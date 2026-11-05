-- Migration: retention policy and nightly anonymize job (spec L4, issue #92)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after migration_staffing_board.sql (step 43 in docs/database.md). Needs the audit
-- trigger (migration_audit_log.sql), sessions, season_settings, interest_signups, incidents,
-- roll_call_marks, authorized_pickups, release_consents, volunteer applications and notes.
-- On the demo project, re-apply migration_demo_environment.sql after this file so
-- private.reset_demo() keeps app_settings.retention_live = 'false' and clears report rows.
--
-- The job ships in dry-run. private.apply_retention(p_dry_run) changes family data only when
-- p_dry_run is false. pg_cron passes false only when app_settings.retention_live is 'true'.
-- A dry run writes retention_runs / retention_run_items and nothing else that lasts
-- (the audit trigger also records those report inserts, with reason retention).
--
-- Anonymize overwrites camper PII and keeps the row, the year, the grade and the class.
-- A row in retention_holds skips that parent's whole family. An unknown date keeps the data.
-- auth.users is never deleted here. See docs/legal/retention-policy.md.
-- The job, hold changes and registration inserts share advisory lock 440092.

-- ── 1. Legal hold, and camper rows survive a parent-account delete ──
-- The hold lives in an admin-owned table, not on the family rows a parent can edit or delete.

CREATE TABLE IF NOT EXISTS retention_holds (
  parent_id  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE RESTRICT,
  set_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  set_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason     TEXT
);
COMMENT ON TABLE retention_holds IS 'Admin-owned legal hold (spec L4). A row pauses retention for that parent and every camper of theirs. Parents cannot write this table.';

ALTER TABLE retention_holds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_read_retention_holds ON retention_holds;
CREATE POLICY admin_read_retention_holds ON retention_holds
  FOR SELECT TO authenticated USING (private.auth_user_role() = 'admin');
REVOKE ALL ON retention_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON retention_holds TO authenticated;

DROP TRIGGER IF EXISTS audit_log_change ON retention_holds;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON retention_holds
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('parent_id');

-- students.parent_id was ON DELETE CASCADE, which would destroy the camper (and the registrations
-- reports are counted from) when the parent profile is removed. Keep the camper; clear the link.
DO $$
DECLARE cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public' AND rel.relname = 'students' AND con.contype = 'f'
    AND con.confrelid = 'public.profiles'::regclass
    AND EXISTS (
      SELECT 1 FROM unnest(con.conkey) AS k
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k
      WHERE a.attname = 'parent_id'
    );
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.students DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_parent_id_fkey;
  ALTER TABLE public.students ALTER COLUMN parent_id DROP NOT NULL;
  ALTER TABLE public.students
    ADD CONSTRAINT students_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
END $$;
COMMENT ON COLUMN students.parent_id IS 'Null after retention removes the parent profile. The camper row stays for year, grade and class reports.';

-- One lock for the job, for every hold write, and for a new registration. Same transaction
-- can take it again. 440092 is fixed so every caller waits on the same key.
CREATE OR REPLACE FUNCTION private.retention_lock()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(440092);
END;
$$;
REVOKE ALL ON FUNCTION private.retention_lock() FROM PUBLIC, anon, authenticated;

-- Direct writes (not only the admin function) take the lock and refuse a non-admin.
-- The SQL editor and cron have no auth.uid() and are trusted. The job itself never writes a hold.
CREATE OR REPLACE FUNCTION private.guard_retention_hold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.retention_lock();
  IF auth.uid() IS NOT NULL AND private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can set a legal hold' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_retention_hold() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS retention_holds_guard ON retention_holds;
CREATE TRIGGER retention_holds_guard
  BEFORE INSERT OR UPDATE OR DELETE ON retention_holds
  FOR EACH ROW EXECUTE FUNCTION private.guard_retention_hold();

-- Flags from the first draft of this migration move onto the table, then the columns go.
-- A parent could delete their own parent_profiles row and take a column flag with it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parent_profiles' AND column_name = 'legal_hold'
  ) THEN
    INSERT INTO retention_holds (parent_id, reason)
    SELECT id, 'legal_hold' FROM parent_profiles WHERE legal_hold
    ON CONFLICT (parent_id) DO NOTHING;
    ALTER TABLE parent_profiles DROP COLUMN legal_hold;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'legal_hold'
  ) THEN
    IF EXISTS (SELECT 1 FROM students WHERE legal_hold AND parent_id IS NULL) THEN
      RAISE EXCEPTION 'Cannot migrate a held camper without a parent; preserve the hold and resolve the family first';
    END IF;
    INSERT INTO retention_holds (parent_id, reason)
    SELECT DISTINCT parent_id, 'legal_hold' FROM students
    WHERE legal_hold AND parent_id IS NOT NULL
    ON CONFLICT (parent_id) DO NOTHING;
    ALTER TABLE students DROP COLUMN legal_hold;
  END IF;
END $$;
DROP TRIGGER IF EXISTS students_guard_legal_hold ON students;
DROP TRIGGER IF EXISTS parent_profiles_guard_legal_hold ON parent_profiles;
DROP FUNCTION IF EXISTS private.guard_legal_hold();

-- Default off. Re-running this file does not turn a live project back to dry-run.
-- The demo reset sets the value to 'false' explicitly.
INSERT INTO app_settings (key, value, updated_at)
VALUES ('retention_live', 'false', now())
ON CONFLICT (key) DO NOTHING;

-- ── 2. Report tables (admin read; the job writes) ────────────

CREATE TABLE IF NOT EXISTS retention_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at   TIMESTAMPTZ,
  dry_run       BOOLEAN NOT NULL,
  live_setting  BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS retention_runs_started_idx ON retention_runs (started_at DESC);
COMMENT ON TABLE retention_runs IS 'One row per nightly retention pass. dry_run means no family data changed (spec L4).';

CREATE TABLE IF NOT EXISTS retention_run_items (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id         UUID NOT NULL REFERENCES retention_runs(id) ON DELETE CASCADE,
  rule           TEXT NOT NULL CHECK (char_length(rule) BETWEEN 1 AND 80),
  subject_count  INT NOT NULL CHECK (subject_count >= 0),
  detail         TEXT,
  subject_ids    TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (run_id, rule)
);
CREATE INDEX IF NOT EXISTS retention_run_items_run_idx ON retention_run_items (run_id);
COMMENT ON TABLE retention_run_items IS 'Counts per retention rule for one run. subject_ids are row ids, not names (spec L4).';

-- Aggregates captured the first time a year is about to be anonymized. No names.
-- Later runs do not refresh a year: the demographic columns are already cleared.
CREATE TABLE IF NOT EXISTS season_totals (
  year         SMALLINT NOT NULL,
  metric       TEXT NOT NULL,
  bucket       TEXT NOT NULL,
  n            INT NOT NULL CHECK (n >= 0),
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (year, metric, bucket)
);
COMMENT ON TABLE season_totals IS 'Aggregate season counts stored before anonymize (spec L4, backlog B17). No personal data.';

ALTER TABLE retention_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_read_retention_runs ON retention_runs;
DROP POLICY IF EXISTS admin_read_retention_run_items ON retention_run_items;
DROP POLICY IF EXISTS admin_read_season_totals ON season_totals;
CREATE POLICY admin_read_retention_runs ON retention_runs
  FOR SELECT TO authenticated USING (private.auth_user_role() = 'admin');
CREATE POLICY admin_read_retention_run_items ON retention_run_items
  FOR SELECT TO authenticated USING (private.auth_user_role() = 'admin');
CREATE POLICY admin_read_season_totals ON season_totals
  FOR SELECT TO authenticated USING (private.auth_user_role() = 'admin');

REVOKE ALL ON retention_runs, retention_run_items, season_totals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON retention_runs, retention_run_items, season_totals TO authenticated;

DROP TRIGGER IF EXISTS audit_log_change ON retention_runs;
DROP TRIGGER IF EXISTS audit_log_change ON retention_run_items;
DROP TRIGGER IF EXISTS audit_log_change ON season_totals;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON retention_runs
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON retention_run_items
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON season_totals
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('year,metric,bucket');

-- ── 3. Clocks ────────────────────────────────────────────────
-- Unknown or ambiguous dates return NULL. Callers treat NULL as "keep the data".
-- The age-21 hold assumes the youngest camp age (4th grade, 9; src/lib/campers.ts YOUNGEST_CAMP_AGE)
-- at the camper's first registration year. Keep through that estimated 21st year,
-- until 1 January after it. A later grade is not used.

CREATE OR REPLACE FUNCTION private.grade_age(p_grade TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(btrim(coalesce(p_grade, '')))
    WHEN '4th' THEN 9
    WHEN '5th' THEN 10
    WHEN '6th' THEN 11
    WHEN '7th' THEN 12
    WHEN '8th' THEN 13
    WHEN '9th' THEN 14
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION private.grade_age(TEXT) FROM PUBLIC, anon, authenticated;

-- Drop the grade-based overload. A changed grade must not shorten the hold.
DROP FUNCTION IF EXISTS private.student_turns_21(UUID);
DROP FUNCTION IF EXISTS private.turns_21(TEXT, INT);

CREATE OR REPLACE FUNCTION private.turns_21(p_first_year INT)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_first_year BETWEEN 1 AND 9986
      THEN make_date(p_first_year - 9 + 21 + 1, 1, 1)
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION private.turns_21(INT) FROM PUBLIC, anon, authenticated;

-- One registration's session end. A both-weeks section (session_id null) uses that
-- registration's year: the latest end date of that year's sessions, else 31 December.
-- Anything we cannot resolve is NULL (keep the row).
CREATE OR REPLACE FUNCTION private.registration_end(p_registration UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN r.id IS NULL OR sec.id IS NULL THEN NULL
    WHEN r.year IS NULL OR r.year < 1 OR r.year > 9999 THEN NULL
    WHEN sec.session_id IS NOT NULL THEN CASE
      WHEN se.year = r.year AND se.end_date >= se.start_date THEN se.end_date
      ELSE NULL
    END
    WHEN sec.week IS NOT NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM sessions s WHERE s.year = r.year
        AND (s.end_date IS NULL OR s.start_date IS NULL OR s.end_date < s.start_date)
    ) THEN NULL
    ELSE coalesce(
      (SELECT max(s.end_date) FROM sessions s WHERE s.year = r.year),
      make_date(r.year::int, 12, 31)
    )
  END
  FROM (SELECT p_registration AS id) x
  LEFT JOIN registrations r ON r.id = x.id
  LEFT JOIN sections sec ON sec.id = r.section_id
  LEFT JOIN sessions se ON se.id = sec.session_id
$$;
REVOKE ALL ON FUNCTION private.registration_end(UUID) FROM PUBLIC, anon, authenticated;

-- Latest resolved session end. NULL when the camper has no registration, or when any
-- registration's date cannot be resolved (one unknown date keeps the whole camper).
CREATE OR REPLACE FUNCTION private.student_last_session_end(p_student UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT CASE
    WHEN count(*) = 0 THEN NULL
    WHEN bool_or(private.registration_end(r.id) IS NULL) THEN NULL
    ELSE max(private.registration_end(r.id))
  END
  FROM registrations r
  WHERE r.student_id = p_student
$$;
REVOKE ALL ON FUNCTION private.student_last_session_end(UUID) FROM PUBLIC, anon, authenticated;

-- NULL when any of this parent's campers has no registrations or a date we cannot
-- resolve. Callers skip the family.
CREATE OR REPLACE FUNCTION private.parent_retention_end(p_parent UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT CASE
    WHEN bool_or(private.student_last_session_end(s.id) IS NULL) THEN NULL
    ELSE max(private.student_last_session_end(s.id))
  END
  FROM students s
  WHERE s.parent_id = p_parent
$$;
REVOKE ALL ON FUNCTION private.parent_retention_end(UUID) FROM PUBLIC, anon, authenticated;

-- First registration year. A null year on any registration makes the year unknown.
-- No registrations, invalid years, or any undated registration → NULL (keep the records).
-- students.registration_year is mutable and is not evidence of a first registration.
CREATE OR REPLACE FUNCTION private.student_first_year(p_student UUID)
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM registrations r WHERE r.student_id = p_student
        AND (r.year IS NULL OR r.year < 1 OR r.year > 9999)
    ) THEN NULL
    ELSE (SELECT min(r.year)::int FROM registrations r WHERE r.student_id = p_student)
  END
$$;
REVOKE ALL ON FUNCTION private.student_first_year(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.student_turns_21(p_student UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT private.turns_21(private.student_first_year(p_student))
$$;
REVOKE ALL ON FUNCTION private.student_turns_21(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.student_is_held(p_student UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    JOIN retention_holds h ON h.parent_id = s.parent_id
    WHERE s.id = p_student
  )
$$;
REVOKE ALL ON FUNCTION private.student_is_held(UUID) FROM PUBLIC, anon, authenticated;

-- True when this camper, or a sibling under the same parent, has a registration whose
-- session date cannot be resolved. The whole family is then left alone.
CREATE OR REPLACE FUNCTION private.family_has_unresolved(p_student UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM students sib
    JOIN registrations r ON r.student_id = sib.id
    WHERE private.registration_end(r.id) IS NULL
      AND (
        sib.id = p_student
        OR (
          sib.parent_id IS NOT NULL
          AND sib.parent_id = (SELECT s.parent_id FROM students s WHERE s.id = p_student)
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.family_has_unresolved(UUID) FROM PUBLIC, anon, authenticated;

-- A recordless camper may still be deleted by their parent. Once there is age-21
-- evidence, an unknown clock (including an unresolved family date) means keep.
-- The later consents table is optional, just as it is in the retention job.
CREATE OR REPLACE FUNCTION private.student_has_protected_records(p_student UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, private
AS $$
DECLARE
  has_records BOOLEAN;
  has_consents BOOLEAN := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student) THEN RETURN true; END IF;
  SELECT EXISTS (
    SELECT 1 FROM students s WHERE s.id = p_student
      AND (s.waiver_signature IS NOT NULL OR s.guardian_signature IS NOT NULL OR s.waiver_signed_at IS NOT NULL)
  ) OR EXISTS (SELECT 1 FROM registrations WHERE student_id = p_student)
    OR EXISTS (SELECT 1 FROM roll_call_marks WHERE student_id = p_student)
    OR EXISTS (SELECT 1 FROM incidents WHERE student_id = p_student)
    OR EXISTS (SELECT 1 FROM release_consents WHERE student_id = p_student)
  INTO has_records;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consents' AND column_name = 'student_id'
  ) THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.consents WHERE student_id = $1)'
      INTO has_consents USING p_student;
  END IF;
  RETURN (has_records OR has_consents) AND (
    private.family_has_unresolved(p_student)
    OR private.student_turns_21(p_student) IS NULL
    OR private.student_turns_21(p_student) > (now() AT TIME ZONE 'America/Denver')::date
  );
END;
$$;
REVOKE ALL ON FUNCTION private.student_has_protected_records(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.parent_has_protected_records(p_parent UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.parent_id = p_parent AND private.student_has_protected_records(s.id)
  )
$$;
REVOKE ALL ON FUNCTION private.parent_has_protected_records(UUID) FROM PUBLIC, anon, authenticated;

-- Shared profile fields must satisfy the parent clock even after a role change.
-- A parent without a resolved clock is kept; a person with no parent history can
-- follow the volunteer clock alone.
CREATE OR REPLACE FUNCTION private.parent_profile_can_anonymize(p_parent UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM retention_holds WHERE parent_id = p_parent)
    AND CASE WHEN EXISTS (SELECT 1 FROM profiles WHERE id = p_parent AND role = 'parent')
      OR EXISTS (SELECT 1 FROM parent_profiles WHERE id = p_parent)
      OR EXISTS (SELECT 1 FROM students WHERE parent_id = p_parent)
    THEN coalesce(private.parent_retention_end(p_parent) <=
      ((now() AT TIME ZONE 'America/Denver')::date - interval '2 years')::date, false)
    ELSE true END
$$;
REVOKE ALL ON FUNCTION private.parent_profile_can_anonymize(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.guard_student_retention_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.retention_lock();
  -- SQL editor / cron and admins are trusted, as in guard_retention_hold().
  IF auth.uid() IS NULL OR private.auth_user_role() = 'admin' THEN RETURN OLD; END IF;
  IF private.student_is_held(OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete camper: the camper or family is on legal hold. Contact an admin.'
      USING ERRCODE = '42501';
  END IF;
  IF private.student_has_protected_records(OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete camper: records are protected by the age-21 retention hold (or its date is unknown). Contact an admin.'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_student_retention_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS students_guard_retention_delete ON students;
CREATE TRIGGER students_guard_retention_delete
  BEFORE DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION private.guard_student_retention_delete();

-- Take the retention lock BEFORE any row is locked. The row guard above runs after Postgres
-- already holds the camper's row lock, so taking 440092 there could deadlock with a live run
-- that holds 440092 and is waiting for that row. A statement-level BEFORE trigger fires first.
-- Deleting a parent cascades to campers, so profiles and parent_profiles get it too.
CREATE OR REPLACE FUNCTION private.retention_lock_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.retention_lock();
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.retention_lock_before_delete() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['students', 'parent_profiles', 'profiles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a_retention_lock_before_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER a_retention_lock_before_delete BEFORE DELETE ON public.%I
                    FOR EACH STATEMENT EXECUTE FUNCTION private.retention_lock_before_delete()', t);
  END LOOP;
END $$;

-- True while a name, contact, demographic or pickup adult is still on the camper.
-- Waiver signatures are not included: those stay until the 21st birthday.
CREATE OR REPLACE FUNCTION private.camper_has_personal_data(p_student UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = p_student
      AND (
        s.full_name IS DISTINCT FROM 'Former camper'
        OR s.first_name IS DISTINCT FROM 'Former'
        OR s.last_name IS DISTINCT FROM 'camper'
        OR s.email IS NOT NULL
        OR s.school_district IS NOT NULL
        OR s.school_name IS NOT NULL
        OR s.shirt_size IS NOT NULL
        OR s.laptop_available IS NOT NULL
        OR s.ethnic_background IS NOT NULL
        OR s.gender IS NOT NULL
        OR s.parent_name IS NOT NULL
        OR s.parent_phone IS NOT NULL
        OR s.emergency_contact_name IS NOT NULL
        OR s.emergency_contact_phone IS NOT NULL
        OR s.emergency_contact_relation IS NOT NULL
        OR s.allergies IS NOT NULL
        OR s.medical_conditions IS NOT NULL
        OR s.medical_info IS NOT NULL
        OR s.other_info IS NOT NULL
        OR s.free_reduced_lunch IS NOT NULL
        OR s.lunch_provision IS NOT NULL
        OR s.how_heard IS NOT NULL
        OR s.previous_program IS NOT NULL
        OR s.program_last_year IS NOT NULL
        OR s.candy_consent IS NOT NULL
        OR EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = s.id AND r.place_with IS NOT NULL)
        OR EXISTS (SELECT 1 FROM authorized_pickups ap WHERE ap.student_id = s.id)
      )
  )
$$;
REVOKE ALL ON FUNCTION private.camper_has_personal_data(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.camper_has_medical_text(p_student UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = p_student
      AND (s.allergies IS NOT NULL OR s.medical_conditions IS NOT NULL
           OR s.medical_info IS NOT NULL OR s.other_info IS NOT NULL)
  )
$$;
REVOKE ALL ON FUNCTION private.camper_has_medical_text(UUID) FROM PUBLIC, anon, authenticated;

-- Camp year the clocks compare against. No sessions, invalid years or multiple active
-- years are unknown/ambiguous, so the volunteer paths keep the data.
CREATE OR REPLACE FUNCTION private.retention_camp_year()
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN count(DISTINCT year) FILTER (WHERE is_active) > 1 THEN NULL
    WHEN bool_or(year NOT BETWEEN 1 AND 9999) THEN NULL
    ELSE coalesce(max(year) FILTER (WHERE is_active), max(year))::int
  END
  FROM sessions
$$;
REVOKE ALL ON FUNCTION private.retention_camp_year() FROM PUBLIC, anon, authenticated;

-- One row per crew link. resolved is false when the section or duty has no date we can trust
-- (missing session, or a both-weeks section whose registrations do not all carry a year).
CREATE OR REPLACE FUNCTION private.volunteer_crew_dates(p_volunteer UUID)
RETURNS TABLE (resolved BOOLEAN, end_date DATE, season_year INT)
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT
    CASE
      WHEN s.session_id IS NOT NULL THEN se.end_date >= se.start_date AND se.year BETWEEN 1 AND 9999
      WHEN s.week IS NOT NULL THEN FALSE
      WHEN EXISTS (SELECT 1 FROM registrations r WHERE r.section_id = s.id AND private.registration_end(r.id) IS NULL) THEN FALSE
      WHEN NOT EXISTS (SELECT 1 FROM registrations r WHERE r.section_id = s.id AND r.year IS NOT NULL) THEN FALSE
      ELSE TRUE
    END,
    CASE
      WHEN s.session_id IS NOT NULL THEN se.end_date
      ELSE (
        SELECT max(private.registration_end(r.id))
        FROM registrations r WHERE r.section_id = s.id
      )
    END,
    CASE
      WHEN s.session_id IS NOT NULL THEN se.year::int
      ELSE (SELECT max(r.year)::int FROM registrations r WHERE r.section_id = s.id AND r.year IS NOT NULL)
    END
  FROM sections s
  LEFT JOIN sessions se ON se.id = s.session_id
  WHERE s.lead_id = p_volunteer
  UNION ALL
  SELECT
    CASE
      WHEN s.session_id IS NOT NULL THEN se.end_date >= se.start_date AND se.year BETWEEN 1 AND 9999
      WHEN s.week IS NOT NULL THEN FALSE
      WHEN EXISTS (SELECT 1 FROM registrations r WHERE r.section_id = s.id AND private.registration_end(r.id) IS NULL) THEN FALSE
      WHEN NOT EXISTS (SELECT 1 FROM registrations r WHERE r.section_id = s.id AND r.year IS NOT NULL) THEN FALSE
      ELSE TRUE
    END,
    CASE
      WHEN s.session_id IS NOT NULL THEN se.end_date
      ELSE (SELECT max(private.registration_end(r.id)) FROM registrations r WHERE r.section_id = s.id)
    END,
    CASE
      WHEN s.session_id IS NOT NULL THEN se.year::int
      ELSE (SELECT max(r.year)::int FROM registrations r WHERE r.section_id = s.id AND r.year IS NOT NULL)
    END
  FROM section_supports ss
  JOIN sections s ON s.id = ss.section_id
  LEFT JOIN sessions se ON se.id = s.session_id
  WHERE ss.volunteer_id = p_volunteer
  UNION ALL
  SELECT coalesce(se.end_date >= se.start_date AND se.year BETWEEN 1 AND 9999, false), se.end_date, se.year::int
  FROM duty_assignments da
  JOIN duty_slots ds ON ds.id = da.duty_slot_id
  LEFT JOIN sessions se ON se.id = ds.session_id
  WHERE da.volunteer_id = p_volunteer
  UNION ALL
  SELECT coalesce(se.end_date >= se.start_date AND se.year BETWEEN 1 AND 9999, false), se.end_date, se.year::int
  FROM week_roles wr
  LEFT JOIN sessions se ON se.id = wr.session_id
  WHERE wr.volunteer_id = p_volunteer
$$;
REVOKE ALL ON FUNCTION private.volunteer_crew_dates(UUID) FROM PUBLIC, anon, authenticated;

-- Latest crew date we could resolve. Unresolved links are ignored here; volunteer_blocked keeps
-- the person when any link is unresolved, so a missing date is never treated as "long ago".
CREATE OR REPLACE FUNCTION private.volunteer_last_session_end(p_volunteer UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT max(d.end_date) FROM private.volunteer_crew_dates(p_volunteer) d WHERE d.resolved
$$;
REVOKE ALL ON FUNCTION private.volunteer_last_session_end(UUID) FROM PUBLIC, anon, authenticated;

-- Spring and summer applications belong to that summer (15 Aug). From September, the next summer.
CREATE OR REPLACE FUNCTION private.application_season_end(p_created TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_created IS NULL THEN NULL
    WHEN extract(month FROM p_created AT TIME ZONE 'America/Denver') >= 9
      THEN make_date(extract(year FROM p_created AT TIME ZONE 'America/Denver')::int + 1, 8, 15)
    ELSE make_date(extract(year FROM p_created AT TIME ZONE 'America/Denver')::int, 8, 15)
  END
$$;
REVOKE ALL ON FUNCTION private.application_season_end(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

-- Latest of every date we have: crew seasons, acceptance, removal, and every application's
-- submitted date and season end. Null when none of those exist. PostgreSQL GREATEST skips nulls.
CREATE OR REPLACE FUNCTION private.volunteer_retention_end(p_volunteer UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT greatest(
    private.volunteer_last_session_end(p_volunteer),
    (SELECT (v.accepted_at AT TIME ZONE 'America/Denver')::date FROM volunteers v WHERE v.id = p_volunteer),
    (SELECT private.application_season_end(v.accepted_at) FROM volunteers v WHERE v.id = p_volunteer),
    (SELECT (v.removed_at AT TIME ZONE 'America/Denver')::date FROM volunteers v WHERE v.id = p_volunteer),
    (SELECT max((a.created_at AT TIME ZONE 'America/Denver')::date)
       FROM volunteer_applications a WHERE a.user_id = p_volunteer),
    (SELECT max(private.application_season_end(a.created_at))
       FROM volunteer_applications a WHERE a.user_id = p_volunteer)
  )
$$;
REVOKE ALL ON FUNCTION private.volunteer_retention_end(UUID) FROM PUBLIC, anon, authenticated;

-- True when this person must be left alone: no camp year to judge, an undated crew link,
-- an application or acceptance in the current or previous season (or one we cannot date),
-- or a clock that has not reached two years. A null clock also keeps them.
CREATE OR REPLACE FUNCTION private.volunteer_blocked(p_volunteer UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT private.retention_camp_year() IS NULL
    OR EXISTS (SELECT 1 FROM private.volunteer_crew_dates(p_volunteer) d WHERE d.resolved IS NOT TRUE)
    OR EXISTS (
      SELECT 1 FROM private.volunteer_crew_dates(p_volunteer) d
      WHERE d.resolved AND d.season_year >= private.retention_camp_year() - 1
    )
    OR EXISTS (
      SELECT 1 FROM volunteer_applications a
      WHERE a.user_id = p_volunteer
        AND (
          a.created_at IS NULL
          OR private.application_season_end(a.created_at) IS NULL
          OR extract(year FROM private.application_season_end(a.created_at))::int >= private.retention_camp_year() - 1
        )
    )
    OR EXISTS (
      SELECT 1 FROM volunteers v
      WHERE v.id = p_volunteer
        AND (
          v.accepted_at IS NULL
          OR private.application_season_end(v.accepted_at) IS NULL
          OR extract(year FROM private.application_season_end(v.accepted_at))::int >= private.retention_camp_year() - 1
        )
    )
    OR private.volunteer_retention_end(p_volunteer) IS NULL
    OR private.volunteer_retention_end(p_volunteer) > ((now() AT TIME ZONE 'America/Denver')::date - interval '2 years')::date
$$;
REVOKE ALL ON FUNCTION private.volunteer_blocked(UUID) FROM PUBLIC, anon, authenticated;

-- Conduct note with no camper. A both-weeks section uses its registrations' years.
-- No resolved date → NULL, and the job keeps the note. occurred_at is not a fallback.
CREATE OR REPLACE FUNCTION private.conduct_end(p_incident UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT CASE
    WHEN sec.id IS NULL THEN NULL
    WHEN sec.session_id IS NOT NULL THEN CASE
      WHEN se.year BETWEEN 1 AND 9999 AND se.end_date >= se.start_date THEN se.end_date
      ELSE NULL
    END
    WHEN sec.week IS NOT NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM registrations r WHERE r.section_id = sec.id AND private.registration_end(r.id) IS NULL) THEN NULL
    WHEN NOT EXISTS (SELECT 1 FROM registrations r WHERE r.section_id = sec.id AND r.year IS NOT NULL) THEN NULL
    ELSE (
      SELECT max(private.registration_end(r.id))
      FROM registrations r WHERE r.section_id = sec.id
    )
  END
  FROM incidents i
  LEFT JOIN sections sec ON sec.id = i.section_id
  LEFT JOIN sessions se ON se.id = sec.session_id
  WHERE i.id = p_incident
$$;
REVOKE ALL ON FUNCTION private.conduct_end(UUID) FROM PUBLIC, anon, authenticated;

-- Audit rows that name these campers, on every audited table that has a student_id column,
-- plus the camper's own students rows. change_requests is included because it is audited and
-- stores student_id. Tables without an audit trigger are not listed. EVERY old/new
-- reference must be eligible; a reassignment must never delete another camper's trail.
CREATE OR REPLACE FUNCTION private.camper_audit_ids(p_students UUID[])
RETURNS SETOF BIGINT
LANGUAGE sql
STABLE
SET search_path = public, private, audit
AS $$
  WITH eligible AS (
    SELECT s.id::text AS id FROM students s
    WHERE s.id = ANY(coalesce(p_students, '{}'))
      AND NOT private.student_is_held(s.id)
      AND NOT private.family_has_unresolved(s.id)
      AND private.student_turns_21(s.id) <= (now() AT TIME ZONE 'America/Denver')::date
  )
  SELECT l.id
  FROM audit.log l
  CROSS JOIN LATERAL (
    SELECT array_remove(CASE WHEN l.table_name = 'students'
      THEN ARRAY[l.row_id, l.old->>'id', l.new->>'id']
      ELSE ARRAY[l.old->>'student_id', l.new->>'student_id'] END, NULL) AS ids
  ) refs
  WHERE ((
      l.table_name = 'students'
      AND l.row_id IN (SELECT id FROM eligible)
    )
    OR (
      l.table_name IN (
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'student_id' AND NOT a.attisdropped
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND EXISTS (
            SELECT 1 FROM pg_trigger tg
            JOIN pg_proc p ON p.oid = tg.tgfoid
            WHERE tg.tgrelid = c.oid AND NOT tg.tgisinternal AND p.oid = 'audit.log_change()'::regprocedure
          )
      )
    )
  )
    -- A present snapshot must explicitly say which camper it references (or null).
    -- Missing keys / malformed snapshots are unknown, rather than an absent camper.
    AND (l.old IS NULL OR (jsonb_typeof(l.old) = 'object'
      AND l.old ? CASE WHEN l.table_name = 'students' THEN 'id' ELSE 'student_id' END))
    AND (l.new IS NULL OR (jsonb_typeof(l.new) = 'object'
      AND l.new ? CASE WHEN l.table_name = 'students' THEN 'id' ELSE 'student_id' END))
    AND cardinality(refs.ids) > 0
    AND NOT EXISTS (
      SELECT 1 FROM unnest(refs.ids) ref(id)
      WHERE NOT EXISTS (SELECT 1 FROM eligible e WHERE e.id = ref.id)
    )
$$;
REVOKE ALL ON FUNCTION private.camper_audit_ids(UUID[]) FROM PUBLIC, anon, authenticated;

-- ── 4. The job ───────────────────────────────────────────────
-- p_dry_run false is the only live pass. Cron passes false only when retention_live is 'true'.
-- Tests call private.apply_retention(false) to force a live pass without flipping the setting.

CREATE OR REPLACE FUNCTION private.apply_retention(p_dry_run BOOLEAN DEFAULT true)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, audit
AS $ret$
DECLARE
  today     DATE := (now() AT TIME ZONE 'America/Denver')::date;
  dry       BOOLEAN := p_dry_run IS DISTINCT FROM false;
  live_on   BOOLEAN;
  run_id    UUID;
  snap_n    INT;
  cutoff_2y DATE := (today - interval '2 years')::date;
  cutoff_1y DATE := (today - interval '1 year')::date;
  sid       UUID;
  pid       UUID;
BEGIN
  -- Serialize with hold changes and new registrations before any eligibility read.
  PERFORM private.retention_lock();

  SELECT coalesce(lower(btrim(value)) = 'true', false) INTO live_on
  FROM app_settings WHERE key = 'retention_live';
  live_on := coalesce(live_on, false);

  PERFORM private.set_reason('retention');

  DROP TABLE IF EXISTS
    _ret_held_parent, _ret_held_student, _ret_skip,
    _ret_anon_raw, _ret_anon, _ret_med_raw, _ret_med,
    _ret_age_raw, _ret_age21, _ret_waiver, _ret_roll, _ret_camper_inc, _ret_consent,
    _ret_pickup, _ret_place, _ret_parent_due, _ret_parent_delete, _ret_parent_rename, _ret_parent_contact, _ret_parent_contact_clear,
    _ret_app_raw, _ret_app, _ret_vol, _ret_note, _ret_conduct, _ret_interest,
    _ret_years, _ret_snap, _ret_audit, _ret_interest_audit;

  CREATE TEMP TABLE _ret_held_parent (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_held_student (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_skip (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_anon_raw (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_anon (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_med_raw (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_med (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_age_raw (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_age21 (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_waiver (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_roll (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_camper_inc (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_consent (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_pickup (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_place (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_parent_due (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_parent_delete (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_parent_rename (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_parent_contact (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_parent_contact_clear (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_app_raw (id UUID PRIMARY KEY, user_id UUID);
  CREATE TEMP TABLE _ret_app (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_vol (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_note (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_conduct (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_interest (id UUID PRIMARY KEY);
  CREATE TEMP TABLE _ret_years (year SMALLINT PRIMARY KEY);
  CREATE TEMP TABLE _ret_snap (
    year SMALLINT, metric TEXT, bucket TEXT, n INT,
    PRIMARY KEY (year, metric, bucket)
  );
  CREATE TEMP TABLE _ret_audit (id BIGINT PRIMARY KEY);
  CREATE TEMP TABLE _ret_interest_audit (id BIGINT PRIMARY KEY);

  INSERT INTO _ret_held_parent
  SELECT parent_id FROM retention_holds;

  INSERT INTO _ret_held_student
  SELECT s.id FROM students s JOIN _ret_held_parent h ON h.id = s.parent_id;

  -- Campers: medical text, anonymize, age-21 records.
  INSERT INTO _ret_med_raw
  SELECT s.id FROM students s
  WHERE private.student_last_session_end(s.id) <= today - 90
    AND NOT private.family_has_unresolved(s.id)
    AND private.camper_has_medical_text(s.id);
  INSERT INTO _ret_med
  SELECT id FROM _ret_med_raw r
  WHERE NOT EXISTS (SELECT 1 FROM _ret_held_student h WHERE h.id = r.id);
  INSERT INTO _ret_skip
  SELECT coalesce(s.parent_id, s.id)
  FROM students s JOIN _ret_med_raw r ON r.id = s.id
  WHERE EXISTS (SELECT 1 FROM _ret_held_student h WHERE h.id = s.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO _ret_anon_raw
  SELECT s.id FROM students s
  WHERE private.student_last_session_end(s.id) <= cutoff_2y
    AND NOT private.family_has_unresolved(s.id)
    AND private.camper_has_personal_data(s.id);
  INSERT INTO _ret_anon
  SELECT id FROM _ret_anon_raw r
  WHERE NOT EXISTS (SELECT 1 FROM _ret_held_student h WHERE h.id = r.id);
  INSERT INTO _ret_skip
  SELECT coalesce(s.parent_id, s.id)
  FROM students s JOIN _ret_anon_raw r ON r.id = s.id
  WHERE EXISTS (SELECT 1 FROM _ret_held_student h WHERE h.id = s.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO _ret_age_raw
  SELECT s.id FROM students s
  WHERE NOT private.family_has_unresolved(s.id)
    AND private.student_turns_21(s.id) IS NOT NULL
    AND private.student_turns_21(s.id) <= today;
  INSERT INTO _ret_age21
  SELECT id FROM _ret_age_raw r
  WHERE NOT EXISTS (SELECT 1 FROM _ret_held_student h WHERE h.id = r.id);
  INSERT INTO _ret_skip
  SELECT coalesce(s.parent_id, s.id)
  FROM students s JOIN _ret_age_raw r ON r.id = s.id
  WHERE EXISTS (SELECT 1 FROM _ret_held_student h WHERE h.id = s.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO _ret_waiver
  SELECT s.id FROM students s JOIN _ret_age21 a ON a.id = s.id
  WHERE s.waiver_signature IS NOT NULL OR s.guardian_signature IS NOT NULL OR s.waiver_signed_at IS NOT NULL;
  INSERT INTO _ret_roll
  SELECT m.id FROM roll_call_marks m JOIN _ret_age21 a ON a.id = m.student_id;
  INSERT INTO _ret_camper_inc
  SELECT i.id FROM incidents i JOIN _ret_age21 a ON a.id = i.student_id;
  INSERT INTO _ret_consent
  SELECT c.id FROM release_consents c JOIN _ret_age21 a ON a.id = c.student_id;
  INSERT INTO _ret_pickup
  SELECT ap.id FROM authorized_pickups ap JOIN _ret_anon a ON a.id = ap.student_id;
  INSERT INTO _ret_place
  SELECT r.id FROM registrations r JOIN _ret_anon a ON a.id = r.student_id
  WHERE r.place_with IS NOT NULL;

  -- Parents: two years after their last camper's session. An undated registration skips the family.
  INSERT INTO _ret_parent_due
  SELECT p.id
  FROM profiles p
  WHERE p.role = 'parent'
    AND NOT EXISTS (SELECT 1 FROM _ret_held_parent h WHERE h.id = p.id)
    AND private.parent_retention_end(p.id) IS NOT NULL
    AND private.parent_retention_end(p.id) <= cutoff_2y
    AND NOT (
      (EXISTS (SELECT 1 FROM volunteers v WHERE v.id = p.id)
       OR EXISTS (SELECT 1 FROM volunteer_applications a WHERE a.user_id = p.id))
      AND private.volunteer_blocked(p.id)
    );
  INSERT INTO _ret_skip
  SELECT p.id
  FROM profiles p
  WHERE p.role = 'parent'
    AND EXISTS (SELECT 1 FROM _ret_held_parent h WHERE h.id = p.id)
    AND private.parent_retention_end(p.id) IS NOT NULL
    AND private.parent_retention_end(p.id) <= cutoff_2y
  ON CONFLICT DO NOTHING;

  -- Keep the family id while any camper has age-21 records. Otherwise a later hold
  -- would have no parent to attach to. Other cascading references also keep the profile.
  INSERT INTO _ret_parent_delete
  SELECT d.id FROM _ret_parent_due d
  WHERE NOT EXISTS (SELECT 1 FROM volunteers v WHERE v.id = d.id)
    AND NOT EXISTS (SELECT 1 FROM updates u WHERE u.author_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM volunteer_applications a WHERE a.user_id = d.id)
    AND NOT private.parent_has_protected_records(d.id);
  INSERT INTO _ret_parent_rename
  SELECT d.id FROM _ret_parent_due d
  WHERE NOT EXISTS (SELECT 1 FROM _ret_parent_delete x WHERE x.id = d.id);
  IF to_regclass('private.demo_keep_users') IS NOT NULL THEN
    EXECUTE 'DELETE FROM _ret_parent_delete d WHERE EXISTS (SELECT 1 FROM private.demo_keep_users k WHERE k.id = d.id)';
    EXECUTE 'DELETE FROM _ret_parent_rename d WHERE EXISTS (SELECT 1 FROM private.demo_keep_users k WHERE k.id = d.id)';
    EXECUTE 'DELETE FROM _ret_parent_due d WHERE EXISTS (SELECT 1 FROM private.demo_keep_users k WHERE k.id = d.id)';
  END IF;
  INSERT INTO _ret_parent_contact
  SELECT pp.id FROM parent_profiles pp JOIN _ret_parent_due d ON d.id = pp.id
  WHERE NOT private.parent_has_protected_records(pp.id);
  INSERT INTO _ret_parent_contact_clear
  SELECT pp.id FROM parent_profiles pp JOIN _ret_parent_due d ON d.id = pp.id
  WHERE private.parent_has_protected_records(pp.id)
    AND (pp.email IS NOT NULL OR pp.phone IS NOT NULL OR pp.emergency_contact_name IS NOT NULL
      OR pp.emergency_contact_phone IS NOT NULL OR pp.emergency_contact_relation IS NOT NULL);

  -- Volunteer applications. Pending ones are left for a person to decide.
  -- A missing date, or a season that is this year or last year, keeps the row.
  INSERT INTO _ret_app_raw (id, user_id)
  SELECT a.id, a.user_id
  FROM volunteer_applications a
  WHERE private.retention_camp_year() IS NOT NULL
    AND ((
      a.status = 'rejected'
      AND a.created_at IS NOT NULL
      AND private.application_season_end(a.created_at) IS NOT NULL
      AND extract(year FROM private.application_season_end(a.created_at))::int < private.retention_camp_year() - 1
      AND (a.created_at AT TIME ZONE 'America/Denver')::date <= cutoff_1y
      AND (a.user_id IS NULL OR NOT private.volunteer_blocked(a.user_id))
    ) OR (
      a.status = 'accepted'
      AND (
        (a.user_id IS NOT NULL AND NOT private.volunteer_blocked(a.user_id))
        OR (
          a.user_id IS NULL
          AND a.created_at IS NOT NULL
          AND private.application_season_end(a.created_at) IS NOT NULL
          AND extract(year FROM private.application_season_end(a.created_at))::int < private.retention_camp_year() - 1
          AND greatest(
                (a.created_at AT TIME ZONE 'America/Denver')::date,
                private.application_season_end(a.created_at)
              ) <= cutoff_2y
        )
      )
    ));
  INSERT INTO _ret_app
  SELECT r.id FROM _ret_app_raw r
  WHERE r.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM _ret_held_parent h WHERE h.id = r.user_id);
  INSERT INTO _ret_skip
  SELECT r.user_id FROM _ret_app_raw r
  WHERE r.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM _ret_held_parent h WHERE h.id = r.user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO _ret_vol
  SELECT v.id
  FROM volunteers v
  JOIN profiles p ON p.id = v.id
  WHERE p.role IS DISTINCT FROM 'admin'
    AND NOT EXISTS (SELECT 1 FROM _ret_held_parent h WHERE h.id = v.id)
    AND NOT private.volunteer_blocked(v.id)
    AND (
      v.legal_name IS NOT NULL OR v.preferred_name IS NOT NULL OR v.pronunciation IS NOT NULL
      OR v.bio IS NOT NULL OR v.photo_path IS NOT NULL OR v.photo_guardian_name IS NOT NULL
      OR v.removed_reason IS NOT NULL
      OR (private.parent_profile_can_anonymize(p.id)
        AND p.display_name IS DISTINCT FROM CASE WHEN p.role = 'parent' THEN 'Former parent' ELSE 'Former volunteer' END)
    );
  INSERT INTO _ret_note
  SELECT vn.volunteer_id
  FROM volunteer_notes vn
  JOIN volunteers v ON v.id = vn.volunteer_id
  JOIN profiles p ON p.id = v.id
  WHERE p.role IS DISTINCT FROM 'admin'
    AND NOT EXISTS (SELECT 1 FROM _ret_held_parent h WHERE h.id = v.id)
    AND NOT private.volunteer_blocked(v.id);

  -- Incidents that name no camper: one year after that section's session (Q-F4's default).
  -- No resolved date keeps the note.
  INSERT INTO _ret_conduct
  SELECT i.id
  FROM incidents i
  WHERE i.student_id IS NULL
    AND private.conduct_end(i.id) IS NOT NULL
    AND private.conduct_end(i.id) <= cutoff_1y;

  INSERT INTO _ret_interest
  SELECT i.id
  FROM interest_signups i
  JOIN season_settings ss ON ss.year = i.year
  WHERE ss.registration_opens_at IS NOT NULL
    AND (ss.registration_opens_at AT TIME ZONE 'America/Denver')::date <= today - 60;

  -- A season that already has any totals is left untouched. A new season is captured whole.
  INSERT INTO _ret_years
  SELECT DISTINCT r.year FROM registrations r
  WHERE r.student_id IN (SELECT id FROM _ret_anon)
    AND r.year IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM season_totals t WHERE t.year = r.year);

  INSERT INTO _ret_snap (year, metric, bucket, n)
  SELECT r.year, 'registrations', c.name || ' · ' || r.status::text, count(*)::int
  FROM registrations r
  JOIN sections sec ON sec.id = r.section_id
  JOIN classes c ON c.id = sec.class_id
  WHERE r.year IN (SELECT year FROM _ret_years)
  GROUP BY r.year, c.name, r.status;

  INSERT INTO _ret_snap (year, metric, bucket, n)
  SELECT r.year, 'campers_by_grade', coalesce(nullif(btrim(s.grade), ''), '(none)'), count(DISTINCT s.id)::int
  FROM students s
  JOIN registrations r ON r.student_id = s.id
  WHERE r.year IN (SELECT year FROM _ret_years)
  GROUP BY r.year, coalesce(nullif(btrim(s.grade), ''), '(none)');

  INSERT INTO _ret_snap (year, metric, bucket, n)
  SELECT r.year, 'campers_by_gender', coalesce(nullif(btrim(s.gender), ''), '(not given)'), count(DISTINCT s.id)::int
  FROM students s
  JOIN registrations r ON r.student_id = s.id
  WHERE r.year IN (SELECT year FROM _ret_years)
  GROUP BY r.year, coalesce(nullif(btrim(s.gender), ''), '(not given)');

  INSERT INTO _ret_snap (year, metric, bucket, n)
  SELECT r.year, 'campers_by_lunch',
         CASE WHEN s.lunch_provision IS TRUE THEN 'yes' WHEN s.lunch_provision IS FALSE THEN 'no' ELSE '(not given)' END,
         count(DISTINCT s.id)::int
  FROM students s
  JOIN registrations r ON r.student_id = s.id
  WHERE r.year IN (SELECT year FROM _ret_years)
  GROUP BY r.year, CASE WHEN s.lunch_provision IS TRUE THEN 'yes' WHEN s.lunch_provision IS FALSE THEN 'no' ELSE '(not given)' END;

  INSERT INTO _ret_snap (year, metric, bucket, n)
  SELECT r.year, 'campers_by_how_heard', left(coalesce(nullif(btrim(s.how_heard), ''), '(not given)'), 80),
         count(DISTINCT s.id)::int
  FROM students s
  JOIN registrations r ON r.student_id = s.id
  WHERE r.year IN (SELECT year FROM _ret_years)
  GROUP BY r.year, left(coalesce(nullif(btrim(s.how_heard), ''), '(not given)'), 80);

  INSERT INTO _ret_snap (year, metric, bucket, n)
  SELECT r.year, 'ethnic_background', left(eb, 80), count(DISTINCT s.id)::int
  FROM students s
  JOIN registrations r ON r.student_id = s.id
  CROSS JOIN LATERAL unnest(s.ethnic_background) AS eb
  WHERE r.year IN (SELECT year FROM _ret_years)
  GROUP BY r.year, left(eb, 80);

  SELECT count(*) INTO snap_n FROM _ret_snap;

  IF NOT dry THEN
    -- One insert for every bucket of every new season, before any anonymizing.
    -- Years that already have totals were left out of _ret_years.
    INSERT INTO season_totals (year, metric, bucket, n)
    SELECT year, metric, bucket, n FROM _ret_snap;

    -- Re-read the hold and the clock immediately before each change. A hold taken
    -- after the sets were built (same transaction, or a waiter that ran first) is kept.
    FOR sid IN SELECT id FROM _ret_med ORDER BY id LOOP
      IF private.student_is_held(sid) OR private.family_has_unresolved(sid) THEN CONTINUE; END IF;
      IF private.student_last_session_end(sid) IS NULL
         OR private.student_last_session_end(sid) > today - 90 THEN CONTINUE; END IF;
      IF NOT private.camper_has_medical_text(sid) THEN CONTINUE; END IF;
      UPDATE students SET
        allergies = NULL, medical_conditions = NULL, medical_info = NULL, other_info = NULL
      WHERE id = sid;
    END LOOP;

    FOR sid IN SELECT id FROM _ret_anon ORDER BY id LOOP
      IF private.student_is_held(sid) OR private.family_has_unresolved(sid) THEN CONTINUE; END IF;
      IF private.student_last_session_end(sid) IS NULL
         OR private.student_last_session_end(sid) > cutoff_2y THEN CONTINUE; END IF;
      IF NOT private.camper_has_personal_data(sid) THEN CONTINUE; END IF;
      UPDATE students SET
        full_name = 'Former camper',
        first_name = 'Former',
        last_name = 'camper',
        email = NULL,
        school_district = NULL,
        school_name = NULL,
        shirt_size = NULL,
        laptop_available = NULL,
        ethnic_background = NULL,
        gender = NULL,
        parent_name = NULL,
        parent_phone = NULL,
        emergency_contact_name = NULL,
        emergency_contact_phone = NULL,
        emergency_contact_relation = NULL,
        allergies = NULL,
        medical_conditions = NULL,
        medical_info = NULL,
        other_info = NULL,
        free_reduced_lunch = NULL,
        lunch_provision = NULL,
        how_heard = NULL,
        previous_program = NULL,
        program_last_year = NULL,
        candy_consent = NULL
      WHERE id = sid;
    END LOOP;

    UPDATE registrations r SET place_with = NULL
    WHERE r.id IN (SELECT id FROM _ret_place)
      AND NOT private.student_is_held(r.student_id)
      AND NOT private.family_has_unresolved(r.student_id);
    DELETE FROM authorized_pickups ap
    WHERE ap.id IN (SELECT id FROM _ret_pickup)
      AND NOT private.student_is_held(ap.student_id)
      AND NOT private.family_has_unresolved(ap.student_id);

    FOR pid IN SELECT id FROM _ret_parent_rename ORDER BY id LOOP
      IF EXISTS (SELECT 1 FROM retention_holds h WHERE h.parent_id = pid) THEN CONTINUE; END IF;
      IF private.parent_retention_end(pid) IS NULL
         OR private.parent_retention_end(pid) > cutoff_2y THEN CONTINUE; END IF;
      IF private.parent_has_protected_records(pid) THEN
        UPDATE parent_profiles SET email = NULL, phone = NULL,
          emergency_contact_name = NULL, emergency_contact_phone = NULL, emergency_contact_relation = NULL
        WHERE id = pid;
      ELSE
        DELETE FROM parent_profiles WHERE id = pid;
      END IF;
      UPDATE profiles SET display_name = 'Former parent'
      WHERE id = pid AND display_name IS DISTINCT FROM 'Former parent';
    END LOOP;
    FOR pid IN SELECT id FROM _ret_parent_delete ORDER BY id LOOP
      IF EXISTS (SELECT 1 FROM retention_holds h WHERE h.parent_id = pid) THEN CONTINUE; END IF;
      IF private.parent_retention_end(pid) IS NULL
         OR private.parent_retention_end(pid) > cutoff_2y THEN CONTINUE; END IF;
      IF private.parent_has_protected_records(pid) THEN CONTINUE; END IF;
      DELETE FROM profiles WHERE id = pid;
    END LOOP;

    DELETE FROM volunteer_applications a WHERE id IN (SELECT id FROM _ret_app)
      AND (a.user_id IS NULL OR (
        NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.parent_id = a.user_id)
        AND NOT private.volunteer_blocked(a.user_id)
      ));

    UPDATE volunteers SET
      legal_name = NULL,
      preferred_name = NULL,
      pronunciation = NULL,
      bio = NULL,
      photo_path = NULL,
      photo_guardian_name = NULL,
      removed_reason = NULL
    WHERE id IN (SELECT id FROM _ret_vol)
      AND NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.parent_id = volunteers.id)
      AND NOT private.volunteer_blocked(id);
    UPDATE profiles SET display_name = CASE WHEN role = 'parent' THEN 'Former parent' ELSE 'Former volunteer' END
    WHERE id IN (SELECT id FROM _ret_vol)
      AND NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.parent_id = profiles.id)
      AND NOT private.volunteer_blocked(id)
      AND private.parent_profile_can_anonymize(id)
      AND display_name IS DISTINCT FROM CASE WHEN role = 'parent' THEN 'Former parent' ELSE 'Former volunteer' END;
    DELETE FROM volunteer_notes vn WHERE volunteer_id IN (SELECT id FROM _ret_note)
      AND NOT EXISTS (SELECT 1 FROM retention_holds h WHERE h.parent_id = vn.volunteer_id)
      AND NOT private.volunteer_blocked(vn.volunteer_id);

    DELETE FROM release_consents c
    WHERE c.id IN (SELECT id FROM _ret_consent)
      AND NOT private.student_is_held(c.student_id)
      AND NOT private.family_has_unresolved(c.student_id)
      AND private.student_turns_21(c.student_id) IS NOT NULL
      AND private.student_turns_21(c.student_id) <= today;
    DELETE FROM roll_call_marks m
    WHERE m.id IN (SELECT id FROM _ret_roll)
      AND NOT private.student_is_held(m.student_id)
      AND NOT private.family_has_unresolved(m.student_id)
      AND private.student_turns_21(m.student_id) IS NOT NULL
      AND private.student_turns_21(m.student_id) <= today;
    DELETE FROM incidents i
    WHERE i.id IN (SELECT id FROM _ret_camper_inc)
      AND NOT private.student_is_held(i.student_id)
      AND NOT private.family_has_unresolved(i.student_id)
      AND private.student_turns_21(i.student_id) IS NOT NULL
      AND private.student_turns_21(i.student_id) <= today;
    UPDATE students s SET
      waiver_signature = NULL,
      guardian_signature = NULL,
      waiver_signed_at = NULL
    WHERE s.id IN (SELECT id FROM _ret_waiver)
      AND NOT private.student_is_held(s.id)
      AND NOT private.family_has_unresolved(s.id)
      AND private.student_turns_21(s.id) IS NOT NULL
      AND private.student_turns_21(s.id) <= today;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consents' AND column_name = 'student_id'
    ) THEN
      EXECUTE 'DELETE FROM consents c WHERE c.student_id IN (SELECT id FROM _ret_age21)
        AND NOT private.student_is_held(c.student_id)
        AND NOT private.family_has_unresolved(c.student_id)
        AND private.student_turns_21(c.student_id) <= $1' USING today;
    END IF;

    INSERT INTO _ret_audit
    SELECT private.camper_audit_ids(ARRAY(
      SELECT a.id FROM _ret_age21 a
      WHERE NOT private.student_is_held(a.id)
        AND NOT private.family_has_unresolved(a.id)
        AND private.student_turns_21(a.id) IS NOT NULL
        AND private.student_turns_21(a.id) <= today
    ));
    DELETE FROM audit.log WHERE id IN (SELECT id FROM _ret_audit);

    DELETE FROM incidents WHERE id IN (SELECT id FROM _ret_conduct);

    DELETE FROM interest_signups WHERE id IN (SELECT id FROM _ret_interest);
    INSERT INTO _ret_interest_audit
    SELECT l.id FROM audit.log l
    WHERE l.table_name = 'interest_signups'
      AND l.row_id IN (SELECT id::text FROM _ret_interest);
    DELETE FROM audit.log WHERE id IN (SELECT id FROM _ret_interest_audit);
  ELSE
    INSERT INTO _ret_audit
    SELECT private.camper_audit_ids(ARRAY(SELECT id FROM _ret_age21));
    INSERT INTO _ret_interest_audit
    SELECT l.id FROM audit.log l
    WHERE l.table_name = 'interest_signups'
      AND l.row_id IN (SELECT id::text FROM _ret_interest);
  END IF;

  INSERT INTO retention_runs (started_at, dry_run, live_setting)
  VALUES (clock_timestamp(), dry, live_on)
  RETURNING id INTO run_id;

  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'clear_medical', count(*)::int, 'campers', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_med;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'anonymize_camper', count(*)::int, 'campers', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_anon;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'clear_place_with', count(*)::int, 'registrations', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_place;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_pickup', count(*)::int, 'authorized_pickups', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_pickup;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_parent_contact', count(*)::int, 'parent_profiles', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_parent_contact;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'anonymize_parent_contact', count(*)::int, 'parent_profiles kept for age-21 records', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_parent_contact_clear;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_parent_account', count(*)::int, 'profiles; auth.users is not removed', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_parent_delete;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'anonymize_parent_name', count(*)::int, 'profiles kept because another record points at them', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_parent_rename;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_volunteer_application', count(*)::int, 'applications', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_app;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'clear_volunteer_record', count(*)::int, 'volunteers', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_vol;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_volunteer_notes', count(*)::int, 'volunteer_notes', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_note;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'clear_waiver', count(*)::int, 'campers', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_waiver;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_release_consent', count(*)::int, 'release_consents', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_consent;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_roll_call', count(*)::int, 'roll_call_marks', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_roll;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_camper_incident', count(*)::int, 'incidents', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_camper_inc;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_camper_audit', count(*)::int, 'audit.log rows', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_audit;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_conduct_incident', count(*)::int, 'incidents with no camper', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_conduct;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'delete_interest_signup', count(*)::int, 'interest_signups and their audit rows', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_interest;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'skipped_hold', count(*)::int, 'families', coalesce(array_agg(id::text ORDER BY id::text), '{}') FROM _ret_skip;
  INSERT INTO retention_run_items (run_id, rule, subject_count, detail, subject_ids)
  SELECT run_id, 'season_totals', snap_n, CASE WHEN dry THEN 'not written' ELSE 'written' END,
         coalesce((SELECT array_agg(DISTINCT year::text ORDER BY year::text) FROM _ret_years), '{}');

  UPDATE retention_runs SET finished_at = clock_timestamp() WHERE id = run_id;
  PERFORM private.set_reason(NULL);

  DROP TABLE IF EXISTS
    _ret_held_parent, _ret_held_student, _ret_skip,
    _ret_anon_raw, _ret_anon, _ret_med_raw, _ret_med,
    _ret_age_raw, _ret_age21, _ret_waiver, _ret_roll, _ret_camper_inc, _ret_consent,
    _ret_pickup, _ret_place, _ret_parent_due, _ret_parent_delete, _ret_parent_rename, _ret_parent_contact, _ret_parent_contact_clear,
    _ret_app_raw, _ret_app, _ret_vol, _ret_note, _ret_conduct, _ret_interest,
    _ret_years, _ret_snap, _ret_audit, _ret_interest_audit;

  RETURN run_id;
END;
$ret$;
REVOKE ALL ON FUNCTION private.apply_retention(BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ── 5. Admin: read a family, set or clear its hold ───────────

CREATE OR REPLACE FUNCTION public.admin_search_families(p_query TEXT)
RETURNS TABLE (parent_id UUID, display_name TEXT, email TEXT, on_hold BOOLEAN, campers INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  q TEXT := btrim(coalesce(p_query, ''));
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF char_length(q) < 2 THEN
    RETURN;
  END IF;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  RETURN QUERY
  SELECT p.id, p.display_name, pp.email,
         EXISTS (SELECT 1 FROM retention_holds h WHERE h.parent_id = p.id),
         (SELECT count(*)::int FROM students s WHERE s.parent_id = p.id)
  FROM profiles p
  LEFT JOIN parent_profiles pp ON pp.id = p.id
  WHERE p.role = 'parent'
    AND (p.display_name ILIKE '%' || q || '%' ESCAPE '\'
         OR pp.email ILIKE '%' || q || '%' ESCAPE '\')
  ORDER BY p.display_name, p.id
  LIMIT 20;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_search_families(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_families(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_family_legal_hold(p_parent_id UUID, p_hold BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.retention_lock();
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_parent_id AND role = 'parent') THEN
    RAISE EXCEPTION 'That family does not have a parent account' USING ERRCODE = 'P0002';
  END IF;
  IF p_hold IS NULL THEN
    RAISE EXCEPTION 'Specify whether to set or clear the hold' USING ERRCODE = '22004';
  END IF;
  PERFORM private.set_reason('legal_hold');
  IF p_hold THEN
    INSERT INTO retention_holds (parent_id, set_by, reason)
    VALUES (p_parent_id, auth.uid(), 'legal_hold')
    ON CONFLICT (parent_id) DO UPDATE
      SET set_by = EXCLUDED.set_by, set_at = now(), reason = EXCLUDED.reason;
  ELSE
    DELETE FROM retention_holds WHERE parent_id = p_parent_id;
  END IF;
  PERFORM private.set_reason(NULL);
  RETURN coalesce(p_hold, false);
END;
$$;
REVOKE ALL ON FUNCTION public.set_family_legal_hold(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_family_legal_hold(UUID, BOOLEAN) TO authenticated;

-- A registration write can move a family's clock. The statement trigger takes the lock
-- before row locks and registration checks, including the trusted/admin insert path. The
-- job cannot decide a family is due while this insert is in flight, and this insert waits
-- until a running job commits.
CREATE OR REPLACE FUNCTION private.lock_retention_for_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.retention_lock();
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.lock_retention_for_registration() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lock_retention_on_registration ON registrations;
CREATE TRIGGER lock_retention_on_registration
  BEFORE INSERT OR UPDATE OR DELETE ON registrations
  FOR EACH STATEMENT EXECUTE FUNCTION private.lock_retention_for_registration();

-- ── 6. Nightly, dry-run unless retention_live is on ──────────
-- 08:45 UTC is about 1:45am Denver in winter and 2:45am in summer.
-- Unschedule by name first so re-running this file replaces the command instead of adding a second job.

DO $$
BEGIN
  PERFORM cron.unschedule('apply-retention')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apply-retention');
  PERFORM cron.schedule(
    'apply-retention',
    '45 8 * * *',
    $cron$SELECT private.apply_retention(
      coalesce(lower(btrim((SELECT value FROM public.app_settings WHERE key = 'retention_live'))), 'false') IS DISTINCT FROM 'true'
    )$cron$
  );
END $$;

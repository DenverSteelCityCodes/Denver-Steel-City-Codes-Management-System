-- Migration: authorized pickups and dated walk-home consent at dismissal (spec 36, #156)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: deploy the send-notifications Edge Function BEFORE applying this migration (it must know
-- the pickup_changed template; a sender that doesn't know a template holds the email queued for 6
-- hours instead of failing it). Then apply after migration_camp_week_ops.sql (roll_call_marks),
-- migration_edit_conflicts.sql, migration_audit_log.sql, migration_notifications.sql,
-- migration_admin_mfa.sql and migration_laptop_loans.sql: this file redefines section_roster()
-- (keeping the laptop_loan column), so re-apply it whenever migration_laptop_loans.sql or
-- migration_volunteer_roster_access.sql is re-applied. Then re-apply migration_demo_environment.sql
-- on the demo project (it seeds pickup adults, a walk-home consent and past releases).
--
-- Decided (spec 36): parents list the adults who may pick up each camper; the parent account holder
-- is always allowed. Leaving alone (walk, bike, transit) needs the parent's dated consent for one
-- week: every day of it, or named days. At dismissal the crew records who collected each camper.
-- The database never blocks a release, it records it; but "left on their own" without consent for
-- that day, and an adult who isn't on that day's list, can only be recorded as "an admin said OK".
--   * authorized_pickups: name, relation, phone, and days (NULL = any day; else only those dates,
--     e.g. a grandparent on Wednesday). The spec's table plus `days`: its "Done when" needs a
--     Wednesday-only adult. Parents own their campers' rows; admins see all; crew read them only
--     through section_roster() (today's list; phones for the section's lead only).
--   * release_consents: one per camper per week (session): walk / bike / transit / other, days
--     (NULL = every day of the week; else dates inside it) and a note. Parents can change it until
--     the week ends, so a same-day change still works.
--   * roll_call_marks.released_to / released_mode ('listed_adult', 'parent', 'alone', 'admin_ok')
--     on a present dismissal mark, checked by a trigger whichever way the mark is written.
--   * dismissal_board(): admins, today's dismissal for every section: who is still waiting, who
--     collected whom, and the admin_ok releases.
--   * pickup_changed email (outbox) to the section's lead when a parent changes the list or the
--     consent during camp week in a way that touches a day from today to the end of the week.
-- Both new tables are audited. Ship the frontend AFTER this migration (it reads the new columns).

-- ── 0. Helpers ───────────────────────────────────────────────

-- Does the signed-in parent own this camper? (Definer, so the policies don't chain RLS.)
CREATE OR REPLACE FUNCTION private.auth_parent_has_student(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND parent_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION private.auth_parent_has_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_parent_has_student(UUID) TO authenticated;   -- RLS policies run it as the caller

-- Has this week not ended yet (Denver date)? A consent can change until its last day.
CREATE OR REPLACE FUNCTION private.session_not_over(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id
                    AND end_date >= (now() AT TIME ZONE 'America/Denver')::date);
$$;
REVOKE ALL ON FUNCTION private.session_not_over(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.session_not_over(UUID) TO authenticated;

-- ── 1. Pickup adults ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS authorized_pickups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    relation    TEXT NOT NULL CHECK (length(relation) BETWEEN 1 AND 50),
    phone       TEXT NOT NULL CHECK (length(phone) <= 30 AND length(regexp_replace(phone, '\D', '', 'g')) BETWEEN 7 AND 15),
    days        DATE[] CHECK (days IS NULL OR cardinality(days) BETWEEN 1 AND 31),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS authorized_pickups_student_idx ON authorized_pickups (student_id);
COMMENT ON TABLE authorized_pickups IS 'Adults a parent allows to collect a camper at dismissal (spec 36). days NULL = any day, else only those dates. The parent account holder is always allowed and is not listed here.';

ALTER TABLE authorized_pickups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_pickups"  ON authorized_pickups;
DROP POLICY IF EXISTS "parent_own_pickups" ON authorized_pickups;
CREATE POLICY "admin_all_pickups" ON authorized_pickups FOR ALL TO authenticated
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "parent_own_pickups" ON authorized_pickups FOR ALL TO authenticated
    USING (private.auth_parent_has_student(student_id)) WITH CHECK (private.auth_parent_has_student(student_id));
REVOKE ALL ON authorized_pickups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON authorized_pickups TO authenticated;   -- RLS: parents (own campers) and admins

-- Tidy the words, sort the days, and cap the list.
CREATE OR REPLACE FUNCTION private.authorized_pickups_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  NEW.name := regexp_replace(btrim(NEW.name), '\s+', ' ', 'g');
  NEW.relation := regexp_replace(btrim(NEW.relation), '\s+', ' ', 'g');
  NEW.phone := btrim(NEW.phone);
  IF NEW.days IS NOT NULL THEN
    NEW.days := (SELECT array_agg(DISTINCT d ORDER BY d) FROM unnest(NEW.days) AS d WHERE d IS NOT NULL);
    IF NEW.days IS NULL THEN
      RAISE EXCEPTION 'Pick at least one day, or choose any day' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM authorized_pickups WHERE student_id = NEW.student_id) >= 10 THEN
    RAISE EXCEPTION 'A camper can have up to 10 pickup adults. Remove one first.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.authorized_pickups_check() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS authorized_pickups_check ON authorized_pickups;
CREATE TRIGGER authorized_pickups_check BEFORE INSERT OR UPDATE ON authorized_pickups
    FOR EACH ROW EXECUTE FUNCTION private.authorized_pickups_check();
DROP TRIGGER IF EXISTS touch_updated_at ON authorized_pickups;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON authorized_pickups
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
DROP TRIGGER IF EXISTS audit_log_change ON authorized_pickups;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON authorized_pickups
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');

-- ── 2. Dated walk-home consent ───────────────────────────────

CREATE TABLE IF NOT EXISTS release_consents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    mode          TEXT NOT NULL CHECK (mode IN ('walk', 'bike', 'transit', 'other')),
    days          DATE[] CHECK (days IS NULL OR cardinality(days) BETWEEN 1 AND 31),
    note          TEXT CHECK (note IS NULL OR length(note) <= 300),
    consented_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    consented_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, session_id)
);
COMMENT ON TABLE release_consents IS 'A parent''s dated consent for a camper to leave camp on their own in one week (spec 36). days NULL = every day of that week.';

ALTER TABLE release_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_release_consents"    ON release_consents;
DROP POLICY IF EXISTS "parent_read_release_consents"  ON release_consents;
DROP POLICY IF EXISTS "parent_write_release_consents" ON release_consents;
DROP POLICY IF EXISTS "parent_edit_release_consents"  ON release_consents;
DROP POLICY IF EXISTS "parent_drop_release_consents"  ON release_consents;
CREATE POLICY "admin_all_release_consents" ON release_consents FOR ALL TO authenticated
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "parent_read_release_consents" ON release_consents FOR SELECT TO authenticated
    USING (private.auth_parent_has_student(student_id));
-- Changes only until the week ends (Denver date).
CREATE POLICY "parent_write_release_consents" ON release_consents FOR INSERT TO authenticated
    WITH CHECK (private.auth_parent_has_student(student_id) AND private.session_not_over(session_id));
CREATE POLICY "parent_edit_release_consents" ON release_consents FOR UPDATE TO authenticated
    USING (private.auth_parent_has_student(student_id) AND private.session_not_over(session_id))
    WITH CHECK (private.auth_parent_has_student(student_id) AND private.session_not_over(session_id));
CREATE POLICY "parent_drop_release_consents" ON release_consents FOR DELETE TO authenticated
    USING (private.auth_parent_has_student(student_id) AND private.session_not_over(session_id));
REVOKE ALL ON release_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON release_consents TO authenticated;   -- RLS: parents (own campers) and admins

-- Days inside the week, sorted; who consented and when, stamped by the server.
CREATE OR REPLACE FUNCTION private.release_consents_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  se sessions%ROWTYPE;
BEGIN
  SELECT * INTO se FROM sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That camp week doesn''t exist' USING ERRCODE = 'P0001'; END IF;
  NEW.note := nullif(regexp_replace(btrim(coalesce(NEW.note, '')), '\s+', ' ', 'g'), '');
  IF NEW.days IS NOT NULL THEN
    NEW.days := (SELECT array_agg(DISTINCT d ORDER BY d) FROM unnest(NEW.days) AS d WHERE d IS NOT NULL);
    IF NEW.days IS NULL THEN
      RAISE EXCEPTION 'Pick at least one day, or choose every day of %', se.name USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(NEW.days) AS d WHERE d NOT BETWEEN se.start_date AND se.end_date) THEN
      RAISE EXCEPTION 'Pick days during % (% to %)', se.name,
        to_char(se.start_date, 'FMMonth FMDD'), to_char(se.end_date, 'FMMonth FMDD') USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.mode IS DISTINCT FROM OLD.mode OR NEW.days IS DISTINCT FROM OLD.days
     OR NEW.note IS DISTINCT FROM OLD.note OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    NEW.consented_by := coalesce(auth.uid(), NEW.consented_by);
    NEW.consented_at := now();
  ELSE
    NEW.consented_by := OLD.consented_by;
    NEW.consented_at := OLD.consented_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.release_consents_check() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS release_consents_check ON release_consents;
CREATE TRIGGER release_consents_check BEFORE INSERT OR UPDATE ON release_consents
    FOR EACH ROW EXECUTE FUNCTION private.release_consents_check();
DROP TRIGGER IF EXISTS audit_log_change ON release_consents;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON release_consents
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');

-- ── 3. Who is allowed on a given day ─────────────────────────

-- The camper's pickup list for one day: any-day adults and the ones dated that day (dated first).
-- Phones only when asked (the section's lead and admins).
CREATE OR REPLACE FUNCTION private.pickups_on(p_student_id UUID, p_day DATE, p_with_phone BOOLEAN)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'name', ap.name, 'relation', ap.relation,
           'phone', CASE WHEN p_with_phone THEN ap.phone END,
           'days', ap.days)
         ORDER BY ap.days IS NULL, lower(ap.name)), '[]'::jsonb)
    FROM authorized_pickups ap
   WHERE ap.student_id = p_student_id AND (ap.days IS NULL OR p_day = ANY (ap.days));
$$;
REVOKE ALL ON FUNCTION private.pickups_on(UUID, DATE, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- The consent that lets a camper leave on their own from this section on this day: the parent's
-- consent for the week running that day (the section's own week; any week for a both-weeks
-- section), covering the day. NULL when there is none.
CREATE OR REPLACE FUNCTION private.leave_alone_on(p_student_id UUID, p_section_id UUID, p_day DATE)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('mode', rc.mode, 'note', rc.note)
    FROM release_consents rc
    JOIN sessions se ON se.id = rc.session_id
    JOIN sections s ON s.id = p_section_id
   WHERE rc.student_id = p_student_id
     AND p_day BETWEEN se.start_date AND se.end_date
     AND (s.session_id IS NULL OR s.session_id = rc.session_id)
     AND (rc.days IS NULL OR p_day = ANY (rc.days))
   ORDER BY se.start_date
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.leave_alone_on(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;

-- ── 4. Dismissal: who collected each camper ──────────────────

ALTER TABLE roll_call_marks ADD COLUMN IF NOT EXISTS released_to   TEXT;
ALTER TABLE roll_call_marks ADD COLUMN IF NOT EXISTS released_mode TEXT;
ALTER TABLE roll_call_marks DROP CONSTRAINT IF EXISTS roll_call_marks_released_mode_check;
ALTER TABLE roll_call_marks ADD CONSTRAINT roll_call_marks_released_mode_check
    CHECK (released_mode IN ('listed_adult', 'parent', 'alone', 'admin_ok'));
ALTER TABLE roll_call_marks DROP CONSTRAINT IF EXISTS roll_call_marks_release_shape;
ALTER TABLE roll_call_marks ADD CONSTRAINT roll_call_marks_release_shape CHECK (
    (released_mode IS NULL AND released_to IS NULL)
    OR (released_mode IS NOT NULL AND roll_call = 'dismissal' AND present AND length(released_to) BETWEEN 1 AND 100));
COMMENT ON COLUMN roll_call_marks.released_to IS 'Dismissal only (spec 36): who collected the camper, e.g. the parent''s or a listed adult''s name, or "On their own (walk)".';
COMMENT ON COLUMN roll_call_marks.released_mode IS 'Dismissal only (spec 36): listed_adult, parent, alone (needs the day''s consent) or admin_ok (anyone else, after checking with an admin).';

-- Checks a release however the mark is written (the crew's upsert, an admin, a script):
--   * only a present dismissal mark carries one; marking the camper absent clears it;
--   * 'parent': the camper's parent (the name is filled in here);
--   * 'listed_adult': must be on the camper's pickup list for that day (stored with the listed name);
--   * 'alone': needs the parent's consent covering that day ("On their own (walk)" is filled in);
--   * 'admin_ok': anyone else, named, after the crew checked with an admin.
-- The note column (spec 34's roll-call notes) is left alone: writing only the note doesn't fire this.
CREATE OR REPLACE FUNCTION private.roll_call_release_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  who  TEXT;
  lone JSONB;
BEGIN
  NEW.released_to := nullif(regexp_replace(btrim(coalesce(NEW.released_to, '')), '\s+', ' ', 'g'), '');
  IF NEW.roll_call <> 'dismissal' OR NOT NEW.present OR NEW.released_mode IS NULL THEN
    NEW.released_to := NULL;
    NEW.released_mode := NULL;
    RETURN NEW;
  END IF;
  -- The same release on the same camper-day (a re-save of "present") passes as it is.
  IF TG_OP = 'UPDATE' AND NEW.released_mode IS NOT DISTINCT FROM OLD.released_mode
     AND NEW.released_to IS NOT DISTINCT FROM OLD.released_to
     AND NEW.student_id = OLD.student_id AND NEW.section_id = OLD.section_id AND NEW.day = OLD.day THEN
    RETURN NEW;
  END IF;

  IF NEW.released_mode = 'parent' THEN
    SELECT coalesce(nullif(btrim(st.parent_name), ''), nullif(btrim(p.display_name), ''), 'Parent')
      INTO NEW.released_to
      FROM students st LEFT JOIN profiles p ON p.id = st.parent_id
     WHERE st.id = NEW.student_id;
  ELSIF NEW.released_mode = 'listed_adult' THEN
    SELECT ap.name INTO who FROM authorized_pickups ap
     WHERE ap.student_id = NEW.student_id AND lower(ap.name) = lower(NEW.released_to)
       AND (ap.days IS NULL OR NEW.day = ANY (ap.days))
     ORDER BY ap.days IS NULL
     LIMIT 1;
    IF who IS NULL THEN
      RAISE EXCEPTION '% isn''t on this camper''s pickup list for that day. Check with an admin first.',
        coalesce(NEW.released_to, 'That adult') USING ERRCODE = 'P0001';
    END IF;
    NEW.released_to := who;
  ELSIF NEW.released_mode = 'alone' THEN
    lone := private.leave_alone_on(NEW.student_id, NEW.section_id, NEW.day);
    IF lone IS NULL THEN
      RAISE EXCEPTION 'This camper has no consent from their parent to leave on their own that day. Check with an admin first.'
        USING ERRCODE = 'P0001';
    END IF;
    NEW.released_to := 'On their own (' || (lone ->> 'mode') || ')';
  ELSIF NEW.released_to IS NULL THEN   -- admin_ok
    RAISE EXCEPTION 'Say who collected the camper' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.roll_call_release_check() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS roll_call_release_check ON roll_call_marks;
CREATE TRIGGER roll_call_release_check
    BEFORE INSERT OR UPDATE OF present, roll_call, day, student_id, section_id, released_to, released_mode ON roll_call_marks
    FOR EACH ROW EXECUTE FUNCTION private.roll_call_release_check();

-- ── 5. The crew's roster: today's pickup list and walk-home consent ──
-- Same as migration_laptop_loans.sql, plus:
--   pickup_adults          today's list (name, relation, days; phone for the section's lead and admins)
--   may_leave_alone_today  the parent's consent covers today (Denver date)
--   leave_alone_mode       'walk' / 'bike' / 'transit' / 'other' when it does
--   leave_alone_note       the parent's note on it, if any
-- Dropped first: the columns change.

DROP FUNCTION IF EXISTS public.section_roster(UUID);
CREATE FUNCTION public.section_roster(p_section_id UUID)
RETURNS TABLE (
    id                         UUID,
    full_name                  TEXT,
    age                        INT,
    allergies                  TEXT,
    medical_conditions         TEXT,
    medical_info               TEXT,
    emergency_contact_name     TEXT,
    emergency_contact_phone    TEXT,
    emergency_contact_relation TEXT,
    parent_name                TEXT,
    parent_phone               TEXT,
    laptop_loan                TEXT,
    pickup_adults              JSONB,
    may_leave_alone_today      BOOLEAN,
    leave_alone_mode           TEXT,
    leave_alone_note           TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  today      DATE := (now() AT TIME ZONE 'America/Denver')::date;
  with_phone BOOLEAN;
BEGIN
  -- coalesce: a NULL role or helper result must fail the check, not skip it.
  IF auth.uid() IS NULL
     OR NOT (coalesce(private.auth_user_role() = 'admin', false)
             OR coalesce(private.auth_volunteer_has_section(p_section_id), false)) THEN
    RAISE EXCEPTION 'Only this section''s crew or an admin can see its roster' USING ERRCODE = '42501';
  END IF;
  with_phone := coalesce(private.auth_user_role() = 'admin', false)
             OR EXISTS (SELECT 1 FROM sections sx WHERE sx.id = p_section_id AND sx.lead_id = auth.uid());

  RETURN QUERY
    SELECT st.id, st.full_name, st.age::int, st.allergies, st.medical_conditions, st.medical_info,
           st.emergency_contact_name, st.emergency_contact_phone, st.emergency_contact_relation,
           st.parent_name, st.parent_phone,
           CASE WHEN l.status IN ('reserved', 'handed_out') THEN l.status END,
           private.pickups_on(st.id, today, with_phone),
           lone.j IS NOT NULL, lone.j ->> 'mode', lone.j ->> 'note'
    FROM registrations r
    JOIN students st ON st.id = r.student_id
    LEFT JOIN laptop_loans l ON l.registration_id = r.id
    LEFT JOIN LATERAL (SELECT private.leave_alone_on(st.id, p_section_id, today) AS j) lone ON true
    WHERE r.section_id = p_section_id
      AND r.status IN ('confirmed', 'pending')
    ORDER BY st.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.section_roster(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.section_roster(UUID) TO authenticated;

-- ── 6. Admins: the day's dismissal board ─────────────────────
-- One row per camper holding a seat in a section of the week running that day (default today,
-- Denver): their dismissal mark (present NULL = not marked yet), who collected them and who
-- recorded it, today's pickup list with phones, and the walk-home consent.

CREATE OR REPLACE FUNCTION public.dismissal_board(p_day DATE DEFAULT NULL)
RETURNS TABLE (
    section_id        UUID,
    section_label     TEXT,
    class_name        TEXT,
    room              TEXT,
    lead_name         TEXT,
    student_id        UUID,
    full_name         TEXT,
    parent_name       TEXT,
    parent_phone      TEXT,
    present           BOOLEAN,
    released_to       TEXT,
    released_mode     TEXT,
    marked_at         TIMESTAMPTZ,
    marked_by_name    TEXT,
    pickup_adults     JSONB,
    may_leave_alone   BOOLEAN,
    leave_alone_mode  TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  d DATE := coalesce(p_day, (now() AT TIME ZONE 'America/Denver')::date);
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.id, s.label, c.name, s.room, lp.display_name,
           st.id, st.full_name, st.parent_name, st.parent_phone,
           m.present, m.released_to, m.released_mode, m.marked_at, mp.display_name,
           private.pickups_on(st.id, d, true),
           lone.j IS NOT NULL, lone.j ->> 'mode'
      FROM sections s
      JOIN sessions se ON se.id = s.session_id AND d BETWEEN se.start_date AND se.end_date
      JOIN classes c ON c.id = s.class_id
      JOIN registrations r ON r.section_id = s.id AND r.status IN ('confirmed', 'pending')
      JOIN students st ON st.id = r.student_id
      LEFT JOIN profiles lp ON lp.id = s.lead_id
      LEFT JOIN roll_call_marks m ON m.section_id = s.id AND m.student_id = st.id AND m.day = d AND m.roll_call = 'dismissal'
      LEFT JOIN profiles mp ON mp.id = m.marked_by
      LEFT JOIN LATERAL (SELECT private.leave_alone_on(st.id, s.id, d) AS j) lone ON true
     WHERE s.cancelled_at IS NULL
     ORDER BY s.label, st.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.dismissal_board(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismissal_board(DATE) TO authenticated;

-- ── 7. Email the lead about a change during camp week ────────
-- When a parent (not an admin, not the SQL editor or the demo reset) adds, changes or removes a
-- pickup adult or a walk-home consent while their camper's week is running, and the change touches
-- a day from today to the end of that week, the section's lead gets a pickup_changed email.
-- One per change to a row, per section, per transaction.

CREATE OR REPLACE FUNCTION private.notify_pickup_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  today   DATE := (now() AT TIME ZONE 'America/Denver')::date;
  new_j   JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  old_j   JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  row_j   JSONB;
  j       JSONB;
  stu     UUID;
  change  TEXT;
  sec     RECORD;
  touches BOOLEAN;
  for_today BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR coalesce(private.auth_user_role() = 'admin', false) THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE'
     AND (new_j - 'updated_at' - 'consented_at' - 'consented_by') = (old_j - 'updated_at' - 'consented_at' - 'consented_by') THEN
    RETURN NULL;
  END IF;
  row_j := coalesce(new_j, old_j);
  stu := (row_j ->> 'student_id')::uuid;
  change := CASE TG_TABLE_NAME WHEN 'authorized_pickups' THEN 'pickup' ELSE 'consent' END || '_'
         || CASE TG_OP WHEN 'INSERT' THEN 'added' WHEN 'UPDATE' THEN 'changed' ELSE 'removed' END;

  FOR sec IN
    SELECT s.id, s.lead_id, s.label, c.name AS class_name, se.id AS session_id, se.name AS session_name,
           se.end_date, st.full_name, coalesce(nullif(st.first_name, ''), split_part(st.full_name, ' ', 1)) AS first
      FROM registrations r
      JOIN sections s ON s.id = r.section_id AND s.cancelled_at IS NULL AND s.lead_id IS NOT NULL
      JOIN classes c ON c.id = s.class_id
      JOIN sessions se ON today BETWEEN se.start_date AND se.end_date AND (s.session_id = se.id OR s.session_id IS NULL)
      JOIN students st ON st.id = r.student_id
     WHERE r.student_id = stu AND r.status IN ('confirmed', 'pending')
  LOOP
    touches := false;
    for_today := false;
    FOREACH j IN ARRAY ARRAY[new_j, old_j] LOOP
      CONTINUE WHEN j IS NULL;
      CONTINUE WHEN TG_TABLE_NAME = 'release_consents' AND (j ->> 'session_id')::uuid IS DISTINCT FROM sec.session_id;
      IF jsonb_typeof(j -> 'days') IS DISTINCT FROM 'array' THEN
        touches := true; for_today := true;
      ELSE
        IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(j -> 'days') AS x(d) WHERE x.d::date BETWEEN today AND sec.end_date) THEN
          touches := true;
        END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(j -> 'days') AS x(d) WHERE x.d::date = today) THEN
          for_today := true;
        END IF;
      END IF;
    END LOOP;
    CONTINUE WHEN NOT touches;
    PERFORM private.enqueue_notification(sec.lead_id, 'pickup_changed',
      jsonb_build_object(
        'change', change, 'camper', sec.full_name, 'camper_first', sec.first,
        'class', sec.class_name, 'section', sec.label, 'session', sec.session_name,
        'name', row_j ->> 'name', 'relation', row_j ->> 'relation', 'mode', row_j ->> 'mode',
        'days', CASE WHEN TG_OP = 'DELETE' THEN old_j -> 'days' ELSE new_j -> 'days' END,
        'for_today', for_today, 'today', today, 'student_id', stu),
      'pickup_changed:' || change || ':' || (row_j ->> 'id') || ':' || sec.id || ':' || txid_current());
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.notify_pickup_changed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_pickup_changed ON authorized_pickups;
CREATE TRIGGER notify_pickup_changed AFTER INSERT OR UPDATE OR DELETE ON authorized_pickups
    FOR EACH ROW EXECUTE FUNCTION private.notify_pickup_changed();
DROP TRIGGER IF EXISTS notify_pickup_changed ON release_consents;
CREATE TRIGGER notify_pickup_changed AFTER INSERT OR UPDATE OR DELETE ON release_consents
    FOR EACH ROW EXECUTE FUNCTION private.notify_pickup_changed();

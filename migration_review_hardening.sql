-- Migration: review hardening (code review 2026-10-14; applied to rdckxazvoeixgwtjhrlf via MCP).
-- Apply after every other migration_*.sql file — in particular after migration_interviews.sql,
-- migration_interview_self_booking.sql, migration_security_hardening.sql,
-- migration_one_class_per_week.sql and migration_camp_week_ops.sql. Safe to re-run.
--
-- New objects only; fixes to existing functions/policies were made in the files that define them.
--   1. Volunteer applications: one per email per 24 h (throttle against scripted sign-ups).
--   2. Applicants can't read admin notes: their direct SELECT on volunteer_applications and
--      interview_bookings is replaced by two RPCs that return their own rows without notes.
--   3. Parents can't change a camper's age to one their current class doesn't allow (stops
--      "raise age → register for an older class → lower age").
--   4. Volunteer interview notes move from volunteers.interview_notes (readable by the volunteer
--      through volunteer_select_self) to an admin-only volunteer_notes table.

-- ── 1. Application throttle ───────────────────────────────────

CREATE INDEX IF NOT EXISTS volunteer_applications_email_lower_idx ON volunteer_applications (lower(email));

CREATE OR REPLACE FUNCTION public.volunteer_applications_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  -- Only API callers (anon / authenticated JWTs) are throttled; the SQL editor, cron and
  -- reset_demo() are trusted, and admins may enter applications on someone's behalf.
  IF coalesce(auth.jwt()->>'role', '') NOT IN ('anon', 'authenticated')
     OR private.auth_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;
  -- Serialize same-email inserts so two parallel requests can't both pass the check.
  PERFORM pg_advisory_xact_lock(hashtextextended('volunteer_application:' || lower(trim(NEW.email)), 0));
  IF EXISTS (SELECT 1 FROM volunteer_applications
             WHERE lower(email) = lower(trim(NEW.email)) AND created_at > now() - interval '24 hours') THEN
    -- 23505 so the apply form shows its "already submitted with this email" message.
    RAISE EXCEPTION 'An application with this email was already submitted in the last 24 hours' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.volunteer_applications_before_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS volunteer_applications_before_insert ON volunteer_applications;
CREATE TRIGGER volunteer_applications_before_insert BEFORE INSERT ON volunteer_applications
    FOR EACH ROW EXECUTE FUNCTION public.volunteer_applications_before_insert();

-- ── 2. Applicant reads without admin notes ────────────────────
-- Admins and applicants are both `authenticated`, so column privileges can't hide admin_notes.
-- Applicants lose direct SELECT; admin_all_* policies are unchanged.

DROP POLICY IF EXISTS "self_read_application"      ON volunteer_applications;
DROP POLICY IF EXISTS "volunteer_read_own_booking" ON interview_bookings;

-- The caller's latest application (status only — no notes).
CREATE OR REPLACE FUNCTION public.my_volunteer_application()
RETURNS TABLE (id UUID, status TEXT, interview_confirmed BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.status, a.interview_confirmed, a.created_at
  FROM volunteer_applications a
  WHERE a.user_id = auth.uid()
  ORDER BY a.created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_volunteer_application() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_volunteer_application() TO authenticated;

-- The caller's interview time (same application book_my_interview() books for).
CREATE OR REPLACE FUNCTION public.my_interview()
RETURNS TABLE (slot_id UUID, slot_datetime TIMESTAMPTZ, duration_minutes SMALLINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.slot_id, s.slot_datetime, s.duration_minutes
  FROM volunteer_applications a
  JOIN interview_bookings b ON b.application_id = a.id
  JOIN interview_slots s ON s.id = b.slot_id
  WHERE a.user_id = auth.uid() AND a.status <> 'rejected'
  ORDER BY a.created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_interview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_interview() TO authenticated;

-- ── 3. Camper age vs. current classes ─────────────────────────
-- parent_own_students is FOR ALL, so without this a parent could raise students.age, register
-- into an older section (registrations_before_insert checks age at insert time), then lower it.
-- Only this camp year's held or waitlisted seats count, so a returning camper can age up.

CREATE OR REPLACE FUNCTION public.students_guard_age()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  clash TEXT;
BEGIN
  IF NEW.age IS NOT DISTINCT FROM OLD.age
     OR auth.uid() IS NULL OR private.auth_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;
  SELECT format('%s (ages %s–%s)', c.name, s.age_min, s.age_max) INTO clash
  FROM registrations r
  JOIN sections s ON s.id = r.section_id
  JOIN classes  c ON c.id = s.class_id
  WHERE r.student_id = NEW.id
    AND r.status IN ('pending', 'confirmed', 'waitlisted', 'offered')
    AND r.year >= coalesce((SELECT max(year) FROM sessions WHERE is_active), extract(year FROM now())::int)
    AND (NEW.age IS NULL OR NEW.age < s.age_min OR NEW.age > s.age_max)
  LIMIT 1;
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'This camper is signed up for %, so their age can''t be changed to %. Contact the camp to change classes first.',
      clash, coalesce(NEW.age::text, 'blank') USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.students_guard_age() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS students_guard_age ON students;
CREATE TRIGGER students_guard_age BEFORE UPDATE OF age ON students
    FOR EACH ROW EXECUTE FUNCTION public.students_guard_age();

-- ── 4. Volunteer interview notes are admin-only ───────────────
-- RLS can't hide one column from the row's owner while showing it to admins (both are
-- `authenticated`), so the notes get their own table.

CREATE TABLE IF NOT EXISTS volunteer_notes (
    volunteer_id UUID PRIMARY KEY REFERENCES volunteers(id) ON DELETE CASCADE,
    notes        TEXT NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE volunteer_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_volunteer_notes" ON volunteer_notes;
CREATE POLICY "admin_all_volunteer_notes" ON volunteer_notes
    FOR ALL USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'volunteers' AND column_name = 'interview_notes') THEN
    INSERT INTO volunteer_notes (volunteer_id, notes)
    SELECT id, interview_notes FROM volunteers WHERE interview_notes IS NOT NULL
    ON CONFLICT (volunteer_id) DO NOTHING;
    ALTER TABLE volunteers DROP COLUMN interview_notes;
  END IF;
END $$;

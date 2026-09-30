-- Migration: security hardening + finish section_supports (QA pass 2026-09-30)
-- Apply in Supabase Dashboard > SQL Editor (applied to rdckxazvoeixgwtjhrlf via MCP on 2026-09-30).
--
-- Closes:
--   C1  users could set their own profiles.role (e.g. to 'admin')
--   C2  signup trusted a client-supplied role in user metadata
--   C3  parents could write any registration status (skip approval / capacity / waitlist)
--   C4  any signed-in user could create/upgrade their own volunteers row
--   H1  parents saw capacity counts filtered by RLS (only their own registrations)
--   H7  section_fill view bypassed RLS and was readable signed-out
-- Also finishes migration_section_supports.sql, which never applied on the live DB because it
-- dropped sections.support_id while section_fill and two policies still depended on it.

-- ── 0. Pin search_path on the role helper ─────────────────────

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ── 1. Finish section_supports (sections.support_id → join table) ─

CREATE TABLE IF NOT EXISTS section_supports (
    section_id   UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    PRIMARY KEY (section_id, volunteer_id)
);
CREATE INDEX IF NOT EXISTS section_supports_volunteer_id_idx ON section_supports (volunteer_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'sections' AND column_name = 'support_id') THEN
    INSERT INTO section_supports (section_id, volunteer_id)
      SELECT id, support_id FROM sections WHERE support_id IS NOT NULL
      ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Everything that depends on sections.support_id has to go before the column does.
DROP VIEW IF EXISTS section_fill;   -- also H7: replaced by section_fill_counts() below
DROP POLICY IF EXISTS "volunteer_read_assigned_sections"    ON sections;
DROP POLICY IF EXISTS "volunteer_read_classes_via_sections" ON classes;
ALTER TABLE sections DROP COLUMN IF EXISTS support_id;

CREATE OR REPLACE FUNCTION auth_volunteer_has_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sections sec
    WHERE sec.id = p_section_id
      AND (sec.lead_id = auth.uid()
           OR EXISTS (SELECT 1 FROM section_supports ss
                      WHERE ss.section_id = sec.id AND ss.volunteer_id = auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION auth_volunteer_has_student(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.student_id = p_student_id AND auth_volunteer_has_section(r.section_id)
  );
$$;

ALTER TABLE section_supports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_section_supports"          ON section_supports;
DROP POLICY IF EXISTS "read_section_supports"               ON section_supports;
DROP POLICY IF EXISTS "volunteer_read_own_section_supports" ON section_supports;

CREATE POLICY "admin_all_section_supports" ON section_supports FOR ALL
    USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY "volunteer_read_own_section_supports" ON section_supports FOR SELECT TO authenticated
    USING (auth_volunteer_has_section(section_id));

CREATE POLICY "volunteer_read_assigned_sections" ON sections FOR SELECT TO authenticated
    USING (auth_volunteer_has_section(id));
CREATE POLICY "volunteer_read_classes_via_sections" ON classes FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM sections s WHERE s.class_id = classes.id AND auth_volunteer_has_section(s.id)));

-- ── 2. Fill counts that aren't filtered by the caller's RLS (H1) ─
-- Parents can only SELECT their own registrations, so an embedded registrations(count) showed
-- every section as nearly empty. This returns true totals (signed-in users only).

CREATE OR REPLACE FUNCTION section_fill_counts()
RETURNS TABLE (section_id UUID, active_count INT, waitlist_count INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id,
         (COUNT(r.id) FILTER (WHERE r.status IN ('confirmed', 'pending')))::int,
         (COUNT(r.id) FILTER (WHERE r.status = 'waitlisted'))::int
  FROM sections s
  LEFT JOIN registrations r ON r.section_id = s.id
  WHERE auth.uid() IS NOT NULL
  GROUP BY s.id;
$$;
REVOKE ALL ON FUNCTION section_fill_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION section_fill_counts() TO authenticated;

-- ── 3. Profiles: nobody picks or changes their own role (C1, C2) ─

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'User'),
    -- Only the two self-service roles are accepted from signup metadata. Admins are promoted
    -- by an existing admin from Users & roles.
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'volunteer' THEN 'volunteer'::user_role
         ELSE 'parent'::user_role END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_profile_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() is NULL for the SQL editor / service role: those are trusted.
  IF auth.uid() IS NOT NULL
     AND NEW.role IS DISTINCT FROM OLD.role
     AND auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can change account roles' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_guard_role ON profiles;
CREATE TRIGGER profiles_guard_role BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION guard_profile_role();

-- Profiles are created by handle_new_user; clients never insert them.
DROP POLICY IF EXISTS "self_insert_profile" ON profiles;

-- ── 4. Registrations: the server decides status, eligibility and year (C3) ─

DROP POLICY IF EXISTS "parent_own_registrations"        ON registrations;
DROP POLICY IF EXISTS "parent_read_own_registrations"   ON registrations;
DROP POLICY IF EXISTS "parent_insert_own_registrations" ON registrations;

CREATE POLICY "parent_read_own_registrations" ON registrations FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM students s WHERE s.id = registrations.student_id AND s.parent_id = auth.uid()));
CREATE POLICY "parent_insert_own_registrations" ON registrations FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = registrations.student_id AND s.parent_id = auth.uid()));
-- No parent UPDATE/DELETE: confirming, moving and cancelling are admin actions.

CREATE OR REPLACE FUNCTION registrations_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sec     sections%ROWTYPE;
  stu_age SMALLINT;
  taken   INT;
BEGIN
  -- Row lock serializes concurrent sign-ups for the same section so capacity can't be overrun.
  SELECT * INTO sec FROM sections WHERE id = NEW.section_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That section no longer exists' USING ERRCODE = 'P0001';
  END IF;

  NEW.year := COALESCE(
    (SELECT year FROM sessions WHERE id = sec.session_id),
    (SELECT MAX(year) FROM sessions WHERE is_active),
    NEW.year
  );

  -- Admins (and trusted server contexts) may place anyone anywhere with any status.
  IF auth.uid() IS NULL OR auth_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT age INTO stu_age FROM students WHERE id = NEW.student_id;
  IF stu_age IS NULL OR stu_age < sec.age_min OR stu_age > sec.age_max THEN
    RAISE EXCEPTION 'This section is for ages %–%', sec.age_min, sec.age_max USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO taken FROM registrations
  WHERE section_id = sec.id AND status IN ('confirmed', 'pending');

  NEW.status := CASE WHEN taken >= sec.capacity THEN 'waitlisted'::registration_status
                     ELSE 'pending'::registration_status END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS registrations_before_insert ON registrations;
CREATE TRIGGER registrations_before_insert BEFORE INSERT ON registrations
    FOR EACH ROW EXECUTE FUNCTION registrations_before_insert();

-- ── 5. Volunteers: only admins create or change volunteer records (C4) ─

DROP POLICY IF EXISTS "volunteer_insert_self" ON volunteers;
DROP POLICY IF EXISTS "volunteer_update_self" ON volunteers;

-- ── 6. Volunteer applications: public insert, but no spoofing ──

CREATE OR REPLACE FUNCTION application_user_ok(p_user_id UUID, p_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  -- The apply form signs up first, then inserts before the email is confirmed (no session yet),
  -- so allow a just-created account whose email matches the application.
  SELECT p_user_id IS NULL
      OR p_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM auth.users u
                 WHERE u.id = p_user_id
                   AND lower(u.email) = lower(p_email)
                   AND u.created_at > now() - interval '1 hour');
$$;

DROP POLICY IF EXISTS "public_insert_application" ON volunteer_applications;
CREATE POLICY "public_insert_application" ON volunteer_applications FOR INSERT TO anon, authenticated
    WITH CHECK (
        status = 'pending'
        AND admin_notes IS NULL
        AND interview_confirmed = false
        AND application_user_ok(user_id, email)
    );

-- ── 7. Duty slots: capacity enforced server-side ──────────────

CREATE OR REPLACE FUNCTION duty_assignments_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cap   SMALLINT;
  taken INT;
BEGIN
  SELECT capacity INTO cap FROM duty_slots WHERE id = NEW.duty_slot_id FOR UPDATE;
  SELECT COUNT(*) INTO taken FROM duty_assignments WHERE duty_slot_id = NEW.duty_slot_id;
  IF taken >= cap AND auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'This duty slot is already full' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS duty_assignments_before_insert ON duty_assignments;
CREATE TRIGGER duty_assignments_before_insert BEFORE INSERT ON duty_assignments
    FOR EACH ROW EXECUTE FUNCTION duty_assignments_before_insert();

-- ── 8. Schedules and assignments: signed-in users only ────────

DROP POLICY IF EXISTS "read_duty_slots"       ON duty_slots;
DROP POLICY IF EXISTS "read_duty_assignments" ON duty_assignments;
DROP POLICY IF EXISTS "read_interview_slots"  ON interview_slots;
CREATE POLICY "read_duty_slots"       ON duty_slots       FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_duty_assignments" ON duty_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_interview_slots"  ON interview_slots  FOR SELECT TO authenticated USING (true);

-- ── 9. Keep RLS helpers out of the public REST API ────────────
-- Anything in `public` is callable at /rest/v1/rpc/<name>. Policies reference functions by OID,
-- so moving the helpers to a non-exposed schema keeps every policy working.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

ALTER FUNCTION public.auth_user_role()                        SET SCHEMA private;
ALTER FUNCTION public.auth_volunteer_has_section(UUID)         SET SCHEMA private;
ALTER FUNCTION public.auth_volunteer_has_student(UUID)         SET SCHEMA private;
ALTER FUNCTION public.application_user_ok(UUID, TEXT)          SET SCHEMA private;

ALTER FUNCTION private.auth_volunteer_has_student(UUID)        SET search_path = public, private;
ALTER FUNCTION private.application_user_ok(UUID, TEXT)         SET search_path = public, private, auth;
ALTER FUNCTION public.guard_profile_role()                     SET search_path = public, private;
ALTER FUNCTION public.registrations_before_insert()            SET search_path = public, private;
ALTER FUNCTION public.duty_assignments_before_insert()         SET search_path = public, private;

-- Trigger functions never need to be callable by API roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrations_before_insert()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.duty_assignments_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                FROM PUBLIC, anon, authenticated;

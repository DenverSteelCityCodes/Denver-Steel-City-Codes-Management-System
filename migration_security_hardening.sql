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
--
-- Safe to re-run (2026-10-14 review): helpers are moved into `private` only if they are still
-- in `public`, then (re)defined in `private`; registrations_before_insert() is defined only in
-- migration_one_class_per_week.sql, so re-running this file can't roll it back.

-- ── 0. RLS helpers live in a non-exposed schema ───────────────
-- Anything in `public` is callable at /rest/v1/rpc/<name>. Earlier files create these helpers in
-- public; moving them (rather than creating new copies) keeps every existing policy working,
-- because policies reference functions by OID. A helper already in private is left where it is.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['auth_user_role()', 'auth_volunteer_has_section(uuid)',
                           'auth_volunteer_has_student(uuid)', 'application_user_ok(uuid, text)'] LOOP
    IF to_regprocedure('public.' || f) IS NOT NULL AND to_regprocedure('private.' || f) IS NULL THEN
      EXECUTE format('ALTER FUNCTION public.%s SET SCHEMA private', f);
    END IF;
  END LOOP;
END $$;

-- Pinned search_path.
CREATE OR REPLACE FUNCTION private.auth_user_role()
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

CREATE OR REPLACE FUNCTION private.auth_volunteer_has_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sections sec
    WHERE sec.id = p_section_id
      AND (sec.lead_id = auth.uid()
           OR EXISTS (SELECT 1 FROM section_supports ss
                      WHERE ss.section_id = sec.id AND ss.volunteer_id = auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION private.auth_volunteer_has_student(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
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
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "volunteer_read_own_section_supports" ON section_supports FOR SELECT TO authenticated
    USING (private.auth_volunteer_has_section(section_id));

CREATE POLICY "volunteer_read_assigned_sections" ON sections FOR SELECT TO authenticated
    USING (private.auth_volunteer_has_section(id));
CREATE POLICY "volunteer_read_classes_via_sections" ON classes FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM sections s WHERE s.class_id = classes.id AND private.auth_volunteer_has_section(s.id)));

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

-- Also refuses to demote or delete the last admin (Users & roles checks this too, but only
-- client-side). auth.uid() is NULL for the SQL editor / service role / cron: those are trusted.
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role
     AND auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can change account roles' USING ERRCODE = '42501';
  END IF;

  IF OLD.role = 'admin' AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'admin') THEN
    -- Serialize admin removals so two admins demoting each other can't both pass the check.
    PERFORM pg_advisory_xact_lock(hashtextextended('profiles:last-admin', 0));
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin' AND id <> OLD.id) THEN
      RAISE EXCEPTION 'There has to be at least one admin. Make someone else an admin first.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_guard_role ON profiles;
CREATE TRIGGER profiles_guard_role BEFORE UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

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

-- Status, eligibility, capacity and year are set by the registrations_before_insert() trigger.
-- Its canonical definition (function and trigger) is in migration_one_class_per_week.sql; an
-- older body used to live here and silently replaced the newer one when this file was re-run.

-- ── 5. Volunteers: only admins create or change volunteer records (C4) ─

DROP POLICY IF EXISTS "volunteer_insert_self" ON volunteers;
DROP POLICY IF EXISTS "volunteer_update_self" ON volunteers;

-- ── 6. Volunteer applications: public insert, but no spoofing ──

CREATE OR REPLACE FUNCTION private.application_user_ok(p_user_id UUID, p_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
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
        -- interview_confirmed is the applicant's own "I signed up for an interview" attestation
        -- (required by the apply form), so it is allowed to be true here.
        status = 'pending'
        AND admin_notes IS NULL
        AND private.application_user_ok(user_id, email)
        -- Admins can close applications (Volunteers / Form editor); that must stop direct API
        -- inserts too, not just hide the form. app_settings is publicly readable.
        AND EXISTS (SELECT 1 FROM app_settings
                    WHERE key = 'volunteer_applications_open' AND value = 'true')
    );
-- Per-email throttle: volunteer_applications_before_insert() in migration_review_hardening.sql.

-- ── 7. Duty slots: capacity enforced server-side ──────────────

-- Runs on INSERT and on UPDATE OF duty_slot_id: volunteer_manage_own_duties is FOR ALL, so
-- without the UPDATE case a volunteer could claim an open slot, then PATCH duty_slot_id to a
-- full one.
CREATE OR REPLACE FUNCTION public.duty_assignments_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  cap   SMALLINT;
  taken INT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.duty_slot_id IS NOT DISTINCT FROM OLD.duty_slot_id THEN
    RETURN NEW;
  END IF;
  -- Row lock serializes concurrent claims on the same slot.
  SELECT capacity INTO cap FROM duty_slots WHERE id = NEW.duty_slot_id FOR UPDATE;
  SELECT COUNT(*) INTO taken FROM duty_assignments WHERE duty_slot_id = NEW.duty_slot_id;
  IF taken >= cap AND auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'This duty slot is already full' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.duty_assignments_before_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS duty_assignments_before_insert ON duty_assignments;
CREATE TRIGGER duty_assignments_before_insert BEFORE INSERT OR UPDATE OF duty_slot_id ON duty_assignments
    FOR EACH ROW EXECUTE FUNCTION public.duty_assignments_before_insert();

-- ── 8. Schedules and assignments: signed-in users only ────────

DROP POLICY IF EXISTS "read_duty_slots"       ON duty_slots;
DROP POLICY IF EXISTS "read_duty_assignments" ON duty_assignments;
DROP POLICY IF EXISTS "read_interview_slots"  ON interview_slots;
CREATE POLICY "read_duty_slots"       ON duty_slots       FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_duty_assignments" ON duty_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_interview_slots"  ON interview_slots  FOR SELECT TO authenticated USING (true);

-- ── 9. Trigger functions are not API endpoints ───────────────
-- (The RLS helpers were moved to `private` in section 0.)

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.duty_assignments_before_insert() FROM PUBLIC, anon, authenticated;
-- rls_auto_enable() is Supabase's "auto-enable RLS" event trigger function; it only exists on
-- projects where that dashboard option was turned on.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- ── 10. Admin-only account lookup for linking volunteer applications ─
-- An application can arrive without user_id (e.g. the email already had an account). Admins
-- can resolve the account by email when accepting instead of dead-ending.

CREATE OR REPLACE FUNCTION public.admin_user_id_for_email(p_email TEXT)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_id_for_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_id_for_email(TEXT) TO authenticated;

-- ── 11. Admin-only account emails for Users & roles ───────────
-- profiles has no email; admins need it to tell accounts apart before changing a role.
-- Created only if missing: migration_demo_environment.sql replaces it with a version that hides
-- kept accounts, and re-running this file must not undo that.

DO $do$
BEGIN
  IF to_regprocedure('public.admin_user_emails()') IS NULL THEN
    EXECUTE $def$
      CREATE FUNCTION public.admin_user_emails()
      RETURNS TABLE (id UUID, email TEXT, last_sign_in_at TIMESTAMPTZ)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
      BEGIN
        IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
          RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
        END IF;
        RETURN QUERY SELECT u.id, u.email::text, u.last_sign_in_at FROM auth.users u;
      END;
      $$
    $def$;
  END IF;
END $do$;
REVOKE ALL ON FUNCTION public.admin_user_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_emails() TO authenticated;

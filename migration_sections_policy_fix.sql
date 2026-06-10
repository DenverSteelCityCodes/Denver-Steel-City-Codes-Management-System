-- Patch: fix infinite recursion in volunteer RLS policies
-- The cycle: volunteer_read_students reads registrations,
--            parent_own_registrations reads students → loop.
-- Fix: SECURITY DEFINER functions bypass RLS on their inner queries,
--      the same pattern used by auth_user_role().

-- ── Helper functions ──────────────────────────────────────────

-- Checks whether the current user (volunteer) has this student
-- enrolled in any section they lead/support.
CREATE OR REPLACE FUNCTION auth_volunteer_has_student(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM registrations r
    JOIN sections sec ON sec.id = r.section_id
    WHERE r.student_id = p_student_id
      AND (sec.lead_id = auth.uid() OR sec.support_id = auth.uid())
  );
$$;

-- Checks whether the current user (volunteer) leads/supports this section.
CREATE OR REPLACE FUNCTION auth_volunteer_has_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sections sec
    WHERE sec.id = p_section_id
      AND (sec.lead_id = auth.uid() OR sec.support_id = auth.uid())
  );
$$;

-- ── Recreate the four affected policies ───────────────────────

DROP POLICY IF EXISTS "volunteer_read_students" ON students;
CREATE POLICY "volunteer_read_students" ON students
    FOR SELECT
    USING (auth_volunteer_has_student(id));

DROP POLICY IF EXISTS "volunteer_read_registrations" ON registrations;
CREATE POLICY "volunteer_read_registrations" ON registrations
    FOR SELECT
    USING (auth_volunteer_has_section(section_id));

DROP POLICY IF EXISTS "volunteer_insert_attendance" ON attendance_logs;
CREATE POLICY "volunteer_insert_attendance" ON attendance_logs
    FOR INSERT
    WITH CHECK (auth_volunteer_has_section(section_id));

DROP POLICY IF EXISTS "volunteer_read_attendance" ON attendance_logs;
CREATE POLICY "volunteer_read_attendance" ON attendance_logs
    FOR SELECT
    USING (auth_volunteer_has_section(section_id));

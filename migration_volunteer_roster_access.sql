-- Migration: tighten volunteer access to camper data (spec 04)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP). Safe to re-run.
--
-- Order: after migration_security_hardening.sql (moves the RLS helpers into `private`) and
-- migration_camp_week_ops.sql. Needs private.auth_user_role() and
-- private.auth_volunteer_has_section(uuid).
-- migration_laptop_loans.sql (spec 29) redefines section_roster() with a laptop_loan column:
-- re-apply it after this file.
--
-- Crew used to read camper rows straight from `students`. Now they read their section's roster
-- through section_roster(), which returns only the fields camp week needs, and only for campers
-- holding a seat (confirmed, or legacy pending). Admin access is unchanged.

-- ── 1. Section roster RPC ─────────────────────────────────────

-- Dropped first so a re-run can change the returned columns (CREATE OR REPLACE can't).
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
    parent_phone               TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  -- coalesce: a NULL role or helper result must fail the check, not skip it.
  IF auth.uid() IS NULL
     OR NOT (coalesce(private.auth_user_role() = 'admin', false)
             OR coalesce(private.auth_volunteer_has_section(p_section_id), false)) THEN
    RAISE EXCEPTION 'Only this section''s crew or an admin can see its roster' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT st.id, st.full_name, st.age::int, st.allergies, st.medical_conditions, st.medical_info,
           st.emergency_contact_name, st.emergency_contact_phone, st.emergency_contact_relation,
           st.parent_name, st.parent_phone
    FROM registrations r
    JOIN students st ON st.id = r.student_id
    WHERE r.section_id = p_section_id
      AND r.status IN ('confirmed', 'pending')
    ORDER BY st.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.section_roster(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.section_roster(UUID) TO authenticated;

-- ── 2. No direct camper reads for crew ────────────────────────

DROP POLICY IF EXISTS "volunteer_read_students" ON students;

-- Crew only see registrations that hold a seat in their own sections.
DROP POLICY IF EXISTS "volunteer_read_registrations" ON registrations;
CREATE POLICY "volunteer_read_registrations" ON registrations FOR SELECT TO authenticated
    USING (private.auth_volunteer_has_section(section_id) AND status IN ('confirmed', 'pending'));

-- Only volunteer_read_students used this helper. No CASCADE: if some other policy still
-- depends on it, this fails loudly instead of silently dropping that policy.
DROP FUNCTION IF EXISTS private.auth_volunteer_has_student(UUID);

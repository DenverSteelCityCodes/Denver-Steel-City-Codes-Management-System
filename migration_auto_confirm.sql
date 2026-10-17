-- Migration: auto-confirm registrations + duplicate-camper report (spec 14, #83)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: with the spec 14 version of migration_one_class_per_week.sql (registrations_before_insert()
-- now sets 'confirmed' instead of 'pending'), and after migration_audit_log.sql.

-- ── 1. Existing "spot held" registrations are confirmed ───────
-- The confirm step checked nothing (decided 2026-10-16, Q-P4). 'pending' stays in the enum for
-- history, but nothing sets it any more.
DO $$
BEGIN
  PERFORM private.set_reason('auto_confirm');
  UPDATE registrations SET status = 'confirmed' WHERE status = 'pending';
  PERFORM private.set_reason(NULL);
END $$;

-- ── 2. Possible duplicate campers (admin only) ────────────────
-- Same normalized first + last name, under DIFFERENT parent accounts, and either the same grade
-- or the same school. Only campers active this camp year (a live registration, or confirmed for
-- the year). Each pair is returned once. Merging is spec 24; this only reports.
CREATE OR REPLACE FUNCTION public.possible_duplicate_campers()
RETURNS TABLE (
    a_id UUID, a_name TEXT, a_parent TEXT,
    b_id UUID, b_name TEXT, b_parent TEXT,
    reason TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  yr INT := coalesce((SELECT max(year) FROM sessions WHERE is_active), extract(year FROM now())::int);
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH active AS (
    SELECT st.*,
           lower(regexp_replace(trim(coalesce(nullif(trim(coalesce(st.first_name, '') || ' ' || coalesce(st.last_name, '')), ''), st.full_name)), '\s+', ' ', 'g')) AS norm
    FROM students st
    WHERE st.registration_year >= yr
       OR EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = st.id AND r.year >= yr AND r.status <> 'cancelled')
  )
  SELECT a.id, a.full_name, pa.display_name, b.id, b.full_name, pb.display_name,
         CASE WHEN a.grade IS NOT NULL AND a.grade = b.grade THEN 'same name and grade'
              ELSE 'same name and school' END
  FROM active a
  JOIN active b ON a.norm = b.norm AND a.id < b.id AND a.parent_id <> b.parent_id
  LEFT JOIN profiles pa ON pa.id = a.parent_id
  LEFT JOIN profiles pb ON pb.id = b.parent_id
  WHERE (a.grade IS NOT NULL AND a.grade = b.grade)
     OR (nullif(trim(a.school_name), '') IS NOT NULL AND lower(trim(a.school_name)) = lower(trim(b.school_name)))
  ORDER BY a.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.possible_duplicate_campers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.possible_duplicate_campers() TO authenticated;

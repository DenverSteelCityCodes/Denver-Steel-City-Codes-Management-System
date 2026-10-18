-- Migration: "parents" and "everyone" mean this season's families (fix #145)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_volunteer_role_gate.sql (#143), which last redefined
-- update_recipient_emails().
--
-- Bug: private.auth_is_active_parent() and update_recipient_emails() counted a parent as active
-- if any of their campers ever held a confirmed or pending seat, in any year. Last season's
-- families therefore read this season's "parents"/"everyone" updates and the camp schedule, and
-- "Email all parents" would reach every family the camp has ever had.
-- Fix: both look only at registrations in the current camp year, the same rule the age-change
-- guard already uses (migration_review_hardening.sql): the latest active session's year, else
-- the calendar year. Section audiences are unchanged (a section belongs to one season).

CREATE OR REPLACE FUNCTION private.current_camp_year()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT max(year) FROM sessions WHERE is_active), extract(year FROM now())::int);
$$;
REVOKE ALL ON FUNCTION private.current_camp_year() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_camp_year() TO authenticated;

CREATE OR REPLACE FUNCTION private.auth_is_active_parent()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM registrations r JOIN students s ON s.id = r.student_id
    WHERE s.parent_id = auth.uid() AND r.status IN ('confirmed', 'pending')
      AND r.year >= private.current_camp_year());
$$;
REVOKE ALL ON FUNCTION private.auth_is_active_parent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_is_active_parent() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_recipient_emails(p_audience TEXT, p_section_id UUID DEFAULT NULL)
RETURNS TEXT[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  -- coalesce: a signed-in user with no profile row has a NULL role, and NOT (NULL OR false) is
  -- NULL, which would skip both permission checks below.
  is_admin BOOLEAN := coalesce(private.auth_user_role() = 'admin', false);
  parents  TEXT[];
  vols     TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;

  IF p_audience = 'section' THEN
    IF p_section_id IS NULL THEN
      RAISE EXCEPTION 'Pick a section' USING ERRCODE = 'P0001';
    END IF;
    IF NOT (is_admin OR coalesce(private.auth_volunteer_has_section(p_section_id), false)) THEN
      RAISE EXCEPTION 'Only this section''s crew or an admin can email its families' USING ERRCODE = '42501';
    END IF;
    RETURN ARRAY(
      SELECT DISTINCT lower(coalesce(pp.email, u.email))
      FROM registrations r
      JOIN students st ON st.id = r.student_id
      JOIN auth.users u ON u.id = st.parent_id
      LEFT JOIN parent_profiles pp ON pp.id = st.parent_id
      WHERE r.section_id = p_section_id AND r.status IN ('confirmed', 'pending')
        AND coalesce(pp.email, u.email) IS NOT NULL
      ORDER BY 1);
  END IF;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  -- This season's families only (#145): last year's families aren't "parents" for this year's mail.
  parents := ARRAY(
    SELECT DISTINCT lower(coalesce(pp.email, u.email))
    FROM students st
    JOIN auth.users u ON u.id = st.parent_id
    LEFT JOIN parent_profiles pp ON pp.id = st.parent_id
    WHERE coalesce(pp.email, u.email) IS NOT NULL
      AND EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = st.id AND r.status IN ('confirmed', 'pending')
                    AND r.year >= private.current_camp_year())
    ORDER BY 1);
  -- Only people who are volunteers now: a demoted volunteer keeps their volunteers row.
  vols := ARRAY(
    SELECT DISTINCT lower(u.email) FROM volunteers v
    JOIN profiles p ON p.id = v.id AND p.role = 'volunteer'
    JOIN auth.users u ON u.id = v.id
    WHERE u.email IS NOT NULL ORDER BY 1);

  RETURN CASE p_audience
    WHEN 'parents'    THEN parents
    WHEN 'volunteers' THEN vols
    WHEN 'everyone'   THEN ARRAY(SELECT DISTINCT e FROM unnest(parents || vols) e ORDER BY e)
    ELSE NULL
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.update_recipient_emails(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_recipient_emails(TEXT, UUID) TO authenticated;

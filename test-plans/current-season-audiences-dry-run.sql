-- Dry run for #145: applies migration_current_season_audiences.sql, then runs its tests.
-- Needs migration_volunteer_role_gate.sql (#143) applied first. Paste into the Supabase SQL editor
-- (demo project). The test block raises 'RESULTS ...' at the end, which rolls back everything.
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

-- Tests for migration_current_season_audiences.sql (#145: past-season families in "parents" and
-- "everyone"). Run against the demo DB after private.reset_demo(). The block raises its results at
-- the end, so every test write rolls back. Before the migration several lines print BAD.
-- The demo seeds one season, so the test moves one family's registrations to last year.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  admin_claims text;
  past_parent uuid; past_email text; cur_parent uuid; cur_email text; yr int;
  res text := ''; n int; arr text[];
begin
  admin_claims := json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text;
  yr := coalesce((select max(year) from sessions where is_active), extract(year from now())::int);

  -- Two families with seats this season; one of them becomes a last-season-only family.
  select st.parent_id into past_parent from students st join registrations r on r.student_id = st.id
   where r.status = 'confirmed' group by st.parent_id order by st.parent_id limit 1;
  select st.parent_id into cur_parent from students st join registrations r on r.student_id = st.id
   where r.status = 'confirmed' and st.parent_id <> past_parent group by st.parent_id order by st.parent_id limit 1;
  update registrations set year = yr - 1
   where student_id in (select id from students where parent_id = past_parent);
  select lower(coalesce(pp.email, u.email)) into past_email from auth.users u
    left join parent_profiles pp on pp.id = u.id where u.id = past_parent;
  select lower(coalesce(pp.email, u.email)) into cur_email from auth.users u
    left join parent_profiles pp on pp.id = u.id where u.id = cur_parent;
  insert into updates (author_id, author_name, audience, body) values (admin_id, 'Test', 'parents', '[TEST] parents only');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', admin_claims, true);
  arr := public.update_recipient_emails('parents');
  res := res || E'\nthis season''s family on the parents list: ' || case when cur_email = any(arr) then 'ok' else 'BAD (missing)' end;
  res := res || E'\nlast season''s family off the parents list: ' || case when past_email = any(arr) then 'BAD (still listed)' else 'ok' end;
  arr := public.update_recipient_emails('everyone');
  res := res || E'\nlast season''s family off the everyone list: ' || case when past_email = any(arr) then 'BAD (still listed)' else 'ok' end;

  perform set_config('request.jwt.claims', json_build_object('sub', cur_parent, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where audience = 'parents';
  res := res || E'\nthis season''s family reads parent updates: ' || case when n > 0 then 'ok' else 'BAD' end;
  select count(*) into n from schedule_items;
  res := res || E'\nthis season''s family reads the camp schedule: ' || case when n > 0 then 'ok' else 'BAD' end;

  perform set_config('request.jwt.claims', json_build_object('sub', past_parent, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where audience = 'parents';
  res := res || E'\nlast season''s family reads parent updates: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
  select count(*) into n from schedule_items;
  res := res || E'\nlast season''s family reads the camp schedule: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

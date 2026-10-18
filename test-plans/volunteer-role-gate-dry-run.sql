-- Dry run for #143: applies migration_volunteer_role_gate.sql, then runs its tests.
-- Paste into the Supabase SQL editor (demo project). The test block raises 'RESULTS ...' at the end,
-- which rolls back EVERYTHING, including the migration. Every line should say ok.
begin;
-- Migration: volunteer access follows the current role (fix #143)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_camp_week_ops.sql, migration_duties.sql, migration_parent_changes.sql
-- and migration_volunteer_self_service.sql.
--
-- Bug: every volunteer-only check asked whether a `volunteers` row exists. Changing someone's role
-- on the Users page never removes that row (it holds their history), so a demoted volunteer still
-- read volunteer updates, schedules and lead names, stayed on the volunteer email list, could
-- claim and drop duty slots, report crew absences, edit preferences and file crew-switch requests.
-- Fix:
--   1. private.auth_is_volunteer() = the current role is 'volunteer' AND a volunteers row exists.
--   2. Every volunteer-only check uses it: duty claims, crew absences, preferences, crew-switch
--      requests, the volunteer email list and the cover suggestions on the admin absence list.
--   3. Moving a volunteer to another role clears their crew spots and upcoming duty claims in the
--      same transaction as the role change (trigger), instead of two client calls beforehand.
--      Past duty claims stay, for hours records. Re-promoting restores access (the row is kept).

-- ── 1. The check ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.auth_is_volunteer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM volunteers v JOIN profiles p ON p.id = v.id
                 WHERE v.id = auth.uid() AND p.role = 'volunteer');
$$;
REVOKE ALL ON FUNCTION private.auth_is_volunteer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_is_volunteer() TO authenticated;

-- ── 2. Duty claims and crew absences ──────────────────────────
DROP POLICY IF EXISTS "volunteer_manage_own_duties" ON duty_assignments;
CREATE POLICY "volunteer_manage_own_duties" ON duty_assignments FOR ALL TO authenticated
    USING      (volunteer_id = auth.uid() AND private.auth_is_volunteer())
    WITH CHECK (volunteer_id = auth.uid() AND private.auth_is_volunteer());

DROP POLICY IF EXISTS "own_insert_crew_absences" ON crew_absences;
CREATE POLICY "own_insert_crew_absences" ON crew_absences FOR INSERT TO authenticated
    WITH CHECK (volunteer_id = auth.uid() AND private.auth_is_volunteer()
                AND to_date >= (now() AT TIME ZONE 'America/Denver')::date);

-- ── 3. Preferences and crew-switch requests ───────────────────
CREATE OR REPLACE FUNCTION public.update_my_volunteer_prefs(
    p_week1 BOOLEAN, p_week2 BOOLEAN, p_first TEXT, p_second TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.auth_is_volunteer() THEN
    RAISE EXCEPTION 'Only accepted volunteers can set preferences' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(p_week1, false) AND NOT coalesce(p_week2, false) THEN
    RAISE EXCEPTION 'Pick at least one week you can help, or use "I can''t make it" for specific days' USING ERRCODE = 'P0001';
  END IF;
  IF length(p_first) > 100 OR length(p_second) > 100 THEN
    RAISE EXCEPTION 'Course choice is too long' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.set_reason('volunteer_prefs');
  UPDATE volunteers SET availability_week_1 = coalesce(p_week1, false), availability_week_2 = coalesce(p_week2, false)
   WHERE id = auth.uid();
  UPDATE volunteer_applications SET course_first_choice = nullif(trim(p_first), ''), course_second_choice = nullif(trim(p_second), '')
   WHERE id = (SELECT id FROM volunteer_applications WHERE user_id = auth.uid()
                ORDER BY (status = 'accepted') DESC, created_at DESC LIMIT 1);
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_volunteer_prefs(BOOLEAN, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_volunteer_prefs(BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_change(p_registration_id UUID, p_kind TEXT, p_message TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  stu UUID;
  new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF p_kind = 'crew_switch' AND NOT private.auth_is_volunteer() THEN
    RAISE EXCEPTION 'Only volunteers can ask to switch crews' USING ERRCODE = '42501';
  END IF;
  IF p_registration_id IS NOT NULL THEN
    SELECT r.student_id INTO stu FROM registrations r JOIN students st ON st.id = r.student_id
     WHERE r.id = p_registration_id AND st.parent_id = auth.uid();
    IF stu IS NULL THEN RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501'; END IF;
    IF EXISTS (SELECT 1 FROM change_requests WHERE registration_id = p_registration_id AND status = 'open') THEN
      RAISE EXCEPTION 'You already have an open request for this spot. The camp will get back to you.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF coalesce(trim(p_message), '') = '' THEN
    RAISE EXCEPTION 'Tell the camp what you''d like to change' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO change_requests (registration_id, student_id, requested_by, kind, message)
  VALUES (p_registration_id, stu, auth.uid(), coalesce(p_kind, 'other'), left(trim(p_message), 1000))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_change(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_change(UUID, TEXT, TEXT) TO authenticated;

-- ── 4. The volunteer email list ───────────────────────────────
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

  parents := ARRAY(
    SELECT DISTINCT lower(coalesce(pp.email, u.email))
    FROM students st
    JOIN auth.users u ON u.id = st.parent_id
    LEFT JOIN parent_profiles pp ON pp.id = st.parent_id
    WHERE coalesce(pp.email, u.email) IS NOT NULL
      AND EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = st.id AND r.status IN ('confirmed', 'pending'))
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

-- Cover suggestions on the admin absence list: only current volunteers.
CREATE OR REPLACE FUNCTION public.admin_crew_absences()
RETURNS TABLE (absence_id UUID, volunteer_name TEXT, from_date DATE, to_date DATE, note TEXT,
               section_id UUID, class_name TEXT, section_label TEXT, week SMALLINT, is_lead BOOLEAN,
               suggestions TEXT[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH crew AS (
    SELECT s.id AS section_id, s.lead_id AS volunteer_id, true AS is_lead FROM sections s WHERE s.lead_id IS NOT NULL
    UNION ALL
    SELECT ss.section_id, ss.volunteer_id, false FROM section_supports ss
  ), sec AS (
    SELECT s.id, s.label, s.week, c.name AS class_name,
           coalesce(se.start_date, (SELECT min(x.start_date) FROM sessions x WHERE x.is_active)) AS starts,
           coalesce(se.end_date,   (SELECT max(x.end_date)   FROM sessions x WHERE x.is_active)) AS ends
      FROM sections s JOIN classes c ON c.id = s.class_id LEFT JOIN sessions se ON se.id = s.session_id
     WHERE s.cancelled_at IS NULL
  )
  SELECT a.id, p.display_name, a.from_date, a.to_date, a.note,
         sec.id, sec.class_name, sec.label, sec.week, crew.is_lead,
         ARRAY(
           SELECT pp.display_name FROM volunteers v JOIN profiles pp ON pp.id = v.id
            WHERE v.experience_level = 'senior' AND v.id <> a.volunteer_id
              AND pp.role = 'volunteer'   -- a demoted volunteer keeps their volunteers row
              AND CASE sec.week WHEN 1 THEN v.availability_week_1 WHEN 2 THEN v.availability_week_2
                                ELSE v.availability_week_1 AND v.availability_week_2 END
              AND NOT EXISTS (SELECT 1 FROM crew c2 JOIN sections s2 ON s2.id = c2.section_id
                               WHERE c2.volunteer_id = v.id AND s2.cancelled_at IS NULL
                                 AND (s2.week IS NULL OR sec.week IS NULL OR s2.week = sec.week))
              AND NOT EXISTS (SELECT 1 FROM crew_absences a2 WHERE a2.volunteer_id = v.id
                               AND a2.from_date <= a.to_date AND a2.to_date >= a.from_date)
            ORDER BY pp.display_name LIMIT 5)
    FROM crew_absences a
    JOIN profiles p ON p.id = a.volunteer_id
    JOIN crew ON crew.volunteer_id = a.volunteer_id
    JOIN sec ON sec.id = crew.section_id
   WHERE a.to_date >= (now() AT TIME ZONE 'America/Denver')::date
     AND a.from_date <= sec.ends AND a.to_date >= sec.starts
   ORDER BY a.from_date, crew.is_lead DESC, sec.class_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_crew_absences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crew_absences() TO authenticated;

-- ── 5. Leaving the volunteer role releases crew spots and upcoming duties ──
-- Same transaction as the role change, so a failed role change leaves the crew untouched and
-- nobody stays on a crew without the volunteer role. Clearing a lead sends no "new lead" email
-- (notify_new_lead skips a NULL lead). The audit trigger records each removal.
CREATE OR REPLACE FUNCTION private.release_volunteer_on_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF OLD.role = 'volunteer' AND NEW.role IS DISTINCT FROM 'volunteer' THEN
    UPDATE sections SET lead_id = NULL WHERE lead_id = NEW.id;
    DELETE FROM section_supports WHERE volunteer_id = NEW.id;
    DELETE FROM duty_assignments da USING duty_slots ds
     WHERE da.duty_slot_id = ds.id AND da.volunteer_id = NEW.id
       AND ds.slot_date >= (now() AT TIME ZONE 'America/Denver')::date;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.release_volunteer_on_role_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_release_volunteer ON profiles;
CREATE TRIGGER profiles_release_volunteer AFTER UPDATE OF role ON profiles
    FOR EACH ROW EXECUTE FUNCTION private.release_volunteer_on_role_change();

-- Tests for migration_volunteer_role_gate.sql (#143: demoted volunteers keep volunteer access).
-- Run against the demo DB after private.reset_demo(). The block raises its results at the end, so
-- every test write rolls back. Admin sessions carry 'aal': 'aal2' so this also runs where admin MFA
-- (spec 27) is required. Before the migration several lines print BAD; after it, all say ok.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  admin_claims text;
  v uuid; v_claims text; v_email text; sec uuid; future_slot uuid; past_slot uuid;
  lead2 uuid; lead2_week smallint; w date; senior uuid; senior_name text; free_slot uuid;
  res text := ''; n int; arr text[];
begin
  admin_claims := json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text;

  -- A volunteer who leads a section, with one upcoming and one past duty claim.
  select s.lead_id, s.id into v, sec from sections s
   where s.lead_id is not null and s.cancelled_at is null order by s.label limit 1;
  v_claims := json_build_object('sub', v, 'role', 'authenticated')::text;
  select lower(email) into v_email from auth.users where id = v;
  select ds.id into future_slot from duty_slots ds
   where ds.slot_date >= (now() at time zone 'America/Denver')::date
     and not exists (select 1 from duty_assignments da where da.duty_slot_id = ds.id and da.volunteer_id = v)
   order by ds.slot_date limit 1;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', admin_claims, true);
  insert into duty_slots (duty_type_id, session_id, slot_date, capacity)
    select duty_type_id, session_id, (now() at time zone 'America/Denver')::date - 3, 2 from duty_slots limit 1
    returning id into past_slot;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (future_slot, v), (past_slot, v);
  insert into updates (author_id, author_name, audience, body) values (admin_id, 'Test', 'volunteers', '[TEST] crew only');

  -- Before the change: a working volunteer.
  perform set_config('request.jwt.claims', v_claims, true);
  select count(*) into n from updates where audience = 'volunteers';
  res := res || E'\nvolunteer reads volunteer updates: ' || case when n > 0 then 'ok' else 'BAD (' || n || ')' end;

  perform set_config('request.jwt.claims', admin_claims, true);
  -- Cover-suggestion setup (as admin: volunteers can't read each other): another lead reports an
  -- absence in their week, and an uncrewed senior available that week would be suggested.
  select s.lead_id, s.week into lead2, lead2_week from sections s
   where s.lead_id is not null and s.lead_id <> v and s.cancelled_at is null and s.week in (1, 2) limit 1;
  select se.start_date into w from sessions se where se.is_active order by se.start_date offset (lead2_week - 1) limit 1;
  select vo.id, p.display_name into senior, senior_name from volunteers vo join profiles p on p.id = vo.id
   where vo.experience_level = 'senior' and vo.id not in (v, lead2)
     and case lead2_week when 1 then vo.availability_week_1 else vo.availability_week_2 end
     and not exists (select 1 from sections s2 where s2.lead_id = vo.id and s2.week = lead2_week)
     and not exists (select 1 from section_supports ss join sections s3 on s3.id = ss.section_id
                      where ss.volunteer_id = vo.id and s3.week = lead2_week)
   limit 1;
  insert into crew_absences (volunteer_id, from_date, to_date, note)
    values (lead2, greatest(w, (now() at time zone 'America/Denver')::date), greatest(w, (now() at time zone 'America/Denver')::date), '[TEST]');

  -- Demote both to parent.
  update profiles set role = 'parent' where id in (v, senior);

  select count(*) into n from sections where lead_id = v;
  res := res || E'\ndemote clears lead spots: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' left)' end;
  select count(*) into n from section_supports where volunteer_id = v;
  res := res || E'\ndemote clears support spots: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' left)' end;
  select count(*) into n from duty_assignments da join duty_slots ds on ds.id = da.duty_slot_id
   where da.volunteer_id = v and ds.slot_date >= (now() at time zone 'America/Denver')::date;
  res := res || E'\ndemote releases upcoming duty claims: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' left)' end;
  select count(*) into n from duty_assignments where volunteer_id = v and duty_slot_id = past_slot;
  res := res || E'\ndemote keeps past duty claims (hours): ' || case when n = 1 then 'ok' else 'BAD' end;
  arr := public.update_recipient_emails('volunteers');
  res := res || E'\ndemoted volunteer off the volunteer email list: ' || case when v_email = any(arr) then 'BAD (still listed)' else 'ok' end;
  if senior is null then
    res := res || E'\ncover suggestions skip demoted seniors: skipped (no idle senior in the seed)';
  else
    select count(*) into n from public.admin_crew_absences() a where senior_name = any(a.suggestions);
    res := res || E'\ncover suggestions skip demoted seniors: ' || case when n = 0 then 'ok' else 'BAD (suggested ' || n || 'x)' end;
  end if;

  -- A future slot with room that v isn't on, so a refused claim means the role check, not a full slot.
  select ds.id into free_slot from duty_slots ds
   where ds.slot_date >= (now() at time zone 'America/Denver')::date
     and (select count(*) from duty_assignments da where da.duty_slot_id = ds.id) < ds.capacity
     and not exists (select 1 from duty_assignments da where da.duty_slot_id = ds.id and da.volunteer_id = v)
   order by ds.slot_date limit 1;

  -- After the change: no volunteer powers left.
  perform set_config('request.jwt.claims', v_claims, true);
  select count(*) into n from updates where audience = 'volunteers';
  res := res || E'\ndemoted reads volunteer updates: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
  select count(*) into n from schedule_items;
  res := res || E'\ndemoted reads camp schedule: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
  begin
    insert into duty_assignments (duty_slot_id, volunteer_id) values (free_slot, v);
    res := res || E'\ndemoted claims a free duty slot: ALLOWED (BAD)';
  exception when others then res := res || E'\ndemoted claims a free duty slot: refused ok'; end;
  begin
    insert into crew_absences (volunteer_id, from_date, to_date) values (v, w + 30, w + 30);
    res := res || E'\ndemoted reports a crew absence: ALLOWED (BAD)';
  exception when others then res := res || E'\ndemoted reports a crew absence: refused ok'; end;
  begin
    perform public.update_my_volunteer_prefs(true, true, 'Intro to Java', 'Web Development');
    res := res || E'\ndemoted edits volunteer preferences: ALLOWED (BAD)';
  exception when others then res := res || E'\ndemoted edits volunteer preferences: refused ok'; end;
  begin
    perform public.request_change(null, 'crew_switch', '[TEST] switch me');
    res := res || E'\ndemoted files a crew switch: ALLOWED (BAD)';
  exception when others then res := res || E'\ndemoted files a crew switch: refused ok'; end;
  begin
    perform public.request_change(null, 'other', '[TEST] a general question');
    res := res || E'\nnon-volunteer can still file a general request: ok';
  exception when others then res := res || E'\nnon-volunteer can still file a general request: BAD (' || sqlerrm || ')'; end;

  -- Re-promote: access comes back.
  perform set_config('request.jwt.claims', admin_claims, true);
  update profiles set role = 'volunteer' where id = v;
  perform set_config('request.jwt.claims', v_claims, true);
  select count(*) into n from updates where audience = 'volunteers';
  res := res || E'\nre-promoted reads volunteer updates again: ' || case when n > 0 then 'ok' else 'BAD' end;
  begin
    perform public.update_my_volunteer_prefs(true, true, 'Intro to Java', 'Web Development');
    res := res || E'\nre-promoted edits preferences: ok';
  exception when others then res := res || E'\nre-promoted edits preferences: BAD (' || sqlerrm || ')'; end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;
rollback;

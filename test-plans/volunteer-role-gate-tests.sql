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

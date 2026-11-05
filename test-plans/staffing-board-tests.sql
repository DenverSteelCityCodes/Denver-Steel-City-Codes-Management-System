-- Spec 39 (#218). Apply migration_staffing_board.sql, then private.reset_demo(), before running.
-- No real names or contacts. The final exception rolls back ALL fixtures and impersonation.
-- Every result line should end in ok. Also re-run volunteer-onboarding-tests.sql and
-- volunteer-hours-tests.sql for the shared guard / hours helper (see the notes in those suites).
do $$
declare
  yr int := private.current_camp_year();
  adm uuid := (select id from profiles where role = 'admin' order by id limit 1);
  parent uuid := (select id from profiles where role = 'parent' order by id limit 1);
  v uuid[] := '{}'; who uuid; i int;
  w1 uuid; w2 uuid; cls uuid; override_cls uuid;
  red_sec uuid; amber_sec uuid; green_sec uuid; both_sec uuid; move_sec uuid;
  blank_sec uuid; child uuid; duty uuid; dt uuid;
  res text := ''; n int; j jsonb; x jsonb; h record; role_id uuid;
  claims_adm text; h_msg text;
begin
  if adm is null or parent is null then raise exception 'Run after the demo seed'; end if;
  claims_adm := json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text;
  insert into sessions (name, year, start_date, end_date, is_active) values
    ('[TEST] Nebula Week 1', yr, '2000-06-05', '2000-06-09', false) returning id into w1;
  insert into sessions (name, year, start_date, end_date, is_active) values
    ('[TEST] Nebula Week 2', yr, '2000-06-12', '2000-06-16', false) returning id into w2;
  insert into season_settings (year, target_campers_per_crew, min_crew_per_section) values (yr, 4, 2)
    on conflict (year) do update set target_campers_per_crew = 4, min_crew_per_section = 2;
  insert into classes (name) values ('[TEST] Nebula weaving') returning id into cls;
  insert into classes (name, min_teachers) values ('[TEST] Comet crafting', 3) returning id into override_cls;
  for i in 1..8 loop
    who := private.demo_user('staffing-test-' || i || '@example.com', '[TEST] Nebula Mentor ' || i, 'volunteer');
    v := array_append(v, who);
    insert into volunteers (id, experience_level, availability_week_1, availability_week_2, accepted_at)
      values (who, 'senior', true, true, now());
    insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school,
      shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status)
      values (who, '[TEST] Nebula', 'Mentor ' || i, 'staffing-test-' || i || '@example.com', '303-555-0101',
        18, '12th', '[TEST] Orbit School', 'M', 'Help campers learn', '[TEST] Nebula weaving', '[TEST] Comet crafting', 'Nebula Mentor', 'accepted');
  end loop;
  -- Accepted this season already. The agreement is what the crewing guard still requires.
  -- v[8] is vetted too, so the removed-volunteer checks below are about removal.
  if to_regclass('public.volunteer_tasks') is not null then
    insert into onboarding_tasks (key, label, due_hours_after_accept, sort_order)
      values ('agreement', 'Signed volunteer agreement', 24, 5) on conflict (key) do nothing;
    insert into volunteer_tasks (volunteer_id, task_key, done_at, verified_by)
      select vid, 'agreement', greatest(now(), (private.season_start()::timestamp at time zone 'America/Denver')), adm from unnest(v) vid
      on conflict (volunteer_id, task_key) do update
        set done_at = excluded.done_at, verified_by = excluded.verified_by;
  end if;
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, room, lead_id)
    values (cls, '[TEST] Red', 5, 17, 30, 1, w1, '[TEST] Nebula 101', v[1]) returning id into red_sec;
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, lead_id)
    values (cls, '[TEST] Amber', 5, 17, 30, 1, w1, v[2]) returning id into amber_sec;
  insert into section_supports values (amber_sec, v[3]);
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, lead_id)
    values (override_cls, '[TEST] Override', 5, 17, 30, 1, w1, v[4]) returning id into green_sec;
  insert into section_supports values (green_sec, v[5]);
  insert into sections (class_id, label, age_min, age_max, capacity, week)
    values (cls, '[TEST] Both', 5, 17, 10, null) returning id into both_sec;

  -- Room checks: normalisation, different weeks, no-session rows, blanks, updates.
  begin
    insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, room)
      values (cls, '[TEST] Clash', 5, 17, 10, 1, w1, '  [test]   NEBULA 101  ');
    res := res || E'\nroom case and extra spaces same week: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nroom case and extra spaces same week: ok'; end;
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, room)
    values (cls, '[TEST] Other week', 5, 17, 10, 2, w2, '[TEST] Nebula 101') returning id into move_sec;
  res := res || E'\nsame room in a different week: ok';
  begin
    update sections set room = '[TEST] NEBULA 101' where id = both_sec;
    res := res || E'\nno-session room clashes with either week: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nno-session room clashes with either week: ok'; end;
  update sections set room = '[TEST] Both Room' where id = both_sec;
  begin
    update sections set room = '  [test] both room ' where id = move_sec;
    res := res || E'\nweek room clashes with no-session room: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nweek room clashes with no-session room: ok'; end;
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, room)
    values (cls, '[TEST] Blank room', 5, 17, 10, 1, w1, '   ') returning id into blank_sec;
  update sections set room = '' where id = amber_sec;
  res := res || E'\nblank rooms ignored: ok';

  -- All writes below exercise admin RLS and the MFA role check.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  insert into week_roles (volunteer_id, session_id, role, note) values (v[6], w1, 'floater', 'Report to room 104 at 8:15') returning id into role_id;
  insert into week_roles (volunteer_id, session_id, role) values (v[7], w1, 'admin_room');
  select count(*) into n from week_roles where session_id = w1;
  res := res || E'\nadmin writes and reads week roles: ' || case when n = 2 then 'ok' else 'BAD' end;
  begin
    insert into week_roles (volunteer_id, session_id, role) values (v[1], w1, 'floater');
    res := res || E'\nlead to week role: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nlead to week role: ok'; end;
  begin
    insert into week_roles (volunteer_id, session_id, role) values (v[3], w1, 'floater');
    res := res || E'\nsupport to week role: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nsupport to week role: ok'; end;
  begin
    update sections set lead_id = v[6] where id = blank_sec;
    res := res || E'\nweek role to lead: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nweek role to lead: ok'; end;
  begin
    insert into section_supports values (blank_sec, v[6]);
    res := res || E'\nweek role to support: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nweek role to support: ok'; end;
  begin
    insert into section_supports values (both_sec, v[6]);
    res := res || E'\nweek role conflicts with both-weeks crew: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nweek role conflicts with both-weeks crew: ok'; end;
  insert into section_supports values (move_sec, v[6]);
  res := res || E'\nweek role and crew in different weeks: ok';
  begin
    update sections set session_id = w1, room = null where id = move_sec;
    res := res || E'\nmoving support-only section checks week roles: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nmoving support-only section checks week roles: ok'; end;
  begin
    update week_roles set session_id = w2 where id = role_id;
    res := res || E'\nmoving week role checks existing crew: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nmoving week role checks existing crew: ok'; end;
  begin
    insert into week_roles (volunteer_id, session_id, role) values (v[6], w1, 'admin_room');
    res := res || E'\none role per volunteer/week: BAD (allowed)';
  exception when unique_violation then res := res || E'\none role per volunteer/week: ok'; end;

  -- Guard is shared by sections, supports and week roles; invalid states cannot be assigned.
  -- These eight are accepted this season with a verified agreement, so a refusal here is the
  -- removal. The other gaps are crewing-guard-tests.sql.
  execute 'reset role';
  update volunteers set removed_at = now() where id = v[8];
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  begin
    insert into week_roles (volunteer_id, session_id, role) values (v[8], w1, 'floater');
    res := res || E'\nremoved volunteer can''t take a week role: BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nremoved volunteer can''t take a week role: ok'; end;
  begin
    update sections set lead_id = v[8] where id = blank_sec;
    res := res || E'\nremoved volunteer can''t lead a section (same guard): BAD (allowed)';
  exception when sqlstate 'P0001' then res := res || E'\nremoved volunteer can''t lead a section (same guard): ok'; end;
  execute 'reset role';
  update volunteers set removed_at = null where id = v[8];

  -- Exact maths: ratio boundaries, course override, seated grades, waitlist and planned absences.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  for i in 1..11 loop
    insert into students (parent_id, full_name, first_name, age, grade)
      values (parent, '[TEST] Nebula Camper ' || i, 'Nebula ' || i, 12, case when i % 2 = 0 then '6th' else '8th' end) returning id into child;
    insert into registrations (student_id, section_id, status) values (child, amber_sec, case when i = 11 then 'waitlisted'::registration_status else 'confirmed'::registration_status end);
  end loop;
  insert into crew_absences (volunteer_id, from_date, to_date) values (v[2], '2000-06-05', '2000-06-09');
  j := public.admin_staffing(w1);
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = amber_sec::text;
  res := res || E'\nadmin_staffing seated/waitlist/crew/required/grades and amber upper boundary: ' ||
    case when (x->>'seated')::int = 10 and (x->>'waitlist')::int = 1 and (x->>'crew')::int = 2
      and (x->>'required')::int = 3 and (x->>'campers_per_crew')::numeric = 5 and x->>'tone' = 'amber'
      and x->>'grade_low' = '6th' and x->>'grade_high' = '8th' then 'ok' else 'BAD ' || x::text end;
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = red_sec::text;
  res := res || E'\nminimum is red even with no campers: ' || case when x->>'tone' = 'red' and x->>'word' = 'Short 1 teacher' and (x->>'small')::boolean then 'ok' else 'BAD' end;
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = green_sec::text;
  res := res || E'\ncourse override minimum: ' || case when (x->>'min_crew')::int = 3 and x->>'tone' = 'red' and (x->>'required')::int = 3 then 'ok' else 'BAD' end;
  insert into section_supports values (green_sec, v[8]);
  j := public.admin_staffing(w1);
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = green_sec::text;
  res := res || E'\ngreen at or under target with minimum met: ' || case when x->>'tone' = 'green' then 'ok' else 'BAD' end;
  -- Above 1.25 is red; target itself is green.
  update registrations set status = 'confirmed' where section_id = amber_sec and status = 'waitlisted';
  j := public.admin_staffing(w1);
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = amber_sec::text;
  res := res || E'\nratio greater than 1.25 target is red: ' || case when x->>'tone' = 'red' then 'ok' else 'BAD' end;
  update registrations set status = 'cancelled' where id in (select id from registrations where section_id = amber_sec order by id limit 3);
  j := public.admin_staffing(w1);
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = amber_sec::text;
  res := res || E'\nratio exactly target is green: ' || case when x->>'tone' = 'green' and (x->>'campers_per_crew')::numeric = 4 then 'ok' else 'BAD' end;
  res := res || E'\nno-session section included in both weeks: ' || case when
    exists (select 1 from jsonb_array_elements(public.admin_staffing(w1)->'sections') t where t->>'section_id' = both_sec::text)
    and exists (select 1 from jsonb_array_elements(public.admin_staffing(w2)->'sections') t where t->>'section_id' = both_sec::text) then 'ok' else 'BAD' end;
  res := res || E'\nweek roles counted in total, not section crew: ' || case when (j->>'crew_total')::int = 8 then 'ok' else 'BAD ' || (j->>'crew_total') end;
  select value into x from jsonb_array_elements(j->'courses') where value->>'class_id' = cls::text;
  res := res || E'\ncourse required/assigned counts: ' || case when (x->>'required')::int = 8 and (x->>'assigned')::int = 3 then 'ok' else 'BAD ' || x::text end;

  update season_settings set target_campers_per_crew = 3, min_crew_per_section = 1 where year = yr;
  j := public.admin_staffing(w1);
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = amber_sec::text;
  res := res || E'\nsettings update immediately changes required crew and colour: ' || case when
    (j->>'target')::int = 3 and (x->>'required')::int = 3 and x->>'tone' = 'red' then 'ok' else 'BAD' end;
  update season_settings set target_campers_per_crew = 4, min_crew_per_section = 2 where year = yr;
  update classes set min_teachers = 4 where id = override_cls;
  j := public.admin_staffing(w1);
  select value into x from jsonb_array_elements(j->'sections') where value->>'section_id' = green_sec::text;
  res := res || E'\ncourse minimum update changes board: ' || case when (x->>'required')::int = 4 and x->>'tone' = 'red' then 'ok' else 'BAD' end;
  update classes set min_teachers = 3 where id = override_cls;
  update sessions set needs_teachers = true where id = w1;
  res := res || E'\nneeds_teachers returned by board: ' || case when (public.admin_staffing(w1)->>'needs_teachers')::boolean then 'ok' else 'BAD' end;

  -- Duty-only holders are separate from unassigned, and role holders accrue service hours.
  delete from section_supports where volunteer_id = v[8] and section_id = green_sec;
  select id into dt from duty_types order by name limit 1;
  insert into duty_slots (duty_type_id, session_id, slot_date) values (dt, w1, '2000-06-05') returning id into duty;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (duty, v[8]);
  j := public.admin_staffing(w1);
  res := res || E'\nduty holder listed separately from unassigned: ' || case when
    exists (select 1 from jsonb_array_elements(j->'duty_holders') t where t->>'volunteer_id' = v[8]::text)
    and not exists (select 1 from jsonb_array_elements(j->'unassigned') t where t->>'volunteer_id' = v[8]::text) then 'ok' else 'BAD' end;
  delete from duty_assignments where duty_slot_id = duty;
  j := public.admin_staffing(w1);
  res := res || E'\naccepted available unassigned found: ' || case when exists
    (select 1 from jsonb_array_elements(j->'unassigned') t where t->>'volunteer_id' = v[8]::text) then 'ok' else 'BAD' end;
  select value into x from jsonb_array_elements(j->'courses') where value->>'class_id' = cls::text;
  res := res || E'\ncourse ranked available counts additional willing volunteers: ' || case when (x->>'ranked_available')::int = 1 then 'ok' else 'BAD' end;
  res := res || E'\nprojected need is total capacity divided by target, rounded up: ' || case when (j->>'projected_need')::int = 28 then 'ok' else 'BAD' end;
  update week_roles set note = '[TEST] Updated report location' where id = role_id;
  select count(*) into n from notifications where template = 'week_role_changed' and recipient_profile = v[6]
    and payload->>'note' = '[TEST] Updated report location';
  res := res || E'\nweek-role edit queues one notice: ' || case when n = 1 then 'ok' else 'BAD' end;
  execute 'reset role';
  select * into h from private.volunteer_week_hours(v[6], w1);
  res := res || E'\nweek role earns 40 service hours: ' || case when h.crewed and h.crew_minutes = 2400 then 'ok' else 'BAD' end;

  -- RLS: own rows only; no volunteer writes; parents and anon refused.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v[6], 'role', 'authenticated')::text, true);
  select count(*) into n from week_roles where session_id = w1;
  res := res || E'\nvolunteer reads only their role: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from week_roles where volunteer_id = v[7];
  res := res || E'\nother volunteer role hidden: ' || case when n = 0 then 'ok' else 'BAD' end;
  update week_roles set note = 'Not allowed' where id = role_id;
  get diagnostics n = row_count;
  res := res || E'\nvolunteer cannot update: ' || case when n = 0 then 'ok' else 'BAD' end;
  begin
    insert into week_roles (volunteer_id, session_id, role) values (v[7], w2, 'floater');
    res := res || E'\nvolunteer cannot insert: BAD (allowed)';
  exception when insufficient_privilege then res := res || E'\nvolunteer cannot insert: ok'; end;
  delete from week_roles where id = role_id;
  get diagnostics n = row_count;
  res := res || E'\nvolunteer cannot delete: ' || case when n = 0 then 'ok' else 'BAD' end;
  -- A refused insert for a colleague who leads a section mustn't say which section (the guards
  -- that would name it run after the admin-only check).
  begin
    insert into week_roles (volunteer_id, session_id, role) values (v[1], w1, 'floater');
    res := res || E'\nvolunteer insert for a lead: BAD (allowed)';
  exception when others then
    get stacked diagnostics h_msg = message_text;
    res := res || E'\nvolunteer insert for a lead says only "Admins only": ' || case when h_msg = 'Admins only' then 'ok' else 'BAD (' || h_msg || ')' end;
  end;
  begin perform public.admin_staffing(w1); res := res || E'\nvolunteer cannot call admin RPC: BAD';
  exception when insufficient_privilege then res := res || E'\nvolunteer cannot call admin RPC: ok'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', parent, 'role', 'authenticated')::text, true);
  select count(*) into n from week_roles;
  res := res || E'\nparent reads no roles: ' || case when n = 0 then 'ok' else 'BAD' end;
  begin
    insert into week_roles (volunteer_id, session_id, role) values (v[7], w2, 'floater');
    res := res || E'\nparent cannot write: BAD';
  exception when insufficient_privilege then res := res || E'\nparent cannot write: ok'; end;
  begin perform public.admin_staffing(w1); res := res || E'\nparent cannot call admin RPC: BAD';
  exception when insufficient_privilege then res := res || E'\nparent cannot call admin RPC: ok'; end;
  execute 'reset role'; execute 'set local role anon';
  perform set_config('request.jwt.claims', '{}', true);
  begin perform * from week_roles; res := res || E'\nanon table refused: BAD';
  exception when insufficient_privilege then res := res || E'\nanon table refused: ok'; end;
  begin perform public.admin_staffing(w1); res := res || E'\nanon RPC refused: BAD';
  exception when insufficient_privilege then res := res || E'\nanon RPC refused: ok'; end;
  execute 'reset role'; execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  perform public.remove_from_season(v[6], '[TEST] Nebula season finished');
  select count(*) into n from week_roles where volunteer_id = v[6];
  res := res || E'\nseason removal drops week roles: ' || case when n = 0 then 'ok' else 'BAD' end;
  -- A trailing tab or doubled space is still the same room.
  execute 'reset role';
  res := res || E'\nroom key ignores every kind of whitespace: ' ||
    case when private.room_key(E'Room  101\t') = private.room_key(' room 101') and private.room_key(E' \t ') is null then 'ok' else 'BAD' end;

  -- Demoting a volunteer releases their week role and takes them off the board's lists.
  insert into week_roles (volunteer_id, session_id, role) values (v[7], w2, 'admin_room');
  update profiles set role = 'parent' where id = v[7];
  select count(*) into n from week_roles where volunteer_id = v[7];
  res := res || E'\ndemotion releases week roles: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  j := public.admin_staffing(w2);
  res := res || E'\ndemoted account isn''t listed as available crew: ' || case when not exists
    (select 1 from jsonb_array_elements(j->'unassigned') t where t->>'volunteer_id' = v[7]::text) then 'ok' else 'BAD' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

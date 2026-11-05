-- Tests for migration_crewing_guard.sql (spec 35, #220). Run against the demo DB after
-- private.reset_demo(), with migration_crewing_guard.sql applied (and migration_staffing_board.sql
-- when week roles should be checked). The block raises its results at the end, so every test
-- write rolls back. Every line should end in "ok".
--
-- Fixture: Bella, accepted this season with a verified agreement, and one empty section.
-- Each refusal breaks exactly one condition, then restores her. Week roles are checked only
-- when that table exists.
do $$
declare
  adm uuid := (select id from profiles where role = 'admin' order by id limit 1);
  bella uuid; cls uuid; sec uuid; sess uuid; pending uuid; quinn uuid;
  res text := ''; m text; spot text; mode text; expected text; st text; n int; reason text;
  season_at timestamptz := (private.season_start()::timestamp at time zone 'America/Denver');
begin
  if adm is null then raise exception 'Run after the demo seed (an admin is required)'; end if;
  select id into sess from sessions order by is_active desc, start_date limit 1;

  bella := private.demo_user('crewing-guard-bella@example.com', 'Bella Nguyen', 'volunteer');
  insert into volunteers (id, experience_level, availability_week_1, availability_week_2, accepted_at, preferred_name)
    values (bella, 'senior', true, true, now(), null)
    on conflict (id) do update set accepted_at = now(), removed_at = null, removed_reason = null, preferred_name = null;
  insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school,
    shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
    values (bella, 'Bella', 'Nguyen', 'crewing-guard-bella@example.com', '303-555-0198',
      17, '12th', '[TEST] Crewing School', 'M', 'Help campers learn', '[TEST] Crewing', '[TEST] Guard',
      'Bella Nguyen', 'accepted', now() - interval '2 days');
  insert into onboarding_tasks (key, label, due_hours_after_accept, sort_order)
    values ('agreement', 'Signed volunteer agreement', 24, 5)
    on conflict (key) do nothing;
  insert into volunteer_tasks (volunteer_id, task_key, done_at, verified_by)
    values (bella, 'agreement', now(), adm)
    on conflict (volunteer_id, task_key) do update set done_at = now(), verified_by = excluded.verified_by;

  insert into classes (name) values ('[TEST] Crewing guard') returning id into cls;
  insert into sections (class_id, label, age_min, age_max, capacity, week)
    values (cls, '[TEST] CG', 8, 14, 10, 1) returning id into sec;

  foreach mode in array array['removed', 'application', 'acceptance', 'agreement', 'old-agreement'] loop
    if mode = 'removed' then
      update volunteers set removed_at = now() where id = bella;
      expected := 'Bella was removed from this season, so they can''t join a crew';
    elsif mode = 'application' then
      insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school,
        shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
        values (bella, 'Bella', 'Nguyen', 'crewing-guard-bella-2@example.com', '303-555-0197',
          17, '12th', '[TEST] Crewing School', 'M', 'Help campers learn', '[TEST] Crewing', '[TEST] Guard',
          'Bella Nguyen', 'pending', now()) returning id into pending;
      expected := 'Bella''s latest application isn''t accepted, so they can''t join a crew';
    elsif mode = 'acceptance' then
      update volunteers set accepted_at = season_at - interval '1 second' where id = bella;
      expected := 'Bella wasn''t accepted this season, so they can''t join a crew';
    elsif mode = 'agreement' then
      update volunteer_tasks set verified_by = null where volunteer_id = bella and task_key = 'agreement';
      expected := 'Bella''s volunteer agreement isn''t verified yet, so they can''t join a crew';
    else
      update volunteer_tasks set done_at = season_at - interval '1 second'
        where volunteer_id = bella and task_key = 'agreement';
      expected := 'Bella''s volunteer agreement isn''t verified yet, so they can''t join a crew';
    end if;

    foreach spot in array array['lead', 'support', 'week role'] loop
      if spot = 'week role' and to_regclass('public.week_roles') is null then
        if mode = 'removed' then
          res := res || E'\nweek role checks: no week_roles table, skipped ok';
        end if;
        continue;
      end if;
      begin
        if spot = 'lead' then
          update sections set lead_id = bella where id = sec;
        elsif spot = 'support' then
          insert into section_supports (section_id, volunteer_id) values (sec, bella);
        elsif sess is null then
          raise exception 'no session for a week role';
        else
          insert into week_roles (volunteer_id, session_id, role) values (bella, sess, 'floater');
        end if;
        res := res || E'\n' || spot || ', ' || mode || ': ALLOWED (BAD)';
      exception when others then
        get stacked diagnostics m = message_text;
        res := res || E'\n' || spot || ', ' || mode || ': ' || case when m = expected then 'ok' else 'BAD (' || m || ')' end;
      end;
      update sections set lead_id = null where id = sec;
      delete from section_supports where section_id = sec and volunteer_id = bella;
      if to_regclass('public.week_roles') is not null then
        delete from week_roles where volunteer_id = bella;
      end if;
    end loop;

    if mode = 'removed' then
      update volunteers set removed_at = null where id = bella;
    elsif mode = 'application' then
      delete from volunteer_applications where id = pending;
    elsif mode = 'acceptance' then
      update volunteers set accepted_at = now() where id = bella;
    elsif mode = 'agreement' then
      update volunteer_tasks set verified_by = adm where volunteer_id = bella and task_key = 'agreement';
    else
      update volunteer_tasks set done_at = now() where volunteer_id = bella and task_key = 'agreement';
    end if;
  end loop;

  -- The season boundary counts: accepted_at and done_at equal to Denver midnight are this season.
  update volunteers set accepted_at = season_at where id = bella;
  update volunteer_tasks set done_at = season_at, verified_by = adm where volunteer_id = bella and task_key = 'agreement';
  begin
    update sections set lead_id = bella where id = sec;
    res := res || E'\naccepted and agreement at the season start, as lead: ' || case when (select lead_id from sections where id = sec) = bella then 'ok' else 'BAD' end;
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\naccepted and agreement at the season start, as lead: BAD (' || m || ')';
  end;
  update sections set lead_id = null where id = sec;
  res := res || E'\nclearing a lead: ' || case when (select lead_id from sections where id = sec) is null then 'ok' else 'BAD' end;

  update volunteers set accepted_at = now() where id = bella;
  update volunteer_tasks set done_at = now() where volunteer_id = bella and task_key = 'agreement';
  insert into section_supports (section_id, volunteer_id) values (sec, bella);
  res := res || E'\nvetted volunteer as support: ' || case when exists (select 1 from section_supports where section_id = sec and volunteer_id = bella) then 'ok' else 'BAD' end;
  -- Removing a support is allowed even after they are removed from the season.
  update volunteers set removed_at = now() where id = bella;
  delete from section_supports where section_id = sec and volunteer_id = bella;
  res := res || E'\nremoving a support while removed: ' || case when not exists (select 1 from section_supports where section_id = sec and volunteer_id = bella) then 'ok' else 'BAD' end;
  update volunteers set removed_at = null where id = bella;

  -- Clearing a lead stays allowed after removal too (the trigger does not run for NULL).
  update sections set lead_id = bella where id = sec;
  update volunteers set removed_at = now() where id = bella;
  update sections set lead_id = null where id = sec;
  res := res || E'\nclearing a lead while removed: ' || case when (select lead_id from sections where id = sec) is null then 'ok' else 'BAD' end;
  update volunteers set removed_at = null where id = bella;

  if to_regclass('public.week_roles') is not null and sess is not null then
    begin
      insert into week_roles (volunteer_id, session_id, role) values (bella, sess, 'admin_room');
      res := res || E'\nvetted volunteer in a week role: ok';
    exception when others then
      get stacked diagnostics m = message_text;
      res := res || E'\nvetted volunteer in a week role: BAD (' || m || ')';
    end;
    delete from week_roles where volunteer_id = bella;
    res := res || E'\nremoving a week role: ' || case when not exists (select 1 from week_roles where volunteer_id = bella) then 'ok' else 'BAD' end;
  end if;

  -- A signed-in non-admin must not learn another volunteer's name or vetting. The guard reads
  -- nothing until it has refused them. auth.uid() comes from the jwt; staying the table owner
  -- for the section updates lets the statement reach the trigger (RLS would otherwise hide the
  -- row). The inserts run as `authenticated`, which is the path that hits the trigger before RLS.
  quinn := private.demo_user('crewing-guard-quinn@example.com', 'Quinn Secret', 'volunteer');
  insert into volunteers (id, experience_level, availability_week_1, availability_week_2)
    values (quinn, 'senior', true, true)
    on conflict (id) do update set removed_at = null;
  update sections set lead_id = bella, room = null where id = sec;

  perform set_config('request.jwt.claims', json_build_object('sub', bella, 'role', 'authenticated')::text, true);
  update sections set room = '[TEST] CG lead room' where id = sec;
  res := res || E'\nlead update that doesn''t touch lead_id: ' ||
    case when (select room from sections where id = sec) = '[TEST] CG lead room' and (select lead_id from sections where id = sec) = bella
      then 'ok' else 'BAD' end;
  update sections set room = '[TEST] CG same lead', lead_id = bella where id = sec;
  res := res || E'\nlead update that repeats the same lead_id: ' ||
    case when (select room from sections where id = sec) = '[TEST] CG same lead' and (select lead_id from sections where id = sec) = bella
      then 'ok' else 'BAD' end;
  begin
    update sections set lead_id = quinn where id = sec;
    res := res || E'\nvolunteer changes the lead: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, st = returned_sqlstate;
    res := res || E'\nvolunteer changes the lead: ' ||
      case when m = 'Admins only' and st = '42501' and position('Quinn' in m) = 0 and position('Secret' in m) = 0 and (select lead_id from sections where id = sec) = bella
        then 'ok' else 'BAD (' || st || ' ' || m || ')' end;
  end;

  execute 'set local role authenticated';
  begin
    insert into section_supports (section_id, volunteer_id) values (sec, quinn);
    res := res || E'\nvolunteer adds a support: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, st = returned_sqlstate;
    res := res || E'\nvolunteer adds a support: ' ||
      case when m = 'Admins only' and st = '42501' and position('Quinn' in m) = 0 and position('Secret' in m) = 0
        then 'ok' else 'BAD (' || st || ' ' || m || ')' end;
  end;
  begin
    insert into sections (class_id, label, age_min, age_max, capacity, week, lead_id)
      values (cls, '[TEST] CG sneak', 8, 14, 10, 1, quinn);
    res := res || E'\nvolunteer inserts a lead: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, st = returned_sqlstate;
    res := res || E'\nvolunteer inserts a lead: ' ||
      case when m = 'Admins only' and st = '42501' and position('Quinn' in m) = 0 and position('Secret' in m) = 0
        then 'ok' else 'BAD (' || st || ' ' || m || ')' end;
  end;

  -- admin_crew_blocks() is the same function the trigger raises, and only an admin can call it.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.admin_crew_blocks();
  res := res || E'\nadmin_crew_blocks lists every volunteer: ' ||
    case when n = (select count(*) from volunteers) then 'ok' else 'BAD (' || n || ')' end;
  select b.reason into reason from public.admin_crew_blocks() b where b.volunteer_id = bella;
  res := res || E'\nvetted volunteer has no block: ' || case when reason is null then 'ok' else 'BAD (' || reason || ')' end;
  update volunteers set removed_at = now() where id = bella;
  select b.reason into reason from public.admin_crew_blocks() b where b.volunteer_id = bella;
  expected := 'Bella was removed from this season, so they can''t join a crew';
  res := res || E'\nadmin_crew_blocks matches the guard: ' || case when reason = expected then 'ok' else 'BAD (' || coalesce(reason, 'null') || ')' end;

  perform set_config('request.jwt.claims', json_build_object('sub', bella, 'role', 'authenticated')::text, true);
  begin
    perform * from public.admin_crew_blocks();
    res := res || E'\nvolunteer calls admin_crew_blocks: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, st = returned_sqlstate;
    res := res || E'\nvolunteer calls admin_crew_blocks: ' ||
      case when m = 'Admins only' and st = '42501' then 'ok' else 'BAD (' || st || ' ' || m || ')' end;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  update sections set lead_id = null where id = sec;
  begin
    update sections set lead_id = bella where id = sec;
    res := res || E'\nowner sees the same removal sentence: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nowner sees the same removal sentence: ' || case when m = expected then 'ok' else 'BAD (' || m || ')' end;
  end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

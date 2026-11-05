-- Tests for migration_volunteer_hours.sql (spec B2). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Two test weeks are dated in 2000 but filed under this camp year, so they're its Weeks 1 and 2
-- (the demo's own weeks become 3 and 4 inside this test only). Week 1 runs Mon 2000-06-05 to
-- Sun 2000-06-11, so its weekend is inside the session dates.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  yr int := private.current_camp_year();
  cls uuid := (select id from classes limit 1);
  t_duty uuid := (select id from duty_types order by name limit 1);
  dmin int := (select minutes from duty_types order by name limit 1);
  w1 uuid; w2 uuid; fut uuid;
  vol uuid; untimed_vol uuid; duty_vol uuid; gone uuid;
  a uuid; c uuid; nw uuid; s1 uuid; s2 uuid; s3 uuid; s4 uuid;
  h record; res text := ''; n int;
  today date := (now() at time zone 'America/Denver')::date;
begin
  -- No week role (spec 39): the guard keeps week-role holders off crews, and these all crew.
  select v.id into vol from volunteers v join profiles p on p.id = v.id where v.removed_at is null and v.id not in (select volunteer_id from week_roles) order by p.display_name limit 1;
  select v.id into untimed_vol from volunteers v join profiles p on p.id = v.id where v.removed_at is null and v.id not in (select volunteer_id from week_roles) order by p.display_name offset 1 limit 1;
  select v.id into duty_vol from volunteers v join profiles p on p.id = v.id where v.removed_at is null and v.id not in (select volunteer_id from week_roles) order by p.display_name offset 2 limit 1;
  select v.id into gone from volunteers v join profiles p on p.id = v.id where v.removed_at is null and v.id not in (select volunteer_id from week_roles) order by p.display_name offset 3 limit 1;

  -- Crewing guard: fill a missing this-season acceptance or verified agreement. An acceptance
  -- or agreement that already counts is left as it is.
  if to_regclass('public.volunteer_tasks') is not null then
    insert into onboarding_tasks (key, label, due_hours_after_accept, sort_order)
      values ('agreement', 'Signed volunteer agreement', 24, 5) on conflict (key) do nothing;
    update volunteers set accepted_at = greatest(now(), (private.season_start()::timestamp at time zone 'America/Denver'))
      where id in (vol, untimed_vol, duty_vol, gone)
        and (accepted_at is null or accepted_at < (private.season_start()::timestamp at time zone 'America/Denver'));
    insert into volunteer_tasks (volunteer_id, task_key, done_at, verified_by)
      select x, 'agreement', greatest(now(), (private.season_start()::timestamp at time zone 'America/Denver')), admin_id from unnest(array[vol, untimed_vol, duty_vol, gone]) x
      where x is not null
      on conflict (volunteer_id, task_key) do update
        set done_at = excluded.done_at, verified_by = excluded.verified_by
        where volunteer_tasks.verified_by is null
           or volunteer_tasks.done_at is null
           or volunteer_tasks.done_at < (private.season_start()::timestamp at time zone 'America/Denver');
  end if;

  insert into sessions (name, year, start_date, end_date, is_active) values ('[TEST] W1', yr, '2000-06-05', '2000-06-11', false) returning id into w1;
  insert into sessions (name, year, start_date, end_date, is_active) values ('[TEST] W2', yr, '2000-06-12', '2000-06-16', false) returning id into w2;
  insert into sessions (name, year, start_date, end_date, is_active) values ('[TEST] future', yr, today + 1, today + 5, false) returning id into fut;

  -- vol: leads A and supports B in Week 1 (one crewed day each weekday, 8 hours); off Wednesday.
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, start_time, end_time, lead_id)
    values (cls, '[TEST] A', 8, 17, 10, 1, w1, '09:00', '12:00', vol) returning id into a;
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, start_time, end_time)
    values (cls, '[TEST] B', 8, 17, 10, 1, w1, '11:00', '15:00') returning id into nw;
  insert into section_supports (section_id, volunteer_id) values (nw, vol);
  insert into crew_absences (volunteer_id, from_date, to_date) values (vol, '2000-06-07', '2000-06-07');
  -- A duty on a crewed day is inside its 8 hours; one on the day off counts nothing; one on the
  -- Saturday (inside the session dates, not a crewed day) adds its minutes.
  insert into duty_slots (duty_type_id, session_id, slot_date) values (t_duty, w1, '2000-06-06') returning id into s1;
  insert into duty_slots (duty_type_id, session_id, slot_date) values (t_duty, w1, '2000-06-07') returning id into s2;
  insert into duty_slots (duty_type_id, session_id, slot_date) values (t_duty, w1, '2000-06-10') returning id into s4;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s1, vol), (s2, vol), (s4, vol);

  select * into h from private.volunteer_week_hours(vol, w1);
  res := res || E'\nweekdays only, minus the day off, two sections one day: ' ||
    case when h.crew_days = 4 and h.crew_minutes = 4 * 480 then 'ok' else 'BAD ' || h::text end;
  res := res || E'\nonly the Saturday duty adds minutes: ' || case when h.duty_minutes = dmin then 'ok' else 'BAD ' || h::text end;

  -- A Week-2 section saved without its session row (week set, session_id null) counts in Week 2 only.
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, start_time, end_time, lead_id)
    values (cls, '[TEST] N', 8, 17, 10, 2, w2, '13:00', '14:00', vol) returning id into nw;
  update sections set session_id = null where id = nw;
  select * into h from private.volunteer_week_hours(vol, w1);
  res := res || E'\nweek-2 section without a session stays out of Week 1: ' || case when h.crew_minutes = 4 * 480 then 'ok' else 'BAD ' || h::text end;
  select * into h from private.volunteer_week_hours(vol, w2);
  res := res || E'\n...and counts in Week 2: ' || case when h.crew_days = 5 and h.crew_minutes = 5 * 480 then 'ok' else 'BAD ' || h::text end;

  -- A section with no times still counts: a full week is the advertised 40 hours, never more.
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id)
    values (cls, '[TEST] C', 8, 17, 10, 1, w1) returning id into c;
  insert into section_supports (section_id, volunteer_id) values (c, untimed_vol);
  select * into h from private.volunteer_week_hours(untimed_vol, w1);
  res := res || E'\nsection without times, full week = 40 hours: ' ||
    case when h.crewed and h.crew_days = 5 and h.crew_minutes = 40 * 60 then 'ok' else 'BAD ' || h::text end;

  -- A duty in a week the volunteer isn't crewed counts too.
  insert into duty_slots (duty_type_id, session_id, slot_date) values (t_duty, w2, '2000-06-13') returning id into s3;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s3, duty_vol);
  select * into h from private.volunteer_week_hours(duty_vol, w2);
  res := res || E'\nduty without crew: ' || case when not h.crewed and h.duty_minutes = dmin then 'ok' else 'BAD ' || h::text end;

  -- Future days count nothing.
  insert into sections (class_id, label, age_min, age_max, capacity, week, session_id, start_time, end_time, lead_id)
    values (cls, '[TEST] F', 8, 17, 10, 1, fut, '09:00', '12:00', vol);
  select * into h from private.volunteer_week_hours(vol, fut);
  res := res || E'\nfuture week: ' || case when h.crewed and h.crew_days = 0 and h.crew_minutes = 0 then 'ok' else 'BAD ' || h::text end;

  -- The volunteer reads only their own weeks, with the letter ready after the week.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  select count(*) into n from public.my_volunteer_hours() m where m.session_id = w1 and m.letter_ready
    and m.crew_minutes = 4 * 480 and m.week_number = 1;
  res := res || E'\nvolunteer sees their Week 1, letter ready: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from public.my_volunteer_hours() m where m.session_id = fut and not m.letter_ready;
  res := res || E'\nno letter before the week ends: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  begin
    perform * from public.admin_volunteer_hours(w1);
    res := res || E'\nvolunteer refused the admin list: BAD (allowed)';
  exception when insufficient_privilege then
    res := res || E'\nvolunteer refused the admin list: ok';
  end;

  -- Admins see everyone in the week except removed volunteers.
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);   -- the owner, not the volunteer above
  insert into section_supports (section_id, volunteer_id) values (a, gone);
  update volunteers set removed_at = now() where id = gone;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from public.admin_volunteer_hours(w1) r where r.volunteer_id in (vol, untimed_vol);
  res := res || E'\nadmin sees the crew: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from public.admin_volunteer_hours(w1) r where r.volunteer_id = gone;
  res := res || E'\nremoved volunteer left out: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from public.admin_volunteer_hours(w2) r where r.volunteer_id = duty_vol;
  res := res || E'\nadmin sees a duty-only volunteer: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  raise exception 'RESULTS %', res;
end $$;

-- Tests for migration_duty_minimums.sql (spec 38). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Admin sessions carry 'aal': 'aal2' so this also runs where admin MFA (spec 27) is required.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  today date := (now() at time zone 'America/Denver')::date;
  w2 sessions; vol uuid; other uuid; t_lunch uuid; t_break uuid;
  s1 uuid; s2 uuid; s3 uuid;
  res text := ''; n int; m int; st text;
begin
  -- Week 2 (starts a week from today in the demo) and a volunteer crewed in it.
  select * into w2 from sessions where is_active order by start_date offset 1 limit 1;
  select c.vid into vol from (select v.id vid from volunteers v where v.removed_at is null) c
   where exists (select 1 from private.crewed_sessions(c.vid) x where x.id = w2.id) limit 1;
  select c.vid into other from (select v.id vid from volunteers v where v.removed_at is null and v.id <> vol) c
   where exists (select 1 from private.crewed_sessions(c.vid) x where x.id = w2.id) limit 1;
  select id into t_lunch from duty_types where name = 'Lunch Duty';
  select id into t_break from duty_types where name = 'Break Supervision';
  update duty_types set minutes = 45 where id = t_lunch;
  update duty_types set minutes = 15 where id = t_break;

  -- The volunteer's Week 2 duties: exactly two lunches (90 minutes), both well outside the lock.
  delete from duty_assignments da using duty_slots ds
   where da.duty_slot_id = ds.id and da.volunteer_id = vol and ds.slot_date between w2.start_date and w2.end_date;
  insert into duty_slots (duty_type_id, session_id, slot_date, capacity) values (t_lunch, w2.id, w2.start_date + 1, 9) returning id into s1;
  insert into duty_slots (duty_type_id, session_id, slot_date, capacity) values (t_lunch, w2.id, w2.start_date + 2, 9) returning id into s2;
  insert into duty_slots (duty_type_id, session_id, slot_date, capacity) values (t_break, w2.id, w2.start_date + 3, 9) returning id into s3;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s1, vol), (s2, vol);
  m := private.duty_minutes(vol, w2.id);
  res := res || E'\nminutes add up by duty length: ' || case when m = 90 then 'ok' else 'BAD (' || m || ')' end;

  -- Before the deadline (deadline = the week's first day): dropping below the minimum is fine.
  insert into duty_settings (year, drop_lock_days, minutes_per_week, signup_deadline_days) values (w2.year, 3, 60, 0)
  on conflict (year) do update set drop_lock_days = 3, minutes_per_week = 60, signup_deadline_days = 0;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  select required_minutes || '/' || my_minutes || '/' || deadline into st from public.my_duty_weeks() where session_id = w2.id;
  res := res || E'\nvolunteer sees their week: ' || case when st = '60/90/' || w2.start_date then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  delete from duty_assignments where duty_slot_id = s2 and volunteer_id = vol;
  get diagnostics n = row_count;
  res := res || E'\nbefore the deadline, a drop below the minimum works: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s2, vol);
  select count(*) into n from notifications where template = 'duty_assigned';
  res := res || E'\nsigning yourself up sends no duty_assigned email: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  -- After the deadline.
  execute 'reset role';
  update duty_settings set signup_deadline_days = 10 where year = w2.year;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  begin
    delete from duty_assignments where duty_slot_id = s2 and volunteer_id = vol;
    res := res || E'\nafter the deadline, a drop to 45 of 60 minutes: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nafter the deadline, a drop to 45 of 60 minutes: refused ok'
               || case when sqlerrm like '%60-minute minimum%' then '' else ' (BAD message: ' || sqlerrm || ')' end;
  end;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s3, vol);
  delete from duty_assignments where duty_slot_id = s2 and volunteer_id = vol;
  get diagnostics n = row_count;
  res := res || E'\nafter the deadline, a drop that keeps 60 of 60 works: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- Shortfall: admins only.
  begin
    perform * from public.admin_duty_shortfall(w2.id);
    res := res || E'\nvolunteer reads the shortfall list: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer reads the shortfall list: refused ok'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) filter (where volunteer_id = vol), count(*) filter (where minutes >= required_minutes), count(*)
    into n, m, st from public.admin_duty_shortfall(w2.id);
  res := res || E'\nshortfall leaves out someone at the minimum: ' || case when n = 0 then 'ok' else 'BAD' end;
  res := res || E'\nshortfall lists only people under it: ' || case when m = 0 then 'ok (' || st || ' short)' else 'BAD' end;

  -- An admin assigns someone: they get one email.
  delete from duty_assignments where duty_slot_id = s2 and volunteer_id = other;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s2, other);
  select count(*) into n from notifications where template = 'duty_assigned' and recipient_profile = other
     and payload ->> 'duty' = 'Lunch Duty' and (payload ->> 'minutes')::int = 45;
  res := res || E'\nadmin assignment queues duty_assigned: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  -- Admins drop below the minimum after the deadline.
  delete from duty_assignments where duty_slot_id = s1 and volunteer_id = vol;
  get diagnostics n = row_count;
  res := res || E'\nadmin drops below the minimum: ' || case when n = 1 then 'ok' else 'BAD' end;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s1, vol);

  -- Reminders: from 2 days before the deadline, once per short volunteer and week.
  execute 'reset role';
  update duty_settings set signup_deadline_days = (w2.start_date - today) - 1 where year = w2.year;  -- deadline tomorrow
  delete from notifications where template = 'duty_minimum_reminder';
  perform private.send_duty_minimum_reminders();
  perform private.send_duty_minimum_reminders();
  select count(*), count(*) filter (where recipient_profile = vol), count(distinct recipient_profile)
    into n, m, st from notifications where template = 'duty_minimum_reminder' and payload ->> 'week' = w2.name;
  res := res || E'\nreminders go once each: ' || case when n > 0 and n::text = st then 'ok (' || n || ')' else 'BAD (' || n || ' rows, ' || st || ' people)' end;
  res := res || E'\nno reminder for someone at the minimum: ' || case when m = 0 then 'ok' else 'BAD' end;
  update duty_settings set signup_deadline_days = (w2.start_date - today) - 5 where year = w2.year;  -- deadline in 5 days
  delete from notifications where template = 'duty_minimum_reminder';
  perform private.send_duty_minimum_reminders();
  select count(*) into n from notifications where template = 'duty_minimum_reminder' and payload ->> 'week' = w2.name;
  res := res || E'\nno reminder 5 days before the deadline: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  -- Minimum 0: nothing shows, nothing is enforced.
  update duty_settings set minutes_per_week = 0, signup_deadline_days = 10 where year = w2.year;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  select count(*) into n from public.my_duty_weeks();
  res := res || E'\nminimum 0: no weeks to show: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  delete from duty_assignments where duty_slot_id in (s1, s3) and volunteer_id = vol;
  get diagnostics n = row_count;
  res := res || E'\nminimum 0: drops aren''t held back: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;

  -- A removed volunteer isn't crewed anywhere.
  execute 'reset role';
  update volunteers set removed_at = now() where id = other;
  select count(*) into n from private.crewed_sessions(other);
  res := res || E'\nremoved volunteer has no crewed weeks: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  raise exception 'RESULTS %', res;
end $$;

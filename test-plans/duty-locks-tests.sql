-- Tests for migration_duty_locks.sql (spec 37). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Admin sessions carry 'aal': 'aal2' so this also runs where admin MFA (spec 27) is required.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  vol uuid; dtype uuid;
  today date := (now() at time zone 'America/Denver')::date;
  s_past uuid; s_1 uuid; s_3 uuid; s_4 uuid; s_locked uuid;
  res text := ''; n int;
begin
  select v.id into vol from volunteers v join profiles p on p.id = v.id
   where p.role = 'volunteer' and v.removed_at is null limit 1;
  select id into dtype from duty_types order by name limit 1;
  -- No row for the year: the defaults (3 days) apply.
  delete from duty_settings;

  -- Test slots, made as the job user (no auth.uid()), with the volunteer already on each.
  insert into duty_slots (duty_type_id, slot_date, capacity) values (dtype, today - 1, 5) returning id into s_past;
  insert into duty_slots (duty_type_id, slot_date, capacity) values (dtype, today + 1, 5) returning id into s_1;
  insert into duty_slots (duty_type_id, slot_date, capacity) values (dtype, today + 3, 5) returning id into s_3;
  insert into duty_slots (duty_type_id, slot_date, capacity) values (dtype, today + 4, 5) returning id into s_4;
  insert into duty_slots (duty_type_id, slot_date, capacity, locked) values (dtype, today + 20, 5, true) returning id into s_locked;
  insert into duty_assignments (duty_slot_id, volunteer_id)
  select x, vol from unnest(array[s_past, s_1, s_3, s_4, s_locked]) x;
  res := res || E'\njob user seeds claims on past and locked slots: ok';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);

  -- Drops.
  begin
    delete from duty_assignments where duty_slot_id = s_past and volunteer_id = vol;
    res := res || E'\nvolunteer drops a past duty: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer drops a past duty: refused ok'; end;
  begin
    delete from duty_assignments where duty_slot_id = s_1 and volunteer_id = vol;
    res := res || E'\nvolunteer drops tomorrow''s duty: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer drops tomorrow''s duty: refused ok'; end;
  begin
    delete from duty_assignments where duty_slot_id = s_3 and volunteer_id = vol;
    res := res || E'\nvolunteer drops a duty 3 days out: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer drops a duty 3 days out: refused ok'; end;
  begin
    delete from duty_assignments where duty_slot_id = s_locked and volunteer_id = vol;
    res := res || E'\nvolunteer drops a locked duty: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer drops a locked duty: refused ok'; end;
  delete from duty_assignments where duty_slot_id = s_4 and volunteer_id = vol;
  get diagnostics n = row_count;
  res := res || E'\nvolunteer drops a duty 4 days out: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- Claims.
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s_4, vol);
  res := res || E'\nvolunteer claims a duty 4 days out: ok';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  delete from duty_assignments where duty_slot_id in (s_past, s_1, s_locked) and volunteer_id = vol;
  get diagnostics n = row_count;
  res := res || E'\nadmin drops past, tomorrow''s and locked duties: ' || case when n = 3 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  begin
    insert into duty_assignments (duty_slot_id, volunteer_id) values (s_past, vol);
    res := res || E'\nvolunteer claims a past duty: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer claims a past duty: refused ok'; end;
  begin
    insert into duty_assignments (duty_slot_id, volunteer_id) values (s_locked, vol);
    res := res || E'\nvolunteer claims a locked duty: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer claims a locked duty: refused ok'; end;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (s_1, vol);
  res := res || E'\nvolunteer claims tomorrow''s duty (late sign-up): ok';
  begin
    delete from duty_assignments where duty_slot_id = s_1 and volunteer_id = vol;
    res := res || E'\n...and then drops it: ALLOWED (BAD)';
  exception when others then res := res || E'\n...and then can''t drop it: refused ok'; end;

  -- No edits: moving a claim to another slot changes nothing.
  update duty_assignments set duty_slot_id = s_3 where duty_slot_id = s_4 and volunteer_id = vol;
  get diagnostics n = row_count;
  res := res || E'\nvolunteer moves a claim with UPDATE: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;

  -- Volunteers read the settings; only admins write them.
  begin
    insert into duty_settings (year, drop_lock_days) values (2099, 0);
    res := res || E'\nvolunteer writes duty settings: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer writes duty settings: refused ok'; end;
  select count(*) into n from duty_settings;
  res := res || E'\nvolunteer reads duty settings: ok (' || n || ' rows)';

  -- A shorter lock, set by an admin, lets the 3-days-out drop through.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  insert into duty_settings (year, drop_lock_days) values (extract(year from today)::int, 2)
  on conflict (year) do update set drop_lock_days = 2;
  update duty_slots set locked = true where id = s_4;
  get diagnostics n = row_count;
  res := res || E'\nadmin locks a slot: ' || case when n = 1 then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  begin
    delete from duty_assignments where duty_slot_id = s_3 and volunteer_id = vol;
    get diagnostics n = row_count;
    res := res || E'\nwith a 2-day lock, a 3-days-out drop works: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  exception when others then res := res || E'\nwith a 2-day lock, a 3-days-out drop works: BAD (' || sqlerrm || ')'; end;
  begin
    delete from duty_assignments where duty_slot_id = s_4 and volunteer_id = vol;
    res := res || E'\nvolunteer drops a slot the admin just locked: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer drops a slot the admin just locked: refused ok'; end;
  update duty_slots set locked = false where id = s_4;
  get diagnostics n = row_count;
  res := res || E'\nvolunteer unlocks a slot: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;

  raise exception 'RESULTS %', res;
end $$;

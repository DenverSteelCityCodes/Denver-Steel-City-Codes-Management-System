-- Tests for migration_season_settings.sql (spec 13). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  yr int := (select max(year) from sessions where is_active);
  cls uuid; sec record; kid record; res text := ''; st text;
begin
  -- Its own class with no course rules (spec 31) and a camper with no seats yet, so nothing here
  -- leans on the seed's course names.
  insert into classes (name) values ('[TEST] Season Settings Basics') returning id into cls;
  insert into sections (class_id, label, week, age_min, age_max, capacity)
    values (cls, 'SS1', 1, 5, 17, 10) returning * into sec;
  insert into students (parent_id, full_name, first_name, age, grade)
    values ((select id from profiles where role = 'parent' order by id limit 1), '[TEST] Season Settings Camper', 'Season', 11, '6th')
    returning id, parent_id into kid;

  -- Opening is tomorrow → parent refused with the Denver-time message, admin allowed.
  insert into season_settings (year, registration_opens_at) values (yr, now() + interval '1 day')
    on conflict (year) do update set registration_opens_at = excluded.registration_opens_at;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', kid.parent_id, 'role', 'authenticated')::text, true);
  begin
    insert into registrations (student_id, section_id) values (kid.id, sec.id);
    res := res || E'\nparent signs up before opening: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nparent signs up before opening: refused ' || case when sqlerrm like 'Registration opens %(Denver time)' then 'ok' else '(BAD message: ' || sqlerrm || ')' end;
  end;
  begin
    update season_settings set offer_hours = 1 where year = yr;
    res := res || case when found then E'\nparent edits settings: ALLOWED (BAD)' else E'\nparent edits settings: no rows ok' end;
  exception when others then res := res || E'\nparent edits settings: blocked ok'; end;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  insert into registrations (student_id, section_id, status) values (kid.id, sec.id, 'confirmed') returning status into st;
  res := res || E'\nadmin places before opening: ' || case when st is not null then 'ok' else 'BAD' end;
  delete from registrations where student_id = kid.id and section_id = sec.id;
  execute 'reset role';

  -- Opening has passed → parent allowed.
  update season_settings set registration_opens_at = now() - interval '1 minute' where year = yr;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', kid.parent_id, 'role', 'authenticated')::text, true);
  insert into registrations (student_id, section_id) values (kid.id, sec.id) returning status into st;
  res := res || E'\nparent signs up after opening: ' || case when st = 'confirmed' then 'ok' else 'BAD (' || coalesce(st,'null') || ')' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

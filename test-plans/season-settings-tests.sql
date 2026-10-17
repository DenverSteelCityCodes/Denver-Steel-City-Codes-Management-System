-- Tests for migration_season_settings.sql (spec 13). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  yr int := (select max(year) from sessions where is_active);
  sec record; kid record; res text := ''; st text;
begin
  select s.* into sec from sections s
   where s.cancelled_at is null and s.week is not null
     and (select count(*) from registrations r where r.section_id=s.id and r.status in ('confirmed','pending')) < s.capacity
   limit 1;
  select st2.id, st2.parent_id into kid from students st2
   where st2.age between sec.age_min and sec.age_max
     and not exists (select 1 from registrations r join sections s2 on s2.id=r.section_id
                     where r.student_id=st2.id and r.status <> 'cancelled' and (s2.week is null or s2.week = sec.week))
   limit 1;

  -- Opening is tomorrow → parent refused with the Denver-time message, admin allowed.
  insert into season_settings (year, registration_opens_at) values (yr, now() + interval '1 day')
    on conflict (year) do update set registration_opens_at = excluded.registration_opens_at;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', kid.parent_id, 'role', 'authenticated')::text, true);
  begin
    insert into registrations (student_id, section_id) values (kid.id, sec.id);
    res := res || E'\nparent signs up before opening: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nparent signs up before opening: refused ' || case when sqlerrm like 'Registration opens %(Denver time)' then 'ok (' || sqlerrm || ')' else '(BAD message: ' || sqlerrm || ')' end;
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

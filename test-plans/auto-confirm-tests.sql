-- Tests for spec 14 (auto-confirm + duplicate-camper report). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  cls      uuid;
  sec      record;
  kid      record;
  other_parent uuid;
  res      text := '';
  n        int;
  st       text;
begin
  -- Its own class with no course rules (spec 31) and a camper with no seats yet, so nothing here
  -- leans on the seed's course names.
  insert into classes (name) values ('[TEST] Auto-confirm Basics') returning id into cls;
  insert into sections (class_id, label, week, age_min, age_max, capacity)
    values (cls, 'AC1', 1, 5, 17, 10) returning * into sec;
  insert into students (parent_id, full_name, first_name, age, grade)
    values ((select id from profiles where role = 'parent' order by id limit 1), '[TEST] Autoconfirm Camper', 'Autoconfirm', 11, '6th')
    returning id, parent_id into kid;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', kid.parent_id, 'role', 'authenticated')::text, true);
  insert into registrations (student_id, section_id) values (kid.id, sec.id) returning status into st;
  res := res || E'\nparent sign-up with a free seat is confirmed: ' || case when st='confirmed' then 'ok' else 'BAD (' || st || ')' end;
  begin
    perform 1 from public.possible_duplicate_campers();
    res := res || E'\nparent calls duplicate report: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent calls duplicate report: blocked ok'; end;
  execute 'reset role';

  select count(*) into n from registrations where status='pending';
  res := res || E'\nno pending registrations left: ' || case when n=0 then 'ok' else 'BAD (' || n || ')' end;

  -- Duplicate: copy a camper under another parent account with the same name and grade.
  select p.id into other_parent from profiles p where p.role='parent' and p.id <> kid.parent_id limit 1;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year)
    select other_parent, full_name, first_name, last_name, age, grade, (select max(year) from sessions where is_active)
    from students where id = kid.id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select count(*) into n from public.possible_duplicate_campers() d where d.a_id = kid.id or d.b_id = kid.id;
  res := res || E'\nadmin sees the duplicate pair once: ' || case when n=1 then 'ok' else 'BAD (' || n || ')' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

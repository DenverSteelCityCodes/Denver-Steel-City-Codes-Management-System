-- Tests for migration_admin_register.sql (spec 32, #152) and the admin-insert warning it adds to
-- registrations_before_insert() (migration_one_class_per_week.sql).
-- Run against the demo DB after private.reset_demo(). The block raises its results at the end,
-- so every test write rolls back. Every line should end in "ok".
--
-- Fixture: two classes that aren't named like any real course:
--   Behalf Basics   (B) Week 1 (B1, one seat) and Week 2 (B2)
--   Behalf Advanced (A) grades 7–8, after Behalf Basics; Week 2 (A2), ages 11–14
do $$
declare
  yr int := (select max(year) from sessions where is_active);
  p1 uuid; p2 uuid; adm uuid; email1 text;
  cb uuid; ca uuid; b1 uuid; b2 uuid; a2 uuid;
  s6 uuid; s7 uuid; s8 uuid; filler uuid;
  r record; res text := ''; m text; h text; c text; n int; reason text;
  claims_p2 text; claims_adm text;
begin
  select id into p1 from profiles where role = 'parent' order by id limit 1;
  select id into p2 from profiles where role = 'parent' and id <> p1 order by id limit 1;
  select id into adm from profiles where role = 'admin' order by id limit 1;
  select email into email1 from auth.users where id = p1;
  claims_p2 := json_build_object('sub', p2, 'role', 'authenticated')::text;
  claims_adm := json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text;

  insert into classes (name) values ('Behalf Basics') returning id into cb;
  insert into classes (name, grades_allowed, requires_class_id) values ('Behalf Advanced', '{7th,8th}', cb) returning id into ca;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cb, 'B1', 1, 5, 17, 1) returning id into b1;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cb, 'B2', 2, 5, 17, 10) returning id into b2;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (ca, 'A2', 2, 11, 14, 10) returning id into a2;
  insert into students (parent_id, full_name, first_name, last_name, age, grade) values (p1, 'Behalf Six', 'Six', 'Behalf', 11, '6th') returning id into s6;
  insert into students (parent_id, full_name, first_name, last_name, age, grade) values (p1, 'Behalf Seven', 'Seven', 'Behalf', 12, '7th') returning id into s7;
  insert into students (parent_id, full_name, first_name, last_name, age, grade) values (p1, 'Behalf Eight', 'Eight', 'Behalf', 16, '8th') returning id into s8;
  insert into students (parent_id, full_name, age) values (p2, 'Behalf Filler', 10) returning id into filler;
  insert into registrations (student_id, section_id, status) values (filler, b1, 'confirmed');   -- B1 is full
  insert into season_settings (year, registration_opens_at) values (yr, now() - interval '1 day')
    on conflict (year) do update set registration_opens_at = excluded.registration_opens_at;

  -- ── Only admins ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_p2, true);
  begin
    perform * from public.admin_register(email1, s7, null, b2, 'phone', 'Called in', '{}');
    res := res || E'\na parent calling admin_register: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics c = returned_sqlstate;
    res := res || E'\na parent calling admin_register: refused ' || case when c = '42501' then 'ok' else '(BAD: ' || c || ')' end;
  end;
  begin
    perform * from public.admin_registration_check(b2, s7);
    res := res || E'\na parent calling admin_registration_check: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics c = returned_sqlstate;
    res := res || E'\na parent calling admin_registration_check: refused ' || case when c = '42501' then 'ok' else '(BAD: ' || c || ')' end;
  end;
  begin
    perform * from public.admin_find_parent(email1);
    res := res || E'\na parent calling admin_find_parent: ALLOWED (BAD)';
  exception when others then
    res := res || E'\na parent calling admin_find_parent: refused ok';
  end;

  perform set_config('request.jwt.claims', claims_adm, true);

  -- ── Lookups ──
  select count(*) into n from public.admin_find_parent(upper(' ' || email1 || ' ')) f where f.id = p1 and f.campers @> jsonb_build_array(jsonb_build_object('id', s7));
  res := res || E'\nadmin_find_parent finds the family and its campers (any case, spaces): ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from public.admin_find_parent('nobody-here@example.invalid');
  res := res || E'\nadmin_find_parent with no account: ' || case when n = 0 then 'ok' else 'BAD' end;
  select string_agg(f.why, ',' order by f.full_name) into m from public.admin_camper_matches('Seven', 'behalf', null, null) f where f.parent_id = p1;
  res := res || E'\ncamper matches: same name: ' || case when m like '%same name%' then 'ok' else 'BAD (' || coalesce(m, 'none') || ')' end;
  select count(*) into n from public.admin_camper_matches('Someone', 'Behalf', '8th', null) f where f.id = s8 and f.why = 'same last name and grade';
  res := res || E'\ncamper matches: same last name and grade: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from public.admin_camper_matches('Someone', 'Behalf', '5th', null) f where f.id in (s6, s7, s8);
  res := res || E'\ncamper matches: last name alone isn''t a match: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  select string_agg(f.rule, ',' order by f.rule) into m from public.admin_registration_check(a2, s6) f;
  res := res || E'\ncheck lists grade and prerequisite: ' || case when m = 'grade,prerequisite' then 'ok' else 'BAD (' || coalesce(m, 'none') || ')' end;
  select string_agg(f.rule, ',' order by f.rule) into m from public.admin_registration_check(a2, null, 9, '7th') f;
  res := res || E'\ncheck for a new camper (age 9, 7th): ' || case when m = 'age,prerequisite' then 'ok' else 'BAD (' || coalesce(m, 'none') || ')' end;

  -- ── Each rule refused without its override, allowed with it alone ──
  begin
    perform * from public.admin_register(email1, s6, null, a2, 'late', 'After close', '{}');
    res := res || E'\nno override: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, h = pg_exception_hint;
    res := res || E'\nno override: refused ' || case when m like 'Name each rule you are skipping: grade, prerequisite' and h = 'rules:grade,prerequisite' then 'ok' else '(BAD: ' || m || ' / ' || coalesce(h, '') || ')' end;
  end;
  begin
    perform * from public.admin_register(email1, s6, null, a2, 'late', 'After close', '{grade}');
    res := res || E'\none of two overrides: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\none of two overrides: refused ' || case when m = 'Name each rule you are skipping: prerequisite' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  select * into r from public.admin_register(email1, s6, null, a2, 'walk_in', 'Teacher said yes', '{grade,prerequisite}');
  res := res || E'\ngrade + prerequisite overrides: ' || case when r.status = 'confirmed' then 'ok' else 'BAD (' || r.status || ')' end;

  -- prerequisite alone (s7 is in 7th grade)
  insert into registrations (student_id, section_id, status) values (s7, b2, 'confirmed');   -- Week 2 Basics doesn't count for Week 2 Advanced
  begin
    perform * from public.admin_register(email1, s7, null, a2, 'phone', 'Called in', '{same_week}');
    res := res || E'\nprerequisite + same week without both: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    res := res || E'\nprerequisite + same week, both listed in the hint: ' || case when h = 'rules:prerequisite,same_week' then 'ok' else '(BAD: ' || coalesce(h, '') || ')' end;
  end;
  select * into r from public.admin_register(email1, s7, null, a2, 'phone', 'Called in', '{prerequisite,same_week}');
  res := res || E'\nprerequisite + same_week overrides: ' || case when r.status = 'confirmed' then 'ok' else 'BAD' end;

  -- no rule broken: registered with no overrides (s8 is 16, B2 is 5–17)
  select * into r from public.admin_register(email1, s8, null, b2, 'phone', 'Called in', '{}');
  res := res || E'\nno rule broken, no overrides: ' || case when r.status = 'confirmed' then 'ok' else 'BAD' end;
  -- age alone: B2 now stops at 15
  delete from registrations where id = r.registration_id;
  execute 'reset role';
  update sections set age_max = 15 where id = b2;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  begin
    perform * from public.admin_register(email1, s8, null, b2, 'phone', 'Called in', '{}');
    res := res || E'\nage alone without override: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    res := res || E'\nage alone without override: refused ' || case when h = 'rules:age' then 'ok' else '(BAD: ' || coalesce(h, '') || ')' end;
  end;

  -- capacity: B1 is full → waitlisted; with the override → confirmed over the limit
  select * into r from public.admin_register(email1, s6, null, b1, 'late', 'Late form', '{}');
  res := res || E'\nfull section without override is waitlisted: ' || case when r.status = 'waitlisted' then 'ok' else 'BAD (' || r.status || ')' end;
  delete from registrations where id = r.registration_id;
  select * into r from public.admin_register(email1, s6, null, b1, 'late', 'Late form', '{capacity}');
  res := res || E'\nfull section with capacity override is confirmed: ' || case when r.status = 'confirmed' then 'ok' else 'BAD (' || r.status || ')' end;

  -- closed and opening
  execute 'reset role';
  update form_configs set config = jsonb_set(config, '{enabled}', 'false') where form_key = 'student_registration';
  update season_settings set registration_opens_at = now() + interval '3 days' where year = yr;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  begin
    perform * from public.admin_register(email1, s7, null, b1, 'late', 'Late form', '{capacity}');
    res := res || E'\nclosed + before opening: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    res := res || E'\nclosed + before opening: refused ' || case when h like 'rules:closed,opening%' then 'ok' else '(BAD: ' || coalesce(h, '') || ')' end;
  end;

  -- a new camper: refused → nothing created; allowed → camper + registration
  begin
    perform * from public.admin_register(email1, null, '{"first_name":"Nova","last_name":"Behalf","age":9,"grade":"4th"}', a2, 'walk_in', 'Walk-in', '{closed,opening}');
    res := res || E'\nnew camper, rules unnamed: ALLOWED (BAD)';
  exception when others then
    null;
  end;
  select count(*) into n from students where first_name = 'Nova' and last_name = 'Behalf';
  res := res || E'\nnew camper refused leaves no camper row: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select * into r from public.admin_register(email1, null, '{"first_name":"Nova","last_name":"Behalf","age":9,"grade":"4th","school_name":"Behalf Elementary"}', b2, 'recovery', 'Form was lost', '{closed,opening}');
  select count(*) into n from students where id = r.student_id and parent_id = p1 and full_name = 'Nova Behalf' and school_name = 'Behalf Elementary';
  res := res || E'\nnew camper created under the family: ' || case when n = 1 and r.status = 'confirmed' then 'ok' else 'BAD' end;

  -- bad input
  begin
    perform * from public.admin_register('nobody-here@example.invalid', null, '{"first_name":"X","last_name":"Y","age":9}', b2, 'phone', 'Called', '{closed,opening}');
    res := res || E'\nno account: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    res := res || E'\nno account: refused ' || case when h = 'no_account' then 'ok' else '(BAD: ' || coalesce(h, '') || ')' end;
  end;
  begin
    perform * from public.admin_register(email1, s7, null, b1, 'phone', '  ', '{closed,opening,capacity}');
    res := res || E'\nblank reason: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nblank reason: refused ok';
  end;
  begin
    perform * from public.admin_register(email1, filler, null, b2, 'phone', 'Called', '{closed,opening}');
    res := res || E'\nanother family''s camper: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nanother family''s camper: refused ok';
  end;

  -- ── History ──
  execute 'reset role';
  select l.reason into reason from audit.log l where l.table_name = 'registrations' and l.action = 'INSERT'
    and l.new ->> 'student_id' = s6::text and l.new ->> 'section_id' = a2::text order by l.id desc limit 1;
  res := res || E'\nHistory reason names the source, skipped rules and reason: ' || case when reason = 'Admin sign-up (walk-in) · skipped: grade, prerequisite · Teacher said yes' then 'ok' else 'BAD (' || coalesce(reason, 'null') || ')' end;
  select count(*) into n from audit.log l where l.table_name = 'students' and l.action = 'INSERT' and l.row_id = r.student_id::text and l.reason like 'Admin sign-up (lost form)%';
  res := res || E'\nthe new camper''s row carries the same reason: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from notifications where template = 'registration_confirmed' and payload ->> 'student_id' = r.student_id::text;
  res := res || E'\nthe family gets the confirmation email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- A direct admin insert still works but is stamped as a warning.
  perform set_config('app.reason', '', true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  insert into registrations (student_id, section_id, status) values (s8, a2, 'confirmed');
  execute 'reset role';
  select l.reason into reason from audit.log l where l.table_name = 'registrations' and l.action = 'INSERT' and l.new ->> 'student_id' = s8::text and l.new ->> 'section_id' = a2::text;
  res := res || E'\ndirect admin insert with no reason is flagged: ' || case when reason = 'admin_insert_no_reason' then 'ok' else 'BAD (' || coalesce(reason, 'null') || ')' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

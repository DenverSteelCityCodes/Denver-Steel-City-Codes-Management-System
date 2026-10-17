-- Tests for migration_parent_swap.sql (spec 12). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Fixture: a "Swap Test" class with sections in Week 2 and campers of two different parents.
-- In the demo, Week 2 starts next week, so the 14-day deadline has passed; the test checks that
-- first, then sets the deadline to 0 days. The concurrency checks (two parents racing for the last
-- seat, A→B and B→A at once) need two connections: see parent-swap-concurrency.md.
do $$
declare
  yr int := (select max(year) from sessions where is_active);
  p1 uuid; p2 uuid; p3 uuid;
  c1 uuid; c2 uuid; c3 uuid;
  cls uuid; mc uuid; sa uuid; sb uuid; sw1 uuid; sage uuid; sm uuid;
  r1 uuid; r2 uuid; r3 uuid;
  res text := ''; st text; n int;
begin
  select id into p1 from profiles where role = 'parent' order by id limit 1;
  select id into p2 from profiles where role = 'parent' and id <> p1 order by id limit 1;
  select id into p3 from profiles where role = 'parent' and id not in (p1, p2) order by id limit 1;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Swap One', 'Swap', 11, '6th') returning id into c1;
  insert into students (parent_id, full_name, first_name, age, grade) values (p2, 'Swap Two', 'Swap', 11, '6th') returning id into c2;
  insert into students (parent_id, full_name, first_name, age, grade) values (p3, 'Swap Three', 'Swap', 11, '6th') returning id into c3;

  insert into classes (name) values ('Swap Test') returning id into cls;
  insert into classes (name) values ('Microcontrollers Swap Test') returning id into mc;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'SA', 2, 5, 17, 2) returning id into sa;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'SB', 2, 5, 17, 1) returning id into sb;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'W1', 1, 5, 17, 5) returning id into sw1;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'OLD', 2, 15, 17, 5) returning id into sage;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (mc, 'MC', 2, 5, 17, 5) returning id into sm;

  -- c1 and c2 fill SA (capacity 2); c3 waits for it.
  insert into registrations (student_id, section_id, status, year) values (c1, sa, 'confirmed', yr) returning id into r1;
  insert into registrations (student_id, section_id, status, year) values (c2, sa, 'confirmed', yr) returning id into r2;
  insert into registrations (student_id, section_id, status, year) values (c3, sa, 'waitlisted', yr) returning id into r3;

  -- Default 14 days: Week 2 is next week, so online switching has closed.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  begin
    perform public.swap_my_registration(r1, sb);
    res := res || E'\nswap after the deadline: ALLOWED (BAD)';
  exception when others then res := res || E'\nswap after the deadline: refused ' || case when sqlerrm like 'Online changes for this week closed on%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  execute 'reset role';
  insert into season_settings (year, change_deadline_days) values (yr, 0) on conflict (year) do update set change_deadline_days = 0;

  execute 'set local role authenticated';
  -- Another parent can't switch it.
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  begin
    perform public.swap_my_registration(r1, sb);
    res := res || E'\nanother parent swaps it: ALLOWED (BAD)';
  exception when others then res := res || E'\nanother parent swaps it: refused ok'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  -- Readable refusals: other week, age band, grade rule.
  begin
    perform public.swap_my_registration(r1, sw1);
    res := res || E'\nswap to another week: ALLOWED (BAD)';
  exception when others then res := res || E'\nswap to another week: refused ' || case when sqlerrm like 'You can only switch to a class in the same week%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  begin
    perform public.swap_my_registration(r1, sage);
    res := res || E'\nswap outside the age band: ALLOWED (BAD)';
  exception when others then res := res || E'\nswap outside the age band: refused ' || case when sqlerrm = 'This class is for ages 15–17' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  begin
    perform public.swap_my_registration(r1, sm);
    res := res || E'\nMicrocontrollers for a 6th grader: ALLOWED (BAD)';
  exception when others then res := res || E'\nMicrocontrollers for a 6th grader: refused ' || case when sqlerrm = 'Open to students entering grades 7–9' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;

  -- Options: same week, eligible, other sections only, with live spots left.
  select count(*) filter (where section_id = sb and spots_left = 1) * 10
       + count(*) filter (where section_id in (sa, sw1, sage, sm)) into n
    from public.my_swap_options(r1);
  res := res || E'\noptions list SB (1 left) and not the ineligible ones: ' || case when n = 10 then 'ok' else 'BAD (' || n || ')' end;

  -- The swap: same row, confirmed, in SB; SA's freed seat is offered to c3; one moved email.
  perform public.swap_my_registration(r1, sb);
  execute 'reset role';
  select (section_id = sb)::text || '/' || status::text into st from registrations where id = r1;
  res := res || E'\nswap moves the same registration, confirmed: ' || case when st = 'true/confirmed' then 'ok' else 'BAD (' || st || ')' end;
  select status::text into st from registrations where id = r3;
  res := res || E'\nthe freed seat is offered to the waitlist: ' || case when st = 'offered' then 'ok' else 'BAD (' || st || ')' end;
  select count(*) into n from notifications where template = 'registration_moved' and payload->>'student_id' = c1::text;
  res := res || E'\none registration_moved email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from audit.log where table_name = 'registrations' and row_id = r1::text and reason = 'parent_swap';
  res := res || E'\naudit log records the parent swap: ' || case when n >= 1 then 'ok' else 'BAD (' || n || ')' end;

  -- SB is now full: c2 gets the "cancel first" message, and keeps the SA seat.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  begin
    perform public.swap_my_registration(r2, sb);
    res := res || E'\nswap into a full class: ALLOWED (BAD)';
  exception when others then res := res || E'\nswap into a full class: refused ' || case when sqlerrm = 'Swap Test SB is full. To join its waitlist you''d need to cancel your spot in Swap Test SA first.' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  execute 'reset role';
  select (section_id = sa)::text || '/' || status::text into st from registrations where id = r2;
  res := res || E'\n...and keeps the seat it had: ' || case when st = 'true/confirmed' then 'ok' else 'BAD (' || st || ')' end;

  -- A waitlist place can't be switched.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p3, 'role', 'authenticated')::text, true);
  begin
    perform public.swap_my_registration(r3, sb);
    res := res || E'\nswitch an offer/waitlist place: ALLOWED (BAD)';
  exception when others then res := res || E'\nswitch an offer/waitlist place: refused ok'; end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

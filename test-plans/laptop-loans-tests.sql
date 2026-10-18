-- Tests for migration_laptop_loans.sql (spec 29). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Every line should end in "ok"; any BAD is a failure.
-- Fixture: three weeks of their own in year 2099 (so the demo's loans and caps don't count):
-- A starts in 30 days with 2 loaners, B in 37 days with 1, C started yesterday. Campers of three
-- demo parents, and a demo volunteer leading two of the sections.
-- The race for the last loaner needs separate connections: test-plans/seat-race.sh (RACE=laptops).
do $$
declare
  yr int := 2099;
  today date := (now() at time zone 'America/Denver')::date;
  p1 uuid; p2 uuid; p3 uuid; adm uuid; vol uuid; vol2 uuid;
  wa uuid; wb uuid; wc uuid;
  cls uuid; sa uuid; sa2 uuid; sb uuid; sc uuid; sw uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; rw uuid; rc uuid;
  res text := ''; st text; n int; m int;
begin
  select id into p1 from profiles where role = 'parent' order by id limit 1;
  select id into p2 from profiles where role = 'parent' and id <> p1 order by id limit 1;
  select id into p3 from profiles where role = 'parent' and id not in (p1, p2) order by id limit 1;
  select id into adm from profiles where role = 'admin' order by id limit 1;
  select v.id into vol from volunteers v join profiles p on p.id = v.id
   where p.role = 'volunteer' and v.experience_level = 'senior' order by v.id limit 1;
  select v.id into vol2 from volunteers v join profiles p on p.id = v.id
   where p.role = 'volunteer' and v.id <> vol order by v.id limit 1;

  insert into sessions (name, year, start_date, end_date, is_active, laptop_loaners)
    values ('Laptop Test A', yr, today + 30, today + 34, false, 2) returning id into wa;
  insert into sessions (name, year, start_date, end_date, is_active, laptop_loaners)
    values ('Laptop Test B', yr, today + 37, today + 41, false, 1) returning id into wb;
  insert into sessions (name, year, start_date, end_date, is_active, laptop_loaners)
    values ('Laptop Test C', yr, today - 1, today + 3, false, 5) returning id into wc;
  insert into classes (name) values ('[TEST] Laptop Class') returning id into cls;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity, lead_id)
    values (cls, 'LA', 1, wa, 5, 17, 10, vol) returning id into sa;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity, lead_id)
    values (cls, 'LA2', 1, wa, 5, 17, 10, vol) returning id into sa2;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (cls, 'LB', 2, wb, 5, 17, 10) returning id into sb;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (cls, 'LC', 1, wc, 5, 17, 10) returning id into sc;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (cls, 'LW', 1, wa, 5, 17, 1) returning id into sw;

  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Lap One', 'Lap1', 11, '6th') returning id into c1;
  insert into students (parent_id, full_name, first_name, age, grade) values (p2, 'Lap Two', 'Lap2', 11, '6th') returning id into c2;
  insert into students (parent_id, full_name, first_name, age, grade) values (p3, 'Lap Three', 'Lap3', 11, '6th') returning id into c3;
  insert into students (parent_id, full_name, first_name, age, grade) values (p3, 'Lap Four', 'Lap4', 11, '6th') returning id into c4;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Lap Five', 'Lap5', 11, '6th') returning id into c5;
  insert into students (parent_id, full_name, first_name, age, grade) values (p2, 'Lap Six', 'Lap6', 11, '6th') returning id into c6;
  insert into students (parent_id, full_name, first_name, age, grade) values (p2, 'Lap Seven', 'Lap7', 11, '6th') returning id into c7;
  insert into registrations (student_id, section_id, status) values (c1, sa, 'confirmed') returning id into r1;
  insert into registrations (student_id, section_id, status) values (c2, sa, 'confirmed') returning id into r2;
  insert into registrations (student_id, section_id, status) values (c3, sa2, 'confirmed') returning id into r3;
  insert into registrations (student_id, section_id, status) values (c4, sa2, 'confirmed') returning id into r4;
  insert into registrations (student_id, section_id, status) values (c7, sa2, 'confirmed') returning id into r5;
  insert into registrations (student_id, section_id, status) values (c5, sw, 'waitlisted') returning id into rw;
  insert into registrations (student_id, section_id, status) values (c6, sc, 'confirmed') returning id into rc;

  execute 'set local role authenticated';

  -- ── Request: under the cap reserved, past it queued ──
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  st := public.request_laptop(r1);
  res := res || E'\nfirst request is reserved: ' || case when st = 'reserved' then 'ok' else 'BAD (' || st || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  st := public.request_laptop(r2);
  res := res || E'\nsecond request (the last loaner) is reserved: ' || case when st = 'reserved' then 'ok' else 'BAD (' || st || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', p3, 'role', 'authenticated')::text, true);
  st := public.request_laptop(r3);
  res := res || E'\nrequest N+1 is queued: ' || case when st = 'queued' then 'ok' else 'BAD (' || st || ')' end;
  st := public.request_laptop(r4);
  res := res || E'\nrequest N+2 is queued: ' || case when st = 'queued' then 'ok' else 'BAD (' || st || ')' end;
  select string_agg(coalesce(queue_position::text, '-'), ',' order by queue_position) into st
    from public.my_laptop_loans() where registration_id in (r3, r4);
  res := res || E'\nthe family sees its places in the queue (1, 2): ' || case when st = '1,2' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  select count(*) into n from public.my_laptop_loans() where changes_open and registration_id in (r3, r4);
  res := res || E'\n...and can still change them before the week: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Ownership, seat and date rules ──
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  begin
    perform public.request_laptop(r3);
    res := res || E'\nrequest for another family''s camper: ALLOWED (BAD)';
  exception when others then res := res || E'\nrequest for another family''s camper: refused ' || case when sqlstate = '42501' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  begin
    perform public.release_laptop(r2);
    res := res || E'\nrelease another family''s laptop: ALLOWED (BAD)';
  exception when others then res := res || E'\nrelease another family''s laptop: refused ' || case when sqlstate = '42501' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  begin
    perform public.request_laptop(rw);
    res := res || E'\nrequest for a waitlist place: ALLOWED (BAD)';
  exception when others then res := res || E'\nrequest for a waitlist place: refused ' || case when sqlerrm like 'A laptop can be borrowed once%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  begin
    perform public.admin_set_laptop_status(r1, 'handed_out');
    res := res || E'\nparent ticks hand-out: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent ticks hand-out: refused ' || case when sqlstate = '42501' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  begin
    perform public.request_laptop(rc);
    res := res || E'\nrequest after the week started: ALLOWED (BAD)';
  exception when others then res := res || E'\nrequest after the week started: refused ' || case when sqlerrm like 'Laptop Test C has started%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;

  -- Asking twice changes nothing and sends one email.
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  st := public.request_laptop(r1);
  res := res || E'\nasking again keeps the reservation: ' || case when st = 'reserved' then 'ok' else 'BAD (' || st || ')' end;

  -- ── RLS: parents read their own campers' loans only; no client writes ──
  -- (Counted over the fixture: the demo seed may give these families loans of their own.)
  select count(*) into n from laptop_loans where registration_id in (r1, r2, r3, r4, r5, rc);
  res := res || E'\nparent 1 reads only their own loan: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', p3, 'role', 'authenticated')::text, true);
  select count(*) into n from laptop_loans where registration_id in (r1, r2, r3, r4, r5, rc);
  res := res || E'\nparent 3 reads their two: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;
  begin
    update laptop_loans set status = 'reserved' where registration_id = r3;
    get diagnostics n = row_count;
    res := res || E'\nparent updates their queued loan directly: ' || case when n = 0 then 'no rows, ok' else 'ALLOWED (BAD)' end;
  exception when others then res := res || E'\nparent updates their queued loan directly: refused ok'; end;
  begin
    insert into laptop_loans (registration_id, status) values (r5, 'reserved');
    res := res || E'\nparent inserts a loan directly: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent inserts a loan directly: refused ok'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  select count(*) into n from laptop_loans;
  res := res || E'\na volunteer reads no loans directly: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from laptop_loans where registration_id in (r1, r2, r3, r4);
  res := res || E'\nan admin reads them all: ' || case when n = 4 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Release promotes the oldest queued request and emails that family ──
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  st := public.release_laptop(r1);
  execute 'reset role';
  select string_agg(status, ',' order by registration_id = r1 desc) into st from laptop_loans where registration_id in (r1, r3);
  res := res || E'\nrelease frees it and the oldest queued request is reserved: ' || case when st = 'released,reserved' then 'ok' else 'BAD (' || st || ')' end;
  select status into st from laptop_loans where registration_id = r4;
  res := res || E'\n...the newer one still waits: ' || case when st = 'queued' then 'ok' else 'BAD (' || st || ')' end;
  select private.laptop_queue_position(r4) into n;
  res := res || E'\n...now first in the queue: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'laptop_promoted' and recipient_profile = p3 and payload->>'student_id' = c3::text;
  res := res || E'\nthe promoted family gets a laptop_promoted email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'laptop_released' and payload->>'student_id' = c1::text and payload->>'reason' = 'parent';
  res := res || E'\nthe releasing family gets a laptop_released email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Cancel → release → promote ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  perform public.cancel_my_registration(r2);
  execute 'reset role';
  select status into st from laptop_loans where registration_id = r2;
  res := res || E'\ncancelling the spot releases its laptop: ' || case when st = 'released' then 'ok' else 'BAD (' || st || ')' end;
  select status into st from laptop_loans where registration_id = r4;
  res := res || E'\n...and the queue moves up: ' || case when st = 'reserved' then 'ok' else 'BAD (' || st || ')' end;
  select count(*) into n from notifications where template = 'laptop_released' and payload->>'student_id' = c2::text and payload->>'reason' = 'spot_ended';
  res := res || E'\n...the cancelled family is told the laptop went with the spot: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'laptop_promoted' and payload->>'student_id' = c4::text;
  res := res || E'\n...the next family gets laptop_promoted: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Raising the cap promotes ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  st := public.request_laptop(r5);
  res := res || E'\nrequest with the week full is queued: ' || case when st = 'queued' then 'ok' else 'BAD (' || st || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  update sessions set laptop_loaners = 3 where id = wa;
  select status into st from laptop_loans where registration_id = r5;
  res := res || E'\nraising the cap reserves the queued request: ' || case when st = 'reserved' then 'ok' else 'BAD (' || st || ')' end;
  update sessions set laptop_loaners = 2 where id = wa;
  select count(*) into n from laptop_loans where registration_id in (r3, r4, r5) and status = 'reserved';
  res := res || E'\nlowering it takes nothing back: ' || case when n = 3 then 'ok' else 'BAD (' || n || ')' end;
  update sessions set laptop_loaners = 3 where id = wa;

  -- ── Admin hand-out checklist ──
  st := public.admin_set_laptop_status(r3, 'handed_out');
  select status || '/' || (handed_out_at is not null)::text into st from laptop_loans where registration_id = r3;
  res := res || E'\nadmin ticks handed out, with the time: ' || case when st = 'handed_out/true' then 'ok' else 'BAD (' || st || ')' end;
  perform public.admin_set_laptop_status(r3, 'reserved');
  select status || '/' || (handed_out_at is null)::text into st from laptop_loans where registration_id = r3;
  res := res || E'\nadmin undoes a hand-out tick: ' || case when st = 'reserved/true' then 'ok' else 'BAD (' || st || ')' end;
  perform public.admin_set_laptop_status(r3, 'handed_out');
  begin
    perform public.admin_set_laptop_status(r4, 'returned');
    res := res || E'\nreturn a laptop never handed out: ALLOWED (BAD)';
  exception when others then res := res || E'\nreturn a laptop never handed out: refused ok'; end;

  -- The crew's roster: reserved and handed out only, and only for the section's crew.
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  select string_agg(full_name || '=' || coalesce(laptop_loan, '-'), ',' order by full_name) into st from public.section_roster(sa2);
  res := res || E'\nthe lead''s roster shows who borrows one: ' || case when st = 'Lap Four=reserved,Lap Seven=reserved,Lap Three=handed_out' then 'ok' else 'BAD (' || st || ')' end;
  select string_agg(full_name || '=' || coalesce(laptop_loan, '-'), ',') into st from public.section_roster(sa);
  res := res || E'\n...and nothing for a released one: ' || case when st = 'Lap One=-' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  begin
    perform * from public.section_roster(sa2);
    res := res || E'\nanother volunteer reads the roster: ALLOWED (BAD)';
  exception when others then res := res || E'\nanother volunteer reads the roster: refused ok'; end;

  -- A handed-out laptop can't be released online; the camp marks it returned.
  perform set_config('request.jwt.claims', json_build_object('sub', p3, 'role', 'authenticated')::text, true);
  begin
    perform public.release_laptop(r3);
    res := res || E'\nparent releases a handed-out laptop: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent releases a handed-out laptop: refused ' || case when sqlerrm like 'That laptop has been handed out%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  -- p1 asks again: back of the queue (the week is full).
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  st := public.request_laptop(r1);
  res := res || E'\nasking again after releasing goes to the back of the queue: ' || case when st = 'queued' then 'ok' else 'BAD (' || st || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.admin_set_laptop_status(r3, 'returned');
  select string_agg(status, ',' order by registration_id = r3 desc) into st from laptop_loans where registration_id in (r3, r1);
  res := res || E'\na returned laptop goes to the queue: ' || case when st = 'returned,reserved' then 'ok' else 'BAD (' || st || ')' end;

  -- ── Moving a camper to another week takes the request along ──
  update registrations set section_id = sb where id = r4;
  execute 'reset role';
  select status into st from laptop_loans where registration_id = r4;
  res := res || E'\nmoved to a week with a free loaner: still reserved: ' || case when st = 'reserved' then 'ok' else 'BAD (' || st || ')' end;
  select private.laptop_in_use(wa) * 10 + private.laptop_in_use(wb) into n;
  res := res || E'\n...and it counts in the new week, not the old: ' || case when n = 21 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Started weeks: parents can't change online; admins can ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  st := public.request_laptop(rc);
  res := res || E'\nadmin requests during the week: ' || case when st = 'reserved' then 'ok' else 'BAD (' || st || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  begin
    perform public.release_laptop(rc);
    res := res || E'\nparent releases during the week: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent releases during the week: refused ' || case when sqlerrm like 'Laptop Test C has started%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  select count(*) filter (where not changes_open) into n from public.my_laptop_loans() where registration_id = rc;
  res := res || E'\n...and their view says so: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  execute 'reset role';

  -- A move into a week with one free loaner doesn't bounce through the queue (which would email
  -- the family "queued" then "promoted"; within this one transaction the dedupe keys would hide
  -- those emails, so the audit log is checked instead).
  select count(*) into n from audit.log where table_name = 'laptop_loans' and row_id = r4::text
     and reason in ('laptop_moved', 'laptop_promoted') and new->>'status' = 'queued';
  select count(*) into m from audit.log where table_name = 'laptop_loans' and row_id = r4::text and reason = 'laptop_promoted';
  res := res || E'\n...without passing through the queue: ' || case when n = 0 and m = 1 then 'ok' else 'BAD (' || n || '/' || m || ')' end;

  -- ── Spares, and a spot that ends after the hand-out ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  update sessions set laptop_loaners = 2 where id = wa;          -- in use: r1 and r5
  st := public.request_laptop(r3);                               -- returned earlier: asks again, queued
  res := res || E'\na new request with the week full is queued: ' || case when st = 'queued' then 'ok' else 'BAD (' || st || ')' end;
  st := public.admin_set_laptop_status(r3, 'handed_out');
  res := res || E'\na queued camper can be handed a spare: ' || case when st = 'handed_out' then 'ok' else 'BAD (' || st || ')' end;
  perform public.admin_set_laptop_status(r5, 'handed_out');
  update registrations set status = 'cancelled' where id = r5;
  select status into st from laptop_loans where registration_id = r5;
  res := res || E'\ncancelling a spot leaves a handed-out laptop handed out: ' || case when st = 'handed_out' then 'ok' else 'BAD (' || st || ')' end;
  begin
    perform public.admin_set_laptop_status(r5, 'reserved');
    res := res || E'\nundo a hand-out after the spot ended: ALLOWED (BAD)';
  exception when others then res := res || E'\nundo a hand-out after the spot ended: refused ' || case when sqlerrm like 'This camper no longer holds a spot%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  st := public.admin_set_laptop_status(r5, 'returned');
  select status || '/' || (returned_at is not null)::text into st from laptop_loans where registration_id = r5;
  res := res || E'\n...but it can be marked returned: ' || case when st = 'returned/true' then 'ok' else 'BAD (' || st || ')' end;
  execute 'reset role';

  -- ── Emails and audit ──
  select count(*) into n from notifications where template = 'laptop_reserved' and payload->>'student_id' = c1::text;
  res := res || E'\none laptop_reserved email for camper 1 (asking twice didn''t send two): ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'laptop_queued' and payload->>'student_id' = c4::text and payload->>'position' = '2';
  res := res || E'\nlaptop_queued says the place in the queue: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template like 'laptop_%' and dedupe_key is null;
  res := res || E'\nevery laptop email has a dedupe key: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*), count(*) filter (where reason = 'laptop_promoted') into n, m from audit.log
   where table_name = 'laptop_loans' and row_id in (r1::text, r2::text, r3::text, r4::text, r5::text);
  res := res || E'\naudit log records the loans and why: ' || case when n >= 10 and m >= 3 then 'ok' else 'BAD (' || n || '/' || m || ')' end;

  -- A registration with a loan can't be deleted (RESTRICT): it's cancelled, never deleted.
  begin
    delete from registrations where id = r1;
    res := res || E'\ndelete a registration with a loan: ALLOWED (BAD)';
  exception when foreign_key_violation then res := res || E'\ndelete a registration with a loan: refused ok'; end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

-- Tests for migration_waitlist_offers.sql (spec 10). Run against the demo DB after
-- private.reset_demo(). Builds its own Week 2 class; the block raises its results at the end, so
-- every test write rolls back. Every line should end in "ok".
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  parent uuid := (select id from profiles where role='parent' order by display_name limit 1);
  yr int := (select max(year) from sessions where is_active);
  cls uuid; sec uuid; other uuid; stu uuid[] := '{}'; reg uuid[] := '{}'; s uuid; r uuid;
  res text := ''; n int; st text; hrs numeric; i int;
begin
  insert into classes (name) values ('[TEST] Offers') returning id into cls;
  insert into sections (class_id, label, age_min, age_max, capacity, week) values (cls, 'OFF-1', 8, 15, 2, 2) returning id into sec;
  insert into sections (class_id, label, age_min, age_max, capacity, week) values (cls, 'OFF-2', 8, 15, 5, 2) returning id into other;
  -- 6 campers: c1, c2 hold the two seats; c3..c6 wait, joining in that order.
  for i in 1..6 loop
    insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year)
      values (parent, '[TEST] Camper ' || i, '[TEST] Camper', i::text, 11, '6th', yr) returning id into s;
    stu := stu || s;
    insert into registrations (student_id, section_id, status, created_at)
      values (s, sec, (case when i <= 2 then 'confirmed' else 'waitlisted' end)::registration_status, now() - ((10 - i) || ' minutes')::interval)
      returning id into r;
    reg := reg || r;
  end loop;
  -- c3 already holds a seat in OFF-2 the same week → must be skipped.
  insert into registrations (student_id, section_id, status) values (stu[3], other, 'confirmed');
  -- Taking that seat withdrew c3's OFF-1 waitlist place (the rule working). Put it back, as an
  -- admin could, so the offer logic's own "skip seat-holders" safety net is exercised.
  update registrations set status = 'waitlisted' where id = reg[3];
  -- c5 was displaced by a cancelled class that week → goes first despite joining later.
  insert into registrations (student_id, section_id, status, cancel_reason, displaced_from_section)
    values (stu[5], other, 'cancelled', 'section_cancelled', other);

  -- Free one seat as an admin.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update registrations set status = 'cancelled' where id = reg[1];
  execute 'reset role';
  select status::text into st from registrations where id = reg[5];
  res := res || E'\ndisplaced camper is offered first: ' || case when st='offered' then 'ok' else 'BAD (' || st || ')' end;
  select status::text into st from registrations where id = reg[3];
  res := res || E'\nseat-holder that week is skipped: ' || case when st='waitlisted' then 'ok' else 'BAD (' || st || ')' end;
  select extract(epoch from offer_expires_at - offered_at)/3600 into hrs from registrations where id = reg[5];
  res := res || E'\noffer window (final week → 12 h): ' || case when round(hrs) = 12 then 'ok' else 'BAD (' || round(hrs,1) || ' h)' end;
  select count(*) into n from registrations where section_id = sec and status in ('confirmed','pending','offered');
  res := res || E'\ncapacity respected (2): ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'waitlist_offer';
  res := res || E'\noffer email queued: ' || case when n >= 1 then 'ok' else 'BAD' end;

  -- The family declines → next in line (c4) is offered.
  perform set_config('request.jwt.claims', json_build_object('sub', parent, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.decline_offer(reg[5]);
  execute 'reset role';
  select status::text into st from registrations where id = reg[4];
  res := res || E'\ndecline passes it to the next camper: ' || case when st='offered' then 'ok' else 'BAD (' || st || ')' end;

  -- c4 also waits in OFF-2's waitlist that week; accepting OFF-1 withdraws it.
  update sections set capacity = (select count(*) from registrations where section_id = other and status in ('confirmed','pending','offered')) where id = other;
  insert into registrations (student_id, section_id, status) values (stu[4], other, 'waitlisted');
  perform set_config('request.jwt.claims', json_build_object('sub', parent, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_offer(reg[4]);
  execute 'reset role';
  select status::text into st from registrations where id = reg[4];
  res := res || E'\naccept confirms: ' || case when st='confirmed' then 'ok' else 'BAD (' || st || ')' end;
  select status::text || '/' || coalesce(cancel_reason,'') into st from registrations where student_id = stu[4] and section_id = other;
  res := res || E'\naccepting withdraws the same-week waitlist: ' || case when st='cancelled/took_other_seat' then 'ok' else 'BAD (' || st || ')' end;

  -- Expiry: free another seat → c6 offered; force it past due and sweep → cancelled, nobody left.
  update registrations set status = 'cancelled' where id = reg[2];
  select status::text into st from registrations where id = reg[6];
  update registrations set offer_expires_at = now() - interval '1 minute' where id = reg[6];
  perform private.sweep_offers();
  select status::text || '/' || coalesce(cancel_reason,'') into st from registrations where id = reg[6];
  res := res || E'\nexpired offer ends: ' || case when st='cancelled/offer_expired' then 'ok' else 'BAD (' || st || ')' end;
  select status::text into st from registrations where id = reg[3];
  res := res || E'\n...and the skipped seat-holder still waits: ' || case when st='waitlisted' then 'ok' else 'BAD (' || st || ')' end;

  -- Burst: 30 waiting, capacity raised by 10 → exactly 10 offers.
  for i in 1..30 loop
    insert into students (parent_id, full_name, age, grade, registration_year) values (parent, '[TEST] Burst ' || i, 11, '6th', yr) returning id into s;
    insert into registrations (student_id, section_id, status, created_at) values (s, sec, 'waitlisted', now() + (i || ' seconds')::interval);
  end loop;
  select count(*) into n from registrations where section_id = sec and status in ('confirmed','pending','offered');
  update sections set capacity = n + 10 where id = sec;
  select count(*) into n from registrations r2 join students s2 on s2.id = r2.student_id where r2.section_id = sec and r2.status = 'offered' and s2.full_name like '[TEST] Burst %';
  res := res || E'\n10 seats for 30 waiting → 10 offers: ' || case when n = 10 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from registrations where section_id = sec and status in ('confirmed','pending','offered');
  res := res || E'\nnever over capacity: ' || case when n <= (select capacity from sections where id = sec) then 'ok' else 'BAD' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

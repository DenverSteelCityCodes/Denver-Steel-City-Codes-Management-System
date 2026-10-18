-- Tests for spec 10a (no same-week waitlist backups), in migration_one_class_per_week.sql.
-- Run against the demo DB after private.reset_demo(). The block raises its results at the end, so
-- every test write rolls back. Every line should end in "ok".
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  -- A camper holding a seat, its parent, and the week of that seat.
  held     record;
  other_w  uuid;   -- another section in the SAME week that fits the camper's age
  other_x  uuid;   -- a section in a DIFFERENT week that fits the camper's age
  res      text := '';
begin
  select r.student_id, st.parent_id, st.age, s.week, r.section_id into held
    from registrations r join sections s on s.id=r.section_id join students st on st.id=r.student_id
   where r.status in ('confirmed','pending') and s.week is not null
     and exists (select 1 from sections o where o.week = s.week and o.id <> s.id and st.age between o.age_min and o.age_max and o.cancelled_at is null and private.course_rule_block(r.student_id, o.id) is null)
     and exists (select 1 from sections o where o.week is not null and o.week <> s.week and st.age between o.age_min and o.age_max and o.cancelled_at is null and private.course_rule_block(r.student_id, o.id) is null)
     -- free in the other week, so joining a waitlist there is allowed
     and not exists (select 1 from registrations r2 join sections s2 on s2.id = r2.section_id
                      where r2.student_id = r.student_id and r2.id <> r.id and r2.status in ('confirmed','pending')
                        and (s2.week is null or s2.week <> s.week))
   limit 1;
  if held.student_id is null then raise exception 'RESULTS: no suitable camper in the seed (test needs updating)'; end if;
  -- Classes the camper's grade and prerequisites allow (spec 31), so only the week rule is tested.
  select id into other_w from sections o where o.week = held.week and o.id <> held.section_id and held.age between o.age_min and o.age_max and o.cancelled_at is null and private.course_rule_block(held.student_id, o.id) is null limit 1;
  select id into other_x from sections o where o.week is not null and o.week <> held.week and held.age between o.age_min and o.age_max and o.cancelled_at is null and private.course_rule_block(held.student_id, o.id) is null limit 1;
  -- Make both targets full, so a sign-up would be a waitlist entry.
  update sections set capacity = greatest(1, (select count(*) from registrations where section_id = sections.id and status in ('confirmed','pending'))) where id in (other_w, other_x);
  insert into registrations (student_id, section_id, status)
    select st.id, s.id, 'confirmed' from sections s, lateral (select id from students where id <> held.student_id and age between s.age_min and s.age_max limit 1) st
     where s.id in (other_w, other_x) and not exists (select 1 from registrations where section_id = s.id and status in ('confirmed','pending'))
    on conflict do nothing;
  delete from registrations where student_id = held.student_id and section_id in (other_w, other_x);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', held.parent_id, 'role', 'authenticated')::text, true);
  begin
    insert into registrations (student_id, section_id) values (held.student_id, other_w);
    res := res || E'\nsame-week waitlist backup by parent: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nsame-week waitlist backup by parent: refused ' || case when sqlerrm like '%Cancel it first%' then 'ok' else '(BAD message: ' || sqlerrm || ')' end;
  end;
  begin
    insert into registrations (student_id, section_id) values (held.student_id, other_x);
    res := res || E'\ndifferent-week waitlist by parent: allowed ' || case when (select status from registrations where student_id=held.student_id and section_id=other_x) = 'waitlisted' then 'ok' else '(BAD: not waitlisted)' end;
  exception when others then res := res || E'\ndifferent-week waitlist by parent: refused (BAD: ' || sqlerrm || ')'; end;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  begin
    insert into registrations (student_id, section_id, status) values (held.student_id, other_w, 'waitlisted');
    res := res || E'\nadmin override places a same-week backup: ok';
  exception when others then res := res || E'\nadmin override: refused (BAD: ' || sqlerrm || ')'; end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

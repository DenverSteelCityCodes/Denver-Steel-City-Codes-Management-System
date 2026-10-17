-- Tests for migration_soft_cancel.sql (spec 06) — run against the demo DB after private.reset_demo().
-- Same pattern as audit-log-tests.sql: the block ends by raising its results, so every test write
-- rolls back. Every line should end in "ok"; any "BAD" is a failure.
do $$
declare
  v_parent  uuid := (select id from profiles where display_name='Taylor Brooks');
  admin_id  uuid := (select id from profiles where display_name='Jordan Rivera');
  -- A Week 1 section with seated campers, and one of the parent's campers who fits it by age.
  sec       uuid := (select s.id from sections s where s.label='PY-B' and s.week=1);
  seated    int  := (select count(*) from registrations where section_id=(select s.id from sections s where s.label='PY-B' and s.week=1) and status <> 'cancelled');
  reg       uuid;
  stu       uuid;
  res       text := '';
  n         int;
  r         record;
begin
  -- ===== Parent can't cancel a section =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  begin
    perform public.cancel_section(sec);
    res := res || E'\nparent cancels a section: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent cancels a section: blocked ok'; end;
  execute 'reset role';

  -- ===== Admin: deleting a section with registrations is refused =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  begin
    delete from sections where id = sec;
    res := res || E'\nadmin deletes a section with registrations: ALLOWED (BAD)';
  exception when foreign_key_violation then res := res || E'\nadmin deletes a section with registrations: refused ok'; end;

  -- ===== Admin "Remove registration" = cancel with reason, and restore clears it =====
  select id into reg from registrations where section_id = sec and status = 'confirmed' limit 1;
  update registrations set status = 'cancelled' where id = reg;
  select * into r from registrations where id = reg;
  res := res || E'\nadmin cancel stamps reason/by/at: ' || case when r.cancel_reason='admin_removed' and r.cancelled_by=admin_id and r.cancelled_at is not null then 'ok' else 'BAD (' || coalesce(r.cancel_reason,'null') || ')' end;
  update registrations set status = 'confirmed' where id = reg;
  select * into r from registrations where id = reg;
  res := res || E'\nrestore clears the stamp: ' || case when r.cancel_reason is null and r.cancelled_at is null then 'ok' else 'BAD' end;

  -- ===== Admin cancels the section =====
  select public.cancel_section(sec, 'Teacher unavailable') into n;
  res := res || E'\ncancel_section returns its count (' || n || '): ' || case when n = seated then 'ok' else 'BAD (want ' || seated || ')' end;
  select count(*) into n from registrations where section_id = sec and status <> 'cancelled';
  res := res || E'\nno live registrations left: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from registrations where section_id = sec and cancel_reason = 'section_cancelled' and displaced_from_section = sec and cancelled_by = admin_id;
  res := res || E'\nall marked section_cancelled + displaced: ' || case when n = seated then 'ok' else 'BAD (' || n || ')' end;
  select * into r from sections where id = sec;
  res := res || E'\nsection marked cancelled with reason: ' || case when r.cancelled_at is not null and r.cancel_reason = 'Teacher unavailable' then 'ok' else 'BAD' end;
  execute 'reset role';
  select count(*) into n from audit.log where table_name = 'registrations' and reason = 'section_cancelled';
  res := res || E'\naudit log labels the cancels: ' || case when n >= seated then 'ok' else 'BAD (' || n || ')' end;

  -- ===== Parent can't sign up for a cancelled section =====
  select st.id into stu from students st
   where st.parent_id = v_parent
     and st.age between (select age_min from sections where id = sec) and (select age_max from sections where id = sec)
   limit 1;
  if stu is null then
    res := res || E'\nparent signs up for a cancelled section: skipped (no eligible camper in seed)';
  else
    delete from registrations where student_id = stu and section_id = sec;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
    begin
      insert into registrations (student_id, section_id) values (stu, sec);
      res := res || E'\nparent signs up for a cancelled section: ALLOWED (BAD)';
    exception when others then
      res := res || E'\nparent signs up for a cancelled section: refused ' || case when sqlerrm like '%cancelled%' then 'ok' else '(BAD message: ' || sqlerrm || ')' end;
    end;
    execute 'reset role';
  end if;

  -- ===== The nightly reset still works with RESTRICT =====
  perform private.reset_demo();
  res := res || E'\nreset_demo() runs: ok (' || (select count(*) from students) || ' campers reseeded)';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

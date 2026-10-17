-- Tests for migration_history_revert.sql (spec 15). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  v_parent uuid := (select id from profiles where display_name='Taylor Brooks');
  maya uuid := (select id from students where full_name='Maya Brooks');
  reg uuid; sec uuid; a1 bigint; a2 bigint; res text := ''; n int; v text; cap int;
begin
  -- Parent edits allergies twice (two log entries).
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  update students set allergies = 'Peanuts (rev test 1)' where id = maya;
  update students set allergies = 'Peanuts (rev test 2)' where id = maya;
  begin
    perform public.admin_revert(1);
    res := res || E'\nparent calls admin_revert: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent calls admin_revert: blocked ok'; end;
  execute 'reset role';
  select id into a1 from audit.log where table_name='students' and row_id=maya::text and new->>'allergies'='Peanuts (rev test 1)';
  select id into a2 from audit.log where table_name='students' and row_id=maya::text and new->>'allergies'='Peanuts (rev test 2)';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select count(*) into n from public.admin_camper_history(maya);
  res := res || E'\ncamper history shows the edits: ' || case when n >= 2 then 'ok (' || n || ')' else 'BAD (' || n || ')' end;
  begin
    perform public.admin_revert(a1);
    res := res || E'\nreverting an older edit that was changed again: ALLOWED (BAD)';
  exception when others then res := res || E'\nreverting a superseded edit: refused ' || case when sqlerrm like '%changed again%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  perform public.admin_revert(a2);
  select allergies into v from students where id = maya;
  res := res || E'\nreverting the latest edit restores it: ' || case when v = 'Peanuts (rev test 1)' then 'ok' else 'BAD (' || v || ')' end;
  execute 'reset role';
  select count(*) into n from audit.log where table_name='students' and row_id=maya::text and reason = 'revert:' || a2;
  res := res || E'\nthe revert is itself logged: ' || case when n = 1 then 'ok' else 'BAD' end;
  execute 'set local role authenticated';

  -- Registration: cancel then revert restores the seat; when the section is full, refused.
  -- A section with no waitlist: otherwise the freed seat is offered on at once (spec 10) and can't be restored.
  select r.id, r.section_id into reg, sec from registrations r
   where r.status='confirmed'
     and not exists (select 1 from registrations w where w.section_id = r.section_id and w.status = 'waitlisted')
   limit 1;
  update registrations set status = 'cancelled' where id = reg;
  execute 'reset role';
  select id into a1 from audit.log where table_name='registrations' and row_id=reg::text order by id desc limit 1;
  execute 'set local role authenticated';
  perform public.admin_revert(a1);
  select status::text into v from registrations where id = reg;
  res := res || E'\nundoing a cancel restores the seat: ' || case when v='confirmed' then 'ok' else 'BAD (' || v || ')' end;
  update registrations set status = 'cancelled' where id = reg;
  execute 'reset role';
  select id into a1 from audit.log where table_name='registrations' and row_id=reg::text order by id desc limit 1;
  execute 'set local role authenticated';
  select count(*) into cap from registrations where section_id = sec and status in ('confirmed','pending');
  update sections set capacity = greatest(cap, 1) where id = sec;
  begin
    perform public.admin_revert(a1);
    res := res || E'\nundoing a cancel into a full section: ALLOWED (BAD)';
  exception when others then res := res || E'\nundoing a cancel into a full section: refused ' || case when sqlerrm like '%full%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

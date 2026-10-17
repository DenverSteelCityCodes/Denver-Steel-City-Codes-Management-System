-- Tests for migration_notifications.sql (spec 09). Run against the demo DB after private.reset_demo().
-- The block raises its results at the end, so every test write (and queued email) rolls back.
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  sec record; kid record; res text := ''; n int; r record; nid bigint;
begin
  select s.* into sec from sections s
   where s.cancelled_at is null and s.week is not null
     and (select count(*) from registrations x where x.section_id=s.id and x.status in ('confirmed','pending')) < s.capacity
   limit 1;
  select st.id, st.parent_id, st.first_name into kid from students st
   where st.age between sec.age_min and sec.age_max
     and not exists (select 1 from registrations x join sections s2 on s2.id=x.section_id
                     where x.student_id=st.id and x.status <> 'cancelled' and (s2.week is null or s2.week = sec.week))
   limit 1;
  -- Give the family a deliverable (but reserved .test) address so the email queues.
  insert into parent_profiles (id, email) values (kid.parent_id, 'family@scc-demo.test')
    on conflict (id) do update set email = excluded.email;

  -- Trusted context (like the demo reset): no email.
  insert into registrations (student_id, section_id, status) values (kid.id, sec.id, 'confirmed');
  select count(*) into n from notifications;
  res := res || E'\nno email for SQL-editor/reset writes: ' || case when n=0 then 'ok' else 'BAD (' || n || ')' end;
  delete from registrations where student_id=kid.id and section_id=sec.id;

  -- Parent signs up → one confirmation, queued, to the contact email, with the class details.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', kid.parent_id, 'role', 'authenticated')::text, true);
  insert into registrations (student_id, section_id) values (kid.id, sec.id);
  begin
    perform 1 from notifications limit 1;
    select count(*) into n from notifications;
    res := res || E'\nparent reads the email log: ' || case when n=0 then 'sees nothing ok' else 'SEES ROWS (BAD)' end;
  exception when others then res := res || E'\nparent reads the email log: blocked ok'; end;
  execute 'reset role';
  select * into r from notifications order by id desc limit 1;
  res := res || E'\nsign-up queues one confirmation: ' || case when r.template='registration_confirmed' and r.status='queued' and r.recipient_email='family@scc-demo.test' and r.payload->>'class' is not null then 'ok (' || (r.payload->>'class') || ')' else 'BAD (' || coalesce(r.template,'none') || '/' || coalesce(r.status,'') || ')' end;

  -- Admin cancels the section → the family gets the "class was cancelled" wording.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.cancel_section(sec.id, 'test');
  select count(*) into n from notifications;
  res := res || E'\nadmin reads the email log: ' || case when n >= 2 then 'ok (' || n || ' rows)' else 'BAD (' || n || ')' end;
  execute 'reset role';
  select count(*) into n from notifications where template='registration_cancelled' and payload->>'cancel_reason'='section_cancelled';
  res := res || E'\ncancelled class queues cancel emails: ' || case when n >= 1 then 'ok (' || n || ', most to example.com so cancelled)' else 'BAD' end;
  select count(*) into n from notifications where recipient_email like '%@example.com' and status <> 'cancelled';
  res := res || E'\nexample.com addresses never queue: ' || case when n=0 then 'ok' else 'BAD (' || n || ')' end;

  -- The sender's side: claim marks sending; finish records sent.
  execute 'set local role service_role';
  select id into nid from public.claim_notifications(10) limit 1;
  perform public.finish_notification(nid, true, null);
  execute 'reset role';
  select * into r from notifications where id = nid;
  res := res || E'\nclaim + finish marks sent: ' || case when r.status='sent' and r.attempts=1 and r.sent_at is not null then 'ok' else 'BAD (' || coalesce(r.status,'none') || ')' end;
  begin
    execute 'set local role authenticated';
    perform public.claim_notifications(1);
    res := res || E'\nsigned-in user claims emails: ALLOWED (BAD)';
  exception when others then res := res || E'\nsigned-in user claims emails: blocked ok'; end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

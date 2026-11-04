-- Tests for migration_notifications.sql (spec 09). Run against the demo DB after private.reset_demo().
-- The block raises its results at the end, so every test write (and queued email) rolls back.
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  cls uuid; sec record; kid record; res text := ''; n int; r record; nid bigint;
begin
  -- Its own class with no course rules (spec 31) and a camper with no seats yet. The reset keeps
  -- old emails, so every count below is limited to this transaction's (created_at = now()).
  insert into classes (name) values ('Notifications Basics') returning id into cls;
  insert into sections (class_id, label, week, age_min, age_max, capacity)
    values (cls, 'NT1', 1, 5, 17, 10) returning * into sec;
  insert into students (parent_id, full_name, first_name, age, grade)
    values ((select id from profiles where role = 'parent' order by id limit 1), 'Notifications Camper', 'Notify', 11, '6th')
    returning id, parent_id, first_name into kid;
  -- Give the family a deliverable (but reserved .test) address so the email queues.
  insert into parent_profiles (id, email) values (kid.parent_id, 'family@scc-demo.test')
    on conflict (id) do update set email = excluded.email;

  -- Trusted context (like the demo reset): no email.
  insert into registrations (student_id, section_id, status) values (kid.id, sec.id, 'confirmed');
  select count(*) into n from notifications where created_at = now();
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
  select * into r from notifications where created_at = now() order by id desc limit 1;
  res := res || E'\nsign-up queues one confirmation: ' || case when r.template='registration_confirmed' and r.status='queued' and r.recipient_email='family@scc-demo.test' and r.payload->>'class' is not null then 'ok' else 'BAD (' || coalesce(r.template,'none') || '/' || coalesce(r.status,'') || ')' end;

  -- Admin cancels the section → the family gets the "class was cancelled" wording.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.cancel_section(sec.id, 'test');
  select count(*) into n from notifications;
  res := res || E'\nadmin reads the email log: ' || case when n >= 2 then 'ok (' || n || ' rows)' else 'BAD (' || n || ')' end;
  execute 'reset role';
  select count(*) into n from notifications where created_at = now() and template='registration_cancelled' and payload->>'cancel_reason'='section_cancelled';
  res := res || E'\ncancelled class queues cancel emails: ' || case when n >= 1 then 'ok' else 'BAD' end;
  select count(*) into n from notifications where created_at = now() and recipient_email like '%@example.com' and status <> 'cancelled';
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

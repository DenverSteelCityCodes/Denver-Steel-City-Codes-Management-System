-- Tests for migration_interview_slots_private.sql (#144: interview slots readable by every
-- signed-in user). Run against the demo DB after private.reset_demo(). The block raises its results
-- at the end, so every test write rolls back. Before the migration the parent and volunteer lines
-- print BAD; after it, all say ok.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  parent_id uuid := (select st.parent_id from students st limit 1);
  vol_id uuid := (select id from volunteers limit 1);
  applicant_id uuid := (select user_id from volunteer_applications where status = 'pending' and user_id is not null limit 1);
  slot uuid;
  res text := ''; n int;
begin
  insert into interview_slots (slot_datetime, duration_minutes, notes)
    values (now() + interval '3 days', 15, '[TEST] meet.example/secret-room passcode 1234') returning id into slot;
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub', parent_id, 'role', 'authenticated')::text, true);
  select count(*) into n from interview_slots;
  res := res || E'\nparent reads interview slots: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;

  perform set_config('request.jwt.claims', json_build_object('sub', vol_id, 'role', 'authenticated')::text, true);
  select count(*) into n from interview_slots where notes like '[TEST]%';
  res := res || E'\nvolunteer reads slot notes: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;

  if applicant_id is null then
    res := res || E'\napplicant lists open times: skipped (no pending applicant with an account)';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', applicant_id, 'role', 'authenticated')::text, true);
    select count(*) into n from interview_slots;
    res := res || E'\napplicant reads the table directly: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
    select count(*) into n from public.open_interview_slots() where id = slot;
    res := res || E'\napplicant still lists open times (RPC): ' || case when n = 1 then 'ok' else 'BAD' end;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from interview_slots where id = slot and notes like '[TEST]%';
  res := res || E'\nadmin reads slots with notes: ' || case when n = 1 then 'ok' else 'BAD' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

-- Tests for admin MFA (spec 27: private.auth_user_role() and migration_admin_mfa.sql). Run
-- against the demo DB after private.reset_demo(). The block raises its results at the end, so
-- every test write (including turning the switch on) rolls back.
-- Each "session" is faked with request.jwt.claims; 'aal' is the claim Supabase Auth sets to
-- 'aal2' once the authenticator code has been verified.
do $$
declare
  a1 uuid; a2 uuid; parent uuid; res text := ''; n int; ok boolean;
  claims text;
begin
  select id into a1 from profiles where role = 'admin' order by id limit 1;
  select id into a2 from profiles where role = 'admin' and id <> a1 order by id limit 1;
  select st.parent_id into parent from students st limit 1;
  update app_settings set value = 'true' where key = 'admin_mfa_required';

  -- Admin, password only (aal1): no admin data, no admin RPCs.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from students;
  res := res || E'\naal1 admin reads campers: ' || case when n = 0 then 'none ok' else 'BAD (' || n || ')' end;
  select count(*) into n from profiles;
  res := res || E'\naal1 admin reads profiles: ' || case when n = 1 then 'only own ok' else 'BAD (' || n || ')' end;
  begin
    perform public.admin_mfa_status();
    res := res || E'\naal1 admin calls an admin RPC: ALLOWED (BAD)';
  exception when others then res := res || E'\naal1 admin calls an admin RPC: refused ok'; end;
  select required into ok from public.my_mfa_requirement();
  res := res || E'\nthe app is told the second step is required: ' || case when ok then 'ok' else 'BAD' end;

  -- Same admin after the code (aal2): everything back.
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from students;
  res := res || E'\naal2 admin reads campers: ' || case when n > 0 then 'ok' else 'BAD (0)' end;
  select count(*) into n from public.admin_mfa_status();
  res := res || E'\naal2 admin sees the MFA status list: ' || case when n >= 2 then 'ok' else 'BAD (' || n || ')' end;

  -- Parents are unaffected at aal1.
  perform set_config('request.jwt.claims', json_build_object('sub', parent, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from students;
  res := res || E'\naal1 parent reads own campers: ' || case when n > 0 then 'ok' else 'BAD (0)' end;
  select required into ok from public.my_mfa_requirement();
  res := res || E'\nparents aren''t asked for a second step: ' || case when not ok then 'ok' else 'BAD' end;
  execute 'reset role';

  -- Reset a colleague's factor: removed, logged; not allowed on yourself.
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), a2, 'Test phone', 'totp', 'verified', now(), now());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.admin_reset_mfa(a1);
    res := res || E'\nreset your own second step: ALLOWED (BAD)';
  exception when others then res := res || E'\nreset your own second step: refused ok'; end;
  perform public.admin_reset_mfa(a2);
  execute 'reset role';
  select count(*) into n from auth.mfa_factors where user_id = a2;
  res := res || E'\nreset removes the colleague''s factor: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from audit.log where reason = 'mfa_reset' and row_id = a2::text and actor_id = a1;
  res := res || E'\nthe reset is in the audit log: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- Switch off (the demo): aal1 admin works as before.
  update app_settings set value = 'false' where key = 'admin_mfa_required';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from students;
  execute 'reset role';
  res := res || E'\nswitch off: aal1 admin reads campers: ' || case when n > 0 then 'ok' else 'BAD (0)' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

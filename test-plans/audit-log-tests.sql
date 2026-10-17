-- Tests for migration_audit_log.sql (spec 05) — run against the demo DB after private.reset_demo().
-- Impersonates each role with SET LOCAL ROLE + request.jwt.claims, like camp-week-rls-tests.sql.
-- The block ends by raising an exception that carries the results, so EVERY test write (and the
-- audit rows it produced) is rolled back. Read the results in the error message: every line should
-- end in "ok"; any "BAD" is a failure.
do $$
declare
  v_parent  uuid := (select id from profiles where display_name='Taylor Brooks');
  sam       uuid := (select id from profiles where display_name='Sam Okafor');
  admin_id  uuid := (select id from profiles where display_name='Jordan Rivera');
  maya      uuid := (select id from students where full_name='Maya Brooks');
  res       text := '';
  n         int;
  r         record;
  t0        timestamptz;
  ms_on     numeric;
  ms_off    numeric;
  sec       uuid := (select id from sections order by label limit 1);
begin
  -- ===== PARENT edits own camper → one log row with the parent as actor =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  update students set allergies = 'Peanuts (audit test)' where id = maya;
  update students set allergies = 'Peanuts (audit test)' where id = maya;   -- no-op: must not log
  begin
    perform 1 from audit.log limit 1;
    res := res || E'\nparent reads audit.log: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent reads audit.log: blocked ok'; end;
  begin
    perform 1 from public.admin_history('students', maya::text);
    res := res || E'\nparent calls admin_history: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent calls admin_history: blocked ok'; end;
  execute 'reset role';

  select count(*) into n from audit.log where table_name='students' and row_id=maya::text;
  res := res || E'\nparent edit + no-op logged ' || n || ' row(s) ' || case when n=1 then 'ok' else '(BAD: want 1)' end;
  select * into r from audit.log where table_name='students' and row_id=maya::text order by id desc limit 1;
  res := res || E'\nactor is the parent, role parent: ' || case when r.actor_id=v_parent and r.actor_role='parent' then 'ok' else 'BAD (' || coalesce(r.actor_id::text,'null') || '/' || coalesce(r.actor_role,'null') || ')' end;
  res := res || E'\nold/new captured: ' || case when r.new->>'allergies'='Peanuts (audit test)' and r.old ? 'allergies' then 'ok' else 'BAD' end;

  -- ===== VOLUNTEER cannot read the log =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', sam, 'role', 'authenticated')::text, true);
  begin
    perform 1 from public.admin_history('students', maya::text);
    res := res || E'\nvolunteer calls admin_history: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer calls admin_history: blocked ok'; end;
  execute 'reset role';

  -- ===== ADMIN: reads history, and a reason set by an RPC is recorded =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('app.reason', 'audit_test_reason', true);   -- what private.set_reason() does inside an RPC
  update students set allergies = 'None (audit test)' where id = maya;
  perform set_config('app.reason', '', true);
  select count(*) into n from public.admin_history('students', maya::text);
  res := res || E'\nadmin_history returns both edits: ' || case when n=2 then 'ok' else 'BAD (' || n || ')' end;
  select * into r from public.admin_history('students', maya::text) limit 1;
  res := res || E'\nnewest entry: admin + reason + name: ' || case when r.actor_id=admin_id and r.reason='audit_test_reason' and r.actor_name='Jordan Rivera' then 'ok' else 'BAD' end;
  execute 'reset role';

  -- ===== Trusted context (SQL editor / cron): actor null =====
  perform set_config('request.jwt.claims', '', true);
  update students set allergies = 'Shellfish (audit test)' where id = maya;
  select * into r from audit.log where table_name='students' and row_id=maya::text order by id desc limit 1;
  res := res || E'\nSQL-editor edit logged with null actor: ' || case when r.actor_id is null then 'ok' else 'BAD' end;

  -- ===== Composite key and text key =====
  update app_settings set value = value where key = 'volunteer_applications_open';  -- no-op
  update app_settings set updated_at = now() where key = 'volunteer_applications_open';
  select count(*) into n from audit.log where table_name='app_settings' and row_id='volunteer_applications_open';
  res := res || E'\napp_settings keyed by text key: ' || case when n=1 then 'ok' else 'BAD (' || n || ')' end;

  -- ===== Overhead: 200 section updates with and without the trigger =====
  t0 := clock_timestamp();
  for i in 1..100 loop update sections set room = coalesce(room, '') where id = sec; update sections set room = nullif(room, '') where id = sec; end loop;
  ms_on := extract(epoch from clock_timestamp() - t0) * 1000;
  alter table sections disable trigger audit_log_change;
  t0 := clock_timestamp();
  for i in 1..100 loop update sections set room = coalesce(room, '') where id = sec; update sections set room = nullif(room, '') where id = sec; end loop;
  ms_off := extract(epoch from clock_timestamp() - t0) * 1000;
  res := res || E'\noverhead, 200 section updates: ' || round(ms_on) || ' ms with log vs ' || round(ms_off) || ' ms without (info)';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

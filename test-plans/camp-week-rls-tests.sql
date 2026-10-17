-- RLS tests for migration_camp_week_ops.sql — run in Supabase SQL editor (or via MCP) against
-- the demo DB after private.reset_demo(). Impersonates each role with SET LOCAL ROLE +
-- request.jwt.claims; test writes are removed at the end. Expected: every "(BAD)" line absent.
-- Last run 2026-09-30: 36 checks, all as expected (see test-plans/camp-week-gap-audit-2026-09-30.md).
create temp table if not exists rls_results (n serial, test text, outcome text);
truncate rls_results;
grant all on rls_results to authenticated, anon;
grant usage, select on sequence rls_results_n_seq to authenticated, anon;
do $$
declare
  v_parent uuid := (select id from profiles where display_name='Taylor Brooks');
  sam uuid := (select id from profiles where display_name='Sam Okafor');
  fiona uuid := (select id from profiles where display_name='Fiona Zhang');
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  pyb uuid := (select s.id from sections s where s.label='PY-B' and s.week=1);
  web uuid := (select s.id from sections s where s.label='WEB-1' and s.week=1);
  pyb_support uuid := (select volunteer_id from section_supports where section_id=(select s.id from sections s where s.label='PY-B' and s.week=1) limit 1);
  pyb_student uuid := (select r.student_id from registrations r where r.section_id=(select s.id from sections s where s.label='PY-B' and s.week=1) and r.status in ('confirmed','pending') limit 1);
  web_student uuid := (select r.student_id from registrations r where r.section_id=(select s.id from sections s where s.label='WEB-1' and s.week=1) and r.status in ('confirmed','pending') limit 1);
  maya uuid := (select id from students where full_name='Maya Brooks');
  today date := (now() at time zone 'America/Denver')::date;
  n int; arr text[]; new_id uuid; ok boolean;
begin
  -- ===== PARENT (Taylor Brooks) =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  select count(*), bool_and(st.parent_id = v_parent) into n, ok from roll_call_marks m join students st on st.id=m.student_id;
  insert into rls_results(test,outcome) values ('parent sees only own campers'' roll calls', n || ' rows; all own = ' || ok);
  select count(*) into n from updates;
  insert into rls_results(test,outcome) values ('parent sees updates (everyone+parents+WEB-1 section = 3)', n || ' rows: ' || coalesce((select string_agg(audience, ',' order by audience) from updates),''));
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (web, maya, today, 'dismissal', true, v_parent);
    insert into rls_results(test,outcome) values ('parent inserts roll call', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('parent inserts roll call', 'blocked: ' || sqlerrm); end;
  begin
    insert into updates(audience, body) values ('everyone', 'spam');
    insert into rls_results(test,outcome) values ('parent posts update', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('parent posts update', 'blocked: ' || sqlerrm); end;
  begin
    perform public.update_recipient_emails('parents');
    insert into rls_results(test,outcome) values ('parent asks for parent emails', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('parent asks for parent emails', 'blocked: ' || sqlerrm); end;
  begin
    perform public.update_recipient_emails('section', web);
    insert into rls_results(test,outcome) values ('parent asks for section emails', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('parent asks for section emails', 'blocked: ' || sqlerrm); end;
  select count(*) into n from public.section_lead_names();
  insert into rls_results(test,outcome) values ('parent reads lead first names', n || ' sections');
  select count(*) into n from schedule_items;
  insert into rls_results(test,outcome) values ('parent reads schedule items', n || ' rows');
  select count(*) into n from sections where room is not null;
  insert into rls_results(test,outcome) values ('parent reads section rooms', n || ' rows');

  -- ===== VOLUNTEER LEAD (Sam Okafor, leads PY-B w1) =====
  perform set_config('request.jwt.claims', json_build_object('sub', sam, 'role', 'authenticated')::text, true);
  select count(*) into n from roll_call_marks where section_id <> pyb;
  insert into rls_results(test,outcome) values ('lead sees other sections'' roll calls', n || ' rows (expect 0)');
  select count(*) into n from roll_call_marks where section_id = pyb;
  insert into rls_results(test,outcome) values ('lead sees own section roll calls', n || ' rows');
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, pyb_student, today, 'arrival', true, sam) returning id into new_id;
    update roll_call_marks set present = false where id = new_id;
    insert into rls_results(test,outcome) values ('lead marks + edits own section', 'ok, present now ' || (select present from roll_call_marks where id=new_id));
  exception when others then insert into rls_results(test,outcome) values ('lead marks own section', 'BLOCKED (BAD): ' || sqlerrm); end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, pyb_student, today, 'after_lunch', true, fiona);
    insert into rls_results(test,outcome) values ('lead marks as someone else', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('lead marks as someone else', 'blocked: ' || sqlerrm); end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (web, web_student, today, 'after_lunch', true, sam);
    insert into rls_results(test,outcome) values ('lead marks other section', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('lead marks other section', 'blocked: ' || sqlerrm); end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, web_student, today, 'after_lunch', true, sam);
    insert into rls_results(test,outcome) values ('lead marks camper not in section', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('lead marks camper not in section', 'blocked: ' || sqlerrm); end;
  select count(*) into n from updates;
  insert into rls_results(test,outcome) values ('lead sees updates (everyone+volunteers = 2; not WEB-1 section, not parents)', n || ' rows: ' || coalesce((select string_agg(audience, ',' order by audience) from updates),''));
  begin
    insert into updates(audience, section_id, body) values ('section', pyb, 'Today we made loops!') returning id into new_id;
    insert into rls_results(test,outcome) values ('lead posts to own section', 'ok, author stamped as ' || (select author_name from updates where id=new_id));
  exception when others then insert into rls_results(test,outcome) values ('lead posts to own section', 'BLOCKED (BAD): ' || sqlerrm); end;
  begin
    insert into updates(audience, section_id, body) values ('section', web, 'hijack');
    insert into rls_results(test,outcome) values ('lead posts to other section', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('lead posts to other section', 'blocked: ' || sqlerrm); end;
  begin
    insert into updates(audience, body) values ('everyone', 'hijack');
    insert into rls_results(test,outcome) values ('lead posts to everyone', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('lead posts to everyone', 'blocked: ' || sqlerrm); end;
  begin
    insert into updates(author_id, audience, section_id, body) values (admin_id, 'section', pyb, 'as admin?') returning author_id into new_id;
    insert into rls_results(test,outcome) values ('lead spoofs author_id', case when new_id = sam then 'ok: author forced to self' else 'ALLOWED (BAD)' end);
  exception when others then insert into rls_results(test,outcome) values ('lead spoofs author_id', 'blocked: ' || sqlerrm); end;
  delete from updates where author_id = admin_id;
  get diagnostics n = row_count;
  insert into rls_results(test,outcome) values ('lead deletes admin update', n || ' rows (expect 0)');
  delete from updates where author_id = sam;
  get diagnostics n = row_count;
  insert into rls_results(test,outcome) values ('lead deletes own updates', n || ' rows');
  begin
    arr := public.update_recipient_emails('section', pyb);
    insert into rls_results(test,outcome) values ('lead gets own section emails', array_length(arr,1) || ' emails');
  exception when others then insert into rls_results(test,outcome) values ('lead gets own section emails', 'BLOCKED (BAD): ' || sqlerrm); end;
  begin
    arr := public.update_recipient_emails('section', web);
    insert into rls_results(test,outcome) values ('lead gets other section emails', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('lead gets other section emails', 'blocked: ' || sqlerrm); end;
  begin
    arr := public.update_recipient_emails('everyone');
    insert into rls_results(test,outcome) values ('lead gets everyone emails', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('lead gets everyone emails', 'blocked: ' || sqlerrm); end;

  -- ===== SUPPORT VOLUNTEER of PY-B =====
  perform set_config('request.jwt.claims', json_build_object('sub', pyb_support, 'role', 'authenticated')::text, true);
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, pyb_student, today, 'dismissal', true, pyb_support);
    insert into rls_results(test,outcome) values ('support marks own section', 'ok');
  exception when others then insert into rls_results(test,outcome) values ('support marks own section', 'BLOCKED (BAD): ' || sqlerrm); end;
  begin
    insert into updates(audience, section_id, body) values ('section', pyb, 'support post');
    insert into rls_results(test,outcome) values ('support posts update', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('support posts update', 'blocked: ' || sqlerrm); end;

  -- ===== ADMIN =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select count(*) into n from roll_call_marks;
  insert into rls_results(test,outcome) values ('admin sees all roll calls', n || ' rows');
  arr := public.update_recipient_emails('everyone');
  insert into rls_results(test,outcome) values ('admin everyone emails', array_length(arr,1) || ' emails');
  arr := public.update_recipient_emails('volunteers');
  insert into rls_results(test,outcome) values ('admin volunteer emails', array_length(arr,1) || ' emails');
  insert into updates(audience, body) values ('parents', 'admin test') returning id into new_id;
  insert into rls_results(test,outcome) values ('admin posts to parents', 'ok by ' || (select author_name from updates where id=new_id));
  delete from updates where id=new_id;
  insert into schedule_items(session_id, start_time, title) values ((select id from sessions limit 1), '07:00', 'test') returning id into new_id;
  delete from schedule_items where id=new_id;
  insert into rls_results(test,outcome) values ('admin edits schedule', 'ok');

  -- ===== ANON =====
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from roll_call_marks; insert into rls_results(test,outcome) values ('anon roll calls', n || ' rows');
  select count(*) into n from updates; insert into rls_results(test,outcome) values ('anon updates', n || ' rows');
  select count(*) into n from schedule_items; insert into rls_results(test,outcome) values ('anon schedule', n || ' rows');
  begin
    perform public.section_lead_names();
    insert into rls_results(test,outcome) values ('anon lead names', 'ALLOWED (BAD)');
  exception when others then insert into rls_results(test,outcome) values ('anon lead names', 'blocked: ' || sqlerrm); end;

  execute 'reset role';
  delete from roll_call_marks where day = today and section_id = pyb and marked_by in (sam, pyb_support);
end $$;
select test, outcome from rls_results order by n;

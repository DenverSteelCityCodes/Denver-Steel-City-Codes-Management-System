-- RLS tests for migration_camp_week_ops.sql — run against the demo DB after private.reset_demo().
-- Impersonates each role with SET LOCAL ROLE + request.jwt.claims. The block raises its results at
-- the end, so every test write rolls back. Every line should end in "ok"; any "BAD" is a failure.
-- First run 2026-09-30 (see test-plans/camp-week-gap-audit-2026-09-30.md).
-- The "roster:" checks cover migration_volunteer_roster_access.sql (crew read campers only through
-- section_roster()).
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
  -- Read as the table owner, before any role switch.
  pyb_seated int := (select count(*) from registrations r where r.section_id=pyb and r.status in ('confirmed','pending'));
  web_seated int := (select count(*) from registrations r where r.section_id=web and r.status in ('confirmed','pending'));
  pyb_marks int := (select count(*) from roll_call_marks where section_id=pyb);
  all_marks int := (select count(*) from roll_call_marks);
  all_students int := (select count(*) from students);
  all_schedule int := (select count(*) from schedule_items);
  all_rooms int := (select count(*) from sections where room is not null);
  sam_updates int := (select count(*) from updates where author_id=sam);
  -- Every section the lead crews, and its unseated (cancelled, waitlisted, offered) campers.
  sam_sections uuid[] := array(select s.id from sections s where s.lead_id=sam);
  sam_unseated text[];
  today date := (now() at time zone 'America/Denver')::date;
  res text := ''; n int; arr text[]; new_id uuid; ok boolean; t text;
begin
  -- A cancelled spot in PY-B, so the unseated-roster check has one to leave out after a fresh reset.
  insert into students (parent_id, full_name, first_name, age, grade)
    values (v_parent, 'Roster Cancelled', 'Cancelled', 11, '6th') returning id into new_id;
  insert into registrations (student_id, section_id, status) values (new_id, pyb, 'cancelled');
  all_students := all_students + 1;
  sam_unseated := array(select r.section_id || ':' || r.student_id from registrations r
                        where r.section_id = any(sam_sections) and r.status not in ('confirmed','pending'));

  -- ===== PARENT (Taylor Brooks) =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  select count(*), bool_and(st.parent_id = v_parent) into n, ok from roll_call_marks m join students st on st.id=m.student_id;
  res := res || E'\nparent sees only own campers'' roll calls: ' || case when n > 0 and ok then 'ok' else 'BAD (' || n || ' rows; all own = ' || coalesce(ok::text, 'null') || ')' end;
  select coalesce(string_agg(audience, ',' order by audience), '') into t from updates;
  res := res || E'\nparent sees updates for everyone, parents and WEB-1: ' || case when t = 'everyone,parents,section' then 'ok' else 'BAD (' || t || ')' end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (web, maya, today, 'dismissal', true, v_parent);
    res := res || E'\nparent inserts roll call: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent inserts roll call: blocked ok'; end;
  begin
    insert into updates(audience, body) values ('everyone', 'spam');
    res := res || E'\nparent posts update: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent posts update: blocked ok'; end;
  begin
    perform public.update_recipient_emails('parents');
    res := res || E'\nparent asks for parent emails: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent asks for parent emails: blocked ok'; end;
  begin
    perform public.update_recipient_emails('section', web);
    res := res || E'\nparent asks for section emails: ALLOWED (BAD)';
  exception when others then res := res || E'\nparent asks for section emails: blocked ok'; end;
  select count(*) into n from public.section_lead_names();
  res := res || E'\nparent reads lead first names: ' || case when n > 0 then 'ok' else 'BAD (0 sections)' end;
  select count(*) into n from schedule_items;
  res := res || E'\nparent reads schedule items: ' || case when n = all_schedule and n > 0 then 'ok' else 'BAD (' || n || ' of ' || all_schedule || ')' end;
  select count(*) into n from sections where room is not null;
  res := res || E'\nparent reads section rooms: ' || case when n = all_rooms and n > 0 then 'ok' else 'BAD (' || n || ' of ' || all_rooms || ')' end;
  begin
    perform public.section_roster(web);
    res := res || E'\nroster: parent reads own camper''s section roster: ALLOWED (BAD)';
  exception when others then res := res || E'\nroster: parent reads own camper''s section roster: blocked ok'; end;

  -- ===== VOLUNTEER LEAD (Sam Okafor, leads PY-B w1) =====
  perform set_config('request.jwt.claims', json_build_object('sub', sam, 'role', 'authenticated')::text, true);
  select count(*) into n from roll_call_marks where section_id <> pyb;
  res := res || E'\nlead sees no other sections'' roll calls: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  select count(*) into n from roll_call_marks where section_id = pyb;
  res := res || E'\nlead sees own section roll calls: ' || case when n = pyb_marks and n > 0 then 'ok' else 'BAD (' || n || ' of ' || pyb_marks || ')' end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, pyb_student, today, 'arrival', true, sam) returning id into new_id;
    update roll_call_marks set present = false where id = new_id;
    res := res || E'\nlead marks + edits own section: ' || case when (select present from roll_call_marks where id=new_id) = false then 'ok' else 'BAD (edit lost)' end;
  exception when others then res := res || E'\nlead marks + edits own section: BLOCKED (BAD: ' || sqlerrm || ')'; end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, pyb_student, today, 'after_lunch', true, fiona);
    res := res || E'\nlead marks as someone else: ALLOWED (BAD)';
  exception when others then res := res || E'\nlead marks as someone else: blocked ok'; end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (web, web_student, today, 'after_lunch', true, sam);
    res := res || E'\nlead marks other section: ALLOWED (BAD)';
  exception when others then res := res || E'\nlead marks other section: blocked ok'; end;
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, web_student, today, 'after_lunch', true, sam);
    res := res || E'\nlead marks camper not in section: ALLOWED (BAD)';
  exception when others then res := res || E'\nlead marks camper not in section: blocked ok'; end;
  select coalesce(string_agg(audience, ',' order by audience), '') into t from updates;
  res := res || E'\nlead sees updates for everyone and volunteers (not WEB-1, not parents): ' || case when t = 'everyone,volunteers' then 'ok' else 'BAD (' || t || ')' end;
  begin
    insert into updates(audience, section_id, body) values ('section', pyb, 'Today we made loops!') returning id into new_id;
    select author_name into t from updates where id=new_id;
    res := res || E'\nlead posts to own section, author stamped: ' || case when t = 'Sam Okafor' then 'ok' else 'BAD (' || coalesce(t, 'null') || ')' end;
  exception when others then res := res || E'\nlead posts to own section: BLOCKED (BAD: ' || sqlerrm || ')'; end;
  begin
    insert into updates(audience, section_id, body) values ('section', web, 'hijack');
    res := res || E'\nlead posts to other section: ALLOWED (BAD)';
  exception when others then res := res || E'\nlead posts to other section: blocked ok'; end;
  begin
    insert into updates(audience, body) values ('everyone', 'hijack');
    res := res || E'\nlead posts to everyone: ALLOWED (BAD)';
  exception when others then res := res || E'\nlead posts to everyone: blocked ok'; end;
  begin
    insert into updates(author_id, audience, section_id, body) values (admin_id, 'section', pyb, 'as admin?') returning author_id into new_id;
    res := res || E'\nlead spoofs author_id: ' || case when new_id = sam then 'forced to self ok' else 'ALLOWED (BAD)' end;
  exception when others then res := res || E'\nlead spoofs author_id: blocked ok'; end;
  delete from updates where author_id = admin_id;
  get diagnostics n = row_count;
  res := res || E'\nlead deletes admin update: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  delete from updates where author_id = sam;
  get diagnostics n = row_count;
  res := res || E'\nlead deletes own updates: ' || case when n = sam_updates + 2 then 'ok' else 'BAD (' || n || ', want ' || sam_updates + 2 || ')' end;
  begin
    arr := public.update_recipient_emails('section', pyb);
    res := res || E'\nlead gets own section emails: ' || case when coalesce(array_length(arr,1), 0) > 0 then 'ok' else 'BAD (none)' end;
  exception when others then res := res || E'\nlead gets own section emails: BLOCKED (BAD: ' || sqlerrm || ')'; end;
  begin
    arr := public.update_recipient_emails('section', web);
    res := res || E'\nlead gets other section emails: ALLOWED (BAD)';
  exception when others then res := res || E'\nlead gets other section emails: blocked ok'; end;
  begin
    arr := public.update_recipient_emails('everyone');
    res := res || E'\nlead gets everyone emails: ALLOWED (BAD)';
  exception when others then res := res || E'\nlead gets everyone emails: blocked ok'; end;

  -- Roster access (spec 04): no direct camper reads; section_roster for own section only.
  select count(*) into n from students;
  res := res || E'\nroster: lead selects students directly: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  select count(*) into n from (select ethnic_background, free_reduced_lunch, school_name, email, waiver_signature from students) x;
  res := res || E'\nroster: lead selects sensitive camper columns: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  select count(*) into n from registrations where status not in ('confirmed','pending');
  res := res || E'\nroster: lead sees no unseated registrations: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  begin
    select count(*) into n from public.section_roster(pyb);
    res := res || E'\nroster: lead reads own section roster: ' || case when n = pyb_seated and n > 0 then 'ok' else 'BAD (' || n || ' of ' || pyb_seated || ')' end;
    select count(*) into n from unnest(sam_sections) sid cross join lateral public.section_roster(sid) sr
      where sid || ':' || sr.id = any(sam_unseated);
    res := res || E'\nroster: own rosters leave out unseated campers: '
      || case when n = 0 and cardinality(sam_unseated) > 0 then 'ok' else 'BAD (' || n || ' of ' || cardinality(sam_unseated) || ' shown)' end;
  exception when others then res := res || E'\nroster: lead reads own section roster: BLOCKED (BAD: ' || sqlerrm || ')'; end;
  begin
    perform public.section_roster(web);
    res := res || E'\nroster: lead reads other section roster: ALLOWED (BAD)';
  exception when others then res := res || E'\nroster: lead reads other section roster: blocked ok'; end;

  -- ===== SUPPORT VOLUNTEER of PY-B =====
  perform set_config('request.jwt.claims', json_build_object('sub', pyb_support, 'role', 'authenticated')::text, true);
  begin
    insert into roll_call_marks(section_id, student_id, day, roll_call, present, marked_by) values (pyb, pyb_student, today, 'dismissal', true, pyb_support);
    res := res || E'\nsupport marks own section: ok';
  exception when others then res := res || E'\nsupport marks own section: BLOCKED (BAD: ' || sqlerrm || ')'; end;
  begin
    insert into updates(audience, section_id, body) values ('section', pyb, 'support post');
    res := res || E'\nsupport posts update: ALLOWED (BAD)';
  exception when others then res := res || E'\nsupport posts update: blocked ok'; end;
  select count(*) into n from students;
  res := res || E'\nroster: support selects students directly: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  begin
    select count(*) into n from public.section_roster(pyb);
    res := res || E'\nroster: support reads own section roster: ' || case when n = pyb_seated and n > 0 then 'ok' else 'BAD (' || n || ' of ' || pyb_seated || ')' end;
  exception when others then res := res || E'\nroster: support reads own section roster: BLOCKED (BAD: ' || sqlerrm || ')'; end;

  -- ===== ADMIN =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  -- All the seeded marks plus the lead's and the support volunteer's from above.
  select count(*) into n from roll_call_marks;
  res := res || E'\nadmin sees all roll calls: ' || case when n = all_marks + 2 then 'ok' else 'BAD (' || n || ', want ' || all_marks + 2 || ')' end;
  arr := public.update_recipient_emails('everyone');
  res := res || E'\nadmin gets everyone emails: ' || case when coalesce(array_length(arr,1), 0) > 0 then 'ok' else 'BAD (none)' end;
  arr := public.update_recipient_emails('volunteers');
  res := res || E'\nadmin gets volunteer emails: ' || case when coalesce(array_length(arr,1), 0) > 0 then 'ok' else 'BAD (none)' end;
  insert into updates(audience, body) values ('parents', 'admin test') returning author_name into t;
  res := res || E'\nadmin posts to parents: ' || case when t = 'Jordan Rivera' then 'ok' else 'BAD (' || coalesce(t, 'null') || ')' end;
  begin
    insert into schedule_items(session_id, start_time, title) values ((select id from sessions limit 1), '07:00', 'test') returning id into new_id;
    delete from schedule_items where id=new_id;
    res := res || E'\nadmin edits schedule: ok';
  exception when others then res := res || E'\nadmin edits schedule: BLOCKED (BAD: ' || sqlerrm || ')'; end;
  select count(*) into n from students;
  res := res || E'\nroster: admin selects students directly: ' || case when n = all_students then 'ok' else 'BAD (' || n || ' of ' || all_students || ')' end;
  begin
    select count(*) into n from public.section_roster(web);
    res := res || E'\nroster: admin reads any section roster: ' || case when n = web_seated and n > 0 then 'ok' else 'BAD (' || n || ' of ' || web_seated || ')' end;
  exception when others then res := res || E'\nroster: admin reads any section roster: BLOCKED (BAD: ' || sqlerrm || ')'; end;

  -- ===== ANON =====
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from roll_call_marks;
  res := res || E'\nanon reads no roll calls: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  select count(*) into n from updates;
  res := res || E'\nanon reads no updates: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  select count(*) into n from schedule_items;
  res := res || E'\nanon reads no schedule: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  begin
    perform public.section_lead_names();
    res := res || E'\nanon lead names: ALLOWED (BAD)';
  exception when others then res := res || E'\nanon lead names: blocked ok'; end;
  begin
    perform public.section_roster(pyb);
    res := res || E'\nroster: anon reads a roster: ALLOWED (BAD)';
  exception when others then res := res || E'\nroster: anon reads a roster: blocked ok'; end;
  execute 'reset role';

  -- section_roster returns exactly the roster fields. A new column is a privacy decision: update
  -- this list on purpose when the roster grows.
  t := pg_get_function_result('public.section_roster(uuid)'::regprocedure);
  res := res || E'\nroster: section_roster returns only the roster fields: ' || case when t =
    'TABLE(id uuid, full_name text, age integer, allergies text, medical_conditions text, medical_info text, '
    || 'emergency_contact_name text, emergency_contact_phone text, emergency_contact_relation text, parent_name text, '
    || 'parent_phone text, laptop_loan text, pickup_adults jsonb, may_leave_alone_today boolean, leave_alone_mode text, '
    || 'leave_alone_note text)' then 'ok' else 'BAD (' || t || ')' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

-- Tests for migration_volunteer_onboarding.sql (spec 35, #155). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Every line should end in "ok".
--
-- Fixture: two pending applicants with accounts (A booked, B not), a crew volunteer V who leads a
-- Week 1 section, supports a Week 2 one and holds an upcoming duty, a parent P1 with a camper
-- seated in Week 1 only, and the demo admin.
do $$
declare
  adm uuid := (select id from profiles where role = 'admin' order by (display_name = 'Jordan Rivera') desc, id limit 1);
  app_a uuid; app_b uuid; user_a uuid; user_b uuid;
  v uuid; lead_sec uuid; sup_sec uuid; w1 uuid; w2 uuid; p1 uuid; duty uuid;
  slot1 uuid; slot2 uuid; slot3 uuid; slot_soon uuid; slot_day uuid; bk uuid;
  claims_adm text; claims_a text; claims_b text; claims_v text; claims_p1 text;
  res text := ''; n int; expected int; m text; t timestamptz; j jsonb; ok boolean; url text; path text;
begin
  claims_adm := json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text;

  -- ── Fixture ──
  select id, user_id into app_a, user_a from volunteer_applications
   where status = 'pending' and user_id is not null order by created_at limit 1;
  select id, user_id into app_b, user_b from volunteer_applications
   where status = 'pending' and user_id is not null and id <> app_a order by created_at limit 1;
  delete from interview_bookings where application_id in (app_a, app_b);
  -- Other pending applicants are booked, so "times posted" only reaches A and B.
  update volunteer_applications set created_at = now() - interval '400 days'
   where status = 'pending' and id not in (app_a, app_b);
  claims_a := json_build_object('sub', user_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', user_b, 'role', 'authenticated')::text;

  select id into w1 from sessions where is_active order by start_date limit 1;
  select id into w2 from sessions where is_active and id <> w1 order by start_date limit 1;
  select s.id, s.lead_id into lead_sec, v from sections s where s.session_id = w1 and s.lead_id is not null
   order by s.label limit 1;
  select s.id into sup_sec from sections s where s.session_id = w2 and s.cancelled_at is null
     and s.lead_id is distinct from v order by s.label limit 1;
  delete from section_supports where volunteer_id = v and section_id in (select id from sections where session_id = w2);
  insert into section_supports (section_id, volunteer_id) values (sup_sec, v);
  insert into duty_slots (duty_type_id, session_id, slot_date, capacity)
  select id, w2, (now() at time zone 'America/Denver')::date + 9, 2 from duty_types limit 1 returning id into duty;
  insert into duty_assignments (duty_slot_id, volunteer_id) values (duty, v);
  claims_v := json_build_object('sub', v, 'role', 'authenticated')::text;

  -- A parent with a camper seated in Week 1 and nothing in Week 2.
  select st.parent_id into p1 from registrations r join students st on st.id = r.student_id join sections s on s.id = r.section_id
   where r.status = 'confirmed' and s.session_id = w1
     and not exists (select 1 from registrations r2 join students st2 on st2.id = r2.student_id join sections s2 on s2.id = r2.section_id
                     where st2.parent_id = st.parent_id and s2.session_id = w2 and r2.status in ('confirmed', 'pending'))
   order by st.parent_id limit 1;
  claims_p1 := json_build_object('sub', p1, 'role', 'authenticated')::text;

  -- ── 1. Meeting links ──
  insert into interview_slots (slot_datetime, duration_minutes) values (now() + interval '3 days', 15) returning id into slot1;
  insert into interview_slots (slot_datetime, duration_minutes) values (now() + interval '4 days', 15) returning id into slot2;
  insert into interview_slot_links (slot_id, meeting_url) values (slot1, 'https://meet.example.com/test-a'), (slot2, 'https://meet.example.com/test-b');
  begin
    insert into interview_slot_links (slot_id, meeting_url) values (slot2, 'javascript:alert(1)')
      on conflict (slot_id) do update set meeting_url = excluded.meeting_url;
    res := res || E'\nnon-https link: ALLOWED (BAD)';
  exception when check_violation then
    res := res || E'\nnon-https link: refused ok';
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_a, true);
  perform public.book_my_interview(slot1);
  select meeting_url, denver_time into url, m from public.my_interview();
  res := res || E'\nbooked applicant reads their link: ' || case when url = 'https://meet.example.com/test-a' then 'ok' else 'BAD (' || coalesce(url, 'null') || ')' end;
  res := res || E'\nmy_interview gives the Denver time in words: ' || case when m ~ '^[A-Z][a-z]+day, [A-Z][a-z]+ [0-9]{1,2} at [0-9]{1,2}:[0-9]{2} [AP]M$' then 'ok' else 'BAD (' || coalesce(m, 'null') || ')' end;
  select count(*) into n from interview_slot_links;
  res := res || E'\nbooked applicant reads the links table: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;

  perform set_config('request.jwt.claims', claims_b, true);
  select count(*) into n from public.my_interview();
  res := res || E'\nanother applicant gets no interview or link: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from interview_slot_links;
  res := res || E'\nanother applicant reads the links table: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
  perform set_config('request.jwt.claims', claims_p1, true);
  select count(*) into n from interview_slot_links;
  res := res || E'\nparent reads the links table: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  perform set_config('request.jwt.claims', claims_v, true);
  select count(*) into n from interview_slot_links;
  res := res || E'\nvolunteer reads the links table: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  perform set_config('request.jwt.claims', claims_adm, true);
  select count(*) into n from interview_slot_links where slot_id in (slot1, slot2);
  res := res || E'\nadmin reads every link: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;

  -- ── 2. Interview emails ──
  select count(*) into n from notifications where template = 'interview_booked' and payload ->> 'application_id' = app_a::text;
  res := res || E'\nbooking sends one interview_booked: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select payload into j from notifications where template = 'interview_booked' and payload ->> 'application_id' = app_a::text;
  res := res || E'\nthe booking email carries the time and the link: ' || case when j ->> 'meeting_url' = 'https://meet.example.com/test-a' and j ? 'slot_datetime' and j ->> 'first_name' is not null then 'ok' else 'BAD (' || j::text || ')' end;
  perform set_config('request.jwt.claims', claims_a, true);
  perform public.book_my_interview(slot2);
  perform set_config('request.jwt.claims', claims_adm, true);   -- only admins read the outbox
  select count(*) into n from notifications where template = 'interview_booked' and payload ->> 'application_id' = app_a::text and (payload ->> 'moved')::boolean;
  res := res || E'\nmoving sends one more (moved): ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- Times posted: two slots in one insert and one more later the same day → one email to B.
  perform set_config('request.jwt.claims', claims_adm, true);
  insert into interview_slots (slot_datetime, duration_minutes) values (now() + interval '5 days', 15), (now() + interval '5 days 30 minutes', 15);
  insert into interview_slots (slot_datetime, duration_minutes) values (now() + interval '6 days', 15) returning id into slot3;
  select count(*) into n from notifications where template = 'interview_times_posted' and payload ->> 'application_id' = app_b::text;
  res := res || E'\ntimes posted: one email to the unbooked applicant: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'interview_times_posted' and payload ->> 'application_id' = app_a::text;
  res := res || E'\ntimes posted: none to the booked applicant: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'interview_times_posted' and (payload ->> 'application_id')::uuid not in (app_a, app_b);
  res := res || E'\ntimes posted: none to last season''s pending applicants: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  -- Nudge: once a day, admins only, not for a booked applicant.
  t := public.admin_nudge_applicant(app_b);
  perform public.admin_nudge_applicant(app_b);
  select count(*) into n from notifications where template = 'interview_nudge' and payload ->> 'application_id' = app_b::text;
  res := res || E'\nnudge twice in a day: one email: ' || case when n = 1 and t is not null then 'ok' else 'BAD (' || n || ')' end;
  begin
    perform public.admin_nudge_applicant(app_a);
    res := res || E'\nnudge a booked applicant: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nnudge a booked applicant: refused ok';
  end;
  perform set_config('request.jwt.claims', claims_v, true);
  begin
    perform public.admin_nudge_applicant(app_b);
    res := res || E'\nvolunteer nudges: ALLOWED (BAD)';
  exception when insufficient_privilege then
    res := res || E'\nvolunteer nudges: refused ok';
  end;
  execute 'reset role';

  -- Reminders: a booking made days ago for a slot 23 hours away (24h kind), one for a slot 50
  -- minutes away (1h kind), and one booked 10 minutes ago for a slot 20 hours away (none).
  perform set_config('request.jwt.claims', '', true);
  select id into bk from interview_bookings where application_id = app_a;
  update interview_slots set slot_datetime = now() + interval '23 hours' where id = slot2;
  update interview_bookings set booked_at = now() - interval '3 days' where id = bk;
  perform private.send_interview_reminders();
  perform private.send_interview_reminders();
  select count(*) into n from notifications where template = 'interview_reminder' and payload ->> 'application_id' = app_a::text and payload ->> 'kind' = '24h';
  res := res || E'\n24-hour reminder, cron run twice: one email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  update interview_slots set slot_datetime = now() + interval '50 minutes' where id = slot2;
  perform private.send_interview_reminders();
  select count(*) into n from notifications where template = 'interview_reminder' and payload ->> 'application_id' = app_a::text and payload ->> 'kind' = '1h';
  res := res || E'\n1-hour reminder: one email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  insert into interview_slots (slot_datetime, duration_minutes) values (now() + interval '20 hours', 15) returning id into slot_day;
  insert into interview_bookings (slot_id, application_id, booked_at) values (slot_day, app_b, now() - interval '10 minutes');
  perform private.send_interview_reminders();
  select count(*) into n from notifications where template = 'interview_reminder' and payload ->> 'application_id' = app_b::text;
  res := res || E'\nbooked 10 minutes ago: no 24-hour reminder: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'interview_booked' and payload ->> 'application_id' = app_b::text;
  res := res || E'\nSQL-editor booking sends no email: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from cron.job where jobname = 'interview-reminders' and schedule = '*/5 * * * *';
  res := res || E'\nreminder job scheduled: ' || case when n = 1 then 'ok' else 'BAD' end;

  -- ── 3. Decisions ──
  delete from interview_bookings where application_id = app_b;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  update volunteer_applications set status = 'rejected' where id = app_b;
  select count(*) into n from notifications where template = 'application_declined' and payload ->> 'application_id' = app_b::text;
  res := res || E'\ndecline: one email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  update volunteer_applications set admin_notes = 'note only' where id = app_b;
  select count(*) into n from notifications where template like 'application_%' and payload ->> 'application_id' = app_b::text;
  res := res || E'\nan edit that isn''t a decision: no email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  update profiles set role = 'volunteer' where id = user_a;
  insert into volunteers (id, experience_level, availability_week_1, availability_week_2, accepted_at)
  values (user_a, 'junior', true, true, now() - interval '9 days')
  on conflict (id) do update set accepted_at = now() - interval '9 days';
  update volunteer_applications set status = 'accepted' where id = app_a;
  select count(*), min(jsonb_array_length(payload -> 'tasks')) into n, m from notifications
   where template = 'application_accepted' and payload ->> 'application_id' = app_a::text;
  res := res || E'\naccept: one email listing the checklist: ' || case when n = 1 and m::int = (select count(*) from onboarding_tasks) then 'ok' else 'BAD (' || n || ', ' || coalesce(m, 'null') || ')' end;
  select accepted_at into t from volunteers where id = user_a;
  res := res || E'\naccept starts the checklist clock: ' || case when t > now() - interval '1 minute' then 'ok' else 'BAD' end;

  -- ── 4. Onboarding checklist ──
  perform set_config('request.jwt.claims', claims_a, true);
  select count(*) into n from public.my_onboarding() where done_at is null and due_at > now();
  res := res || E'\nnew volunteer: every item open and due later: ' || case when n = (select count(*) from onboarding_tasks) then 'ok' else 'BAD (' || n || ')' end;
  perform public.set_my_onboarding_task('discord', true);
  select count(*) into n from public.my_onboarding() where done_at is not null;
  res := res || E'\nvolunteer ticks an item: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  begin
    insert into volunteer_tasks (volunteer_id, task_key, verified_by) values (user_a, 'remind', user_a);
    res := res || E'\nvolunteer writes the table directly: ALLOWED (BAD)';
  exception when insufficient_privilege then
    res := res || E'\nvolunteer writes the table directly: blocked ok';
  end;
  perform set_config('request.jwt.claims', claims_adm, true);
  update volunteers set accepted_at = now() - interval '3 days' where id = user_a;
  update onboarding_tasks set created_at = now() - interval '30 days';
  select count(*) into n from public.admin_onboarding_overdue() where volunteer_id = user_a;
  res := res || E'\noverdue: every unticked item, three days on: ' || case when n = (select count(*) from onboarding_tasks) - 1 then 'ok' else 'BAD (' || n || ')' end;
  insert into onboarding_tasks (key, label, due_hours_after_accept) values ('test-new', '[TEST] Added today', 24);
  select count(*) into n from public.admin_onboarding_overdue() where task_key = 'test-new';
  res := res || E'\nan item added today isn''t overdue for anyone yet: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', claims_p1, true);
  select count(*) into n from public.admin_onboarding_overdue();
  res := res || E'\nparent reads the overdue list: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  select count(*) into n from volunteer_tasks;
  res := res || E'\nparent reads volunteer_tasks: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;

  -- ── 5. Profile and photo consent ──
  perform set_config('request.jwt.claims', claims_v, true);
  begin
    perform public.update_my_volunteer_profile('Legal Name', 'Sam', 'SAM', 'Hi', user_a::text || '/x.jpg', true, null);
    res := res || E'\nphoto in someone else''s folder: ALLOWED (BAD)';
  exception when insufficient_privilege then
    res := res || E'\nphoto in someone else''s folder: refused ok';
  end;
  begin
    perform public.update_my_volunteer_profile('Legal Name', 'Sam', null, repeat('x', 301), null, false, null);
    res := res || E'\n301-character bio: ALLOWED (BAD)';
  exception when others then
    res := res || E'\n301-character bio: refused ok';
  end;
  execute 'reset role';
  update volunteer_applications set age = 16 where user_id = v;
  execute 'set local role authenticated';
  path := v::text || '/test.jpg';
  perform public.update_my_volunteer_profile('Test Legal', 'Testy', 'TEST-ee', 'Loves Python.', path, true, null);
  select photo_visible, needs_guardian into ok, m from public.my_volunteer_profile();
  res := res || E'\nunder 18, own consent only: photo hidden: ' || case when not ok and m::boolean then 'ok' else 'BAD' end;
  perform public.update_my_volunteer_profile('Test Legal', 'Testy', 'TEST-ee', 'Loves Python.', path, true, 'Pat Guardian');
  select photo_visible into ok from public.my_volunteer_profile();
  res := res || E'\nunder 18 with a guardian''s consent: photo shown: ' || case when ok then 'ok' else 'BAD' end;

  -- ── 6. Meet the teachers ──
  perform set_config('request.jwt.claims', claims_p1, true);
  select count(*) into n from public.meet_the_crew() where session_id = w2;
  res := res || E'\nparent sees no crew for a week without their camper: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from public.meet_the_crew() where session_id = w1;
  res := res || E'\nparent sees their camper''s week''s crew: ' || case when n > 0 then 'ok' else 'BAD' end;
  select name, photo_path into m, url from public.meet_the_crew() where volunteer_id = v and section_id = lead_sec;
  res := res || E'\ncrew shows the preferred name and the consented photo: ' || case when m = 'Testy' and url = path then 'ok' else 'BAD (' || coalesce(m, 'null') || ', ' || coalesce(url, 'null') || ')' end;
  res := res || E'\nparent may read that photo file: ' || case when private.crew_photo_visible(path) then 'ok' else 'BAD' end;
  -- The storage policies themselves, on storage.objects (what the Storage API checks).
  perform set_config('request.jwt.claims', claims_v, true);
  insert into storage.objects (bucket_id, name, owner_id) values ('volunteer-photos', path, v::text);
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('volunteer-photos', user_a::text || '/sneaky.jpg', v::text);
    res := res || E'\nvolunteer uploads into someone else''s folder: ALLOWED (BAD)';
  exception when insufficient_privilege then
    res := res || E'\nvolunteer uploads into someone else''s folder: blocked ok';
  end;
  perform set_config('request.jwt.claims', claims_p1, true);
  select count(*) into n from storage.objects where bucket_id = 'volunteer-photos' and name = path;
  res := res || E'\nparent in that week reads the photo object: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', claims_b, true);
  select count(*) into n from storage.objects where bucket_id = 'volunteer-photos' and name = path;
  res := res || E'\nsomeone with no camper that week reads it: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  perform set_config('request.jwt.claims', claims_p1, true);
  select count(*) into n from public.meet_the_crew() where photo_path is not null and not private.volunteer_photo_ok(volunteer_id);
  res := res || E'\nno unconsented photo reaches a parent: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', claims_adm, true);
  select lead_first_name into m from public.section_lead_names() where section_id = lead_sec;
  res := res || E'\nlead names use the preferred name: ' || case when m = 'Testy' then 'ok' else 'BAD (' || coalesce(m, 'null') || ')' end;
  perform set_config('request.jwt.claims', claims_v, true);
  perform public.update_my_volunteer_profile('Test Legal', 'Testy', null, null, path, false, null);
  perform set_config('request.jwt.claims', claims_p1, true);
  select photo_path into url from public.meet_the_crew() where volunteer_id = v and section_id = lead_sec;
  res := res || E'\nconsent withdrawn: photo gone: ' || case when url is null and not private.crew_photo_visible(path) then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', claims_b, true);
  select count(*) into n from public.meet_the_crew();
  res := res || E'\nsomeone with no seated camper sees no crew: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  -- ── 7. Remove from the season ──
  perform set_config('request.jwt.claims', claims_v, true);
  begin
    perform public.remove_from_season(v, 'test');
    res := res || E'\nvolunteer removes someone: ALLOWED (BAD)';
  exception when insufficient_privilege then
    res := res || E'\nvolunteer removes someone: refused ok';
  end;
  perform set_config('request.jwt.claims', claims_adm, true);
  begin
    perform public.remove_from_season(v, '  ');
    res := res || E'\nremove with no reason: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nremove with no reason: refused ok';
  end;
  expected := (select count(*) from sections where lead_id = v) + (select count(*) from section_supports where volunteer_id = v);
  n := public.remove_from_season(v, '[TEST] Missed onboarding');
  res := res || E'\nremove frees the lead and support spots: ' || case when n = expected and n >= 2 and (select lead_id from sections where id = lead_sec) is null
    and not exists (select 1 from section_supports where volunteer_id = v and section_id = sup_sec) then 'ok' else 'BAD (' || n || ')' end;
  res := res || E'\nremove drops upcoming duty claims: ' || case when not exists (select 1 from duty_assignments where duty_slot_id = duty and volunteer_id = v) then 'ok' else 'BAD' end;
  res := res || E'\nremove marks them removed with the reason: ' || case when exists (select 1 from volunteers where id = v and removed_at is not null and removed_reason = '[TEST] Missed onboarding' and removed_by = adm) then 'ok' else 'BAD' end;
  select count(*) into n from notifications where template = 'volunteer_removed' and recipient_profile = v;
  res := res || E'\nremove emails them once: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  execute 'reset role';
  select count(*) into n from audit.log where reason = 'Removed from the season: [TEST] Missed onboarding'
     and ((table_name = 'sections' and row_id = lead_sec::text) or table_name in ('section_supports', 'volunteers', 'duty_assignments'));
  res := res || E'\nremoval is in History with its reason: ' || case when n >= 4 then 'ok' else 'BAD (' || n || ')' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_v, true);
  res := res || E'\nremoved volunteer loses volunteer access: ' || case when not private.auth_is_volunteer() then 'ok' else 'BAD' end;
  begin
    insert into duty_assignments (duty_slot_id, volunteer_id) values (duty, v);
    res := res || E'\nremoved volunteer claims a duty: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nremoved volunteer claims a duty: blocked ok';
  end;
  perform set_config('request.jwt.claims', claims_adm, true);
  begin
    insert into section_supports (section_id, volunteer_id) values (sup_sec, v);
    res := res || E'\nadmin puts a removed volunteer on a crew: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nadmin puts a removed volunteer on a crew: refused ok';
  end;
  begin
    perform public.remove_from_season(v, 'again');
    res := res || E'\nremove twice: ALLOWED (BAD)';
  exception when others then
    res := res || E'\nremove twice: refused ok';
  end;
  -- Accepting again restores them.
  update volunteer_applications set status = 'pending' where user_id = v;
  update volunteer_applications set status = 'accepted' where user_id = v;
  res := res || E'\naccepting again clears the removal: ' || case when exists (select 1 from volunteers where id = v and removed_at is null) then 'ok' else 'BAD' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

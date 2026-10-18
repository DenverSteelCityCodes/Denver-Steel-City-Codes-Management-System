-- Tests for migration_urgent_and_incidents.sql (spec 34, #154): week audiences, urgent notices and
-- the sender's order, the incident log's RLS and parent notice, and roll-call notes. Run against
-- the demo DB after private.reset_demo(). The block raises its results at the end, so every test
-- write rolls back (including the queued emails). Every line should say ok.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  w1 uuid; w2 uuid; yr int;
  sec_a uuid; sec_b uuid;            -- sec_a: a week-2 section and its lead; sec_b: a section they don't crew
  lead_a uuid; w1_vol uuid;          -- w1_vol: crew in week 1 only
  camper_a uuid; camper_b uuid;      -- a camper in sec_a, a camper in sec_b
  fam_w2 uuid; fam_w1 uuid;          -- a week-2-only family, a week-1-only family
  upd uuid; inc uuid; inc2 uuid; inc_none uuid;
  res text := ''; n int; arr text[]; ok boolean; t timestamptz; who uuid;
  today date := (now() at time zone 'America/Denver')::date;
  claim_ids bigint[];
  n_a bigint; n_b bigint; n_c bigint;
  lead_email text; w1_email text; who_n int; upd2 uuid;
  camper_c uuid; inc3 uuid; inc4 uuid; sec_both uuid; cls uuid; t2 timestamptz;
begin
  yr := coalesce((select max(year) from sessions where is_active), extract(year from now())::int);
  select id into w1 from sessions where year = yr order by start_date limit 1;
  select id into w2 from sessions where year = yr order by start_date offset 1 limit 1;

  -- A week-2 section with campers, and its lead.
  select s.id, s.lead_id into sec_a, lead_a from sections s
   where s.session_id = w2 and s.cancelled_at is null and s.lead_id is not null
     and exists (select 1 from registrations r where r.section_id = s.id and r.status = 'confirmed')
   order by s.label limit 1;
  select s.id into sec_b from sections s
   where s.id <> sec_a and s.cancelled_at is null and coalesce(s.lead_id, '00000000-0000-0000-0000-000000000000') <> lead_a
     and not exists (select 1 from section_supports ss where ss.section_id = s.id and ss.volunteer_id = lead_a)
     and exists (select 1 from registrations r where r.section_id = s.id and r.status = 'confirmed')
   order by s.label limit 1;
  select s.lead_id into w1_vol from sections s join profiles p on p.id = s.lead_id and p.role = 'volunteer'
   where s.session_id = w1 and s.lead_id is not null
     and not exists (select 1 from sections x where x.session_id = w2 and x.lead_id = s.lead_id)
     and not exists (select 1 from section_supports ss join sections x on x.id = ss.section_id
                     where x.session_id = w2 and ss.volunteer_id = s.lead_id)
   limit 1;
  select r.student_id into camper_a from registrations r where r.section_id = sec_a and r.status = 'confirmed' limit 1;
  select r.student_id into camper_b from registrations r where r.section_id = sec_b and r.status = 'confirmed' limit 1;
  -- A second camper in sec_a from another family (for the "no address" notice).
  select r.student_id into camper_c from registrations r join students st on st.id = r.student_id
   where r.section_id = sec_a and r.status = 'confirmed'
     and st.parent_id <> (select parent_id from students where id = camper_a) limit 1;
  -- Families: only in week 2, only in week 1.
  select st.parent_id into fam_w2 from students st join registrations r on r.student_id = st.id
    join sections s on s.id = r.section_id
   where r.status = 'confirmed' group by st.parent_id
  having bool_and(s.session_id = w2) order by st.parent_id limit 1;
  select st.parent_id into fam_w1 from students st join registrations r on r.student_id = st.id
    join sections s on s.id = r.section_id
   where r.status = 'confirmed' group by st.parent_id
  having bool_and(s.session_id = w1) order by st.parent_id limit 1;
  if sec_a is null or sec_b is null or w1_vol is null or camper_a is null or fam_w2 is null or fam_w1 is null then
    raise exception 'fixture missing: sec_a % sec_b % w1_vol % camper_a % fam_w2 % fam_w1 %', sec_a, sec_b, w1_vol, camper_a, fam_w2, fam_w1;
  end if;

  -- Deliverable test addresses (the seed uses example.com, which the outbox skips). Two families
  -- share one address to check "one email per address".
  insert into parent_profiles (id, email) values (fam_w2, 'week2-family@scc-test.invalid')
    on conflict (id) do update set email = excluded.email;
  insert into parent_profiles (id, email) values (fam_w1, 'week1-family@scc-test.invalid')
    on conflict (id) do update set email = excluded.email;
  select st.parent_id into who from students st join registrations r on r.student_id = st.id
    join sections s on s.id = r.section_id
   where r.status = 'confirmed' and s.session_id = w2 and st.parent_id <> fam_w2 limit 1;
  insert into parent_profiles (id, email) values (who, 'week2-family@scc-test.invalid')
    on conflict (id) do update set email = excluded.email;

  select lower(email) into lead_email from auth.users where id = lead_a;
  select lower(email) into w1_email from auth.users where id = w1_vol;

  -- ── Sender order: priority first, then oldest ──
  update notifications set next_attempt_at = now() + interval '1 day' where status in ('queued', 'failed');
  insert into notifications (recipient_email, template, priority, created_at) values ('a@scc-test.invalid', 'registration_confirmed', 0, now() - interval '10 minutes') returning id into n_a;
  insert into notifications (recipient_email, template, priority, created_at) values ('b@scc-test.invalid', 'urgent_notice', 1, now()) returning id into n_b;
  insert into notifications (recipient_email, template, priority, created_at) values ('c@scc-test.invalid', 'registration_confirmed', 0, now() - interval '20 minutes') returning id into n_c;
  select array_agg(id) into claim_ids from public.claim_urgent_notifications(50);
  res := res || E'\nurgent claim takes only urgent rows: ' || case when claim_ids = array[n_b] then 'ok' else 'BAD ' || coalesce(claim_ids::text, 'none') end;
  update notifications set status = 'queued', attempts = 0 where id = n_b;
  select array_agg(id) into claim_ids from public.claim_notifications(1);
  res := res || E'\nordinary claim: urgent first: ' || case when claim_ids = array[n_b] then 'ok' else 'BAD ' || coalesce(claim_ids::text, 'none') end;
  select array_agg(id) into claim_ids from public.claim_notifications(1);
  res := res || E'\nordinary claim: then the oldest: ' || case when claim_ids = array[n_c] then 'ok' else 'BAD ' || coalesce(claim_ids::text, 'none') end;
  select count(*) into n from notifications where id in (n_b, n_c) and status = 'sending' and next_attempt_at > now() - interval '1 second';
  res := res || E'\nclaims stamp the claim time (stuck-row requeue counts from it): ' || case when n = 2 then 'ok' else 'BAD' end;
  perform private.requeue_stuck_notifications();
  select count(*) into n from notifications where id in (n_b, n_c) and status = 'sending';
  res := res || E'\na just-claimed row isn''t requeued as stuck: ' || case when n = 2 then 'ok' else 'BAD' end;
  perform public.requeue_notifications(array[n_c], 60);
  select count(*) into n from notifications where id = n_c and status = 'queued' and attempts = 0 and next_attempt_at > now() + interval '50 seconds';
  res := res || E'\nrequeue (429 or out of time) gives the attempt back: ' || case when n = 1 then 'ok' else 'BAD' end;
  select array_agg(id) into claim_ids from public.claim_notifications(1);
  res := res || E'\nordinary claim: then the next oldest: ' || case when claim_ids = array[n_a] then 'ok' else 'BAD ' || coalesce(claim_ids::text, 'none') end;

  execute 'set local role authenticated';

  -- A both-weeks section (no week) led by week-1-only crew, with a seat only in last year: its
  -- crew is not "Crew in Week 2" until a camper holds a seat in it this year.
  execute 'reset role';
  select class_id into cls from sections where id = sec_a;
  insert into sections (class_id, label, age_min, age_max, capacity, week, lead_id)
  values (cls, '[TEST] BOTH', 8, 14, 10, null, w1_vol) returning id into sec_both;
  insert into registrations (student_id, section_id, status) values (camper_b, sec_both, 'confirmed');
  update registrations set year = yr - 1 where section_id = sec_both;
  execute 'set local role authenticated';

  -- ── Admin: week audiences, an urgent notice ──
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  arr := public.week_recipient_emails('week_families', w2);
  res := res || E'\nweek 2 families list has a week-2 family: ' || case when 'week2-family@scc-test.invalid' = any(arr) then 'ok' else 'BAD (missing)' end;
  res := res || E'\nweek 2 families list leaves out a week-1 family: ' || case when 'week1-family@scc-test.invalid' = any(arr) then 'BAD (listed)' else 'ok' end;
  arr := public.week_recipient_emails('week_crew', w2);
  res := res || E'\nweek 2 crew list has the week-2 lead: ' || case when lead_email = any(arr) then 'ok' else 'BAD (missing)' end;
  res := res || E'\nweek 2 crew list leaves out crew of a past-season both-weeks section: ' || case when w1_email = any(arr) then 'BAD (listed)' else 'ok' end;
  execute 'reset role';
  update registrations set year = yr where section_id = sec_both;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  arr := public.week_recipient_emails('week_crew', w2);
  res := res || E'\nweek 2 crew list has a both-weeks section''s crew once it has a seat this year: ' || case when w1_email = any(arr) then 'ok' else 'BAD (missing)' end;
  execute 'reset role';
  delete from registrations where section_id = sec_both;
  delete from sections where id = sec_both;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  insert into updates (author_id, audience, session_id, body, urgent)
  values (admin_id, 'week_families', w2, '[TEST] Site hold: stay in rooms', true) returning id into upd;
  execute 'reset role';

  -- One urgent_notice per week-2 family, none for week 1, all at priority 1, shared address once.
  select count(*) into n from notifications where template = 'urgent_notice' and payload ->> 'update_id' = upd::text;
  select count(distinct st.parent_id) into who_n from registrations r join students st on st.id = r.student_id
   where r.status in ('confirmed', 'pending') and r.year = yr and r.section_id in (select private.week_section_ids(w2));
  res := res || E'\nurgent: one row per week-2 family: ' || case when n = who_n and n > 0 then 'ok (' || n || ')' else 'BAD (' || n || ' rows, ' || who_n || ' families)' end;
  select count(*) into n from notifications where template = 'urgent_notice' and payload ->> 'update_id' = upd::text and recipient_profile = fam_w1;
  res := res || E'\nurgent: no email to a week-1 family: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from notifications where template = 'urgent_notice' and payload ->> 'update_id' = upd::text and priority <> 1;
  res := res || E'\nurgent: every row at priority 1: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'urgent_notice' and payload ->> 'update_id' = upd::text
     and recipient_email = 'week2-family@scc-test.invalid' and status = 'queued';
  res := res || E'\nurgent: a shared address gets one email: ' || case when n = 1 then 'ok' else 'BAD (' || n || ' queued)' end;
  update parent_profiles set email_opt_out = true where id = fam_w2;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  insert into updates (author_id, audience, session_id, body, urgent)
  values (admin_id, 'week_families', w2, '[TEST] Early dismissal', true) returning id into upd2;
  execute 'reset role';
  select count(*) into n from notifications where template = 'urgent_notice' and payload ->> 'update_id' = upd2::text and recipient_profile = fam_w2;
  res := res || E'\nurgent: reaches a family that opted out of announcements: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Readers of week audiences ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', fam_w2, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where id = upd;
  res := res || E'\nweek-2 family reads the week-2 notice: ' || case when n = 1 then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', json_build_object('sub', fam_w1, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where id = upd;
  res := res || E'\nweek-1 family reads the week-2 notice: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  perform set_config('request.jwt.claims', json_build_object('sub', lead_a, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where id = upd;
  res := res || E'\nweek-2 crew read what week-2 families were told: ' || case when n = 1 then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', json_build_object('sub', w1_vol, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where id = upd;
  res := res || E'\nweek-1-only crew read the week-2 families notice: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  begin
    perform public.week_recipient_emails('week_families', w2);
    res := res || E'\nvolunteer gets week addresses: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nvolunteer gets week addresses: blocked ok';
  end;

  -- ── A lead posts to their own section, but not an urgent notice ──
  perform set_config('request.jwt.claims', json_build_object('sub', lead_a, 'role', 'authenticated')::text, true);
  begin
    insert into updates (author_id, audience, section_id, body, urgent) values (lead_a, 'section', sec_a, '[TEST] urgent from a lead', true);
    res := res || E'\nlead posts an urgent notice: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nlead posts an urgent notice: blocked ok';
  end;
  insert into updates (author_id, audience, section_id, body) values (lead_a, 'section', sec_a, '[TEST] ordinary post');
  res := res || E'\nlead posts an ordinary update to their section: ok';

  -- ── Incidents: crew of the section only, own entries only ──
  perform set_config('request.jwt.claims', json_build_object('sub', lead_a, 'role', 'authenticated')::text, true);
  insert into incidents (section_id, student_id, kind, level, description, reported_by)
  values (sec_a, camper_a, 'injury', 'note', '[TEST] scraped knee at recess', lead_a) returning id into inc;
  res := res || E'\ncrew log an incident for their own section: ok';
  insert into incidents (section_id, kind, description, reported_by)
  values (sec_a, 'conduct', '[TEST] no camper named', lead_a) returning id into inc_none;
  begin
    insert into incidents (section_id, student_id, kind, description, reported_by)
    values (sec_b, camper_b, 'behavior', '[TEST] other section', lead_a);
    res := res || E'\ncrew log for another section: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\ncrew log for another section: blocked ok';
  end;
  begin
    insert into incidents (section_id, student_id, kind, description, reported_by)
    values (sec_a, camper_b, 'behavior', '[TEST] camper from elsewhere', lead_a);
    res := res || E'\ncrew log about a camper not in their section: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\ncrew log about a camper not in their section: blocked ok';
  end;
  begin
    insert into incidents (section_id, student_id, kind, description, reported_by)
    values (sec_a, camper_a, 'injury', '[TEST] in someone else''s name', w1_vol);
    res := res || E'\ncrew log in someone else''s name: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\ncrew log in someone else''s name: blocked ok';
  end;
  insert into incidents (section_id, student_id, kind, description, reported_by, parent_notified_at, created_at)
  values (sec_a, camper_a, 'injury', '[TEST] pre-stamped and back-dated', lead_a, now(), '2020-01-01') returning id into inc4;
  execute 'reset role';
  select count(*) into n from incidents where id = inc4 and parent_notified_at is null and created_at = now();
  res := res || E'\ncrew can''t set created_at or the parent notice (server-owned): ' || case when n = 1 then 'ok' else 'BAD' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', lead_a, 'role', 'authenticated')::text, true);
  -- Another crew member's entry in the same section (written as the table owner).
  execute 'reset role';
  insert into incidents (section_id, student_id, kind, description, reported_by)
  values (sec_a, camper_a, 'behavior', '[TEST] by someone else', admin_id) returning id into inc2;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', lead_a, 'role', 'authenticated')::text, true);
  select count(*) into n from incidents where id in (inc, inc_none, inc4);
  res := res || E'\ncrew read their own entries: ' || case when n = 3 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from incidents where id = inc2;
  res := res || E'\ncrew read someone else''s entry: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  update incidents set level = 'written_notice' where id = inc;
  get diagnostics n = row_count;
  res := res || E'\ncrew change an entry: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  begin
    perform public.notify_incident_parent(inc, 'x');
    res := res || E'\ncrew notify the parent: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\ncrew notify the parent: blocked ok';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', fam_w2, 'role', 'authenticated')::text, true);
  select count(*) into n from incidents where id in (inc, inc2, inc_none);
  res := res || E'\na parent reads incidents: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;

  -- ── Admin: reads all, updates, tells the parent once ──
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from incidents where id in (inc, inc2, inc_none, inc4);
  res := res || E'\nadmin read every entry: ' || case when n = 4 then 'ok' else 'BAD (' || n || ')' end;
  update incidents set level = 'warning' where id = inc;
  get diagnostics n = row_count;
  res := res || E'\nadmin change an entry: ' || case when n = 1 then 'ok' else 'BAD' end;
  select created_at into t2 from incidents where id = inc;
  update incidents set parent_notified_at = now(), created_at = '2020-01-01', reported_by = admin_id where id = inc;
  select count(*) into n from incidents where id = inc and parent_notified_at is null and created_at = t2 and reported_by = lead_a;
  res := res || E'\nadmin can''t stamp the notice, back-date or re-attribute by hand: ' || case when n = 1 then 'ok' else 'BAD' end;
  -- No deliverable address (the demo's example.com): not sent, not stamped, said plainly.
  execute 'reset role';
  insert into parent_profiles (id, email) values ((select parent_id from students where id = camper_c), 'family@example.com')
    on conflict (id) do update set email = excluded.email;
  insert into incidents (section_id, student_id, kind, description, reported_by)
  values (sec_a, camper_c, 'injury', '[TEST] no address', admin_id) returning id into inc3;
  insert into parent_profiles (id, email) values ((select parent_id from students where id = camper_a), 'camper-a-family@scc-test.invalid')
    on conflict (id) do update set email = excluded.email;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.notify_incident_parent(inc3, 'x');
    res := res || E'\nnotify with no deliverable address: ALLOWED (BAD)';
  exception when raise_exception then
    res := res || E'\nnotify with no deliverable address: refused ok (' || sqlerrm || ')';
  end;
  execute 'reset role';
  select count(*) into n from incidents where id = inc3 and parent_notified_at is null;
  select count(*) into who_n from notifications where dedupe_key = 'incident:' || inc3;
  res := res || E'\n  ...not stamped and nothing left queued: ' || case when n = 1 and who_n = 0 then 'ok' else 'BAD' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  t := public.notify_incident_parent(inc, '[TEST] She is fine; we cleaned it up.');
  execute 'reset role';
  select count(*) into n from incidents where id = inc and parent_notified_at is not null;
  res := res || E'\nnotify stamps parent_notified_at: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from notifications where template = 'incident_notice' and dedupe_key = 'incident:' || inc and status = 'queued'
     and recipient_profile = (select parent_id from students where id = camper_a) and payload ->> 'message' like '[TEST]%';
  res := res || E'\nnotify queues incident_notice to the camper''s parent: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from audit.log where table_name = 'incidents' and row_id = inc::text;
  res := res || E'\nincidents are audited: ' || case when n >= 3 then 'ok (' || n || ')' else 'BAD (' || n || ')' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.notify_incident_parent(inc, null);
    res := res || E'\nnotify twice: ALLOWED (BAD)';
  exception when raise_exception then res := res || E'\nnotify twice: refused ok';
  end;
  begin
    perform public.notify_incident_parent(inc_none, null);
    res := res || E'\nnotify with no camper: ALLOWED (BAD)';
  exception when raise_exception then res := res || E'\nnotify with no camper: refused ok';
  end;

  -- ── Roll-call notes ──
  execute 'reset role';
  insert into roll_call_marks (section_id, student_id, day, roll_call, present, marked_by)
  values (sec_a, camper_a, today, 'arrival', true, admin_id)
  on conflict (section_id, student_id, day, roll_call) do update set present = true, marked_by = admin_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', lead_a, 'role', 'authenticated')::text, true);
  perform public.set_roll_call_note(sec_a, camper_a, today, 'arrival', 'Late');
  execute 'reset role';
  select count(*) into n from roll_call_marks where section_id = sec_a and student_id = camper_a and day = today
     and roll_call = 'arrival' and note = 'Late' and marked_by = admin_id;
  res := res || E'\ncrew tag a mark Late (who marked it stays): ' || case when n = 1 then 'ok' else 'BAD' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', lead_a, 'role', 'authenticated')::text, true);
  begin
    perform public.set_roll_call_note(sec_b, camper_b, today, 'arrival', 'Late');
    res := res || E'\ncrew tag another section''s mark: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\ncrew tag another section''s mark: blocked ok';
  end;
  begin
    perform public.set_roll_call_note(sec_a, camper_a, today, 'dismissal', 'Left early');
    res := res || E'\ntag a camper not yet marked: ALLOWED (BAD)';
  exception when raise_exception then res := res || E'\ntag a camper not yet marked: refused ok';
  end;
  begin
    perform public.set_roll_call_note(sec_a, camper_a, today - 5, 'arrival', 'Late');
    res := res || E'\ncrew tag a mark from days ago: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\ncrew tag a mark from days ago: blocked ok';
  end;
  perform public.set_roll_call_note(sec_a, camper_a, today, 'arrival', '  ');
  execute 'reset role';
  select count(*) into n from roll_call_marks where section_id = sec_a and student_id = camper_a and day = today
     and roll_call = 'arrival' and note is null;
  res := res || E'\nclearing the tags empties the note: ' || case when n = 1 then 'ok' else 'BAD' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

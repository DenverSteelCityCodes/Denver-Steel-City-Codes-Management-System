-- Tests for migration_retention.sql (spec L4, #92).
-- Run on the demo database after private.reset_demo() and after migration_retention.sql.
-- The block raises its results at the end, so every test write rolls back. Every line should end in "ok".
-- Names and emails are tagged [TEST] and use example.com. Nothing here is committed.
--
-- Fixture, dated from Denver's today so it stays true in any year:
--   Anon and Held share a session that ended 3 years ago (5th grade). Anon is anonymized; Held is on hold.
--   Aged is a 5th grader from 20 years ago, so the 21st-birthday clock has passed.
--   Med ended 120 days ago (medical text only). Recent ended 10 days ago (nothing is due).
--   Old Parent owns Anon and Aged, so the parent clock has passed. Current Parent owns Med and Recent.
--   Old Volunteer led the old session and was removed then. New Volunteer leads the recent session.
do $$
declare
  today date;
  anon_end date; aged_end date; med_end date; recent_end date;
  anon_year int; aged_year int; med_year int; recent_year int;
  old_parent uuid; held_parent uuid; cur_parent uuid; old_vol uuid; new_vol uuid; adm uuid;
  klass uuid;
  ses_old uuid; ses_aged uuid; ses_med uuid; ses_recent uuid;
  sec_old uuid; sec_aged uuid; sec_med uuid; sec_recent uuid;
  anon uuid; held uuid; aged uuid; med uuid; recent uuid;
  oldrej uuid; newrej uuid; pending uuid; oldacc uuid; newacc uuid;
  slot uuid; booking uuid;
  inc_anon uuid; inc_aged uuid; inc_old uuid; inc_new uuid;
  creq uuid; creq_audit bigint;
  reassigned uuid; mixed_audit bigint; reverse_audit bigint; unknown_audit bigint; missing_audit bigint; young_audit bigint;
  empty_camper uuid; delete_target uuid; record_kind text;
  skip_parent uuid; skip_old uuid; skip_unk uuid; sec_both uuid; sec_skip uuid;
  vol_newapp uuid; newapp_oldacc uuid; newapp_oldrej uuid; vol_undated uuid; sec_undated uuid;
  prev_app uuid; campy int; prev_at timestamptz; newacc_at timestamptz;
  run1 uuid; run2 uuid; run3 uuid; run4 uuid;
  race_pa uuid; race_pb uuid; race_a uuid; race_b uuid; ses_race uuid; sec_race uuid;
  raised uuid; no_reg uuid; ses_raised uuid; sec_raised uuid;
  freeze_a uuid; freeze_b uuid; freeze_pa uuid; freeze_pb uuid;
  ses_freeze uuid; ses_freeze_new uuid; sec_freeze uuid; sec_freeze_new uuid; klass_f uuid;
  cap_at timestamptz; sty int; frozen_before jsonb; frozen_after jsonb;
  ids text[];
  dry boolean; live boolean; flag boolean;
  n int;
  apps_n int; notes_n int; interest_n int; inc_n int; roll_n int; pick_n int; rel_n int;
  prof_n int; stu_n int; tot_n int;
  sig text; sig2 text; grades text; grades2 text; st text; m text;
  claims_parent text; claims_vol text; claims_adm text;
  res text := '';
begin
  today := (now() at time zone 'America/Denver')::date;
  anon_end := (today - interval '3 years')::date;
  aged_year := extract(year from today)::int - 20;
  aged_end := make_date(aged_year, 7, 15);
  med_end := today - 120;
  recent_end := today - 10;
  anon_year := extract(year from anon_end)::int;
  med_year := extract(year from med_end)::int;
  recent_year := extract(year from recent_end)::int;

  res := res || E'\nturns_21 from first year 2023, youngest age: ' || case when private.turns_21(2023) = date '2036-01-01' then 'ok' else 'BAD' end;
  res := res || E'\nturns_21 from first year 2010 is later than a 9th-grade reading: ' || case when private.turns_21(2010) = date '2023-01-01' then 'ok' else 'BAD' end;
  res := res || E'\nturns_21 from first year 2000: ' || case when private.turns_21(2000) = date '2013-01-01' then 'ok' else 'BAD' end;
  res := res || E'\nturns_21 skips an unknown year: ' || case when private.turns_21(null) is null then 'ok' else 'BAD' end;

  res := res || E'\nturns_21 skips invalid and overflowing years: ' || case
    when private.turns_21(0) is null and private.turns_21(-1) is null
     and private.turns_21(2147483647) is null then 'ok' else 'BAD' end;
  res := res || E'\n21st year is held through December, until January after: ' || case
    when private.turns_21(extract(year from today)::int - 12) = make_date(extract(year from today)::int + 1, 1, 1)
    then 'ok' else 'BAD' end;

  select count(*) into n from cron.job
  where jobname = 'apply-retention' and schedule = '45 8 * * *'
    and command like '%private.apply_retention%' and command like '%retention_live%';
  res := res || E'\nnightly job is scheduled dry unless the setting is on: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  select id into adm from profiles where role = 'admin' order by id limit 1;
  res := res || E'\nfixture: an admin account exists: ' || case when adm is not null then 'ok' else 'BAD' end;

  old_parent := private.demo_user('retention-old-parent@example.com', '[TEST] Retention Old Parent', 'parent');
  held_parent := private.demo_user('retention-held-parent@example.com', '[TEST] Retention Held Parent', 'parent');
  cur_parent := private.demo_user('retention-current-parent@example.com', '[TEST] Retention Current Parent', 'parent');
  old_vol := private.demo_user('retention-old-vol@example.com', '[TEST] Retention Old Volunteer', 'volunteer');
  new_vol := private.demo_user('retention-new-vol@example.com', '[TEST] Retention New Volunteer', 'volunteer');
  claims_parent := json_build_object('sub', cur_parent, 'role', 'authenticated')::text;
  claims_vol := json_build_object('sub', new_vol, 'role', 'authenticated')::text;
  claims_adm := json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text;

  insert into parent_profiles (id, email, phone) values
    (old_parent, 'retention-old-parent@example.com', '303-555-0101'),
    (held_parent, 'retention-held-parent@example.com', '303-555-0102'),
    (cur_parent, 'retention-current-parent@example.com', '303-555-0103');
  update parent_profiles set emergency_contact_name = '[TEST] Old Emergency',
    emergency_contact_phone = '303-555-0104', emergency_contact_relation = 'Aunt'
    where id = old_parent;

  insert into classes (name) values ('[TEST] Retention') returning id into klass;
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention old', anon_year, anon_end - 4, anon_end, false) returning id into ses_old;
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention aged', aged_year, aged_end - 4, aged_end, false) returning id into ses_aged;
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention med', med_year, med_end - 4, med_end, false) returning id into ses_med;
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention recent', recent_year, recent_end - 4, recent_end, false) returning id into ses_recent;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass, 'R-old', 1, ses_old, 5, 17, 10) returning id into sec_old;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass, 'R-aged', 1, ses_aged, 5, 17, 10) returning id into sec_aged;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass, 'R-med', 1, ses_med, 5, 17, 10) returning id into sec_med;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass, 'R-recent', 1, ses_recent, 5, 17, 10) returning id into sec_recent;

  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year, allergies, email, gender, waiver_signature, waiver_signed_at, parent_phone)
    values (old_parent, '[TEST] Retention Anon', 'Anon', 'Camper', 11, '5th', anon_year, 'Peanuts [TEST]', 'anon-camper@example.com', 'Girl', 'Alex Parent', now() - interval '3 years', '303-555-0101')
    returning id into anon;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year, allergies, email, gender)
    values (held_parent, '[TEST] Retention Held', 'Held', 'Camper', 11, '5th', anon_year, 'Peanuts [TEST]', 'held-camper@example.com', 'Boy')
    returning id into held;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year, allergies, email, waiver_signature, waiver_signed_at)
    values (old_parent, '[TEST] Retention Aged', 'Aged', 'Camper', 11, '5th', aged_year, 'Peanuts [TEST]', 'aged-camper@example.com', 'Alex Parent', now() - interval '20 years')
    returning id into aged;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year, allergies, medical_info)
    values (cur_parent, '[TEST] Retention Med', 'Med', 'Camper', 11, '6th', med_year, 'Peanuts [TEST]', 'Asthma [TEST]')
    returning id into med;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year, allergies)
    values (cur_parent, '[TEST] Retention Recent', 'Recent', 'Camper', 12, '7th', recent_year, 'Peanuts [TEST]')
    returning id into recent;

  insert into registrations (student_id, section_id, status, place_with) values (anon, sec_old, 'confirmed', 'Sit with [TEST] Sam');
  insert into registrations (student_id, section_id, status) values (held, sec_old, 'confirmed');
  insert into registrations (student_id, section_id, status) values (aged, sec_aged, 'confirmed');
  insert into registrations (student_id, section_id, status) values (med, sec_med, 'confirmed');
  insert into registrations (student_id, section_id, status, place_with) values (recent, sec_recent, 'confirmed', 'Sit with [TEST] Sam');

  insert into authorized_pickups (student_id, name, relation, phone) values
    (anon, '[TEST] Aunt', 'Aunt', '303-555-0191'),
    (aged, '[TEST] Uncle', 'Uncle', '303-555-0192'),
    (recent, '[TEST] Neighbor', 'Neighbor', '303-555-0193');
  insert into release_consents (student_id, session_id, mode) values
    (anon, ses_old, 'walk'), (aged, ses_aged, 'walk');
  insert into roll_call_marks (section_id, student_id, day, roll_call, present) values
    (sec_old, anon, anon_end, 'arrival', true),
    (sec_aged, aged, aged_end, 'arrival', true);
  insert into incidents (section_id, student_id, kind, description)
    values (sec_old, anon, 'behavior', '[TEST] Retention camper incident') returning id into inc_anon;
  insert into incidents (section_id, student_id, kind, description)
    values (sec_aged, aged, 'behavior', '[TEST] Retention aged incident') returning id into inc_aged;
  insert into incidents (section_id, kind, description)
    values (sec_aged, 'conduct', '[TEST] Retention old conduct') returning id into inc_old;
  insert into incidents (section_id, kind, description)
    values (sec_recent, 'conduct', '[TEST] Retention recent conduct') returning id into inc_new;

  insert into volunteers (id, experience_level) values (old_vol, 'junior'), (new_vol, 'junior');
  -- Second review #4: role changes leave an expired volunteer row on a current parent.
  insert into volunteers (id, experience_level, legal_name, accepted_at, removed_at, removed_reason)
    values (cur_parent, 'junior', '[TEST] Current Parent Old Volunteer', aged_end, aged_end, '[TEST] old removal');
  update sections set lead_id = old_vol where id = sec_old;
  update sections set lead_id = new_vol where id = sec_recent;
  update volunteers set legal_name = '[TEST] Legal Old', removed_reason = '[TEST] do not re-accept', removed_at = anon_end::timestamptz, accepted_at = anon_end::timestamptz where id = old_vol;
  update volunteers set legal_name = '[TEST] Legal New', removed_reason = '[TEST] recent removal', removed_at = now() where id = new_vol;
  insert into volunteer_notes (volunteer_id, notes) values
    (old_vol, '[TEST] old interview notes'),
    (new_vol, '[TEST] new interview notes');

  insert into volunteer_applications (first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, admin_notes, created_at)
    values ('Old', 'Reject', 'retention-old-reject@example.com', '303-555-0181', 16, '11th', '[TEST] School', 'M', '[TEST] why', 'Intro', 'Web', 'Old Reject', 'rejected', '[TEST] decline reason', now() - interval '3 years')
    returning id into oldrej;
  insert into volunteer_applications (first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, admin_notes, created_at)
    values ('New', 'Reject', 'retention-new-reject@example.com', '303-555-0182', 16, '11th', '[TEST] School', 'M', '[TEST] why', 'Intro', 'Web', 'New Reject', 'rejected', '[TEST] recent decline', now() - interval '30 days')
    returning id into newrej;
  insert into volunteer_applications (first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
    values ('Still', 'Pending', 'retention-pending@example.com', '303-555-0183', 16, '11th', '[TEST] School', 'M', '[TEST] why', 'Intro', 'Web', 'Still Pending', 'pending', now() - interval '3 years')
    returning id into pending;
  insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
    values (old_vol, 'Old', 'Volunteer', 'retention-old-vol@example.com', '303-555-0184', 17, '12th', '[TEST] School', 'M', '[TEST] why', 'Intro', 'Web', 'Old Volunteer', 'accepted', now() - interval '3 years')
    returning id into oldacc;
  insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
    values (new_vol, 'New', 'Volunteer', 'retention-new-vol@example.com', '303-555-0185', 17, '12th', '[TEST] School', 'M', '[TEST] why', 'Intro', 'Web', 'New Volunteer', 'accepted', now() - interval '30 days')
    returning id into newacc;
  insert into interview_slots (slot_datetime) values (now() - interval '3 years') returning id into slot;
  insert into interview_bookings (slot_id, application_id, admin_notes)
    values (slot, oldacc, '[TEST] interview notes') returning id into booking;

  insert into season_settings (year, registration_opens_at) values (1990, now() - interval '100 days')
    on conflict (year) do update set registration_opens_at = excluded.registration_opens_at;
  insert into season_settings (year, registration_opens_at) values (1991, now() - interval '10 days')
    on conflict (year) do update set registration_opens_at = excluded.registration_opens_at;
  insert into interest_signups (email, year) values
    ('retention-old-list@example.com', 1990),
    ('retention-new-list@example.com', 1991);

  insert into retention_holds (parent_id, reason) values (held_parent, 'legal_hold');

  -- Finding 2: one undated both-weeks registration keeps the whole family, including a sibling
  -- whose own session ended years ago.
  skip_parent := private.demo_user('retention-skip-parent@example.com', '[TEST] Retention Skip Parent', 'parent');
  insert into parent_profiles (id, email) values (skip_parent, 'retention-skip-parent@example.com');
  insert into classes (name) values ('[TEST] Retention Other') returning id into klass_f;
  insert into sections (class_id, label, week, age_min, age_max, capacity)
    values (klass_f, 'R-both', null, 5, 17, 10) returning id into sec_both;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass_f, 'R-skip-old', 1, ses_aged, 5, 17, 10) returning id into sec_skip;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year, allergies)
    values (skip_parent, '[TEST] Retention Skip Old', 'Skip', 'Old', 11, '5th', aged_year, 'Peanuts [TEST]')
    returning id into skip_old;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, allergies)
    values (skip_parent, '[TEST] Retention Skip Unknown', 'Skip', 'Unknown', 11, '5th', 'Peanuts [TEST]')
    returning id into skip_unk;
  insert into registrations (student_id, section_id, status) values (skip_old, sec_skip, 'confirmed');
  insert into registrations (student_id, section_id, status) values (skip_unk, sec_both, 'confirmed');
  update registrations set year = -1 where student_id = skip_unk;
  res := res || E'\ninvalid both-weeks year is unresolved: ' || case
    when private.student_last_session_end(skip_unk) is null and private.student_first_year(skip_unk) is null then 'ok' else 'BAD' end;
  update registrations set year = null where student_id = skip_unk;
  update students set waiver_signature = '[TEST] unknown sibling waiver' where id = skip_old;
  res := res || E'\nunknown registration makes the parent clock unknown: ' || case
    when private.parent_retention_end(skip_parent) is null then 'ok' else 'BAD' end;

  -- Finding 6: a change request's audit row names the camper and must go at 21.
  insert into change_requests (student_id, requested_by, kind, message)
    values (aged, old_parent, 'other', '[TEST] aged change request') returning id into creq;
  select l.id into creq_audit from audit.log l
  where l.table_name = 'change_requests' and l.new->>'student_id' = aged::text
  order by l.id desc limit 1;

  -- Finding 1: an old crew assignment plus an application this season keeps the person.
  vol_newapp := private.demo_user('retention-newapp-vol@example.com', '[TEST] Retention Newapp Volunteer', 'volunteer');
  insert into volunteers (id, experience_level) values (vol_newapp, 'junior');
  update sections set lead_id = vol_newapp where id = sec_aged;
  update volunteers set legal_name = '[TEST] Legal Newapp', accepted_at = aged_end, removed_at = anon_end where id = vol_newapp;
  insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
    values (vol_newapp, 'New', 'App', 'retention-newapp-vol@example.com', '303-555-0186', 17, '12th', '[TEST] School', 'M', '[TEST] why', 'Intro', 'Web', 'New App', 'pending', now() - interval '10 days');

  insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
    select vol_newapp, 'Old', 'Newapp', 'retention-newapp-old-accept@example.com', phone, age, grade, school, shirt_size,
           why_volunteer, course_first_choice, course_second_choice, volunteer_signature, 'accepted', created_at
    from volunteer_applications where id = oldacc returning id into newapp_oldacc;
  insert into volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, created_at)
    select vol_newapp, 'Old', 'Newapp', 'retention-newapp-old-reject@example.com', phone, age, grade, school, shirt_size,
           why_volunteer, course_first_choice, course_second_choice, volunteer_signature, 'rejected', created_at
    from volunteer_applications where id = oldrej returning id into newapp_oldrej;

  -- Finding 1: a both-weeks section with no registrations has no date, so the crew record stays.
  vol_undated := private.demo_user('retention-undated-vol@example.com', '[TEST] Retention Undated Volunteer', 'volunteer');
  insert into volunteers (id, experience_level) values (vol_undated, 'junior');
  insert into sections (class_id, label, week, age_min, age_max, capacity)
    values (klass, 'R-undated', null, 5, 17, 10) returning id into sec_undated;
  update sections set lead_id = vol_undated where id = sec_undated;
  update volunteers set legal_name = '[TEST] Legal Undated', accepted_at = anon_end, removed_at = anon_end where id = vol_undated;

  -- Finding 1: a rejection whose season is the previous camp year is kept even though it is over a year old.
  campy := private.retention_camp_year();
  prev_at := make_timestamptz(campy - 2, 9, 15, 12, 0, 0, 'America/Denver');
  insert into volunteer_applications (first_name, last_name, email, phone, age, grade, school, shirt_size, why_volunteer, course_first_choice, course_second_choice, volunteer_signature, status, admin_notes, created_at)
    values ('Prev', 'Season', 'retention-prev-reject@example.com', '303-555-0187', 16, '11th', '[TEST] School', 'M', '[TEST] why', 'Intro', 'Web', 'Prev Season', 'rejected', '[TEST] previous season decline', prev_at)
    returning id into prev_app;

  -- Finding 1: exercise every input independently with all other dates old.
  update volunteers set accepted_at = aged_end, removed_at = aged_end where id = old_vol;
  update volunteers set accepted_at = now() where id = old_vol;
  res := res || E'\nnew acceptance overrides old crew and removal: ' || case
    when private.volunteer_retention_end(old_vol) >= today and private.volunteer_blocked(old_vol)
    then 'ok' else 'BAD' end;
  update volunteers set accepted_at = aged_end, removed_at = now() where id = old_vol;
  res := res || E'\nnew removal overrides old crew and acceptance: ' || case
    when private.volunteer_retention_end(old_vol) >= today and private.volunteer_blocked(old_vol)
    then 'ok' else 'BAD' end;
  update volunteers set removed_at = aged_end where id = old_vol;
  res := res || E'\nclock includes the later application season as well as crew: ' || case
    when private.volunteer_retention_end(old_vol) = greatest(
      anon_end, (select (a.created_at at time zone 'America/Denver')::date from volunteer_applications a where a.id = oldacc),
      (select private.application_season_end(a.created_at) from volunteer_applications a where a.id = oldacc))
    then 'ok' else 'BAD' end;
  update volunteers set accepted_at = prev_at where id = old_vol;
  res := res || E'\nprevious-season acceptance protects the volunteer: ' || case
    when private.volunteer_blocked(old_vol) then 'ok' else 'BAD' end;
  update volunteers set accepted_at = null where id = old_vol;
  res := res || E'\nunknown acceptance keeps the volunteer: ' || case
    when private.volunteer_blocked(old_vol) then 'ok' else 'BAD' end;
  update volunteers set accepted_at = anon_end, removed_at = anon_end where id = old_vol;
  select created_at into newacc_at from volunteer_applications where id = newacc;
  update volunteer_applications set created_at = aged_end where id = newacc;
  update volunteers set accepted_at = aged_end, removed_at = aged_end where id = new_vol;
  res := res || E'\ncurrent crew protects the volunteer with an old removal: ' || case
    when private.volunteer_blocked(new_vol) then 'ok' else 'BAD' end;
  update volunteers set accepted_at = now(), removed_at = now() where id = new_vol;
  update volunteer_applications set created_at = newacc_at where id = newacc;

  res := res || E'\nfixture: aged camper is already 21: ' || case when private.student_turns_21(aged) <= today then 'ok' else 'BAD' end;
  res := res || E'\nfixture: anon camper is not yet 21: ' || case when private.student_turns_21(anon) > today then 'ok' else 'BAD' end;

  create temp table ret_stu as
    select id, full_name, first_name, last_name, allergies, email, grade, waiver_signature, parent_id, gender
    from students;
  create temp table ret_prof as select id, display_name from profiles;
  create temp table ret_apps as select id from volunteer_applications;
  select count(*) into apps_n from volunteer_applications;
  select count(*) into notes_n from volunteer_notes;
  select count(*) into interest_n from interest_signups;
  select count(*) into inc_n from incidents;
  select count(*) into roll_n from roll_call_marks;
  select count(*) into pick_n from authorized_pickups;
  select count(*) into rel_n from release_consents;
  select count(*) into prof_n from profiles;
  select count(*) into stu_n from students;
  select count(*) into tot_n from season_totals;
  select coalesce(string_agg(y || ':' || status || ':' || cnt, ',' order by y, status), '') into sig
    from (select r.year::text as y, r.status::text as status, count(*)::text as cnt
          from registrations r join sections sec on sec.id = r.section_id
          where sec.class_id = klass group by r.year, r.status) t;
  select coalesce(string_agg(id::text || '=' || coalesce(grade, ''), ',' order by id::text), '') into grades
    from students where id in (anon, held, aged, med, recent);

  insert into app_settings (key, value) values ('retention_live', 'false')
    on conflict (key) do update set value = 'false';
  run1 := private.apply_retention(true);
  update app_settings set value = 'true' where key = 'retention_live';
  run2 := private.apply_retention(true);

  select count(*) into n from students s join ret_stu b using (id)
  where s.full_name is distinct from b.full_name
     or s.allergies is distinct from b.allergies
     or s.email is distinct from b.email
     or s.grade is distinct from b.grade
     or s.waiver_signature is distinct from b.waiver_signature
     or s.parent_id is distinct from b.parent_id
     or s.gender is distinct from b.gender;
  res := res || E'\ndry run changes no camper: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from ret_prof b
  where not exists (select 1 from profiles p where p.id = b.id)
     or exists (select 1 from profiles p where p.id = b.id and p.display_name is distinct from b.display_name);
  res := res || E'\ndry run changes no profile: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from volunteer_applications;
  res := res || E'\ndry run deletes no application: ' || case when n = apps_n then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_notes;
  res := res || E'\ndry run deletes no volunteer note: ' || case when n = notes_n then 'ok' else 'BAD' end;
  select count(*) into n from interest_signups;
  res := res || E'\ndry run deletes no signup: ' || case when n = interest_n then 'ok' else 'BAD' end;
  select count(*) into n from incidents;
  res := res || E'\ndry run deletes no incident: ' || case when n = inc_n then 'ok' else 'BAD' end;
  select count(*) into n from roll_call_marks;
  res := res || E'\ndry run deletes no roll call: ' || case when n = roll_n then 'ok' else 'BAD' end;
  select count(*) into n from authorized_pickups;
  res := res || E'\ndry run deletes no pickup: ' || case when n = pick_n then 'ok' else 'BAD' end;
  select count(*) into n from release_consents;
  res := res || E'\ndry run deletes no walk-home consent: ' || case when n = rel_n then 'ok' else 'BAD' end;
  select count(*) into n from season_totals;
  res := res || E'\ndry run writes no season total: ' || case when n = tot_n then 'ok' else 'BAD' end;

  select r.dry_run, r.live_setting into dry, live from retention_runs r where r.id = run1;
  res := res || E'\nfirst report is a dry run with the switch off: ' || case when dry and not live then 'ok' else 'BAD' end;
  select r.dry_run, r.live_setting into dry, live from retention_runs r where r.id = run2;
  res := res || E'\ncalling dry stays dry even when the switch is on: ' || case when dry and live then 'ok' else 'BAD' end;
  select subject_ids into ids from retention_run_items where run_id = run1 and rule = 'anonymize_camper';
  res := res || E'\ndry run would anonymize anon and aged only: ' || case
    when anon::text = any(coalesce(ids, '{}')) and aged::text = any(coalesce(ids, '{}'))
     and not held::text = any(coalesce(ids, '{}')) and not med::text = any(coalesce(ids, '{}'))
     and not recent::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  select subject_ids into ids from retention_run_items where run_id = run1 and rule = 'clear_medical';
  res := res || E'\ndry run would clear medical text for anon, aged and med: ' || case
    when anon::text = any(coalesce(ids, '{}')) and aged::text = any(coalesce(ids, '{}')) and med::text = any(coalesce(ids, '{}'))
     and not held::text = any(coalesce(ids, '{}')) and not recent::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  select subject_ids into ids from retention_run_items where run_id = run1 and rule = 'skipped_hold';
  res := res || E'\ndry run counts the held family: ' || case when held_parent::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  select detail into st from retention_run_items where run_id = run1 and rule = 'season_totals';
  res := res || E'\ndry run does not store season totals: ' || case when st = 'not written' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;
  select subject_ids into ids from retention_run_items where run_id = run1 and rule = 'anonymize_camper';
  res := res || E'\ndry run skips the family with an undated registration: ' || case
    when not skip_old::text = any(coalesce(ids, '{}')) and not skip_unk::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  select subject_ids into ids from retention_run_items where run_id = run1 and rule = 'delete_camper_audit';
  res := res || E'\ndry run counts the change-request audit row: ' || case
    when creq_audit::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  res := res || E'\nprevious-season rejection is older than a year and is that season: ' || case
    when prev_at <= (now() - interval '1 year')
     and extract(year from private.application_season_end(prev_at))::int = campy - 1 then 'ok' else 'BAD' end;

  update app_settings set value = 'false' where key = 'retention_live';
  run3 := private.apply_retention(false);
  select r.dry_run, r.live_setting into dry, live from retention_runs r where r.id = run3;
  res := res || E'\ncalling live runs live even when the switch is off: ' || case when not dry and not live then 'ok' else 'BAD' end;

  select count(*) into n from students s join ret_stu b using (id)
  where s.full_name = 'Former camper' and b.full_name is distinct from 'Former camper';
  res := res || E'\nlive anonymizes exactly two campers: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from students where id in (anon, aged)
    and full_name = 'Former camper' and first_name = 'Former' and last_name = 'camper' and email is null;
  res := res || E'\nanon and aged are Former camper with no email: ' || case when n = 2 then 'ok' else 'BAD' end;
  select count(*) into n from students s join ret_stu b using (id)
  where s.full_name is distinct from b.full_name and s.id not in (anon, aged);
  res := res || E'\nno other camper is renamed: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select full_name = '[TEST] Retention Held' and allergies = 'Peanuts [TEST]' and email = 'held-camper@example.com'
    into flag from students where id = held;
  res := res || E'\nheld camper is untouched: ' || case when flag then 'ok' else 'BAD' end;
  select full_name = '[TEST] Retention Med' and allergies is null and medical_info is null into flag from students where id = med;
  res := res || E'\nmed camper keeps the name and loses the medical text: ' || case when flag then 'ok' else 'BAD' end;
  select full_name = '[TEST] Retention Recent' and allergies = 'Peanuts [TEST]' into flag from students where id = recent;
  res := res || E'\nrecent camper is untouched: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from students s join ret_stu b using (id) where b.allergies is not null and s.allergies is null;
  res := res || E'\nmedical text is cleared for exactly three campers: ' || case when n = 3 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from students s join ret_stu b using (id) where s.grade is distinct from b.grade;
  res := res || E'\ngrades are unchanged: ' || case when n = 0 then 'ok' else 'BAD' end;
  select coalesce(string_agg(id::text || '=' || coalesce(grade, ''), ',' order by id::text), '') into grades2
    from students where id in (anon, held, aged, med, recent);
  res := res || E'\nthe five grades still match: ' || case when grades2 = grades then 'ok' else 'BAD' end;
  select waiver_signature is not null into flag from students where id = anon;
  res := res || E'\nanon waiver stays until 21: ' || case when flag then 'ok' else 'BAD' end;
  select waiver_signature is null and guardian_signature is null and waiver_signed_at is null into flag from students where id = aged;
  res := res || E'\naged waiver is cleared at 21: ' || case when flag then 'ok' else 'BAD' end;
  select gender is null into flag from students where id = anon;
  res := res || E'\nanon gender is cleared: ' || case when flag then 'ok' else 'BAD' end;
  select place_with is null into flag from registrations where student_id = anon;
  res := res || E'\nanon place-with note is cleared: ' || case when flag then 'ok' else 'BAD' end;
  select place_with = 'Sit with [TEST] Sam' into flag from registrations where student_id = recent;
  res := res || E'\nrecent place-with note stays: ' || case when flag then 'ok' else 'BAD' end;

  select count(*) into n from students where id in (anon, aged, held, med, recent);
  res := res || E'\ncamper rows stay: ' || case when n = 5 then 'ok' else 'BAD' end;
  select count(*) into n from students;
  res := res || E'\nno camper row is deleted: ' || case when n = stu_n then 'ok' else 'BAD' end;
  select count(*) into n from registrations where student_id in (anon, aged, held, med, recent);
  res := res || E'\nregistration rows stay: ' || case when n = 5 then 'ok' else 'BAD' end;
  select coalesce(string_agg(y || ':' || status || ':' || cnt, ',' order by y, status), '') into sig2
    from (select r.year::text as y, r.status::text as status, count(*)::text as cnt
          from registrations r join sections sec on sec.id = r.section_id
          where sec.class_id = klass group by r.year, r.status) t;
  res := res || E'\nyear and class counts are unchanged: ' || case when sig2 = sig then 'ok' else 'BAD (' || sig2 || ' vs ' || sig || ')' end;

  select count(*) into n from authorized_pickups where student_id in (anon, aged);
  res := res || E'\npickup adults for anonymized campers are gone: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from authorized_pickups where student_id = recent;
  res := res || E'\nrecent pickup adult stays: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from authorized_pickups;
  res := res || E'\npickup deletes are only those two: ' || case when n = pick_n - 2 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from release_consents where student_id = anon;
  res := res || E'\nanon walk-home consent stays until 21: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from release_consents where student_id = aged;
  res := res || E'\naged walk-home consent is deleted at 21: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from roll_call_marks where student_id = anon;
  res := res || E'\nanon roll call stays until 21: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from roll_call_marks where student_id = aged;
  res := res || E'\naged roll call is deleted at 21: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from incidents where id = inc_anon;
  res := res || E'\nanon camper incident stays until 21: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from incidents where id = inc_aged;
  res := res || E'\naged camper incident is deleted at 21: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from incidents where id = inc_old;
  res := res || E'\nold conduct incident is deleted: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from incidents where id = inc_new;
  res := res || E'\nrecent conduct incident stays: ' || case when n = 1 then 'ok' else 'BAD' end;

  select reason into st from audit.log
  where table_name = 'students' and row_id = anon::text and action = 'UPDATE'
  order by id desc limit 1;
  res := res || E'\nanon anonymize is audited as retention: ' || case when st = 'retention' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;
  select count(*) into n from audit.log l
  where (l.table_name = 'students' and l.row_id = aged::text)
     or l.old->>'student_id' = aged::text or l.new->>'student_id' = aged::text;
  res := res || E'\naged audit rows are gone at 21: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from audit.log
  where table_name = 'students' and row_id = held::text and action = 'UPDATE' and reason = 'retention';
  res := res || E'\nheld camper has no retention audit: ' || case when n = 0 then 'ok' else 'BAD' end;

  select count(*) into n from profiles where id = old_parent;
  res := res || E'\nold parent profile stays for age-21 records: ' || case when n = 1 then 'ok' else 'BAD' end;
  select display_name = 'Former parent' into flag from profiles where id = old_parent;
  res := res || E'\nold parent name is anonymized: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from auth.users where id = old_parent;
  res := res || E'\nold parent login is not deleted: ' || case when n = 1 then 'ok' else 'BAD' end;
  select email is null and phone is null and emergency_contact_name is null
    and emergency_contact_phone is null and emergency_contact_relation is null
    into flag from parent_profiles where id = old_parent;
  res := res || E'\nold parent contacts are null and the id stays: ' || case when flag then 'ok' else 'BAD' end;
  select bool_and(parent_id = old_parent) into flag from students where id in (anon, aged);
  res := res || E'\nanon and aged retain their family link: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from profiles where id in (held_parent, cur_parent);
  res := res || E'\nheld and current parents stay: ' || case when n = 2 then 'ok' else 'BAD' end;
  select exists (select 1 from retention_holds where parent_id = held_parent) into flag;
  res := res || E'\nheld parent is still on hold: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from profiles;
  res := res || E'\nno parent profile is deleted while camper records are protected: ' || case when n = prof_n then 'ok' else 'BAD (' || n || ')' end;
  select subject_ids into ids from retention_run_items where run_id = run3 and rule = 'delete_parent_account';
  res := res || E'\nparent-account report excludes families with protected records: ' || case
    when not old_parent::text = any(coalesce(ids, '{}'))
     and not held_parent::text = any(coalesce(ids, '{}'))
     and not cur_parent::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  select subject_ids into ids from retention_run_items where run_id = run3 and rule = 'anonymize_parent_name';
  res := res || E'\nparent anonymize report includes the preserved family: ' || case
    when old_parent::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  select subject_ids into ids from retention_run_items where run_id = run3 and rule = 'anonymize_parent_contact';
  res := res || E'\ncontact anonymize report includes the preserved family: ' || case
    when old_parent::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;

  select display_name = 'Former volunteer' into flag from profiles where id = old_vol;
  res := res || E'\nold volunteer is renamed Former volunteer: ' || case when flag then 'ok' else 'BAD' end;
  select legal_name is null and removed_reason is null and removed_at is not null into flag from volunteers where id = old_vol;
  res := res || E'\nold volunteer identity and removal reason are cleared: ' || case when flag then 'ok' else 'BAD' end;
  select legal_name = '[TEST] Legal New' and removed_reason = '[TEST] recent removal' into flag from volunteers where id = new_vol;
  res := res || E'\nrecent volunteer record stays: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from profiles p join ret_prof b using (id)
  where p.display_name is distinct from b.display_name and p.id not in (old_vol, old_parent);
  res := res || E'\nno other profile is renamed: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select p.display_name = b.display_name into flag from profiles p join ret_prof b using (id) where p.id = cur_parent;
  res := res || E'\nexpired volunteer clock preserves the current parent name: ' || case when flag then 'ok' else 'BAD' end;
  select legal_name is null and removed_reason is null into flag from volunteers where id = cur_parent;
  res := res || E'\ncurrent parent volunteer-only fields still expire: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_notes where volunteer_id = old_vol;
  res := res || E'\nold volunteer notes are deleted: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_notes where volunteer_id = new_vol;
  res := res || E'\nrecent volunteer notes stay: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_notes;
  res := res || E'\nonly that one note is deleted: ' || case when n = notes_n - 1 then 'ok' else 'BAD (' || n || ')' end;

  select count(*) into n from volunteer_applications where id in (oldrej, oldacc);
  res := res || E'\nold rejected and old accepted applications are deleted: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_applications where id in (newrej, pending, newacc);
  res := res || E'\npending and recent applications stay: ' || case when n = 3 then 'ok' else 'BAD' end;
  select count(*) into n from ret_apps b
  where not exists (select 1 from volunteer_applications a where a.id = b.id) and b.id not in (oldrej, oldacc);
  res := res || E'\nno other application is deleted: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from interview_bookings where id = booking;
  res := res || E'\ninterview booking goes with the old application: ' || case when n = 0 then 'ok' else 'BAD' end;

  select count(*) into n from interest_signups where email = 'retention-old-list@example.com';
  res := res || E'\nold notify-me signup is deleted: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from interest_signups where email = 'retention-new-list@example.com';
  res := res || E'\nrecent notify-me signup stays: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from audit.log l
  where l.table_name = 'interest_signups'
    and (l.old->>'email' = 'retention-old-list@example.com' or l.new->>'email' = 'retention-old-list@example.com');
  res := res || E'\nold signup audit copy is deleted: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  n := null;
  select t.n into n from season_totals t
  where t.year = anon_year and t.metric = 'registrations' and t.bucket = '[TEST] Retention · confirmed';
  res := res || E'\nseason total keeps anon year class count: ' || case when n = 2 then 'ok' else 'BAD (' || coalesce(n::text, 'null') || ')' end;
  n := null;
  select t.n into n from season_totals t
  where t.year = anon_year and t.metric = 'campers_by_gender' and t.bucket = 'Girl';
  res := res || E'\nseason total keeps the gender count after the name is cleared: ' || case when n = 1 then 'ok' else 'BAD (' || coalesce(n::text, 'null') || ')' end;
  n := null;
  select t.n into n from season_totals t
  where t.year = aged_year and t.metric = 'registrations' and t.bucket = '[TEST] Retention · confirmed';
  res := res || E'\nseason total keeps the aged year class count: ' || case when n = 1 then 'ok' else 'BAD (' || coalesce(n::text, 'null') || ')' end;
  select detail into st from retention_run_items where run_id = run3 and rule = 'season_totals';
  res := res || E'\nlive run stores season totals: ' || case when st = 'written' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;

  select full_name = '[TEST] Retention Skip Old' and allergies = 'Peanuts [TEST]' into flag from students where id = skip_old;
  res := res || E'\nundated registration keeps the sibling: ' || case when flag then 'ok' else 'BAD' end;
  select full_name = '[TEST] Retention Skip Unknown' and allergies = 'Peanuts [TEST]' into flag from students where id = skip_unk;
  res := res || E'\nundated registration keeps that camper: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from profiles where id = skip_parent;
  res := res || E'\nundated registration keeps the parent: ' || case when n = 1 then 'ok' else 'BAD' end;
  select legal_name = '[TEST] Legal Newapp' into flag from volunteers where id = vol_newapp;
  res := res || E'\ncurrent application keeps the old crew record: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_applications where user_id = vol_newapp and status = 'pending';
  res := res || E'\ncurrent application itself stays: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_applications where id in (newapp_oldacc, newapp_oldrej);
  res := res || E'\nnew application protects every older accepted and rejected application: ' || case when n = 2 then 'ok' else 'BAD' end;
  select legal_name = '[TEST] Legal Undated' into flag from volunteers where id = vol_undated;
  res := res || E'\nundated crew assignment keeps the volunteer: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from volunteer_applications where id = prev_app;
  res := res || E'\nprevious-season rejection stays: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from audit.log
  where table_name = 'change_requests' and (old->>'student_id' = aged::text or new->>'student_id' = aged::text);
  res := res || E'\nchange-request audit row is deleted at 21: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  select waiver_signature = '[TEST] unknown sibling waiver' into flag from students where id = skip_old;
  res := res || E'\nunknown sibling also prevents age-21 waiver deletion: ' || case when flag then 'ok' else 'BAD' end;

  -- Second review #1: reassignment cannot remove either camper's shared audit trail.
  insert into change_requests (student_id, requested_by, kind, message)
    values (aged, old_parent, 'other', '[TEST] reassigned request') returning id into reassigned;
  update change_requests set student_id = held where id = reassigned;
  select id into mixed_audit from audit.log where table_name = 'change_requests'
    and row_id = reassigned::text and old->>'student_id' = aged::text and new->>'student_id' = held::text
    order by id desc limit 1;
  update change_requests set student_id = aged where id = reassigned;
  select id into reverse_audit from audit.log where table_name = 'change_requests'
    and row_id = reassigned::text and old->>'student_id' = held::text and new->>'student_id' = aged::text
    order by id desc limit 1;
  update change_requests set student_id = anon where id = reassigned;
  select id into young_audit from audit.log where table_name = 'change_requests'
    and row_id = reassigned::text and old->>'student_id' = aged::text and new->>'student_id' = anon::text
    order by id desc limit 1;
  insert into audit.log (table_name, row_id, action, old, new)
    values ('change_requests', reassigned::text, 'UPDATE', jsonb_build_object('student_id', aged),
      jsonb_build_object('student_id', 'unknown-camper')) returning id into unknown_audit;
  insert into audit.log (table_name, row_id, action, old, new)
    values ('change_requests', reassigned::text, 'UPDATE', jsonb_build_object('student_id', aged), '{}')
    returning id into missing_audit;
  res := res || E'\naudit helper checks every reference even if caller includes a held id: ' || case
    when not exists (select 1 from private.camper_audit_ids(array[aged, held, anon]) a(id)
      where a.id in (mixed_audit, reverse_audit, young_audit, unknown_audit, missing_audit)) then 'ok' else 'BAD' end;
  run1 := private.apply_retention(true);
  select subject_ids into ids from retention_run_items where run_id = run1 and rule = 'delete_camper_audit';
  res := res || E'\ndry run keeps reassigned, younger and unknown camper audit rows: ' || case
    when mixed_audit is not null and reverse_audit is not null and young_audit is not null
      and not mixed_audit::text = any(coalesce(ids, '{}'))
      and not reverse_audit::text = any(coalesce(ids, '{}'))
      and not young_audit::text = any(coalesce(ids, '{}'))
      and not unknown_audit::text = any(coalesce(ids, '{}'))
      and not missing_audit::text = any(coalesce(ids, '{}')) then 'ok' else 'BAD' end;
  perform private.apply_retention(false);
  select count(*) into n from audit.log where id in (mixed_audit, reverse_audit, young_audit, unknown_audit, missing_audit);
  res := res || E'\nlive run keeps every shared or unresolved audit row: ' || case when n = 5 then 'ok' else 'BAD' end;

  -- Finding 2, resolved: a both-weeks section dated only by its registration year is anonymized.
  insert into students (parent_id, full_name, first_name, last_name, age, grade, email)
    values (cur_parent, '[TEST] Retention Both Weeks', 'Both', 'Weeks', 12, '6th', 'both-weeks@example.com')
    returning id into skip_unk;
  insert into registrations (student_id, section_id, status) values (skip_unk, sec_both, 'confirmed');
  update registrations set year = anon_year where student_id = skip_unk and section_id = sec_both;
  res := res || E'\nboth-weeks clock uses the latest session of the registration year: ' || case
    when private.student_last_session_end(skip_unk) = (select max(end_date) from sessions where year = anon_year)
    then 'ok' else 'BAD' end;
  update registrations set year = 1995 where student_id = skip_unk and section_id = sec_both;
  res := res || E'\nboth-weeks clock falls back to December 31 without sessions: ' || case
    when private.student_last_session_end(skip_unk) = date '1995-12-31' then 'ok' else 'BAD' end;
  -- Its own parent's clock also resolves from a both-weeks registration.
  freeze_pa := private.demo_user('retention-both-parent@example.com', '[TEST] Retention Both Parent', 'parent');
  insert into parent_profiles (id, email) values (freeze_pa, 'retention-both-parent@example.com');
  update students set parent_id = freeze_pa where id = skip_unk;
  res := res || E'\nboth-weeks parent clock uses its registration year: ' || case
    when private.parent_retention_end(freeze_pa) = date '1995-12-31' then 'ok' else 'BAD' end;
  -- Finding 3: an editable camper year without any registrations is not age evidence.
  insert into students (parent_id, full_name, age, grade, registration_year, waiver_signature)
    values (cur_parent, '[TEST] Retention No Registration', 14, '9th', aged_year, '[TEST] no registration waiver')
    returning id into no_reg;
  res := res || E'\nno registrations means an unknown age clock: ' || case
    when private.student_turns_21(no_reg) is null then 'ok' else 'BAD' end;
  res := res || E'\nunregistered camper also keeps the parent clock unknown: ' || case
    when private.parent_retention_end(cur_parent) is null then 'ok' else 'BAD' end;
  res := res || E'\nunknown parent clock blocks shared-profile anonymization: ' || case
    when not private.parent_profile_can_anonymize(cur_parent) then 'ok' else 'BAD' end;
  -- Finding 3: first year ten years ago, grade now 9th. The old grade reading would clear the waiver.
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention raised', extract(year from today)::int - 10, (today - interval '10 years')::date, (today - interval '10 years')::date, false)
    returning id into ses_raised;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass_f, 'R-raised', 1, ses_raised, 5, 17, 10) returning id into sec_raised;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, registration_year, waiver_signature, email)
    values (cur_parent, '[TEST] Retention Raised', 'Raised', 'Grade', 14, '9th', extract(year from today)::int - 10, '[TEST] Raised', 'raised@example.com')
    returning id into raised;
  insert into registrations (student_id, section_id, status) values (raised, sec_raised, 'confirmed');
  update students set registration_year = aged_year, grade = 'unrecognized' where id = raised;
  res := res || E'\nmutable year and unknown grade cannot shorten the age hold: ' || case
    when private.student_turns_21(raised) = make_date(extract(year from today)::int + 3, 1, 1)
    then 'ok' else 'BAD' end;

  -- Finding 7: two campers in one season, only one eligible. The totals freeze the whole season.
  sty := extract(year from today)::int - 4;
  insert into classes (name) values ('[TEST] Retention Freeze') returning id into klass_f;
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention freeze', sty, make_date(sty, 7, 1), make_date(sty, 7, 15), false)
    returning id into ses_freeze;
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention freeze new', extract(year from today)::int, today - 5, today + 2, true)
    returning id into ses_freeze_new;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass_f, 'R-freeze', 1, ses_freeze, 5, 17, 10) returning id into sec_freeze;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass_f, 'R-freeze-new', 1, ses_freeze_new, 5, 17, 10) returning id into sec_freeze_new;
  freeze_pa := private.demo_user('retention-freeze-a@example.com', '[TEST] Retention Freeze A Parent', 'parent');
  freeze_pb := private.demo_user('retention-freeze-b@example.com', '[TEST] Retention Freeze B Parent', 'parent');
  insert into parent_profiles (id, email) values
    (freeze_pa, 'retention-freeze-a@example.com'),
    (freeze_pb, 'retention-freeze-b@example.com');
  insert into students (parent_id, full_name, first_name, last_name, age, grade, gender)
    values (freeze_pa, '[TEST] Retention Freeze A', 'Freeze', 'A', 12, '6th', 'Girl') returning id into freeze_a;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, gender)
    values (freeze_pb, '[TEST] Retention Freeze B', 'Freeze', 'B', 12, '6th', 'Boy') returning id into freeze_b;
  insert into registrations (student_id, section_id, status) values
    (freeze_a, sec_freeze, 'confirmed'),
    (freeze_b, sec_freeze, 'confirmed'),
    (freeze_b, sec_freeze_new, 'confirmed');

  -- Finding 4: the second row of a live run sees a hold taken while the first row was anonymized.
  race_pa := private.demo_user('retention-race-a@example.com', '[TEST] Retention Race A Parent', 'parent');
  race_pb := private.demo_user('retention-race-b@example.com', '[TEST] Retention Race B Parent', 'parent');
  insert into parent_profiles (id, email) values
    (race_pa, 'retention-race-a@example.com'),
    (race_pb, 'retention-race-b@example.com');
  insert into sessions (name, year, start_date, end_date, is_active)
    values ('[TEST] Retention race', aged_year, aged_end - 4, aged_end, false) returning id into ses_race;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (klass_f, 'R-race', 1, ses_race, 5, 17, 10) returning id into sec_race;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, email)
    values (race_pa, '[TEST] Retention Race A', 'Race', 'A', 12, '6th', 'race-a@example.com') returning id into race_a;
  insert into students (parent_id, full_name, first_name, last_name, age, grade, email)
    values (race_pb, '[TEST] Retention Race B', 'Race', 'B', 12, '6th', 'race-b@example.com') returning id into race_b;
  insert into registrations (student_id, section_id, status, place_with) values
    (race_a, sec_race, 'confirmed', '[TEST] race place with'),
    (race_b, sec_race, 'confirmed', '[TEST] race place with');
  update students set waiver_signature = '[TEST] race waiver' where id in (race_a, race_b);
  insert into authorized_pickups (student_id, name, relation, phone) values
    (race_a, '[TEST] Race Pickup', 'Aunt', '303-555-0191'),
    (race_b, '[TEST] Race Pickup', 'Aunt', '303-555-0191');
  insert into release_consents (student_id, session_id, mode) values
    (race_a, ses_race, 'walk'), (race_b, ses_race, 'walk');

  create or replace function private.retention_test_hold_sibling()
  returns trigger language plpgsql security definer set search_path = public, private as $hold$
  begin
    if new.full_name = 'Former camper' and old.full_name like '[TEST] Retention Race %' then
      insert into retention_holds (parent_id, reason)
      select s.parent_id, 'legal_hold'
      from students s
      where s.full_name like '[TEST] Retention Race %' and s.id <> new.id
      on conflict (parent_id) do nothing;
    end if;
    return new;
  end;
  $hold$;
  drop trigger if exists retention_test_hold_sibling on students;
  create trigger retention_test_hold_sibling
    after update on students
    for each row execute function private.retention_test_hold_sibling();

  run4 := private.apply_retention(false);
  drop trigger if exists retention_test_hold_sibling on students;
  drop function if exists private.retention_test_hold_sibling();

  select full_name = 'Former camper' into flag from students where id = skip_unk;
  res := res || E'\nboth-weeks section dated by its year is anonymized: ' || case when flag then 'ok' else 'BAD' end;
  select full_name = 'Former camper' and waiver_signature = '[TEST] Raised' into flag from students where id = raised;
  res := res || E'\nraised grade is anonymized but the waiver is held to the youngest age: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from students
  where id in (race_a, race_b) and full_name = 'Former camper';
  res := res || E'\nhold set during the run saves the other camper: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from students
  where id in (race_a, race_b) and full_name like '[TEST] Retention Race %';
  res := res || E'\nthe other race camper keeps the name: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from retention_holds where parent_id in (race_pa, race_pb);
  res := res || E'\nthe race hold was recorded: ' || case when n >= 1 then 'ok' else 'BAD' end;

  select count(*) into n from students s
  where s.id in (race_a, race_b) and private.student_is_held(s.id)
    and s.waiver_signature = '[TEST] race waiver'
    and exists (select 1 from registrations r where r.student_id = s.id and r.place_with = '[TEST] race place with')
    and exists (select 1 from authorized_pickups ap where ap.student_id = s.id)
    and exists (select 1 from release_consents c where c.student_id = s.id)
    and exists (select 1 from audit.log l where l.table_name = 'students' and l.row_id = s.id::text);
  res := res || E'\nlate hold also saves pickup, place-with, waiver, consent and audit: ' || case when n = 1 then 'ok' else 'BAD' end;
  select count(*) into n from profiles p join retention_holds h on h.parent_id = p.id
  where p.id in (race_pa, race_pb);
  res := res || E'\nlate hold saves the parent profile too: ' || case when n = 1 then 'ok' else 'BAD' end;

  n := null;
  select t.n into n from season_totals t
  where t.year = sty and t.metric = 'registrations' and t.bucket = '[TEST] Retention Freeze · confirmed';
  res := res || E'\nfirst eligible camper freezes the whole season: ' || case when n = 2 then 'ok' else 'BAD (' || coalesce(n::text, 'null') || ')' end;
  n := null;
  select t.n into n from season_totals t
  where t.year = sty and t.metric = 'campers_by_gender' and t.bucket = 'Boy';
  res := res || E'\nfrozen season includes the camper who was not yet eligible: ' || case when n = 1 then 'ok' else 'BAD (' || coalesce(n::text, 'null') || ')' end;
  select full_name = 'Former camper' into flag from students where id = freeze_a;
  res := res || E'\nfirst freeze camper is anonymized on the first run: ' || case when flag then 'ok' else 'BAD' end;
  select full_name = '[TEST] Retention Freeze B' into flag from students where id = freeze_b;
  res := res || E'\nsecond freeze camper is not eligible on the first run: ' || case when flag then 'ok' else 'BAD' end;
  select min(t.captured_at) into cap_at from season_totals t where t.year = sty;
  select jsonb_agg(to_jsonb(t) order by t.metric, t.bucket) into frozen_before from season_totals t where t.year = sty;
  -- Remove the later registration so the second camper becomes eligible in the next run.
  delete from registrations where student_id = freeze_b and section_id = sec_freeze_new;
  perform private.apply_retention(false);
  select full_name = 'Former camper' into flag from students where id = freeze_b;
  res := res || E'\nsecond freeze camper becomes eligible and is anonymized later: ' || case when flag then 'ok' else 'BAD' end;
  select jsonb_agg(to_jsonb(t) order by t.metric, t.bucket) into frozen_after from season_totals t where t.year = sty;
  res := res || E'\nlater run adds no buckets and changes no frozen totals: ' || case
    when frozen_before = frozen_after then 'ok' else 'BAD' end;
  select count(*) into n from season_totals t where t.year = sty and t.captured_at is distinct from cap_at;
  res := res || E'\na later run does not rewrite the frozen season: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  n := null;
  select t.n into n from season_totals t
  where t.year = sty and t.metric = 'registrations' and t.bucket = '[TEST] Retention Freeze · confirmed';
  res := res || E'\nfrozen season count stays at both campers: ' || case when n = 2 then 'ok' else 'BAD (' || coalesce(n::text, 'null') || ')' end;

  select waiver_signature = '[TEST] no registration waiver' into flag from students where id = no_reg;
  res := res || E'\nno registration waiver survives live runs: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from profiles where id = (select id from auth.users where email = 'retention-both-parent@example.com');
  res := res || E'\nresolved both-weeks parent is eligible for deletion: ' || case when n = 0 then 'ok' else 'BAD' end;

  -- Second review #3: an anonymized family can still be found and put on hold.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  select exists (select 1 from public.admin_search_families('Former parent') f where f.parent_id = old_parent) into flag;
  res := res || E'\nanonymized family can still be looked up: ' || case when flag then 'ok' else 'BAD' end;
  perform public.set_family_legal_hold(old_parent, true);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  res := res || E'\na hold can be placed after parent anonymization: ' || case
    when private.student_is_held(anon) and private.student_is_held(aged) then 'ok' else 'BAD' end;
  perform private.apply_retention(false);
  res := res || E'\nlater hold preserves the parent and waiver: ' || case
    when exists (select 1 from profiles where id = old_parent)
      and exists (select 1 from students where id = anon and waiver_signature is not null)
      then 'ok' else 'BAD' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  perform public.set_family_legal_hold(old_parent, false);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  -- Simulate a later pass after all of this family's age-21 clocks have expired.
  update registrations set section_id = sec_aged, year = aged_year where student_id = anon;
  res := res || E'\nfixture: no family record remains inside age-21 hold: ' || case
    when not private.parent_has_protected_records(old_parent) then 'ok' else 'BAD' end;
  perform private.apply_retention(false);
  res := res || E'\nparent and contacts are deleted once no record remains protected: ' || case
    when not exists (select 1 from profiles where id = old_parent)
      and not exists (select 1 from parent_profiles where id = old_parent)
      and (select bool_and(parent_id is null) from students where id in (anon, aged))
      then 'ok' else 'BAD' end;
  res := res || E'\nshared audit is deleted once both referenced campers are eligible: ' || case
    when not exists (select 1 from audit.log where id = young_audit) then 'ok' else 'BAD' end;
  res := res || E'\nheld and unknown audit references still survive the later pass: ' || case
    when (select count(*) from audit.log where id in (mixed_audit, reverse_audit, unknown_audit, missing_audit)) = 4
      then 'ok' else 'BAD' end;

  -- Second review #2: exercise the actual parent DELETE policy and definer trigger.
  -- A held camper with no records is blocked by the legal hold alone.
  insert into students (parent_id, full_name, age) values (held_parent, '[TEST] Held Empty', 11)
    returning id into empty_camper;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', held_parent, 'role', 'authenticated')::text, true);
  flag := false;
  begin
    delete from students where id = empty_camper;
  exception when insufficient_privilege then
    get stacked diagnostics m = message_text;
    flag := m = 'Cannot delete camper: the camper or family is on legal hold. Contact an admin.';
  end;
  res := res || E'\nparent cannot delete a held camper even without records: ' || case
    when flag and exists (select 1 from students where id = empty_camper) then 'ok' else 'BAD' end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  foreach record_kind in array array['waiver', 'guardian', 'signed_at', 'registration', 'roll_call', 'incident', 'release_consent'] loop
    insert into students (parent_id, full_name, age) values (cur_parent, '[TEST] Protected ' || record_kind, 11)
      returning id into delete_target;
    case record_kind
      when 'waiver' then update students set waiver_signature = '[TEST] Signature' where id = delete_target;
      when 'guardian' then update students set guardian_signature = '[TEST] Guardian' where id = delete_target;
      when 'signed_at' then update students set waiver_signed_at = now() where id = delete_target;
      when 'registration' then insert into registrations (student_id, section_id, status) values (delete_target, sec_recent, 'confirmed');
      when 'roll_call' then insert into roll_call_marks (section_id, student_id, day, roll_call, present)
        values (sec_recent, delete_target, recent_end, 'arrival', true);
      when 'incident' then insert into incidents (section_id, student_id, kind, description)
        values (sec_recent, delete_target, 'behavior', '[TEST] Protected incident');
      when 'release_consent' then insert into release_consents (student_id, session_id, mode)
        values (delete_target, ses_recent, 'walk');
    end case;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', claims_parent, true);
    flag := false;
    begin
      delete from students where id = delete_target;
    exception when insufficient_privilege then
      get stacked diagnostics m = message_text;
      flag := m = 'Cannot delete camper: records are protected by the age-21 retention hold (or its date is unknown). Contact an admin.';
    end;
    res := res || E'\nparent cannot delete camper with protected ' || record_kind || ': ' || case
      when flag and exists (select 1 from students where id = delete_target) then 'ok' else 'BAD' end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  end loop;
  insert into students (parent_id, full_name, age) values (cur_parent, '[TEST] Empty Deletable', 11)
    returning id into delete_target;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_parent, true);
  delete from students where id = delete_target;
  get diagnostics n = row_count;
  res := res || E'\nparent can still delete an unheld camper with no records: ' || case when n = 1 then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', claims_adm, true);
  delete from students where id = empty_camper;
  get diagnostics n = row_count;
  res := res || E'\nadmin can still delete a held camper: ' || case when n = 1 then 'ok' else 'BAD' end;
  delete from students where id = no_reg;
  get diagnostics n = row_count;
  res := res || E'\nadmin can still delete a camper with protected records: ' || case when n = 1 then 'ok' else 'BAD' end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  -- Finding 5 and access: deleting one's own contact row cannot remove the admin-owned hold.
  -- Current parent and the recent volunteer still exist. The admin needs aal2 or the role reads as blank.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_parent, true);
  -- The definer statement trigger must work for a normal parent, despite revoked helper access.
  insert into registrations (student_id, section_id, status)
  select recent, sec_recent, 'confirmed'::registration_status where false;
  res := res || E'\nparent registration path can acquire the retention lock: ok';
  select count(*) into n from pg_locks
  where locktype = 'advisory' and pid = pg_backend_pid() and classid = 0 and objid = 440092 and granted;
  res := res || E'\nregistration and job share the fixed transaction lock: ' || case when n > 0 then 'ok' else 'BAD' end;
  select count(*) into n from retention_runs;
  res := res || E'\nparent cannot read retention runs: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from retention_run_items;
  res := res || E'\nparent cannot read retention counts: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from season_totals;
  res := res || E'\nparent cannot read season totals: ' || case when n = 0 then 'ok' else 'BAD' end;
  select count(*) into n from retention_holds;
  res := res || E'\nparent cannot read holds: ' || case when n = 0 then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', json_build_object('sub', held_parent, 'role', 'authenticated')::text, true);
  delete from parent_profiles where id = held_parent;
  select count(*) into n from parent_profiles where id = held_parent;
  res := res || E'\nheld parent can delete their own contact row: ' || case when n = 0 then 'ok' else 'BAD' end;
  begin
    delete from retention_holds where parent_id = held_parent;
    res := res || E'\nparent removes a legal hold: ALLOWED (BAD)';
  exception when insufficient_privilege then
    res := res || E'\nparent removes a legal hold: refused ok';
  when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nparent removes a legal hold: ' || case when m = 'Only an admin can set a legal hold' then 'refused ok' else 'BAD (' || m || ')' end;
  end;
  perform set_config('request.jwt.claims', claims_parent, true);
  begin
    perform public.set_family_legal_hold(cur_parent, true);
    res := res || E'\nparent calls set_family_legal_hold: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nparent calls set_family_legal_hold: ' || case when m = 'Admins only' then 'refused ok' else 'BAD (' || m || ')' end;
  end;
  begin
    perform private.apply_retention(true);
    res := res || E'\nsigned-in user runs the job: ALLOWED (BAD)';
  exception when insufficient_privilege then
    res := res || E'\nsigned-in user runs the job: refused ok';
  when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nsigned-in user runs the job: BAD (' || m || ')';
  end;
  perform set_config('request.jwt.claims', claims_vol, true);
  select count(*) into n from retention_runs;
  res := res || E'\nvolunteer cannot read retention runs: ' || case when n = 0 then 'ok' else 'BAD' end;
  execute 'reset role';

  begin
    execute 'set local role anon';
    begin
      perform 1 from retention_runs limit 1;
      res := res || E'\nanon reads the report: ALLOWED (BAD)';
    exception when insufficient_privilege then
      res := res || E'\nanon reads the report: refused ok';
    when others then
      get stacked diagnostics m = message_text;
      res := res || E'\nanon reads the report: BAD (' || m || ')';
    end;
    execute 'reset role';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nanon reads the report: BAD (' || m || ')';
    begin execute 'reset role'; exception when others then null; end;
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  select count(*) into n from retention_runs;
  res := res || E'\nadmin can read retention runs: ' || case when n > 0 then 'ok' else 'BAD' end;
  perform public.set_family_legal_hold(cur_parent, true);
  perform public.set_family_legal_hold(cur_parent, false);
  select not exists (select 1 from retention_holds where parent_id = cur_parent) into flag;
  res := res || E'\nadmin can clear a hold under the same lock: ' || case when flag then 'ok' else 'BAD' end;
  begin
    perform public.set_family_legal_hold(cur_parent, null);
    res := res || E'\nnull hold request: ALLOWED (BAD)';
  exception when null_value_not_allowed then
    res := res || E'\nnull hold request: refused ok';
  end;
  perform public.set_family_legal_hold(cur_parent, true);
  execute 'reset role';
  select exists (select 1 from retention_holds where parent_id = cur_parent) into flag;
  res := res || E'\nadmin hold marks the parent: ' || case when flag then 'ok' else 'BAD' end;
  select private.student_is_held(med) and private.student_is_held(recent) into flag;
  res := res || E'\nadmin hold covers that parent''s campers: ' || case when flag then 'ok' else 'BAD' end;
  select count(*) into n from retention_holds where parent_id = held_parent;
  res := res || E'\nparent could not remove the existing hold: ' || case when n = 1 then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', '', true);
  perform private.apply_retention(false);
  select private.student_is_held(held) and full_name = '[TEST] Retention Held' into flag from students where id = held;
  res := res || E'\ndeleting the parent contact cannot clear the hold or enable retention: ' || case when flag then 'ok' else 'BAD' end;
  select l.reason into st from audit.log l
  where l.table_name = 'retention_holds' and l.row_id = cur_parent::text
  order by l.id desc limit 1;
  res := res || E'\nhold change is audited as legal_hold: ' || case when st = 'legal_hold' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;

  -- The retention lock is taken per statement, before any row lock, on every table whose delete
  -- reaches campers (a two-session deadlock can't be shown in one transaction; this pins the design).
  select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname = 'a_retention_lock_before_delete' and c.relname in ('students', 'parent_profiles', 'profiles')
     and (t.tgtype & 1) = 0 and (t.tgtype & 2) = 2 and (t.tgtype & 8) = 8;
  res := res || E'\nretention lock taken before row locks on deletes (3 statement triggers): ' || case when n = 3 then 'ok' else 'BAD (' || n || ')' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

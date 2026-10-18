-- Tests for migration_authorized_pickups.sql (spec 36). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Every line should end in "ok"; any BAD is a failure.
-- Fixture (year 2099, so the demo's own weeks don't count): week W runs from 2 days ago to 2 days
-- from now, week F starts in 30 days, week P ended 10 days ago. Section A (lead: vol, support:
-- vol3) and section B (lead: vol2) both run in W. Campers: c1 and c3 (parent p1) in A, c2 (parent
-- p2) in B.
do $$
declare
  yr int := 2099;
  today date := (now() at time zone 'America/Denver')::date;
  p1 uuid; p2 uuid; adm uuid; vol uuid; vol2 uuid; vol3 uuid;
  ww uuid; wf uuid; wp uuid;
  cls uuid; sa uuid; sb uuid;
  c1 uuid; c2 uuid; c3 uuid;
  pk uuid; pk_tomorrow uuid; rc1 uuid;
  res text := ''; st text; n int; m int; b boolean; j jsonb;
begin
  select id into p1 from profiles where role = 'parent' order by id limit 1;
  select id into p2 from profiles where role = 'parent' and id <> p1 order by id limit 1;
  select id into adm from profiles where role = 'admin' order by id limit 1;
  select v.id into vol from volunteers v join profiles p on p.id = v.id where p.role = 'volunteer' order by v.id limit 1;
  select v.id into vol2 from volunteers v join profiles p on p.id = v.id where p.role = 'volunteer' and v.id <> vol order by v.id limit 1;
  select v.id into vol3 from volunteers v join profiles p on p.id = v.id where p.role = 'volunteer' and v.id not in (vol, vol2) order by v.id limit 1;

  insert into sessions (name, year, start_date, end_date, is_active) values ('Pickup Test W', yr, today - 2, today + 2, false) returning id into ww;
  insert into sessions (name, year, start_date, end_date, is_active) values ('Pickup Test F', yr, today + 30, today + 34, false) returning id into wf;
  insert into sessions (name, year, start_date, end_date, is_active) values ('Pickup Test P', yr, today - 14, today - 10, false) returning id into wp;
  insert into classes (name) values ('[TEST] Pickup Class') returning id into cls;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity, lead_id)
    values (cls, 'PA', 1, ww, 5, 17, 10, vol) returning id into sa;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity, lead_id)
    values (cls, 'PB', 1, ww, 5, 17, 10, vol2) returning id into sb;
  insert into section_supports (section_id, volunteer_id) values (sa, vol3);
  insert into students (parent_id, full_name, first_name, age, grade, parent_name, parent_phone)
    values (p1, 'Pick One', 'Pick1', 11, '6th', 'Pat Parent', '303-555-0100') returning id into c1;
  insert into students (parent_id, full_name, first_name, age, grade) values (p2, 'Pick Two', 'Pick2', 11, '6th') returning id into c2;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Pick Three', 'Pick3', 11, '6th') returning id into c3;
  insert into registrations (student_id, section_id, status) values (c1, sa, 'confirmed');
  insert into registrations (student_id, section_id, status) values (c2, sb, 'confirmed');
  insert into registrations (student_id, section_id, status) values (c3, sa, 'confirmed');

  execute 'set local role authenticated';

  -- ── Parents: their own campers' pickup lists ──
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  insert into authorized_pickups (student_id, name, relation, phone) values (c1, '  Rosa   Diaz ', 'Grandmother', '303-555-0142') returning id into pk;
  select name into st from authorized_pickups where id = pk;
  res := res || E'\nparent adds a pickup adult (name tidied): ' || case when st = 'Rosa Diaz' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  insert into authorized_pickups (student_id, name, relation, phone, days) values (c1, 'Ben Diaz', 'Uncle', '303-555-0143', array[today + 1]) returning id into pk_tomorrow;
  insert into authorized_pickups (student_id, name, relation, phone, days) values (c1, 'Wed Grandpa', 'Grandfather', '303-555-0144', array[today]);
  begin
    insert into authorized_pickups (student_id, name, relation, phone) values (c2, 'Not Mine', 'Neighbour', '303-555-0145');
    res := res || E'\nparent adds a pickup adult to another family''s camper: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nparent adds a pickup adult to another family''s camper: refused ok'; end;
  begin
    insert into authorized_pickups (student_id, name, relation, phone) values (c1, 'No Phone', 'Aunt', '12');
    res := res || E'\npickup adult with a two-digit phone: ALLOWED (BAD)';
  exception when check_violation then res := res || E'\npickup adult with a two-digit phone: refused ok'; end;
  begin
    insert into authorized_pickups (student_id, name, relation, phone, days) values (c1, 'No Days', 'Aunt', '303-555-0146', '{}');
    res := res || E'\npickup adult with an empty day list: ALLOWED (BAD)';
  exception when others then res := res || E'\npickup adult with an empty day list: refused ' || case when sqlstate in ('P0001', '23514') then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  select count(*) into n from authorized_pickups where student_id in (c1, c2, c3);
  res := res || E'\nparent 1 reads their 3 pickup adults: ' || case when n = 3 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  select count(*) into n from authorized_pickups where student_id in (c1, c3);
  res := res || E'\nparent 2 reads none of parent 1''s: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  update authorized_pickups set phone = '303-555-0000' where id = pk;
  get diagnostics n = row_count;
  res := res || E'\nparent 2 edits parent 1''s pickup adult: ' || case when n = 0 then 'no rows, ok' else 'ALLOWED (BAD)' end;

  -- ── Dated walk-home consent ──
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  insert into release_consents (student_id, session_id, mode, days, note) values (c1, ww, 'walk', array[today], ' Walks with his sister ')
    returning id into rc1;
  select (consented_by = p1)::text || '/' || coalesce(note, '-') into st from release_consents where id = rc1;
  res := res || E'\nparent consents for today, stamped with who: ' || case when st = 'true/Walks with his sister' then 'ok' else 'BAD (' || st || ')' end;
  begin
    insert into release_consents (student_id, session_id, mode, days) values (c3, ww, 'bike', array[today + 5]);
    res := res || E'\nconsent on a day outside the week: ALLOWED (BAD)';
  exception when others then res := res || E'\nconsent on a day outside the week: refused ' || case when sqlerrm like 'Pick days during Pickup Test W%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  begin
    insert into release_consents (student_id, session_id, mode) values (c3, wp, 'walk');
    res := res || E'\nconsent for a week that has ended: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nconsent for a week that has ended: refused ok'; end;
  begin
    insert into release_consents (student_id, session_id, mode) values (c2, ww, 'walk');
    res := res || E'\nconsent for another family''s camper: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nconsent for another family''s camper: refused ok'; end;
  insert into release_consents (student_id, session_id, mode) values (c3, wf, 'transit');
  select count(*) into n from release_consents where student_id = c3 and session_id = wf and days is null;
  res := res || E'\nconsent for every day of a later week: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Crew: the roster, through section_roster() only ──
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  select count(*) into n from authorized_pickups where student_id in (c1, c2, c3);
  res := res || E'\nlead reads authorized_pickups directly: ' || case when n = 0 then 'no rows, ok' else 'BAD (' || n || ')' end;
  select count(*) into n from release_consents where student_id in (c1, c2, c3);
  res := res || E'\nlead reads release_consents directly: ' || case when n = 0 then 'no rows, ok' else 'BAD (' || n || ')' end;
  begin
    insert into authorized_pickups (student_id, name, relation, phone) values (c1, 'Crew Pick', 'Friend', '303-555-0147');
    res := res || E'\nlead adds a pickup adult: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nlead adds a pickup adult: refused ok'; end;
  select pickup_adults, may_leave_alone_today into j, b from public.section_roster(sa) where id = c1;
  select string_agg(x ->> 'name', ',') into st from jsonb_array_elements(j) x;
  res := res || E'\nlead sees today''s list (dated first, tomorrow''s left out): ' || case when st = 'Wed Grandpa,Rosa Diaz' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  res := res || E'\n...with phones: ' || case when (j -> 0 ->> 'phone') = '303-555-0144' then 'ok' else 'BAD' end;
  res := res || E'\n...and the walk-home consent for today: ' || case when b then 'ok' else 'BAD' end;
  select may_leave_alone_today into b from public.section_roster(sa) where id = c3;
  res := res || E'\nno consent for camper 3 today (theirs is a later week): ' || case when not b then 'ok' else 'BAD' end;
  perform set_config('request.jwt.claims', json_build_object('sub', vol3, 'role', 'authenticated')::text, true);
  select pickup_adults into j from public.section_roster(sa) where id = c1;
  select count(*), count(*) filter (where x ->> 'phone' is not null) into n, m from jsonb_array_elements(j) x;
  res := res || E'\nsupport sees the names but no phones: ' || case when n = 2 and m = 0 then 'ok' else 'BAD (' || n || '/' || m || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  begin
    perform * from public.section_roster(sa);
    res := res || E'\nother section''s lead reads this roster: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nother section''s lead reads this roster: refused ok'; end;

  -- ── Dismissal: who collected each camper ──
  perform set_config('request.jwt.claims', json_build_object('sub', vol, 'role', 'authenticated')::text, true);
  insert into roll_call_marks (section_id, student_id, day, roll_call, present, marked_by, released_mode)
    values (sa, c1, today, 'dismissal', true, vol, 'alone');
  select released_to into st from roll_call_marks where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  res := res || E'\nleft on their own with today''s consent: ' || case when st = 'On their own (walk)' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  insert into roll_call_marks (section_id, student_id, day, roll_call, present, marked_by)
    values (sa, c3, today, 'dismissal', true, vol);
  begin
    update roll_call_marks set released_mode = 'alone' where section_id = sa and student_id = c3 and day = today and roll_call = 'dismissal';
    res := res || E'\nleft alone with no consent today: ALLOWED (BAD)';
  exception when others then res := res || E'\nleft alone with no consent today: refused ' || case when sqlerrm like 'This camper has no consent%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  begin
    update roll_call_marks set released_mode = 'listed_adult', released_to = 'Rosa Diaz' where section_id = sa and student_id = c3 and day = today and roll_call = 'dismissal';
    res := res || E'\nanother camper''s listed adult: ALLOWED (BAD)';
  exception when others then res := res || E'\nanother camper''s listed adult: refused ' || case when sqlerrm like 'Rosa Diaz isn''t on this camper''s pickup list%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  update roll_call_marks set released_mode = 'admin_ok', released_to = '  Aunt  May ' where section_id = sa and student_id = c3 and day = today and roll_call = 'dismissal';
  select released_mode || '/' || released_to into st from roll_call_marks where section_id = sa and student_id = c3 and day = today and roll_call = 'dismissal';
  res := res || E'\n...but an admin OK records it: ' || case when st = 'admin_ok/Aunt May' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  begin
    update roll_call_marks set released_mode = 'admin_ok', released_to = '' where section_id = sa and student_id = c3 and day = today and roll_call = 'dismissal';
    res := res || E'\nadmin OK with no name: ALLOWED (BAD)';
  exception when others then res := res || E'\nadmin OK with no name: refused ' || case when sqlerrm like 'Say who collected%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  update roll_call_marks set released_mode = 'listed_adult', released_to = 'rosa diaz' where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  select released_to into st from roll_call_marks where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  res := res || E'\na listed adult, any capitals, stored as listed: ' || case when st = 'Rosa Diaz' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  begin
    update roll_call_marks set released_mode = 'listed_adult', released_to = 'Ben Diaz' where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
    res := res || E'\nan adult listed only for tomorrow: ALLOWED (BAD)';
  exception when others then res := res || E'\nan adult listed only for tomorrow: refused ' || case when sqlstate = 'P0001' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  update roll_call_marks set released_mode = 'parent', released_to = null where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  select released_to into st from roll_call_marks where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  res := res || E'\nthe parent, named from the camper''s record: ' || case when st = 'Pat Parent' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  -- spec 34's roll-call notes write only the note: the release stays.
  update roll_call_marks set note = 'Late' where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  select released_mode into st from roll_call_marks where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  res := res || E'\na note leaves the release alone: ' || case when st = 'parent' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  update roll_call_marks set present = false where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  select coalesce(released_mode, '-') || '/' || coalesce(released_to, '-') into st from roll_call_marks where section_id = sa and student_id = c1 and day = today and roll_call = 'dismissal';
  res := res || E'\nmarking the camper absent clears the release: ' || case when st = '-/-' then 'ok' else 'BAD (' || st || ')' end;
  insert into roll_call_marks (section_id, student_id, day, roll_call, present, marked_by, released_mode, released_to)
    values (sa, c1, today, 'arrival', true, vol, 'admin_ok', 'Someone');
  select coalesce(released_mode, '-') into st from roll_call_marks where section_id = sa and student_id = c1 and day = today and roll_call = 'arrival';
  res := res || E'\nno release on an arrival mark: ' || case when st = '-' then 'ok' else 'BAD (' || st || ')' end;
  perform set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  update roll_call_marks set present = true, released_mode = 'admin_ok', released_to = 'Stranger' where section_id = sa and student_id = c3 and day = today and roll_call = 'dismissal';
  get diagnostics n = row_count;
  res := res || E'\nother section''s lead records a release here: ' || case when n = 0 then 'no rows, ok' else 'ALLOWED (BAD)' end;

  -- ── Admins: the dismissal board ──
  begin
    perform * from public.dismissal_board();
    res := res || E'\nvolunteer reads the dismissal board: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nvolunteer reads the dismissal board: refused ok'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) filter (where released_mode is null), count(*) filter (where released_mode = 'admin_ok')
    into n, m from public.dismissal_board() where section_id in (sa, sb);
  res := res || E'\nadmin board: 2 not released (camper 1 absent now, camper 2 unmarked), 1 admin OK: ' || case when n = 2 and m = 1 then 'ok' else 'BAD (' || n || '/' || m || ')' end;
  select count(*) into n from public.dismissal_board(today + 1) where section_id = sa and jsonb_array_length(pickup_adults) = 2;
  res := res || E'\n...and tomorrow''s board lists tomorrow''s adult: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from authorized_pickups where student_id in (c1, c2, c3);
  res := res || E'\nadmin reads every pickup adult: ' || case when n = 3 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Email the lead about a change during camp week ──
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  insert into authorized_pickups (student_id, name, relation, phone, days) values (c3, 'Past Only', 'Aunt', '303-555-0148', array[today - 1]);
  delete from release_consents where id = rc1;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  insert into authorized_pickups (student_id, name, relation, phone) values (c3, 'Admin Added', 'Aunt', '303-555-0149');
  execute 'reset role';

  select count(*) into n from notifications where template = 'pickup_changed' and payload ->> 'student_id' = c1::text and recipient_profile = vol;
  res := res || E'\nthe lead is emailed about camper 1''s changes (3 adults, consent added and removed): ' || case when n = 5 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'pickup_changed' and payload ->> 'student_id' = c1::text and payload ->> 'change' = 'consent_removed' and (payload ->> 'for_today')::boolean;
  res := res || E'\n...saying the removed consent was for today: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'pickup_changed' and payload ->> 'student_id' = c3::text;
  res := res || E'\nno email for a past-day adult, a later week''s consent or an admin''s change: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where template = 'pickup_changed' and recipient_profile in (vol2, vol3) and payload ->> 'student_id' in (c1::text, c3::text);
  res := res || E'\nno email to the support or another section''s lead: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Audit ──
  select count(*) into n from audit.log where table_name = 'authorized_pickups' and row_id = pk::text;
  select count(*) into m from audit.log where table_name = 'release_consents' and row_id = rc1::text;
  res := res || E'\naudit log records pickup adults and consents: ' || case when n >= 1 and m = 2 then 'ok' else 'BAD (' || n || '/' || m || ')' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

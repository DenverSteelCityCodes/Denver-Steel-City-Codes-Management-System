-- Tests for migration_public_camp_page.sql (spec 30). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write (and every
-- queued email) rolls back. Every line should say ok; the first line counts any BAD.
--
-- It builds its own camp in 2099 (one active week, a course with two sections plus a cancelled
-- one), so what the public page may show is known exactly, whatever the demo holds.
do $$
declare
  admin_id  uuid := (select id from profiles where role = 'admin' order by created_at limit 1);
  vol_id    uuid := (select v.id from volunteers v where not exists (select 1 from sections s where s.lead_id = v.id) limit 1);
  kid       record;
  kid2      record;
  wk uuid; cls uuid; sec_a uuid; sec_b uuid; sec_x uuid;
  info jsonb; txt text; res text := ''; n int; k text[]; st text; yr int;
  su record; tok text; utok text; bad int; on1 boolean; on2 boolean;
  addr text := 'fam.one@scc-demo.test';
begin
  -- ── Fixtures: a 2099 camp ──
  insert into sessions (name, year, start_date, end_date, is_active, location)
    values ('[TEST] Week A', 2099, '2099-06-08', '2099-06-12', true, '[TEST] Lab Building, 1 Test Way')
    returning id into wk;
  insert into classes (name, description) values ('[TEST] Robots', 'Build a robot.') returning id into cls;
  insert into sections (class_id, label, week, age_min, age_max, capacity, session_id, days, start_time, end_time, room, lead_id)
    values (cls, 'RB-A', 1, 10, 12, 1, wk, 'Mon–Fri', '09:00', '15:00', 'Room 9', vol_id) returning id into sec_a;
  insert into sections (class_id, label, week, age_min, age_max, capacity, session_id, days, start_time, end_time, room)
    values (cls, 'RB-B', 1, 12, 14, 1, wk, 'Mon–Fri', '08:30', '15:30', 'Room 10') returning id into sec_b;
  insert into sections (class_id, label, week, age_min, age_max, capacity, session_id, days, start_time, end_time, room, cancelled_at, cancel_reason)
    values (cls, 'RB-X', 1, 5, 17, 9, wk, 'Mon–Thu', '07:00', '18:00', 'Room 11', now(), 'test') returning id into sec_x;
  insert into schedule_items (session_id, start_time, end_time, title, location)
    values (wk, '15:00', '15:30', 'Pickup', 'Front door'), (wk, '08:30', '09:00', 'Drop-off', 'Front door');
  select st.id, st.full_name, st.first_name, st.parent_id into kid from students st where st.age between 10 and 12 limit 1;
  select st.id, st.full_name into kid2 from students st where st.age between 12 and 14 and st.id <> kid.id limit 1;
  insert into registrations (student_id, section_id, status) values (kid.id, sec_a, 'confirmed');   -- RB-A is now full

  -- ── 1. The public page's data, read as a signed-out visitor ──
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  info := public.public_camp_info();
  execute 'reset role';
  txt := info::text;
  res := res || E'\nanon reads public_camp_info: ' || case when info->>'year' = '2099' and info->>'status' = 'open' then 'ok (2099, open)' else 'BAD (' || coalesce(info->>'year', '?') || ', ' || coalesce(info->>'status', '?') || ')' end;

  select array_agg(x order by x) into k from jsonb_object_keys(info) x;
  res := res || E'\nonly whitelisted top-level keys: ' || case when k = '{courses,registration_opens_at,status,weeks,year}' then 'ok' else 'BAD (' || k::text || ')' end;
  select array_agg(x order by x) into k from jsonb_object_keys(info->'weeks'->0) x;
  res := res || E'\nonly whitelisted week keys: ' || case when k = '{days,end_date,ends,location,name,schedule,start_date,starts}' then 'ok' else 'BAD (' || coalesce(k::text, 'no week') || ')' end;
  select array_agg(x order by x) into k from jsonb_object_keys(info->'weeks'->0->'schedule'->0) x;
  res := res || E'\nonly whitelisted schedule keys: ' || case when k = '{end_time,location,start_time,title}' then 'ok' else 'BAD (' || coalesce(k::text, 'none') || ')' end;
  select array_agg(x order by x) into k from jsonb_object_keys(info->'courses'->0) x;
  res := res || E'\nonly whitelisted course keys: ' || case when k = '{age_max,age_min,description,name,weeks}' then 'ok' else 'BAD (' || coalesce(k::text, 'no course') || ')' end;
  select array_agg(x order by x) into k from jsonb_object_keys(info->'courses'->0->'weeks'->0) x;
  res := res || E'\nonly whitelisted course-week keys: ' || case when k = '{full,week}' then 'ok' else 'BAD (' || coalesce(k::text, 'none') || ')' end;

  select count(*) into n from profiles p where p.id in (vol_id, kid.parent_id, admin_id) and position(p.display_name in txt) > 0;
  res := res || E'\nno names of the lead, the family or the admin: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from students s where s.id = kid.id and (position(s.full_name in txt) > 0 or position(s.first_name in txt) > 0);
  res := res || E'\nno camper names: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  res := res || E'\nno email addresses, section codes, rooms or capacities: ' || case when position('@' in txt) = 0 and position('RB-A' in txt) = 0 and position('Room 9' in txt) = 0 and position('capacity' in txt) = 0 then 'ok' else 'BAD' end;

  res := res || E'\none week, with its place: ' || case when jsonb_array_length(info->'weeks') = 1 and info->'weeks'->0->>'location' = '[TEST] Lab Building, 1 Test Way' then 'ok' else 'BAD (' || (info->'weeks')::text || ')' end;
  res := res || E'\nhours span the open sections only: ' || case when info->'weeks'->0->>'starts' = '08:30:00' and info->'weeks'->0->>'ends' = '15:30:00' and info->'weeks'->0->>'days' = 'Mon–Fri' then 'ok' else 'BAD (' || (info->'weeks'->0->>'starts') || '–' || (info->'weeks'->0->>'ends') || ')' end;
  res := res || E'\ndaily schedule in time order: ' || case when jsonb_array_length(info->'weeks'->0->'schedule') = 2 and info->'weeks'->0->'schedule'->0->>'title' = 'Drop-off' then 'ok' else 'BAD' end;
  res := res || E'\nonly this year''s courses: ' || case when jsonb_array_length(info->'courses') = 1 and info->'courses'->0->>'name' = '[TEST] Robots' then 'ok' else 'BAD (' || jsonb_array_length(info->'courses') || ')' end;
  res := res || E'\nages across open sections (cancelled one ignored): ' || case when (info->'courses'->0->>'age_min') = '10' and (info->'courses'->0->>'age_max') = '14' then 'ok' else 'BAD (' || (info->'courses'->0->>'age_min') || '–' || (info->'courses'->0->>'age_max') || ')' end;
  res := res || E'\none section full is not a full course: ' || case when info->'courses'->0->'weeks'->0->>'full' = 'false' and info->'courses'->0->'weeks'->0->>'week' = '[TEST] Week A' then 'ok' else 'BAD' end;

  -- ── 2. Direct reads and writes fail for anon ──
  execute 'set local role anon';
  begin perform 1 from season_settings limit 1; res := res || E'\nanon reads season_settings: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nanon reads season_settings: refused ok'; end;
  begin perform 1 from interest_signups limit 1; res := res || E'\nanon reads interest_signups: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nanon reads interest_signups: refused ok'; end;
  begin insert into interest_signups (email, year) values ('x@scc-demo.test', 2099); res := res || E'\nanon writes interest_signups: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nanon writes interest_signups: refused ok'; end;
  begin perform private.send_interest_notices(); res := res || E'\nanon runs the notice job: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nanon runs the notice job: refused ok'; end;
  begin perform public.set_my_interest(true); res := res || E'\nanon uses the signed-in checkbox: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\nanon uses the signed-in checkbox: refused ok'; end;
  -- The wizard and the volunteer apply page read sessions directly; the place comes with it.
  select location into st from sessions where id = wk;
  res := res || E'\nanon reads sessions.location: ' || case when st = '[TEST] Lab Building, 1 Test Way' then 'ok' else 'BAD' end;
  execute 'reset role';

  update sessions set location = '[TEST] Annex, 2 Test Way' where id = wk;
  info := public.public_camp_info();
  res := res || E'\nchanging sessions.location changes the page: ' || case when info->'weeks'->0->>'location' = '[TEST] Annex, 2 Test Way' then 'ok' else 'BAD' end;
  select count(*) into n from sessions where year <> 2099 and location is null;
  res := res || E'\nexisting weeks keep the venue the app showed: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' without a place)' end;

  -- ── 3. Status, as the database enforces it ──
  insert into registrations (student_id, section_id, status) values (kid2.id, sec_b, 'confirmed');
  info := public.public_camp_info();
  res := res || E'\nevery section full → waitlist_only, course full: ' || case when info->>'status' = 'waitlist_only' and info->'courses'->0->'weeks'->0->>'full' = 'true' then 'ok' else 'BAD (' || (info->>'status') || ')' end;
  delete from registrations where student_id = kid2.id and section_id = sec_b;
  update form_configs set config = jsonb_set(config, '{enabled}', 'false') where form_key = 'student_registration';
  res := res || E'\nform switched off → closed: ' || case when private.camp_status(2099) = 'closed' then 'ok' else 'BAD (' || private.camp_status(2099) || ')' end;
  update form_configs set config = jsonb_set(config, '{enabled}', 'true') where form_key = 'student_registration';
  insert into season_settings (year, registration_opens_at, updated_at) values (2099, now() + interval '7 days', now() - interval '1 hour');
  info := public.public_camp_info();
  res := res || E'\nopening ahead → upcoming, with the time: ' || case when info->>'status' = 'upcoming' and (info->>'registration_opens_at')::timestamptz = now() + interval '7 days' then 'ok' else 'BAD (' || (info->>'status') || ')' end;
  res := res || E'\na year with no classes yet → upcoming: ' || case when private.camp_status(2098) = 'upcoming' then 'ok' else 'BAD' end;
  update sessions set start_date = '2020-01-06', end_date = '2020-01-10' where id = wk;
  yr := private.public_camp_year();
  res := res || E'\nonce the active year''s weeks are over, the page is about the next year: ' || case when yr = 2100 then 'ok' else 'BAD (' || yr || ')' end;
  update sessions set start_date = '2099-06-08', end_date = '2099-06-12' where id = wk;
  yr := private.public_camp_year();
  res := res || E'\n...and about the active year while it lasts: ' || case when yr = 2099 then 'ok' else 'BAD (' || yr || ')' end;

  -- ── 4. Joining the list (signed out) ──
  execute 'set local role anon';
  perform public.join_interest_list('  Fam.One@SCC-Demo.TEST ');
  perform public.join_interest_list(addr);   -- again the same day
  begin perform public.join_interest_list('not-an-email'); res := res || E'\nbad address: ACCEPTED (BAD)';
  exception when invalid_parameter_value then res := res || E'\nbad address: refused ok (' || sqlerrm || ')'; end;
  execute 'reset role';
  select * into su from interest_signups where email = addr;
  res := res || E'\nsignup stored lower-cased for this camp year, unconfirmed: ' || case when su.year = 2099 and su.confirmed_at is null then 'ok' else 'BAD' end;
  select count(*) into n from notifications where template = 'interest_confirm' and recipient_email = addr and status = 'queued';
  res := res || E'\none confirmation email per address per day: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select payload->>'token' into tok from notifications where template = 'interest_confirm' and recipient_email = addr;
  res := res || E'\nconfirmation carries a confirm token: ' || case when private.interest_token_id(tok, 'confirm') = su.id then 'ok' else 'BAD' end;

  insert into notifications (recipient_email, template, status) select 'cap@scc-demo.test', 'interest_confirm', 'cancelled' from generate_series(1, 20);
  execute 'set local role anon';
  begin perform public.join_interest_list('fam.two@scc-demo.test'); res := res || E'\nform-wide cap (20 a minute): NOT ENFORCED (BAD)';
  exception when raise_exception then res := res || E'\nform-wide cap (20 a minute): refused ok'; end;
  execute 'reset role';
  delete from notifications where recipient_email = 'cap@scc-demo.test';

  perform private.send_interest_notices();
  select count(*) into n from notifications where recipient_email = addr and template <> 'interest_confirm';
  res := res || E'\nunconfirmed signups get nothing else: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;

  -- ── 5. Confirming ──
  execute 'set local role anon';
  begin perform public.confirm_interest(left(tok, length(tok) - 1) || case when right(tok, 1) = '0' then '1' else '0' end);
    res := res || E'\ntampered confirm link: ACCEPTED (BAD)';
  exception when raise_exception then res := res || E'\ntampered confirm link: refused ok'; end;
  execute 'reset role';
  utok := private.interest_token(su.id, 'unsubscribe');
  execute 'set local role anon';
  begin perform public.confirm_interest(utok); res := res || E'\nunsubscribe link used to confirm: ACCEPTED (BAD)';
  exception when raise_exception then res := res || E'\nunsubscribe link used to confirm: refused ok'; end;
  yr := public.confirm_interest(tok);
  perform public.confirm_interest(tok);   -- a second click is harmless
  execute 'reset role';
  select * into su from interest_signups where email = addr;
  res := res || E'\nconfirm link confirms: ' || case when yr = 2099 and su.confirmed_at is not null then 'ok' else 'BAD' end;

  -- ── 6. "Opening soon": once per announced time ──
  perform private.send_interest_notices();
  perform private.send_interest_notices();
  select count(*) into n from notifications where recipient_email = addr and template = 'registration_opening_soon';
  res := res || E'\nexactly one "opening soon": ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select payload->>'token' into utok from notifications where recipient_email = addr and template = 'registration_opening_soon';
  res := res || E'\n...with a working unsubscribe token: ' || case when private.interest_token_id(utok, 'unsubscribe') = su.id and private.interest_token_id(utok, 'confirm') is null then 'ok' else 'BAD' end;
  delete from season_settings where year = 2099;
  insert into season_settings (year, registration_opens_at, updated_at) values (2099, now() + interval '8 days', now());
  perform private.send_interest_notices();
  select count(*) into n from notifications where recipient_email = addr and template = 'registration_opening_soon';
  res := res || E'\na just-changed time waits 10 minutes: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  delete from season_settings where year = 2099;
  insert into season_settings (year, registration_opens_at, updated_at) values (2099, now() + interval '8 days', now() - interval '11 minutes');
  perform private.send_interest_notices();
  perform private.send_interest_notices();
  select count(*) into n from notifications where recipient_email = addr and template = 'registration_opening_soon';
  res := res || E'\na changed time sends one more: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;

  -- ── 7. "Now open": once, when registration opens ──
  insert into interest_signups (email, year, confirmed_at) values ('next.year@scc-demo.test', 2100, now());
  delete from season_settings where year = 2099;
  insert into season_settings (year, registration_opens_at, updated_at) values (2099, now() - interval '1 minute', now() - interval '1 hour');
  perform private.send_interest_notices();
  perform private.send_interest_notices();
  select count(*) into n from notifications where recipient_email = addr and template = 'registration_now_open';
  res := res || E'\nexactly one "now open": ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where recipient_email = addr and template = 'registration_opening_soon';
  res := res || E'\nno "opening soon" once it''s open: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) into n from notifications where recipient_email = 'next.year@scc-demo.test';
  res := res || E'\na year that hasn''t opened gets nothing: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  select payload->>'token' into utok from notifications where recipient_email = addr and template = 'registration_now_open';

  -- ── 8. Unsubscribing ──
  execute 'set local role anon';
  begin perform public.leave_interest_list(tok); res := res || E'\nconfirm link used to unsubscribe: ACCEPTED (BAD)';
  exception when raise_exception then res := res || E'\nconfirm link used to unsubscribe: refused ok'; end;
  yr := public.leave_interest_list(utok);
  execute 'reset role';
  select * into su from interest_signups where email = addr;
  res := res || E'\nunsubscribe link unsubscribes: ' || case when yr = 2099 and su.unsubscribed_at is not null then 'ok' else 'BAD' end;
  delete from season_settings where year = 2099;
  insert into season_settings (year, registration_opens_at, updated_at) values (2099, now() + interval '9 days', now() - interval '1 hour');
  perform private.send_interest_notices();
  select count(*) into n from notifications where recipient_email = addr and template = 'registration_opening_soon';
  res := res || E'\nnothing more after unsubscribing: ' || case when n = 2 then 'ok' else 'BAD (' || n || ')' end;
  execute 'set local role anon';
  perform public.join_interest_list(addr);
  execute 'reset role';
  select count(*) into n from notifications where recipient_email = addr and template = 'interest_confirm';
  res := res || E'\nsigning up again the same day sends no second confirmation: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- ── 9. The signed-in parent's checkbox ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', kid.parent_id, 'role', 'authenticated')::text, true);
  on1 := public.set_my_interest(true);
  on2 := public.my_interest();
  res := res || E'\nparent ticks "notify me": ' || case when on1 and on2 then 'ok' else 'BAD' end;
  select count(*) into n from interest_signups;
  res := res || E'\nparent reads the list: ' || case when n = 0 then 'sees nothing ok' else 'SEES ROWS (BAD)' end;
  on1 := public.set_my_interest(false);
  on2 := public.my_interest();
  res := res || E'\nparent unticks it: ' || case when not on1 and not on2 then 'ok' else 'BAD' end;
  execute 'reset role';
  select count(*) into n from interest_signups i join auth.users u on lower(u.email) = i.email
   where u.id = kid.parent_id and i.year = 2099 and i.confirmed_at is not null;
  res := res || E'\n...using the confirmed login email, no second opt-in: ' || case when n = 1 and not exists (
      select 1 from notifications x join auth.users u on lower(u.email) = x.recipient_email where u.id = kid.parent_id and x.template = 'interest_confirm')
    then 'ok' else 'BAD' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from interest_signups;
  res := res || E'\nadmin reads the list: ' || case when n >= 3 then 'ok (' || n || ' rows)' else 'BAD (' || n || ')' end;
  execute 'reset role';

  -- ── 10. The job is scheduled ──
  select count(*) into n from cron.job where jobname = 'interest-notices' and schedule = '* * * * *';
  res := res || E'\nnotice job runs every minute: ' || case when n = 1 then 'ok' else 'BAD' end;

  bad := (length(res) - length(replace(res, 'BAD', ''))) / 3;
  raise exception 'RESULTS (all rolled back): % BAD%', bad, res;
end $$;

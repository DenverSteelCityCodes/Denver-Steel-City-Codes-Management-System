-- Tests for migration_course_rules.sql (spec 31, #151), with the course-rule checks it adds to
-- registrations_before_insert() (migration_one_class_per_week.sql), the swap functions
-- (migration_parent_swap.sql) and public_camp_info() (migration_public_camp_page.sql).
-- Run against the demo DB after private.reset_demo(). The block raises its results at the end,
-- so every test write rolls back. Every line should end in "ok".
--
-- Fixture: three classes that aren't named like any real course, so nothing here leans on a name:
--   Rules Basics   (B) in Week 1 (B1 one seat, B1b and B1c roomy), Week 2 (B2) and last year (BP)
--   Rules Advanced (A) for grades 7–8 this fall, after Rules Basics; in Week 1 (A1) and Week 2 (A2)
--   Rules Other    (O) no rules; Week 1 (O1) and Week 2 (O2)
do $$
declare
  yr int := (select max(year) from sessions where is_active);
  p1 uuid; p2 uuid; adm uuid;
  cb uuid; ca uuid; co uuid; past uuid;
  b1 uuid; b1b uuid; b1c uuid; b2 uuid; bp uuid; a1 uuid; a2 uuid; o1 uuid; o2 uuid;
  s6 uuid; s7 uuid; s8 uuid; s9 uuid; snull uuid; spast uuid; spc uuid; s6x uuid; a2b uuid; r_s6x uuid; crew uuid;
  r uuid; r_s6_o2 uuid; r_spc_o2 uuid; r_s9_b1b uuid; r_s9_o2 uuid; r_s8_b1b uuid; req uuid;
  res text := ''; st text; m text; h text; n int; j jsonb;
  claims_p1 text; claims_p2 text; claims_adm text;
begin
  select id into p1 from profiles where role = 'parent' order by id limit 1;
  select id into p2 from profiles where role = 'parent' and id <> p1 order by id limit 1;
  select id into adm from profiles where role = 'admin' order by id limit 1;
  claims_p1 := json_build_object('sub', p1, 'role', 'authenticated')::text;
  claims_p2 := json_build_object('sub', p2, 'role', 'authenticated')::text;
  claims_adm := json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text;

  insert into classes (name) values ('Rules Basics') returning id into cb;
  insert into classes (name, grades_allowed, requires_class_id) values ('Rules Advanced', '{7th,8th}', cb) returning id into ca;
  insert into classes (name) values ('Rules Other') returning id into co;
  insert into sessions (name, year, start_date, end_date, is_active)
  values ('Rules last summer', yr - 1, make_date(yr - 1, 7, 6), make_date(yr - 1, 7, 10), false) returning id into past;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cb, 'B1', 1, 5, 17, 1) returning id into b1;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cb, 'B1b', 1, 5, 17, 10) returning id into b1b;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cb, 'B1c', 1, 5, 17, 10) returning id into b1c;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cb, 'B2', 2, 5, 17, 10) returning id into b2;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity) values (cb, 'BP', 1, past, 5, 17, 10) returning id into bp;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (ca, 'A1', 1, 5, 17, 10) returning id into a1;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (ca, 'A2', 2, 5, 17, 10) returning id into a2;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (ca, 'A2b', 2, 5, 17, 10) returning id into a2b;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (co, 'O1', 1, 5, 17, 10) returning id into o1;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (co, 'O2', 2, 5, 17, 10) returning id into o2;

  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Rules Six', 'Six', 11, '6th') returning id into s6;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Rules Seven', 'Seven', 12, '7th') returning id into s7;
  insert into students (parent_id, full_name, first_name, age, grade) values (p2, 'Rules Eight', 'Eight', 13, '8th') returning id into s8;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Rules Nine', 'Nine', 12, '7th') returning id into s9;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Rules Blank', 'Blank', 12, null) returning id into snull;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Rules Past', 'Past', 13, '8th') returning id into spast;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Rules Cancelled', 'Cancelled', 13, '8th') returning id into spc;
  insert into students (parent_id, full_name, first_name, age, grade) values (p1, 'Rules Excepted', 'Excepted', 11, '6th') returning id into s6x;
  -- Last summer: Past completed Rules Basics; Cancelled signed up and cancelled.
  insert into registrations (student_id, section_id, status) values (spast, bp, 'confirmed');
  insert into registrations (student_id, section_id, status) values (spc, bp, 'cancelled');
  select year into n from registrations where student_id = spast;
  res := res || E'\nfixture: last summer''s spot is stamped last year: ' || case when n = yr - 1 then 'ok' else 'BAD (' || coalesce(n::text, 'null') || ')' end;

  -- ── Sign-ups (registrations_before_insert) ──
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_p1, true);
  begin
    insert into registrations (student_id, section_id) values (s6, a2);
    res := res || E'\ngrade outside the class''s grades: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, h = pg_exception_hint;
    res := res || E'\ngrade outside the class''s grades: refused ' || case when m = 'Rules Advanced is for grades 7–8 this fall. Request an exception?' and h = 'course_rule' then 'ok' else '(BAD: ' || m || ' / ' || coalesce(h, '') || ')' end;
  end;
  begin
    insert into registrations (student_id, section_id) values (snull, a2);
    res := res || E'\nno grade on file: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nno grade on file: refused ' || case when m like 'Rules Advanced is for grades 7–8 this fall.%' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  begin
    insert into registrations (student_id, section_id) values (s7, a2);
    res := res || E'\nprerequisite missing: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, h = pg_exception_hint;
    res := res || E'\nprerequisite missing: refused ' || case when m = 'Rules Advanced needs Rules Basics first. Request an exception?' and h = 'course_rule' then 'ok' else '(BAD: ' || m || ' / ' || coalesce(h, '') || ')' end;
  end;
  -- Rules Basics in Week 2 doesn't count for Rules Advanced in Week 1.
  insert into registrations (student_id, section_id) values (s7, b2) returning id into r;
  begin
    insert into registrations (student_id, section_id) values (s7, a1);
    res := res || E'\nprerequisite in a later week: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nprerequisite in a later week: refused ' || case when m like 'Rules Advanced needs Rules Basics first.%' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  execute 'reset role';
  delete from registrations where id = r;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_p1, true);
  -- Seven takes Rules Basics in Week 1 (B1's one seat), then Rules Advanced in Week 2.
  insert into registrations (student_id, section_id) values (s7, b1);
  begin
    insert into registrations (student_id, section_id, place_with) values (s7, a2, 'Same class as Nine') returning id into r;
    select (select status::text from registrations where id = r) || '/'
        || coalesce((select x.place_with from public.my_place_with() x where x.registration_id = r), '') into st;
    res := res || E'\nprerequisite met earlier this season (and place_with kept): ' || case when st = 'confirmed/Same class as Nine' then 'ok' else 'BAD (' || st || ')' end;
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nprerequisite met earlier this season: refused (BAD: ' || m || ')';
  end;
  -- Past completed it last summer; Cancelled only signed up and cancelled.
  begin
    insert into registrations (student_id, section_id) values (spast, a2);
    res := res || E'\nprerequisite met in a past year: ok';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nprerequisite met in a past year: refused (BAD: ' || m || ')';
  end;
  begin
    insert into registrations (student_id, section_id) values (spc, a2);
    res := res || E'\na cancelled spot last year doesn''t count: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\na cancelled spot last year doesn''t count: refused ' || case when m like 'Rules Advanced needs Rules Basics first.%' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  begin
    insert into registrations (student_id, section_id, place_with) values (s9, o1, repeat('x', 101));
    res := res || E'\nplace_with over 100 characters: ALLOWED (BAD)';
  exception when check_violation then res := res || E'\nplace_with over 100 characters: refused ok'; end;

  -- One statement, Week 1 before Week 2 (as the wizard sends them).
  perform set_config('request.jwt.claims', claims_p2, true);
  begin
    insert into registrations (student_id, section_id) values (s8, b1), (s8, a2);
    res := res || E'\na waitlist place doesn''t count as the prerequisite: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\na waitlist place doesn''t count as the prerequisite: refused ' || case when m like 'Rules Advanced needs Rules Basics first.%' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  begin
    insert into registrations (student_id, section_id) values (s8, b1b), (s8, a2);
    select count(*) into n from registrations where student_id = s8 and status = 'confirmed';
    res := res || E'\nprerequisite in the same request, Week 1 first: ' || case when n = 2 then 'ok' else 'BAD (' || n || ' confirmed)' end;
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nprerequisite in the same request, Week 1 first: refused (BAD: ' || m || ')';
  end;
  select id into r_s8_b1b from registrations where student_id = s8 and section_id = b1b;

  -- A class without rules is open to anyone its age band fits.
  perform set_config('request.jwt.claims', claims_p1, true);
  insert into registrations (student_id, section_id) values (s6, o2) returning id into r_s6_o2;
  insert into registrations (student_id, section_id) values (spc, o2) returning id into r_spc_o2;
  insert into registrations (student_id, section_id) values (s9, b1b) returning id into r_s9_b1b;
  insert into registrations (student_id, section_id) values (s9, o2) returning id into r_s9_o2;
  res := res || E'\na class without rules: ok';

  -- Admins place anyone anywhere (spec 32 adds the logged override).
  perform set_config('request.jwt.claims', claims_adm, true);
  begin
    insert into registrations (student_id, section_id) values (snull, a2);
    -- An exception granted: a 6th grader placed in Rules Advanced by an admin.
    insert into registrations (student_id, section_id) values (s6x, a2) returning id into r_s6x;
    res := res || E'\nadmin places past the rules: ok';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nadmin places past the rules: refused (BAD: ' || m || ')';
  end;

  -- ── "Place with" edits (set_place_with) ──
  -- Default 14-day deadline: Week 2 is next week, so it has closed.
  perform set_config('request.jwt.claims', claims_p1, true);
  begin
    perform public.set_place_with(r_s6_o2, 'Seven');
    res := res || E'\nplace_with after the deadline: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nplace_with after the deadline: refused ' || case when m like 'Online changes for this class closed on%' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  execute 'reset role';
  insert into season_settings (year, change_deadline_days) values (yr, 0) on conflict (year) do update set change_deadline_days = 0;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_p1, true);
  perform public.set_place_with(r_s6_o2, '  Same room as Seven  ');
  select x.place_with into st from public.my_place_with() x where x.registration_id = r_s6_o2;
  res := res || E'\nplace_with set, trimmed: ' || case when st = 'Same room as Seven' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;
  begin
    perform public.set_place_with(r_s6_o2, repeat('x', 101));
    res := res || E'\nplace_with over 100 characters (RPC): ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nplace_with over 100 characters (RPC): refused ' || case when m = 'Keep it to 100 characters' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  update registrations set place_with = 'Direct' where id = r_s6_o2;
  get diagnostics n = row_count;
  res := res || E'\nparents can''t UPDATE registrations directly: ' || case when n = 0 then 'ok' else 'BAD (' || n || ' rows)' end;
  perform set_config('request.jwt.claims', claims_p2, true);
  begin
    perform public.set_place_with(r_s6_o2, 'Hacked');
    res := res || E'\nanother parent sets place_with: ALLOWED (BAD)';
  exception when others then res := res || E'\nanother parent sets place_with: refused ok'; end;
  perform set_config('request.jwt.claims', claims_p1, true);
  -- Only admins and the family read it: not a direct read, not another parent, not the crew.
  begin
    perform r2.place_with from registrations r2 where r2.id = r_s6_o2;
    res := res || E'\na parent reads place_with directly: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\na parent reads place_with directly: refused ok'; end;
  perform set_config('request.jwt.claims', claims_p2, true);
  select count(*) into n from public.my_place_with() x where x.registration_id = r_s6_o2;
  res := res || E'\nanother parent doesn''t get it from my_place_with: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  begin
    perform 1 from public.admin_place_with();
    res := res || E'\na parent calls admin_place_with: ALLOWED (BAD)';
  exception when others then res := res || E'\na parent calls admin_place_with: refused ok'; end;
  execute 'reset role';
  select s.lead_id into crew from sections s where s.lead_id is not null order by s.id limit 1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', crew, 'role', 'authenticated')::text, true);
  begin
    perform r2.place_with from registrations r2 limit 1;
    res := res || E'\na crew member reads place_with: ALLOWED (BAD)';
  exception when insufficient_privilege then res := res || E'\na crew member reads place_with: refused ok'; end;
  perform set_config('request.jwt.claims', claims_adm, true);
  select x.place_with into st from public.admin_place_with(o2) x where x.registration_id = r_s6_o2;
  res := res || E'\nadmins read it with admin_place_with: ' || case when st = 'Same room as Seven' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;
  perform set_config('request.jwt.claims', claims_p1, true);
  perform public.set_place_with(r_s6_o2, '   ');
  select x.place_with into st from public.my_place_with() x where x.registration_id = r_s6_o2;
  res := res || E'\nplace_with cleared with a blank: ' || case when st is null then 'ok' else 'BAD (' || st || ')' end;

  -- ── Swaps (deadline now 0 days) ──
  begin
    perform public.swap_my_registration(r_s6_o2, a2);
    res := res || E'\nswap into a class the grade doesn''t fit: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, h = pg_exception_hint;
    res := res || E'\nswap into a class the grade doesn''t fit: refused ' || case when m = 'Rules Advanced is for grades 7–8 this fall. Request an exception?' and h = 'course_rule' then 'ok' else '(BAD: ' || m || ' / ' || coalesce(h, '') || ')' end;
  end;
  begin
    perform public.swap_my_registration(r_spc_o2, a2);
    res := res || E'\nswap without the prerequisite: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, h = pg_exception_hint;
    res := res || E'\nswap without the prerequisite: refused ' || case when m = 'Rules Advanced needs Rules Basics first. Request an exception?' and h = 'course_rule' then 'ok' else '(BAD: ' || m || ' / ' || coalesce(h, '') || ')' end;
  end;
  begin
    perform public.swap_my_registration(r_s9_o2, a2);
    select (section_id = a2)::text into st from registrations where id = r_s9_o2;
    res := res || E'\nswap when the prerequisite is met: ' || case when st = 'true' then 'ok' else 'BAD' end;
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nswap when the prerequisite is met: refused (BAD: ' || m || ')';
  end;
  -- A camper in a class by an admin's exception can still move to another section of it.
  begin
    perform public.swap_my_registration(r_s6x, a2b);
    select (section_id = a2b)::text into st from registrations where id = r_s6x;
    res := res || E'\nan excepted camper switches to another section of the same class: ' || case when st = 'true' then 'ok' else 'BAD' end;
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nan excepted camper switches to another section of the same class: refused (BAD: ' || m || ')';
  end;
  select count(*) into n from public.my_swap_choices(r_s6x) c where c.section_id = a2 and c.blocked_reason is null and not c.rule_blocked;
  res := res || E'\n...and the list offers the other section: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  -- Nine now needs Rules Basics in Week 1 for Rules Advanced in Week 2.
  begin
    perform public.swap_my_registration(r_s9_b1b, o1);
    res := res || E'\nswap out of a prerequisite a later week needs: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text, h = pg_exception_hint;
    res := res || E'\nswap out of a prerequisite a later week needs: refused ' || case when m = 'Rules Advanced in Week 2 needs Rules Basics, so cancel that class first to switch.' and h is distinct from 'course_rule' then 'ok' else '(BAD: ' || m || ' / ' || coalesce(h, '') || ')' end;
  end;
  -- (Asked of the rule itself: during camp week 1 its change deadline has passed.)
  execute 'reset role';
  st := private.swap_block_reason(r_s9_b1b, b1c);
  res := res || E'\n...but another section of the same class is fine: ' || case when st is null then 'ok' else 'BAD (' || st || ')' end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_p1, true);

  -- The switch list: the class the grade doesn't fit is listed, greyed with its reason.
  select count(*) filter (where c.section_id = a2 and c.blocked_reason = 'Rules Advanced is for grades 7–8 this fall.' and c.rule_blocked)
       + count(*) filter (where c.section_id = b2 and c.blocked_reason is null and not c.rule_blocked) * 10
    into n from public.my_swap_choices(r_s6_o2) c;
  res := res || E'\nmy_swap_choices greys out the ruled-out class: ' || case when n = 11 then 'ok' else 'BAD (' || n || ')' end;
  select count(*) filter (where o.section_id = a2) + count(*) filter (where o.section_id = b2) * 10
    into n from public.my_swap_options(r_s6_o2) o;
  res := res || E'\nmy_swap_options (the older app''s list) leaves it out: ' || case when n = 10 then 'ok' else 'BAD (' || n || ')' end;

  -- ── Exception requests ──
  begin
    req := public.request_exception(s6, a2, '  Six took Basics at school.  ');
    select kind || '/' || (section_id = a2)::text || '/' || (student_id = s6)::text || '/' || message || '/' || status
      into st from change_requests where id = req;
    res := res || E'\nrequest an exception: ' || case when st = 'exception/true/true/Six took Basics at school./open' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nrequest an exception: refused (BAD: ' || m || ')';
  end;
  begin
    perform public.request_exception(s6, a2, 'Again');
    res := res || E'\na second open request for the same class: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\na second open request for the same class: refused ' || case when m = 'You already asked about this class. The camp will email you.' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  begin
    perform public.request_exception(s9, b2, 'Please');
    res := res || E'\nan exception for a class the camper can already take: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nan exception for a class the camper can already take: refused ' || case when m = 'Nine can sign up for that class without an exception.' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  begin
    perform public.request_exception(s7, a1, '   ');
    res := res || E'\nan exception with no message: ALLOWED (BAD)';
  exception when others then
    get stacked diagnostics m = message_text;
    res := res || E'\nan exception with no message: refused ' || case when m = 'Tell the camp why Seven is ready for this class' then 'ok' else '(BAD: ' || m || ')' end;
  end;
  perform set_config('request.jwt.claims', claims_p2, true);
  begin
    perform public.request_exception(s6, a1, 'Not my camper');
    res := res || E'\nan exception for someone else''s camper: ALLOWED (BAD)';
  exception when others then res := res || E'\nan exception for someone else''s camper: refused ok'; end;
  select count(*) into n from change_requests where kind = 'exception' and student_id = s6;
  res := res || E'\nanother parent can''t read the request: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', claims_adm, true);
  select count(*) into n from change_requests where kind = 'exception' and student_id = s6 and status = 'open';
  res := res || E'\nadmins see it in the open change requests: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  execute 'reset role';

  -- ── "Prerequisite at risk" ──
  -- Nine's Rules Basics spot (Week 1) is cancelled; Eight missed both arrival roll calls so far.
  update registrations set status = 'cancelled', cancel_reason = 'parent_cancel' where id = r_s9_b1b;
  insert into roll_call_marks (section_id, student_id, day, roll_call, present)
  values (b1b, s8, current_date - 2, 'arrival', false), (b1b, s8, current_date - 1, 'arrival', false),
         (b1b, s8, current_date - 1, 'dismissal', true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  select string_agg(x.camper_name || ':' || x.reason || ':' || x.missed_arrivals || ':' || x.required_class_name, ',' order by x.camper_name)
    into st from public.admin_prerequisite_at_risk() x
   where x.student_id in (s6, s7, s8, s9, snull, spast, spc);
  res := res || E'\nprerequisite at risk lists a cancelled prerequisite and an absent camper: ' || case when st = 'Rules Eight:absent:2:Rules Basics,Rules Nine:cancelled:0:Rules Basics' then 'ok' else 'BAD (' || coalesce(st, 'none') || ')' end;
  execute 'reset role';
  insert into roll_call_marks (section_id, student_id, day, roll_call, present) values (b1b, s8, current_date, 'arrival', true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', claims_adm, true);
  select count(*) into n from public.admin_prerequisite_at_risk() x where x.student_id = s8;
  res := res || E'\n...and drops the camper once they arrive: ' || case when n = 0 then 'ok' else 'BAD (' || n || ')' end;
  perform set_config('request.jwt.claims', claims_p1, true);
  begin
    perform 1 from public.admin_prerequisite_at_risk();
    res := res || E'\nparents read the at-risk list: ALLOWED (BAD)';
  exception when others then res := res || E'\nparents read the at-risk list: refused ok'; end;
  execute 'reset role';

  -- ── The public camp page and the migrated rule ──
  select c into j from jsonb_array_elements(public.public_camp_info() -> 'courses') c where c ->> 'name' = 'Rules Advanced';
  res := res || E'\npublic_camp_info carries the rules: ' || case when j -> 'grades_allowed' = '["7th", "8th"]'::jsonb and j ->> 'requires' = 'Rules Basics' then 'ok' else 'BAD (' || coalesce(j::text, 'missing') || ')' end;
  select string_agg(private.grade_words(v.g::text[]), ' | ' order by v.i) into st
    from (values (1, '{7th,8th,9th}'), (2, '{7th}'), (3, '{4th,6th,8th}'), (4, '{9th,7th,8th}'), (5, '{K,1st}')) v(i, g);
  res := res || E'\ngrade_words: ' || case when st = 'grades 7–9 | grade 7 | grades 4, 6 and 8 | grades 7–9 | grades K and 1st' then 'ok' else 'BAD (' || st || ')' end;
  select count(*) into n from classes where name = 'Microcontrollers' and grades_allowed = '{7th,8th,9th}';
  res := res || E'\nMicrocontrollers is grades 7–9 in the database: ' || case when n >= 1 then 'ok' else 'BAD (' || n || ')' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

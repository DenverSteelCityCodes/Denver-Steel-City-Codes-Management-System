-- Tests for migration_volunteer_self_service.sql (spec 25). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- Admin sessions carry 'aal': 'aal2' so this also runs where admin MFA (spec 27) is required.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  lead_v uuid; other_v uuid; sec record; spare uuid; empty_sec uuid;
  res text := ''; n int; st text; lvl text; w2 date; parents int;
begin
  -- A lead of a Week 2 section with campers, and another volunteer.
  select s.id, s.lead_id, s.week into sec from sections s
   where s.week = 2 and s.lead_id is not null
     and exists (select 1 from registrations r where r.section_id = s.id and r.status = 'confirmed') limit 1;
  lead_v := sec.lead_id;
  select id into other_v from volunteers where id <> lead_v limit 1;
  select start_date into w2 from sessions where is_active order by start_date offset 1 limit 1;
  select experience_level::text into lvl from volunteers where id = lead_v;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', lead_v, 'role', 'authenticated')::text, true);

  -- Preferences: own availability and course choices; never the experience level.
  perform public.update_my_volunteer_prefs(false, true, 'Intro to Java', 'Web Development');
  select availability_week_1::text || '/' || availability_week_2::text || '/' || course_first_choice into st from public.my_volunteer_prefs();
  res := res || E'\nvolunteer updates own preferences: ' || case when st = 'false/true/Intro to Java' then 'ok' else 'BAD (' || coalesce(st, 'null') || ')' end;
  begin
    perform public.update_my_volunteer_prefs(false, false, null, null);
    res := res || E'\nno weeks at all: ALLOWED (BAD)';
  exception when others then res := res || E'\nno weeks at all: refused ok'; end;
  update volunteers set experience_level = case when lvl = 'senior' then 'junior' else 'senior' end::experience_level where id = lead_v;
  get diagnostics n = row_count;
  res := res || E'\nvolunteer changes own experience level: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;
  update volunteers set availability_week_1 = false where id = other_v;
  get diagnostics n = row_count;
  res := res || E'\nvolunteer edits another volunteer: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;

  -- Switch request → the admin queue.
  perform public.request_change(null, 'crew_switch', 'Could I move to the afternoon Java section?');
  select count(*) into n from change_requests where requested_by = lead_v and kind = 'crew_switch' and status = 'open';
  res := res || E'\nswitch request lands in the admin queue: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;

  -- "I can't make it": own, future dates only.
  insert into crew_absences (volunteer_id, from_date, to_date, note) values (lead_v, w2, w2 + 1, 'Dentist');
  res := res || E'\nvolunteer reports an absence: ok';
  begin
    insert into crew_absences (volunteer_id, from_date, to_date) values (other_v, w2, w2);
    res := res || E'\nabsence for someone else: ALLOWED (BAD)';
  exception when others then res := res || E'\nabsence for someone else: refused ok'; end;
  begin
    insert into crew_absences (volunteer_id, from_date, to_date) values (lead_v, current_date - 10, current_date - 9);
    res := res || E'\nabsence in the past: ALLOWED (BAD)';
  exception when others then res := res || E'\nabsence in the past: refused ok'; end;
  begin
    perform public.admin_crew_absences();
    res := res || E'\nvolunteer reads the admin absence list: ALLOWED (BAD)';
  exception when others then res := res || E'\nvolunteer reads the admin absence list: refused ok'; end;

  -- Admin sees the gap, with suggested cover.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*), max(cardinality(suggestions)) into n, parents from public.admin_crew_absences() where section_id = sec.id and is_lead;
  res := res || E'\nadmin sees the lead''s absence on that section: ' || case when n = 1 then 'ok' else 'BAD (' || n || ')' end;
  res := res || E'\n...with suggested cover: ' || case when parents > 0 then 'ok (' || parents || ')' else 'BAD (none)' end;

  -- Replacing the lead emails each family in the section once; a first assignment doesn't.
  select v.id into spare from volunteers v
   where v.id <> lead_v and not exists (select 1 from sections s where s.lead_id = v.id) limit 1;
  update sections set lead_id = spare where id = sec.id;
  select count(distinct st2.parent_id) into parents from registrations r join students st2 on st2.id = r.student_id
   where r.section_id = sec.id and r.status in ('confirmed', 'pending', 'offered');
  select count(*) into n from notifications where template = 'new_lead';
  res := res || E'\nnew lead: one email per family: ' || case when n = parents and n > 0 then 'ok (' || n || ')' else 'BAD (' || n || ' for ' || parents || ')' end;
  insert into sections (class_id, label, week, age_min, age_max, capacity) select class_id, 'TMP', 2, 5, 17, 5 from sections where id = sec.id returning id into empty_sec;
  update sections set lead_id = lead_v where id = empty_sec;
  select count(*) into n from notifications where template = 'new_lead';
  res := res || E'\nfirst lead assignment sends nothing: ' || case when n = parents then 'ok' else 'BAD' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

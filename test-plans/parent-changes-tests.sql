-- Tests for migration_parent_changes.sql (spec 11). Run against the demo DB after
-- private.reset_demo(). The block raises its results at the end, so every test write rolls back.
-- In the demo, Week 1 is this week and Week 2 next week, so the 14-day deadline has passed for
-- both; the test sets the deadline to 0 days to exercise the "before the deadline" path.
do $$
declare
  admin_id uuid := (select id from profiles where display_name='Jordan Rivera');
  yr int := (select max(year) from sessions where is_active);
  w2 record; other_parent uuid; wl record; res text := ''; st text; req uuid; n int;
begin
  -- A confirmed Week 2 seat, and its parent.
  select r.id, st2.parent_id into w2 from registrations r join sections s on s.id=r.section_id join students st2 on st2.id=r.student_id
   where r.status='confirmed' and s.week=2 limit 1;
  select p.id into other_parent from profiles p where p.role='parent' and p.id <> w2.parent_id limit 1;
  select r.id, st2.parent_id into wl from registrations r join students st2 on st2.id=r.student_id where r.status='waitlisted' limit 1;

  -- Default 14 days: the seat can't be cancelled online any more.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', w2.parent_id, 'role', 'authenticated')::text, true);
  begin
    perform public.cancel_my_registration(w2.id);
    res := res || E'\ncancel after the deadline: ALLOWED (BAD)';
  exception when others then res := res || E'\ncancel after the deadline: refused ' || case when sqlerrm like 'Online changes for this class closed on%' then 'ok' else '(BAD: ' || sqlerrm || ')' end; end;
  execute 'reset role';

  -- Deadline 0 days: next week's seat can be cancelled; another parent can't touch it.
  insert into season_settings (year, change_deadline_days) values (yr, 0) on conflict (year) do update set change_deadline_days = 0;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', other_parent, 'role', 'authenticated')::text, true);
  begin
    perform public.cancel_my_registration(w2.id);
    res := res || E'\nanother parent cancels it: ALLOWED (BAD)';
  exception when others then res := res || E'\nanother parent cancels it: refused ok'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', w2.parent_id, 'role', 'authenticated')::text, true);
  perform public.cancel_my_registration(w2.id);
  execute 'reset role';
  select status::text || '/' || coalesce(cancel_reason,'') into st from registrations where id = w2.id;
  res := res || E'\nown cancel before the deadline: ' || case when st='cancelled/parent_cancel' then 'ok' else 'BAD (' || st || ')' end;

  -- Leaving a waitlist is allowed any time (back to 14 days).
  update season_settings set change_deadline_days = 14 where year = yr;
  if wl.id is not null then
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', wl.parent_id, 'role', 'authenticated')::text, true);
    perform public.cancel_my_registration(wl.id);
    execute 'reset role';
    select status::text into st from registrations where id = wl.id;
    res := res || E'\nleave the waitlist after the deadline: ' || case when st='cancelled' then 'ok' else 'BAD' end;
  end if;

  -- Change request: created, no duplicate while open, admin resolves → stamped + family emailed.
  select r.id, st2.parent_id into w2 from registrations r join sections s on s.id=r.section_id join students st2 on st2.id=r.student_id
   where r.status='confirmed' and s.week=1 limit 1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', w2.parent_id, 'role', 'authenticated')::text, true);
  req := public.request_change(w2.id, 'other', 'Please move her to the afternoon class');
  begin
    perform public.request_change(w2.id, 'other', 'again');
    res := res || E'\nsecond open request for the same spot: ALLOWED (BAD)';
  exception when others then res := res || E'\nsecond open request for the same spot: refused ok'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  update change_requests set status = 'done', resolution_note = 'Moved to PY-B' where id = req;
  execute 'reset role';
  select count(*) into n from change_requests where id = req and resolved_by = admin_id and resolved_at is not null;
  res := res || E'\nadmin resolution is stamped: ' || case when n=1 then 'ok' else 'BAD' end;
  select count(*) into n from notifications where template = 'change_request_resolved';
  res := res || E'\nfamily is emailed the resolution: ' || case when n=1 then 'ok (queued or skipped for example.com)' else 'BAD (' || n || ')' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

-- Tests for migration_current_season_audiences.sql (#145: past-season families in "parents" and
-- "everyone"). Run against the demo DB after private.reset_demo(). The block raises its results at
-- the end, so every test write rolls back. Before the migration several lines print BAD.
-- The demo seeds one season, so the test moves one family's registrations to last year.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  admin_claims text;
  past_parent uuid; past_email text; cur_parent uuid; cur_email text; yr int;
  res text := ''; n int; arr text[];
begin
  admin_claims := json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text;
  yr := coalesce((select max(year) from sessions where is_active), extract(year from now())::int);

  -- Two families with seats this season; one of them becomes a last-season-only family.
  select st.parent_id into past_parent from students st join registrations r on r.student_id = st.id
   where r.status = 'confirmed' group by st.parent_id order by st.parent_id limit 1;
  select st.parent_id into cur_parent from students st join registrations r on r.student_id = st.id
   where r.status = 'confirmed' and st.parent_id <> past_parent group by st.parent_id order by st.parent_id limit 1;
  update registrations set year = yr - 1
   where student_id in (select id from students where parent_id = past_parent);
  select lower(coalesce(pp.email, u.email)) into past_email from auth.users u
    left join parent_profiles pp on pp.id = u.id where u.id = past_parent;
  select lower(coalesce(pp.email, u.email)) into cur_email from auth.users u
    left join parent_profiles pp on pp.id = u.id where u.id = cur_parent;
  insert into updates (author_id, author_name, audience, body) values (admin_id, 'Test', 'parents', '[TEST] parents only');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', admin_claims, true);
  arr := public.update_recipient_emails('parents');
  res := res || E'\nthis season''s family on the parents list: ' || case when cur_email = any(arr) then 'ok' else 'BAD (missing)' end;
  res := res || E'\nlast season''s family off the parents list: ' || case when past_email = any(arr) then 'BAD (still listed)' else 'ok' end;
  arr := public.update_recipient_emails('everyone');
  res := res || E'\nlast season''s family off the everyone list: ' || case when past_email = any(arr) then 'BAD (still listed)' else 'ok' end;

  perform set_config('request.jwt.claims', json_build_object('sub', cur_parent, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where audience = 'parents';
  res := res || E'\nthis season''s family reads parent updates: ' || case when n > 0 then 'ok' else 'BAD' end;
  select count(*) into n from schedule_items;
  res := res || E'\nthis season''s family reads the camp schedule: ' || case when n > 0 then 'ok' else 'BAD' end;

  perform set_config('request.jwt.claims', json_build_object('sub', past_parent, 'role', 'authenticated')::text, true);
  select count(*) into n from updates where audience = 'parents';
  res := res || E'\nlast season''s family reads parent updates: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
  select count(*) into n from schedule_items;
  res := res || E'\nlast season''s family reads the camp schedule: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

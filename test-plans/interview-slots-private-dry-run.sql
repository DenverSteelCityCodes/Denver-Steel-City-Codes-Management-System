-- Dry run for #144: applies migration_interview_slots_private.sql, then runs its tests. Paste into the
-- Supabase SQL editor (demo project). The test block raises 'RESULTS ...' at the end, which rolls
-- back everything, including the migration. Every line should say ok.
-- Migration: interview slots are admin-only to read (fix #144)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_security_hardening.sql and migration_interview_self_booking.sql.
--
-- Bug: "read_interview_slots" (migration_security_hardening.sql §8) let every signed-in parent and
-- volunteer select all of interview_slots, including the free-text `notes` column, the natural
-- place for an admin to paste a meeting link or passcode. Nobody but admins needs the table:
-- applicants list open times with open_interview_slots(), see their own with my_interview() and
-- book with book_my_interview(), all SECURITY DEFINER and returning only id, time and duration.
-- Fix: drop the blanket read policy; "admin_all_interview_slots" keeps admins' full access.
-- Meeting links get their own admin-only table in spec 35.

DROP POLICY IF EXISTS "read_interview_slots" ON interview_slots;

-- Tests for migration_interview_slots_private.sql (#144: interview slots readable by every
-- signed-in user). Run against the demo DB after private.reset_demo(). The block raises its results
-- at the end, so every test write rolls back. Before the migration the parent and volunteer lines
-- print BAD; after it, all say ok.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  parent_id uuid := (select st.parent_id from students st limit 1);
  vol_id uuid := (select id from volunteers limit 1);
  applicant_id uuid := (select user_id from volunteer_applications where status = 'pending' and user_id is not null limit 1);
  slot uuid;
  res text := ''; n int;
begin
  insert into interview_slots (slot_datetime, duration_minutes, notes)
    values (now() + interval '3 days', 15, '[TEST] meet.example/secret-room passcode 1234') returning id into slot;
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub', parent_id, 'role', 'authenticated')::text, true);
  select count(*) into n from interview_slots;
  res := res || E'\nparent reads interview slots: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;

  perform set_config('request.jwt.claims', json_build_object('sub', vol_id, 'role', 'authenticated')::text, true);
  select count(*) into n from interview_slots where notes like '[TEST]%';
  res := res || E'\nvolunteer reads slot notes: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD)' end;

  if applicant_id is null then
    res := res || E'\napplicant lists open times: skipped (no pending applicant with an account)';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', applicant_id, 'role', 'authenticated')::text, true);
    select count(*) into n from interview_slots;
    res := res || E'\napplicant reads the table directly: ' || case when n = 0 then 'blocked ok' else 'ALLOWED (BAD, ' || n || ')' end;
    select count(*) into n from public.open_interview_slots() where id = slot;
    res := res || E'\napplicant still lists open times (RPC): ' || case when n = 1 then 'ok' else 'BAD' end;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from interview_slots where id = slot and notes like '[TEST]%';
  res := res || E'\nadmin reads slots with notes: ' || case when n = 1 then 'ok' else 'BAD' end;
  execute 'reset role';

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

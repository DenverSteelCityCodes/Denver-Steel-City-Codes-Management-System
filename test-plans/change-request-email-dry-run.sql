-- Dry run for #146: applies migration_change_request_email_kind.sql, then runs its tests. Paste into
-- the Supabase SQL editor (demo project). The test raises 'RESULTS ...' at the end, rolling back everything.
-- Migration: change-request emails know who asked (fix #146)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_parent_changes.sql.
--
-- Bug: resolving any change request enqueued the parent-worded change_request_resolved email,
-- linking to /parent, including volunteers' crew_switch requests (spec 25). The payload now
-- carries the request kind, and the template (send-notifications/templates.ts) writes a volunteer
-- version that links to /volunteer.

CREATE OR REPLACE FUNCTION private.notify_change_request_resolved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.status IN ('done', 'declined') AND OLD.status = 'open' THEN
    PERFORM private.enqueue_notification(NEW.requested_by, 'change_request_resolved',
      jsonb_build_object('status', NEW.status, 'note', NEW.resolution_note, 'message', NEW.message,
                         'kind', NEW.kind,
                         'camper', (SELECT coalesce(nullif(first_name, ''), split_part(full_name, ' ', 1)) FROM students WHERE id = NEW.student_id)),
      'change_request_resolved:' || NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.notify_change_request_resolved() FROM PUBLIC, anon, authenticated;

-- Tests for migration_change_request_email_kind.sql (#146: crew-switch emails used parent
-- wording). Run against the demo DB after private.reset_demo(). The block raises its results at the
-- end, so every test write rolls back. Before the migration the "kind" lines print BAD.
do $$
declare
  admin_id uuid := (select id from profiles where display_name = 'Jordan Rivera');
  vol_id uuid := (select v.id from volunteers v join profiles p on p.id = v.id where p.role = 'volunteer' limit 1);
  parent_id uuid; reg uuid; vreq uuid; preq uuid;
  res text := ''; k text;
begin
  select st.parent_id, r.id into parent_id, reg from registrations r join students st on st.id = r.student_id
   where r.status = 'confirmed'
     and not exists (select 1 from change_requests c where c.registration_id = r.id and c.status = 'open') limit 1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', vol_id, 'role', 'authenticated')::text, true);
  vreq := public.request_change(null, 'crew_switch', '[TEST] afternoon section please');
  perform set_config('request.jwt.claims', json_build_object('sub', parent_id, 'role', 'authenticated')::text, true);
  preq := public.request_change(reg, 'other', '[TEST] can we switch class?');

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  update change_requests set status = 'done', resolution_note = '[TEST] done' where id in (vreq, preq);
  execute 'reset role';

  select payload->>'kind' into k from notifications where dedupe_key = 'change_request_resolved:' || vreq;
  res := res || E'\ncrew switch email carries kind crew_switch: ' || case when k = 'crew_switch' then 'ok' else 'BAD (' || coalesce(k, 'missing') || ')' end;
  select payload->>'kind' into k from notifications where dedupe_key = 'change_request_resolved:' || preq;
  res := res || E'\nparent request email carries its kind: ' || case when k = 'other' then 'ok' else 'BAD (' || coalesce(k, 'missing') || ')' end;
  select count(*)::text into k from notifications where dedupe_key in ('change_request_resolved:' || vreq, 'change_request_resolved:' || preq);
  res := res || E'\none email per resolved request: ' || case when k = '2' then 'ok' else 'BAD (' || k || ')' end;

  raise exception 'RESULTS (all rolled back):%', res;
end $$;

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

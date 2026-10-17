-- Migration: parents cancel their own spots before the deadline; change requests (spec 11, #80)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_season_settings.sql, migration_soft_cancel.sql, migration_audit_log.sql
-- and migration_notifications.sql.
--
-- Decided 2026-10-16 (Q-W1): parents can cancel (and, with spec 12, switch) until
-- change_deadline_days (14) before the session starts; after that they send a change request.
-- Leaving a waitlist is allowed any time. Parents still have no direct UPDATE on registrations:
-- everything goes through these functions, which check ownership and the deadline.

-- ── 1. When does a registration's change window close? ────────
-- Session start minus the season's change_deadline_days. A both-weeks section (no session) uses
-- the earliest session of its year.
CREATE OR REPLACE FUNCTION private.registration_change_deadline(p_registration_id UUID)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT ((coalesce(se.start_date,
                    (SELECT min(s2.start_date) FROM sessions s2 WHERE s2.year = r.year))
          - (private.season_settings_for(r.year)).change_deadline_days)::timestamp
          AT TIME ZONE 'America/Denver')
  FROM registrations r
  JOIN sections s ON s.id = r.section_id
  LEFT JOIN sessions se ON se.id = s.session_id
  WHERE r.id = p_registration_id;
$$;
REVOKE ALL ON FUNCTION private.registration_change_deadline(UUID) FROM PUBLIC, anon, authenticated;

-- Parents (and the UI) can ask for the deadline of their own registrations.
CREATE OR REPLACE FUNCTION public.my_change_deadlines()
RETURNS TABLE (registration_id UUID, deadline TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT r.id, private.registration_change_deadline(r.id)
  FROM registrations r JOIN students st ON st.id = r.student_id
  WHERE st.parent_id = auth.uid() AND r.status <> 'cancelled';
$$;
REVOKE ALL ON FUNCTION public.my_change_deadlines() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_change_deadlines() TO authenticated;

-- ── 2. Cancel my spot ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_my_registration(p_registration_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg      registrations%ROWTYPE;
  deadline TIMESTAMPTZ;
BEGIN
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND st.parent_id = auth.uid()
   FOR UPDATE OF r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501';
  END IF;
  IF reg.status = 'cancelled' THEN
    RAISE EXCEPTION 'That spot is already cancelled' USING ERRCODE = 'P0001';
  END IF;
  -- A held seat follows the deadline; leaving a waitlist (or declining an offer) never does.
  IF reg.status::text IN ('confirmed', 'pending') THEN
    deadline := private.registration_change_deadline(reg.id);
    IF deadline IS NOT NULL AND now() >= deadline THEN
      RAISE EXCEPTION 'Online changes for this class closed on %. Use "Request a change" and the camp will help.',
        trim(to_char(deadline AT TIME ZONE 'America/Denver', 'FMMonth FMDD')) USING ERRCODE = 'P0001';
    END IF;
  END IF;
  PERFORM private.set_reason('parent_cancel');
  UPDATE registrations SET status = 'cancelled', cancel_reason = 'parent_cancel' WHERE id = reg.id;
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_my_registration(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_registration(UUID) TO authenticated;

-- ── 3. Change requests (after the deadline, or anything else) ─
CREATE TABLE IF NOT EXISTS change_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id  UUID REFERENCES registrations(id) ON DELETE SET NULL,
    student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
    requested_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL CHECK (kind IN ('cancel', 'swap', 'other', 'crew_switch', 'deletion')),
    message          TEXT CHECK (length(message) <= 1000),
    status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'declined')),
    resolution_note  TEXT CHECK (length(resolution_note) <= 1000),
    resolved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS change_requests_open_idx ON change_requests (created_at) WHERE status = 'open';

ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_change_requests" ON change_requests;
DROP POLICY IF EXISTS "own_read_change_requests"  ON change_requests;
CREATE POLICY "admin_all_change_requests" ON change_requests FOR ALL
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "own_read_change_requests" ON change_requests FOR SELECT TO authenticated
    USING (requested_by = auth.uid());
GRANT SELECT, INSERT, UPDATE ON change_requests TO authenticated;   -- writes: admins via RLS, parents via the RPC

DROP TRIGGER IF EXISTS touch_updated_at ON change_requests;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON change_requests
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
DROP TRIGGER IF EXISTS audit_log_change ON change_requests;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON change_requests
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');

CREATE OR REPLACE FUNCTION public.request_change(p_registration_id UUID, p_kind TEXT, p_message TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  stu UUID;
  new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF p_registration_id IS NOT NULL THEN
    SELECT r.student_id INTO stu FROM registrations r JOIN students st ON st.id = r.student_id
     WHERE r.id = p_registration_id AND st.parent_id = auth.uid();
    IF stu IS NULL THEN RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501'; END IF;
    IF EXISTS (SELECT 1 FROM change_requests WHERE registration_id = p_registration_id AND status = 'open') THEN
      RAISE EXCEPTION 'You already have an open request for this spot. The camp will get back to you.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF coalesce(trim(p_message), '') = '' THEN
    RAISE EXCEPTION 'Tell the camp what you''d like to change' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO change_requests (registration_id, student_id, requested_by, kind, message)
  VALUES (p_registration_id, stu, auth.uid(), coalesce(p_kind, 'other'), left(trim(p_message), 1000))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_change(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_change(UUID, TEXT, TEXT) TO authenticated;

-- Email the family when an admin resolves their request.
CREATE OR REPLACE FUNCTION private.notify_change_request_resolved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.status IN ('done', 'declined') AND OLD.status = 'open' THEN
    PERFORM private.enqueue_notification(NEW.requested_by, 'change_request_resolved',
      jsonb_build_object('status', NEW.status, 'note', NEW.resolution_note, 'message', NEW.message,
                         'camper', (SELECT coalesce(nullif(first_name, ''), split_part(full_name, ' ', 1)) FROM students WHERE id = NEW.student_id)),
      'change_request_resolved:' || NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.notify_change_request_resolved() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_change_request_resolved ON change_requests;
CREATE TRIGGER notify_change_request_resolved AFTER UPDATE OF status ON change_requests
    FOR EACH ROW EXECUTE FUNCTION private.notify_change_request_resolved();

-- Stamp who resolved it and when.
CREATE OR REPLACE FUNCTION private.change_requests_stamp_resolution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'open' AND OLD.status = 'open' THEN
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.change_requests_stamp_resolution() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS change_requests_stamp_resolution ON change_requests;
CREATE TRIGGER change_requests_stamp_resolution BEFORE UPDATE OF status ON change_requests
    FOR EACH ROW EXECUTE FUNCTION private.change_requests_stamp_resolution();

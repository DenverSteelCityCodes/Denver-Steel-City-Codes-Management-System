-- Migration: urgent notices, week audiences, the incident log and roll-call notes (spec 34, #154)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_current_season_audiences.sql, migration_notifications.sql and
-- migration_audit_log.sql (step 35 in docs/database.md). Deploy send-notifications first: it
-- knows the two new templates (urgent_notice, incident_notice) and sends urgent rows through the
-- provider's batch endpoint. A sender deployed before this file still works (it skips the urgent
-- claim it can't find); a sender older than this file holds the new templates for 6 hours.
--
--   1. Updates get two audiences, "Families in week N" and "Crew in week N" (updates.session_id),
--      and an `urgent` flag. Only admins post either; a lead still posts to their own section.
--   2. An urgent update is a safety notice: posting one queues an `urgent_notice` email for every
--      person in its audience at once (one per address, ignoring the announcements opt-out) at
--      priority 1. The sender claims priority rows first and in bulk, so ~300 families get it
--      within two minutes. The dashboards show it as a banner until the end of that day.
--   3. incidents: crew log what happened in their own section and read only their own entries;
--      admins read and update every entry. Audited. created_at and parent_notified_at are
--      server-owned (trigger). notify_incident_parent() emails the camper's parent (incident_notice)
--      and stamps parent_notified_at, only when the email could be queued. Admins see an attention item for
--      an incident with a camper and no parent notice after 24 hours (client side).
--   4. set_roll_call_note(): the crew's quick tags (Late, Left early, Picked up by …) on a mark.
--
-- Week membership: a section runs in a session when it is tied to it (sections.session_id), or
-- runs both weeks (no week) and has a camper with a seat in that session's year. A family is in the week when a camper holds a seat
-- (confirmed/pending) in one of those sections in that session's year, so every family audience
-- stays inside the season (#145).

-- ── 1. Updates: week audiences and the urgent flag ───────────

ALTER TABLE updates ADD COLUMN IF NOT EXISTS urgent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE updates ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS updates_session_idx ON updates (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS updates_urgent_idx ON updates (created_at DESC) WHERE urgent;

ALTER TABLE updates DROP CONSTRAINT IF EXISTS updates_audience_check;
ALTER TABLE updates ADD CONSTRAINT updates_audience_check
    CHECK (audience IN ('everyone', 'parents', 'volunteers', 'section', 'week_families', 'week_crew'));
ALTER TABLE updates DROP CONSTRAINT IF EXISTS updates_session_check;
ALTER TABLE updates ADD CONSTRAINT updates_session_check
    CHECK ((audience IN ('week_families', 'week_crew')) = (session_id IS NOT NULL));

-- Sections that run in a session (see the header). A both-weeks section has no session, so it
-- counts only when a camper holds a seat in it in that session's year: an old both-weeks section
-- (and its crew) from a past season stays out.
CREATE OR REPLACE FUNCTION private.week_section_ids(p_session_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM sections s JOIN sessions se ON se.id = p_session_id
  WHERE s.cancelled_at IS NULL
    AND (s.session_id = se.id
         OR (s.week IS NULL AND EXISTS (
               SELECT 1 FROM registrations r
               WHERE r.section_id = s.id AND r.status IN ('confirmed', 'pending') AND r.year = se.year)));
$$;
REVOKE ALL ON FUNCTION private.week_section_ids(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.week_section_ids(UUID) TO authenticated;

-- Does the caller have a camper with a seat in this week? / Is the caller crew in this week?
CREATE OR REPLACE FUNCTION private.auth_week_parent(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1 FROM registrations r
    JOIN students st ON st.id = r.student_id
    JOIN sessions se ON se.id = p_session_id
    WHERE st.parent_id = auth.uid() AND r.status IN ('confirmed', 'pending') AND r.year = se.year
      AND r.section_id IN (SELECT private.week_section_ids(p_session_id)));
$$;
CREATE OR REPLACE FUNCTION private.auth_week_crew(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.auth_is_volunteer() AND EXISTS (
    SELECT 1 FROM sections s
    WHERE s.id IN (SELECT private.week_section_ids(p_session_id))
      AND (s.lead_id = auth.uid()
           OR EXISTS (SELECT 1 FROM section_supports ss WHERE ss.section_id = s.id AND ss.volunteer_id = auth.uid())));
$$;
REVOKE ALL ON FUNCTION private.auth_week_parent(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.auth_week_crew(UUID)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_week_parent(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.auth_week_crew(UUID)   TO authenticated;

-- Who an update reaches, as profiles (callers take DISTINCT: "everyone" can list a parent who
-- also volunteers twice). Same rules as update_recipient_emails() for
-- the four older audiences: "parents" and "everyone" mean this season's families (#145),
-- "volunteers" means people whose role is volunteer now (#143), a section means its families.
-- No permission check: callers are the urgent trigger and the RPCs below, which check first.
CREATE OR REPLACE FUNCTION private.update_audience_profiles(p_audience TEXT, p_section_id UUID, p_session_id UUID)
RETURNS TABLE (profile_id UUID) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF p_audience IN ('parents', 'everyone') THEN
    RETURN QUERY
      SELECT DISTINCT st.parent_id FROM students st JOIN registrations r ON r.student_id = st.id
      WHERE r.status IN ('confirmed', 'pending') AND r.year >= private.current_camp_year() AND st.parent_id IS NOT NULL;
  END IF;
  IF p_audience IN ('volunteers', 'everyone') THEN
    RETURN QUERY
      SELECT v.id FROM volunteers v JOIN profiles p ON p.id = v.id AND p.role = 'volunteer';
  END IF;
  IF p_audience = 'section' THEN
    RETURN QUERY
      SELECT DISTINCT st.parent_id FROM registrations r JOIN students st ON st.id = r.student_id
      WHERE r.section_id = p_section_id AND r.status IN ('confirmed', 'pending') AND st.parent_id IS NOT NULL;
  END IF;
  IF p_audience = 'week_families' THEN
    RETURN QUERY
      SELECT DISTINCT st.parent_id FROM registrations r
      JOIN students st ON st.id = r.student_id
      JOIN sessions se ON se.id = p_session_id
      WHERE r.status IN ('confirmed', 'pending') AND r.year = se.year AND st.parent_id IS NOT NULL
        AND r.section_id IN (SELECT private.week_section_ids(p_session_id));
  END IF;
  IF p_audience = 'week_crew' THEN
    RETURN QUERY
      SELECT DISTINCT c.id FROM (
        SELECT s.lead_id AS id FROM sections s WHERE s.id IN (SELECT private.week_section_ids(p_session_id))
        UNION
        SELECT ss.volunteer_id FROM section_supports ss WHERE ss.section_id IN (SELECT private.week_section_ids(p_session_id))
      ) c JOIN profiles p ON p.id = c.id AND p.role = 'volunteer';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.update_audience_profiles(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Readers: the week audiences join the existing rules. A week's crew also read what that week's
-- families were told (as a section's crew read their section's posts).
DROP POLICY IF EXISTS "read_my_updates" ON updates;
CREATE POLICY "read_my_updates" ON updates FOR SELECT TO authenticated
    USING (
        (audience = 'everyone'      AND (private.auth_is_active_parent() OR private.auth_is_volunteer()))
        OR (audience = 'parents'    AND private.auth_is_active_parent())
        OR (audience = 'volunteers' AND private.auth_is_volunteer())
        OR (audience = 'section'    AND (private.auth_volunteer_has_section(section_id)
                                         OR private.auth_parent_has_section(section_id)))
        OR (audience = 'week_families' AND (private.auth_week_parent(session_id) OR private.auth_week_crew(session_id)))
        OR (audience = 'week_crew'     AND private.auth_week_crew(session_id))
    );

-- A lead posts ordinary updates to their own section; urgent notices are the camp's (admins).
DROP POLICY IF EXISTS "lead_post_to_section" ON updates;
CREATE POLICY "lead_post_to_section" ON updates FOR INSERT TO authenticated
    WITH CHECK (audience = 'section' AND NOT urgent AND private.auth_volunteer_leads_section(section_id));

-- Addresses for a week audience, for "Also email" and "Copy emails" (admins only). The four older
-- audiences keep update_recipient_emails().
CREATE OR REPLACE FUNCTION public.week_recipient_emails(p_audience TEXT, p_session_id UUID)
RETURNS TEXT[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF NOT coalesce(private.auth_user_role() = 'admin', false) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_audience NOT IN ('week_families', 'week_crew') OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'Pick a week' USING ERRCODE = 'P0001';
  END IF;
  RETURN ARRAY(
    SELECT DISTINCT lower(coalesce(nullif(trim(pp.email), ''), u.email))
    FROM private.update_audience_profiles(p_audience, NULL, p_session_id) a
    JOIN auth.users u ON u.id = a.profile_id
    LEFT JOIN parent_profiles pp ON pp.id = a.profile_id
    WHERE coalesce(nullif(trim(pp.email), ''), u.email) IS NOT NULL
    ORDER BY 1);
END;
$$;
REVOKE ALL ON FUNCTION public.week_recipient_emails(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.week_recipient_emails(TEXT, UUID) TO authenticated;

-- ── 2. Urgent notices go out first ────────────────────────────

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS notifications_priority_due_idx ON notifications (priority DESC, created_at)
    WHERE status IN ('queued', 'failed');
-- The provider batch an urgent row was last sent in, set just before the call. If the answer never
-- came (timeout, 5xx, or the run died), the rows keep it and go out again together under the same
-- Idempotency-Key, so the provider can't deliver them twice.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS batch_key TEXT;
CREATE INDEX IF NOT EXISTS notifications_batch_key_idx ON notifications (batch_key) WHERE batch_key IS NOT NULL;

-- The ordinary claim now takes the highest priority first, then the oldest. Rows of an unfinished
-- batch are left to the urgent claim, which keeps them together. Both claims stamp
-- next_attempt_at with the claim time, so private.requeue_stuck_notifications() (every minute)
-- puts a row back only when the run that claimed it died 15 minutes ago, never while a slow run
-- is still sending a backlog that was due long before.
CREATE OR REPLACE FUNCTION public.claim_notifications(p_limit INT DEFAULT 50)
RETURNS SETOF notifications LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications n
     SET status = 'sending', attempts = n.attempts + 1, next_attempt_at = now()
   WHERE n.id IN (SELECT id FROM notifications
                   WHERE status IN ('queued', 'failed') AND attempts < 3 AND next_attempt_at <= now()
                     AND batch_key IS NULL
                   ORDER BY priority DESC, created_at
                   LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
                   FOR UPDATE SKIP LOCKED)
  RETURNING n.*;
$$;
REVOKE ALL ON FUNCTION public.claim_notifications(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications(INT) TO service_role;

-- Urgent rows only, in bulk: the sender sends these through the provider's batch endpoint
-- (100 per call), so a whole week's families go out in one run. A row that was in a batch with an
-- unknown outcome brings the rest of that batch with it.
CREATE OR REPLACE FUNCTION public.claim_urgent_notifications(p_limit INT DEFAULT 300)
RETURNS SETOF notifications LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH picked AS (
    SELECT id, batch_key FROM notifications
     WHERE priority > 0 AND status IN ('queued', 'failed') AND attempts < 3 AND next_attempt_at <= now()
     ORDER BY priority DESC, created_at
     LIMIT least(greatest(coalesce(p_limit, 300), 1), 500)
     FOR UPDATE SKIP LOCKED)
  UPDATE notifications n
     SET status = 'sending', attempts = n.attempts + 1, next_attempt_at = now()
   WHERE n.status IN ('queued', 'failed') AND n.attempts < 3
     AND (n.id IN (SELECT id FROM picked)
          OR (n.batch_key IS NOT NULL AND n.batch_key IN (SELECT batch_key FROM picked WHERE batch_key IS NOT NULL)))
  RETURNING n.*;
$$;
REVOKE ALL ON FUNCTION public.claim_urgent_notifications(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_urgent_notifications(INT) TO service_role;

-- Record the batch a set of claimed rows is about to go out in (null: not in a batch any more,
-- e.g. the provider refused the batch outright, so it was never sent and goes one by one).
CREATE OR REPLACE FUNCTION public.set_notification_batch(p_ids BIGINT[], p_batch_key TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET batch_key = p_batch_key WHERE id = ANY(p_ids) AND status = 'sending';
$$;
REVOKE ALL ON FUNCTION public.set_notification_batch(BIGINT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_notification_batch(BIGINT[], TEXT) TO service_role;

-- Put claimed rows back without using up an attempt, with the reason in last_error: the provider
-- said "slow down" or the quota is used up (429; the sender passes Retry-After, else 15 minutes),
-- or the run is out of time before it could try them. (An earlier draft of this PR had a 2-argument
-- version; it never shipped.)
DROP FUNCTION IF EXISTS public.requeue_notifications(BIGINT[], INT);
CREATE OR REPLACE FUNCTION public.requeue_notifications(p_ids BIGINT[], p_delay_seconds INT DEFAULT 60, p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications
     SET status = 'queued', attempts = greatest(attempts - 1, 0),
         next_attempt_at = now() + make_interval(secs => greatest(coalesce(p_delay_seconds, 60), 0)),
         last_error = coalesce(left(p_error, 500), last_error)
   WHERE id = ANY(p_ids) AND status = 'sending';
$$;
REVOKE ALL ON FUNCTION public.requeue_notifications(BIGINT[], INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_notifications(BIGINT[], INT, TEXT) TO service_role;

-- A run that died leaves rows in 'sending'. Put them back after 15 minutes, keeping the attempt
-- the claim counted (a row that kills the sender can't loop forever); the third time it's failed
-- for good, so it shows on the admin's list instead of sitting queued where no claim takes it.
CREATE OR REPLACE FUNCTION private.requeue_stuck_notifications()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications
     SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
         last_error = CASE WHEN attempts >= 3 THEN 'The sender stopped while sending this, three times' ELSE last_error END
   WHERE status = 'sending' AND next_attempt_at < now() - interval '15 minutes';
$$;
REVOKE ALL ON FUNCTION private.requeue_stuck_notifications() FROM PUBLIC, anon, authenticated;
-- Rows the old version put back with every attempt used were never claimed again: fail them.
UPDATE notifications SET status = 'failed', last_error = coalesce(last_error, 'The sender stopped while sending this, three times')
 WHERE status = 'queued' AND attempts >= 3;

-- Posting an urgent update queues one urgent_notice per person in its audience, at priority 1.
-- A person reached twice (a parent who also volunteers) and two accounts that share an address
-- get one email. The announcements opt-out doesn't apply: this is a safety notice.
CREATE OR REPLACE FUNCTION private.updates_send_urgent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  who     UUID;
  k       TEXT;
  payload JSONB := jsonb_build_object('update_id', NEW.id, 'body', NEW.body, 'author', NEW.author_name,
                                      'posted_at', NEW.created_at);
BEGIN
  FOR who IN SELECT DISTINCT a.profile_id FROM private.update_audience_profiles(NEW.audience, NEW.section_id, NEW.session_id) a
             WHERE a.profile_id IS NOT NULL LOOP
    k := 'urgent:' || NEW.id || ':' || who;
    PERFORM private.enqueue_notification(who, 'urgent_notice', payload, k);
    UPDATE notifications SET priority = 1 WHERE dedupe_key = k;
  END LOOP;
  -- One email per address.
  UPDATE notifications n SET status = 'cancelled', last_error = 'Same address as another recipient'
   WHERE n.template = 'urgent_notice' AND n.payload ->> 'update_id' = NEW.id::text AND n.status = 'queued'
     AND EXISTS (SELECT 1 FROM notifications o
                 WHERE o.template = 'urgent_notice' AND o.payload ->> 'update_id' = NEW.id::text
                   AND o.status = 'queued' AND o.recipient_email = n.recipient_email AND o.id < n.id);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.updates_send_urgent() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS updates_send_urgent ON updates;
CREATE TRIGGER updates_send_urgent AFTER INSERT ON updates
    FOR EACH ROW WHEN (NEW.urgent) EXECUTE FUNCTION private.updates_send_urgent();

-- ── 3. The incident log ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- A section's incidents go with it (sections with campers are cancelled, not deleted).
    section_id          UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    student_id          UUID REFERENCES students(id) ON DELETE SET NULL,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind                TEXT NOT NULL CHECK (kind IN ('injury', 'behavior', 'conduct', 'safety', 'other')),
    level               TEXT NOT NULL DEFAULT 'note' CHECK (level IN ('note', 'warning', 'admin_room', 'written_notice')),
    description         TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 2000),
    reported_by         UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
    parent_notified_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incidents_section_idx  ON incidents (section_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS incidents_reporter_idx ON incidents (reported_by);
CREATE INDEX IF NOT EXISTS incidents_unnotified_idx ON incidents (created_at)
    WHERE student_id IS NOT NULL AND parent_notified_at IS NULL;

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crew_log_incident"        ON incidents;
DROP POLICY IF EXISTS "crew_read_own_incidents"  ON incidents;
DROP POLICY IF EXISTS "admin_read_incidents"     ON incidents;
DROP POLICY IF EXISTS "admin_log_incident"       ON incidents;
DROP POLICY IF EXISTS "admin_update_incidents"   ON incidents;

-- Crew log for their own section only, in their own name, about a camper holding a seat in it,
-- for something in the last two weeks (not the future), not yet marked as told to the parent.
CREATE POLICY "crew_log_incident" ON incidents FOR INSERT TO authenticated
    WITH CHECK (
        reported_by = auth.uid()
        AND private.auth_is_volunteer()
        AND private.auth_volunteer_has_section(section_id)
        AND (student_id IS NULL OR EXISTS (
              SELECT 1 FROM registrations r
              WHERE r.section_id = incidents.section_id AND r.student_id = incidents.student_id
                AND r.status IN ('confirmed', 'pending')))
        AND occurred_at BETWEEN now() - interval '14 days' AND now() + interval '10 minutes'
        AND parent_notified_at IS NULL
    );
CREATE POLICY "crew_read_own_incidents" ON incidents FOR SELECT TO authenticated
    USING (reported_by = auth.uid());
CREATE POLICY "admin_read_incidents" ON incidents FOR SELECT TO authenticated
    USING (private.auth_user_role() = 'admin');
CREATE POLICY "admin_log_incident" ON incidents FOR INSERT TO authenticated
    WITH CHECK (private.auth_user_role() = 'admin' AND reported_by = auth.uid());
CREATE POLICY "admin_update_incidents" ON incidents FOR UPDATE TO authenticated
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
-- No deletes from the client: the log is a record (retention: spec L4).
REVOKE ALL ON incidents FROM anon;
GRANT SELECT, INSERT, UPDATE ON incidents TO authenticated;

-- Server-owned columns: created_at is the time of logging, and parent_notified_at is set only by
-- notify_incident_parent() (it names its reason). Nobody, admins included, writes either directly;
-- the reporter and the logging time never change after the fact.
CREATE OR REPLACE FUNCTION private.incidents_server_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.parent_notified_at := NULL;
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.reported_by := OLD.reported_by;
    IF coalesce(current_setting('app.reason', true), '') <> 'incident_notice' THEN
      NEW.parent_notified_at := OLD.parent_notified_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.incidents_server_columns() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS incidents_server_columns ON incidents;
CREATE TRIGGER incidents_server_columns BEFORE INSERT OR UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION private.incidents_server_columns();

-- Audited (spec 05).
DO $$
BEGIN
  IF to_regprocedure('audit.log_change()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_log_change ON public.incidents;
    CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON public.incidents
        FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');
  END IF;
END $$;

-- Tell the camper's parent (admins): queues incident_notice and stamps parent_notified_at, once.
-- The email carries the admin's own words, not the crew's description (which may name other
-- children).
CREATE OR REPLACE FUNCTION public.notify_incident_parent(p_incident_id UUID, p_message TEXT DEFAULT NULL)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  inc     incidents%ROWTYPE;
  parent  UUID;
  payload JSONB;
  msg     TEXT := nullif(trim(p_message), '');
BEGIN
  IF NOT coalesce(private.auth_user_role() = 'admin', false) THEN
    RAISE EXCEPTION 'Only an admin can tell a family about an incident' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inc FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That incident no longer exists' USING ERRCODE = 'P0002';
  END IF;
  IF inc.student_id IS NULL THEN
    RAISE EXCEPTION 'This entry names no camper, so there is no family to tell' USING ERRCODE = 'P0001';
  END IF;
  IF inc.parent_notified_at IS NOT NULL THEN
    RAISE EXCEPTION 'The family was already told on %',
      to_char(inc.parent_notified_at AT TIME ZONE 'America/Denver', 'Mon FMDD "at" FMHH12:MI AM') USING ERRCODE = 'P0001';
  END IF;
  IF length(msg) > 1000 THEN
    RAISE EXCEPTION 'Keep the message under 1,000 characters' USING ERRCODE = 'P0001';
  END IF;

  SELECT st.parent_id,
         jsonb_build_object(
           'camper', coalesce(nullif(st.first_name, ''), split_part(st.full_name, ' ', 1)),
           'class', c.name, 'section', s.label, 'week', s.week,
           'occurred_at', inc.occurred_at, 'kind', inc.kind, 'message', msg,
           'incident_id', inc.id, 'student_id', st.id)
    INTO parent, payload
  FROM students st
  JOIN sections s ON s.id = inc.section_id
  JOIN classes  c ON c.id = s.class_id
  WHERE st.id = inc.student_id;
  IF parent IS NULL THEN
    RAISE EXCEPTION 'This camper has no parent account to email' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.set_reason('incident_notice');
  PERFORM private.enqueue_notification(parent, 'incident_notice', payload, 'incident:' || inc.id);
  -- No deliverable address: the outbox recorded it as cancelled. Undo everything (the exception
  -- rolls back that row too) rather than say the family was told.
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE dedupe_key = 'incident:' || inc.id AND status = 'queued') THEN
    RAISE EXCEPTION 'No email address on file for this family, so nothing was sent. Call them instead.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE incidents SET parent_notified_at = now() WHERE id = inc.id;
  PERFORM private.set_reason(NULL);
  RETURN now();
END;
$$;
REVOKE ALL ON FUNCTION public.notify_incident_parent(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_incident_parent(UUID, TEXT) TO authenticated;

-- ── 4. Roll-call notes ────────────────────────────────────────
-- The note on one mark (Late, Left early, Picked up by …), written by the section's crew on the
-- days they may mark, or an admin. Only the note changes: who marked and when stay as they were.
CREATE OR REPLACE FUNCTION public.set_roll_call_note(
    p_section_id UUID, p_student_id UUID, p_day DATE, p_roll_call TEXT, p_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT (coalesce(private.auth_user_role() = 'admin', false)
          OR (private.auth_is_volunteer() AND private.auth_volunteer_has_section(p_section_id)
              AND private.roll_call_day_ok(p_day))) THEN
    RAISE EXCEPTION 'Only this section''s crew can add notes to its roll call' USING ERRCODE = '42501';
  END IF;
  IF length(p_note) > 200 THEN
    RAISE EXCEPTION 'Keep the note under 200 characters' USING ERRCODE = 'P0001';
  END IF;
  UPDATE roll_call_marks SET note = nullif(trim(p_note), '')
   WHERE section_id = p_section_id AND student_id = p_student_id AND day = p_day AND roll_call = p_roll_call;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mark them present or absent first' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_roll_call_note(UUID, UUID, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_roll_call_note(UUID, UUID, DATE, TEXT, TEXT) TO authenticated;

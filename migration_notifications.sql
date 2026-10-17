-- Migration: notifications outbox — the app's own email (spec 09, #77)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_audit_log.sql, migration_soft_cancel.sql and migration_auto_confirm.sql.
--
-- Every email a family should get goes through `notifications` (one row per email):
--   * triggers on `registrations` queue registration_confirmed / _waitlisted / _moved / _cancelled
--     (the cancel reason picks the wording: parent, admin, class cancelled, …);
--   * the Edge Function supabase/functions/send-notifications claims queued rows, renders the
--     template, sends through the email provider and records the result, retrying 3 times;
--   * pg_cron calls that function every minute (section 6; needs two Vault secrets).
-- Nothing is sent until the provider key is set as an Edge Function secret (RESEND_API_KEY):
-- until then rows simply wait in the queue. Reply-to is denver@steelcitycodes.org.
--
-- What does NOT queue email: changes made with no signed-in user and no reason (the SQL editor,
-- private.reset_demo()), and recipients without a deliverable address (none, or the reserved
-- example.com domain the demo seed uses): those rows are recorded as 'cancelled'.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 1. The outbox ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id                 BIGSERIAL PRIMARY KEY,
    recipient_profile  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    recipient_email    TEXT,
    template           TEXT NOT NULL,
    payload            JSONB NOT NULL DEFAULT '{}',
    status             TEXT NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
    attempts           SMALLINT NOT NULL DEFAULT 0,
    next_attempt_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error         TEXT,
    dedupe_key         TEXT UNIQUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_due_idx ON notifications (next_attempt_at) WHERE status IN ('queued', 'failed');
CREATE INDEX IF NOT EXISTS notifications_recent_idx ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_notifications" ON notifications;
CREATE POLICY "admin_read_notifications" ON notifications FOR SELECT TO authenticated
    USING (private.auth_user_role() = 'admin');
GRANT SELECT ON notifications TO authenticated;   -- RLS: admins only. No client writes.

-- Announcement opt-out (used when "Also email" moves to the outbox; transactional email ignores it).
ALTER TABLE parent_profiles ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Queue one email ────────────────────────────────────────
-- Address: the parent's contact email, else their login email (same rule as
-- update_recipient_emails()). Same dedupe key twice → queued once.
CREATE OR REPLACE FUNCTION private.enqueue_notification(
    p_profile UUID, p_template TEXT, p_payload JSONB, p_dedupe TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  addr TEXT := (SELECT lower(coalesce(nullif(trim(pp.email), ''), u.email))
                FROM auth.users u LEFT JOIN parent_profiles pp ON pp.id = u.id
                WHERE u.id = p_profile);
  undeliverable BOOLEAN := addr IS NULL OR addr LIKE '%@example.com' OR addr LIKE '%.example.com';
BEGIN
  INSERT INTO notifications (recipient_profile, recipient_email, template, payload, dedupe_key, status, last_error)
  VALUES (p_profile, addr, p_template, coalesce(p_payload, '{}'), p_dedupe,
          CASE WHEN undeliverable THEN 'cancelled' ELSE 'queued' END,
          CASE WHEN undeliverable THEN 'No deliverable address' END)
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_notification(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 3. Registration changes → email the family ────────────────

CREATE OR REPLACE FUNCTION private.notify_registration_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  tmpl    TEXT;
  parent  UUID;
  payload JSONB;
BEGIN
  -- Not for the SQL editor or the demo reset (no user, no reason); system jobs set a reason.
  IF auth.uid() IS NULL AND nullif(current_setting('app.reason', true), '') IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    tmpl := CASE NEW.status::text WHEN 'confirmed' THEN 'registration_confirmed'
                                  WHEN 'pending'   THEN 'registration_confirmed'
                                  WHEN 'waitlisted' THEN 'registration_waitlisted' END;
  ELSIF NEW.section_id IS DISTINCT FROM OLD.section_id AND NEW.status::text <> 'cancelled' THEN
    tmpl := 'registration_moved';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    tmpl := CASE NEW.status::text WHEN 'cancelled'  THEN 'registration_cancelled'
                                  WHEN 'confirmed'  THEN 'registration_confirmed'
                                  WHEN 'waitlisted' THEN 'registration_waitlisted'
                                  WHEN 'offered'    THEN 'waitlist_offer' END;   -- spec 10
  END IF;
  IF tmpl IS NULL THEN RETURN NULL; END IF;

  SELECT st.parent_id,
         jsonb_build_object(
           'camper', coalesce(nullif(st.first_name, ''), split_part(st.full_name, ' ', 1)),
           'camper_full', st.full_name,
           'class', c.name, 'section', s.label, 'week', s.week,
           'session', se.name, 'start_date', se.start_date, 'end_date', se.end_date,
           'days', s.days, 'start_time', s.start_time, 'end_time', s.end_time, 'room', s.room,
           'status', NEW.status, 'cancel_reason', NEW.cancel_reason,
           'offer_expires_at', to_jsonb(NEW) -> 'offer_expires_at',
           'from_class', (SELECT c2.name || ' · ' || s2.label FROM sections s2 JOIN classes c2 ON c2.id = s2.class_id
                          WHERE TG_OP = 'UPDATE' AND s2.id = OLD.section_id AND OLD.section_id IS DISTINCT FROM NEW.section_id),
           'student_id', st.id)
    INTO parent, payload
  FROM students st
  JOIN sections s ON s.id = NEW.section_id
  JOIN classes  c ON c.id = s.class_id
  LEFT JOIN sessions se ON se.id = s.session_id
  WHERE st.id = NEW.student_id;

  PERFORM private.enqueue_notification(parent, tmpl, payload,
    tmpl || ':' || NEW.id || ':' || txid_current());
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.notify_registration_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_registration_change ON registrations;
CREATE TRIGGER notify_registration_change AFTER INSERT OR UPDATE OF status, section_id ON registrations
    FOR EACH ROW EXECUTE FUNCTION private.notify_registration_change();

-- ── 4. The sender's side (service role only) ──────────────────

-- Claim up to p_limit due emails (queued, or failed with retries left) and mark them sending.
CREATE OR REPLACE FUNCTION public.claim_notifications(p_limit INT DEFAULT 50)
RETURNS SETOF notifications LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications n
     SET status = 'sending', attempts = n.attempts + 1
   WHERE n.id IN (SELECT id FROM notifications
                   WHERE status IN ('queued', 'failed') AND attempts < 3 AND next_attempt_at <= now()
                   ORDER BY created_at
                   LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
                   FOR UPDATE SKIP LOCKED)
  RETURNING n.*;
$$;
REVOKE ALL ON FUNCTION public.claim_notifications(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications(INT) TO service_role;

-- Record the result. A failure retries after 5, then 10 minutes; the third failure is final.
CREATE OR REPLACE FUNCTION public.finish_notification(p_id BIGINT, p_ok BOOLEAN, p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications
     SET status = CASE WHEN p_ok THEN 'sent' ELSE 'failed' END,
         sent_at = CASE WHEN p_ok THEN now() END,
         last_error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 500) END,
         next_attempt_at = now() + make_interval(mins => 5 * attempts)
   WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.finish_notification(BIGINT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_notification(BIGINT, BOOLEAN, TEXT) TO service_role;

-- A crashed run can leave rows in 'sending'; put them back after 15 minutes.
CREATE OR REPLACE FUNCTION private.requeue_stuck_notifications()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET status = 'queued'
   WHERE status = 'sending' AND next_attempt_at < now() - interval '15 minutes';
$$;

-- ── 5. (spec 09 asks the admin to see what went out: admins read `notifications` directly) ─

-- ── 6. Every minute: requeue stuck rows and call the sender ───
-- Needs two Vault secrets (run once per project in the SQL editor, never committed):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-notifications', 'notify_function_url');
--   select vault.create_secret('<the project''s anon key>', 'notify_function_key');
-- Without them the job only requeues stuck rows.
DO $$
BEGIN
  PERFORM cron.unschedule('send-notifications') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-notifications');
  PERFORM cron.schedule('send-notifications', '* * * * *', $cron$
    SELECT private.requeue_stuck_notifications();
    SELECT net.http_post(
             url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_function_url'),
             headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
                        'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_function_key')),
             body := '{}'::jsonb)
     WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'notify_function_url')
       AND EXISTS (SELECT 1 FROM notifications WHERE status IN ('queued', 'failed') AND attempts < 3 AND next_attempt_at <= now());
  $cron$);
END $$;

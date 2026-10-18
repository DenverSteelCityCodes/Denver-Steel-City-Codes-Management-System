-- Migration: volunteer interviews and onboarding: private meeting links, emails, checklist,
-- profile, "meet the teachers" (spec 35, #155)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_interview_slots_private.sql, migration_notifications.sql,
-- migration_volunteer_role_gate.sql and migration_audit_log.sql (it uses private.set_reason(),
-- audit.log_change(), private.enqueue_notification() and pg_cron). Deploy send-notifications first:
-- templates.ts gains seven templates and the sender attaches the interview's .ics file. Then
-- re-apply migration_demo_environment.sql on the demo project.
--
-- What it adds:
--   1. interview_slot_links: one meeting link per interview slot, admin-only. The booked applicant
--      reads their own through my_interview(), which also returns the time in Denver words.
--   2. Interview and decision emails, each queued once by the database (one person per email):
--      interview_booked (with an .ics file), interview_reminder (24 hours and 1 hour before, a
--      pg_cron job every 5 minutes), interview_times_posted (to pending applicants with no booking,
--      at most once a Denver day), interview_nudge (an admin's button), application_accepted,
--      application_declined and volunteer_removed.
--   3. The volunteer profile on `volunteers`: legal and preferred name, pronunciation, a 300-
--      character bio, an opt-in photo (private bucket volunteer-photos) with consent stamps.
--   4. The onboarding checklist: onboarding_tasks (set by admins) and volunteer_tasks (what each
--      volunteer has done). Each item is due N hours after acceptance (or after the item was added,
--      if later); admin_onboarding_overdue() lists what is late.
--   5. remove_from_season(): clears this season's crew spots and upcoming duty claims, marks the
--      volunteer removed, emails them, and every change carries the reason into the audit log.
--      A removed volunteer loses volunteer access (private.auth_is_volunteer()) until re-accepted,
--      and can't be put on a crew.
--   6. meet_the_crew(): the crew of each week a parent has a seated camper in, with preferred
--      names, pronunciation, bios and consented photos only. section_lead_names() uses the
--      preferred name too.
--
-- Decided (spec 35 defaults, 2026-10-18):
--   * Photos of volunteers under 18 (by the age on their latest application, unknown counts as
--     under 18) show to parents only with the volunteer's consent AND a guardian's (named) consent.
--     National's rules on minors' photos are still an open question; this is the stricter reading.
--   * Volunteers accepted before this migration have no acceptance time, so nothing is overdue for
--     them; the checklist still lists the items.
--   * A finished checklist item stays done if the volunteer is accepted again in a later season.

-- ── 1. Meeting links (admin-only) ─────────────────────────────

CREATE TABLE IF NOT EXISTS interview_slot_links (
    slot_id     UUID PRIMARY KEY REFERENCES interview_slots(id) ON DELETE CASCADE,
    meeting_url TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_slot_links_url_check') THEN
    -- https only, so a link can never be javascript: or a plain-text passcode.
    ALTER TABLE interview_slot_links ADD CONSTRAINT interview_slot_links_url_check
      CHECK (meeting_url ~ '^https://[^\s<>"]+$' AND length(meeting_url) <= 500);
  END IF;
END $$;

ALTER TABLE interview_slot_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_interview_slot_links" ON interview_slot_links;
CREATE POLICY "admin_all_interview_slot_links" ON interview_slot_links FOR ALL TO authenticated
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
REVOKE ALL ON interview_slot_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON interview_slot_links TO authenticated;

DROP TRIGGER IF EXISTS touch_updated_at ON interview_slot_links;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON interview_slot_links
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- The applicant's own interview: time, the same time in Denver words, and the slot's link.
-- (The return type changed, so it is dropped and created again.)
DROP FUNCTION IF EXISTS public.my_interview();
CREATE FUNCTION public.my_interview()
RETURNS TABLE (slot_id UUID, slot_datetime TIMESTAMPTZ, duration_minutes SMALLINT, denver_time TEXT, meeting_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.slot_id, s.slot_datetime, s.duration_minutes,
         to_char(s.slot_datetime AT TIME ZONE 'America/Denver', 'FMDay, FMMonth FMDD "at" FMHH12:MI AM'),
         l.meeting_url
  FROM volunteer_applications a
  JOIN interview_bookings b ON b.application_id = a.id
  JOIN interview_slots s ON s.id = b.slot_id
  LEFT JOIN interview_slot_links l ON l.slot_id = s.id
  WHERE a.user_id = auth.uid() AND a.status <> 'rejected'
  ORDER BY a.created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_interview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_interview() TO authenticated;

-- ── 2. Applicant emails ───────────────────────────────────────

-- Queue one email to the person behind an application: their account's address, else the one on
-- the form (trimmed: a trailing space once dropped a volunteer off every list). Every payload
-- carries the first name and the application id.
CREATE OR REPLACE FUNCTION private.enqueue_applicant_email(
    p_application_id UUID, p_template TEXT, p_payload JSONB, p_dedupe TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  app  volunteer_applications;
  addr TEXT;
  prof UUID;
  undeliverable BOOLEAN;
BEGIN
  SELECT * INTO app FROM volunteer_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT lower(btrim(u.email)) INTO addr FROM auth.users u WHERE u.id = app.user_id;
  addr := coalesce(nullif(addr, ''), nullif(lower(btrim(app.email)), ''));
  SELECT id INTO prof FROM profiles WHERE id = app.user_id;
  undeliverable := addr IS NULL OR addr LIKE '%@example.com' OR addr LIKE '%.example.com';
  INSERT INTO notifications (recipient_profile, recipient_email, template, payload, dedupe_key, status, last_error)
  VALUES (prof, addr, p_template,
          jsonb_build_object('first_name', app.first_name, 'application_id', app.id) || coalesce(p_payload, '{}'),
          p_dedupe,
          CASE WHEN undeliverable THEN 'cancelled' ELSE 'queued' END,
          CASE WHEN undeliverable THEN 'No deliverable address' END)
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_applicant_email(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- Writes that should email someone: an API call (signed in, or the signed-out /apply booking) or
-- a system job that sets a reason. Not the SQL editor or the demo reset.
CREATE OR REPLACE FUNCTION private.should_notify()
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') IN ('anon', 'authenticated')
      OR nullif(current_setting('app.reason', true), '') IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION private.should_notify() FROM PUBLIC, anon, authenticated;

-- The interview facts every interview email carries.
CREATE OR REPLACE FUNCTION private.interview_payload(p_slot_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('slot_id', s.id, 'slot_datetime', s.slot_datetime,
                            'duration_minutes', s.duration_minutes, 'meeting_url', l.meeting_url)
  FROM interview_slots s LEFT JOIN interview_slot_links l ON l.slot_id = s.id
  WHERE s.id = p_slot_id;
$$;
REVOKE ALL ON FUNCTION private.interview_payload(UUID) FROM PUBLIC, anon, authenticated;

-- When the booking was made or last moved, so a reminder never follows hard on the booking email.
ALTER TABLE interview_bookings ADD COLUMN IF NOT EXISTS booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION private.interview_bookings_stamp()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slot_id IS DISTINCT FROM OLD.slot_id THEN NEW.booked_at := now(); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.interview_bookings_stamp() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS interview_bookings_stamp ON interview_bookings;
CREATE TRIGGER interview_bookings_stamp BEFORE UPDATE OF slot_id ON interview_bookings
    FOR EACH ROW EXECUTE FUNCTION private.interview_bookings_stamp();

-- Booked or moved (by the applicant or an admin) → one interview_booked email.
CREATE OR REPLACE FUNCTION private.notify_interview_booked()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.should_notify() THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.slot_id IS NOT DISTINCT FROM OLD.slot_id THEN RETURN NULL; END IF;
  PERFORM private.enqueue_applicant_email(NEW.application_id, 'interview_booked',
    private.interview_payload(NEW.slot_id) || jsonb_build_object('moved', TG_OP = 'UPDATE'),
    'interview_booked:' || NEW.id || ':' || NEW.slot_id || ':' || txid_current());
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_interview_booked() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_interview_booked ON interview_bookings;
CREATE TRIGGER notify_interview_booked AFTER INSERT OR UPDATE OF slot_id ON interview_bookings
    FOR EACH ROW EXECUTE FUNCTION private.notify_interview_booked();

-- Withdraw queued interview emails that no longer apply (not ones already being sent). A moved or
-- deleted booking withdraws its reminders (for that slot, or all); an application that leaves
-- pending withdraws its reminders, nudges and times-posted emails.
CREATE OR REPLACE FUNCTION private.withdraw_interview_emails(p_application_id UUID, p_templates TEXT[], p_slot_id UUID, p_why TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET status = 'cancelled', last_error = p_why
   WHERE template = ANY (p_templates) AND status IN ('queued', 'failed')
     AND payload ->> 'application_id' = p_application_id::text
     AND (p_slot_id IS NULL OR payload ->> 'slot_id' = p_slot_id::text);
$$;
REVOKE ALL ON FUNCTION private.withdraw_interview_emails(UUID, TEXT[], UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.interview_booking_withdrawn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.withdraw_interview_emails(OLD.application_id, ARRAY['interview_reminder'], NULL, 'The interview was cancelled');
  ELSIF NEW.slot_id IS DISTINCT FROM OLD.slot_id THEN
    PERFORM private.withdraw_interview_emails(OLD.application_id, ARRAY['interview_reminder'], OLD.slot_id, 'The interview moved');
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.interview_booking_withdrawn() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS interview_booking_withdrawn ON interview_bookings;
CREATE TRIGGER interview_booking_withdrawn AFTER UPDATE OF slot_id OR DELETE ON interview_bookings
    FOR EACH ROW EXECUTE FUNCTION private.interview_booking_withdrawn();

-- Pending applicants with no booking, from the last six months (older pending applications are
-- last season's and shouldn't hear about this season's times).
CREATE OR REPLACE FUNCTION private.unbooked_applications()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id FROM volunteer_applications a
  WHERE a.status = 'pending' AND a.created_at > now() - interval '180 days'
    AND NOT EXISTS (SELECT 1 FROM interview_bookings b WHERE b.application_id = a.id);
$$;
REVOKE ALL ON FUNCTION private.unbooked_applications() FROM PUBLIC, anon, authenticated;

-- An admin added interview times → tell every applicant still without a booking. Several slots
-- added the same day make one email per applicant (the dedupe key is per Denver day).
CREATE OR REPLACE FUNCTION private.notify_interview_times_posted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  first_at TIMESTAMPTZ;
  app_id   UUID;
  day      TEXT := to_char(now() AT TIME ZONE 'America/Denver', 'YYYY-MM-DD');
BEGIN
  IF NOT private.should_notify() THEN RETURN NULL; END IF;
  SELECT min(slot_datetime) INTO first_at FROM new_slots WHERE slot_datetime > now();
  IF first_at IS NULL THEN RETURN NULL; END IF;
  FOR app_id IN SELECT * FROM private.unbooked_applications() LOOP
    PERFORM private.enqueue_applicant_email(app_id, 'interview_times_posted',
      jsonb_build_object('first_slot', first_at), 'interview_times_posted:' || app_id || ':' || day);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_interview_times_posted() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_interview_times_posted ON interview_slots;
CREATE TRIGGER notify_interview_times_posted AFTER INSERT ON interview_slots
    REFERENCING NEW TABLE AS new_slots FOR EACH STATEMENT EXECUTE FUNCTION private.notify_interview_times_posted();

-- Reminders: 24 hours before (if the booking was made earlier than that) and 1 hour before (same
-- rule). The dedupe key is per booking, per slot and per kind, so each goes once; a moved booking
-- gets its own.
CREATE OR REPLACE FUNCTION private.send_interview_reminders()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  -- A reminder still waiting when its interview has started is no use any more.
  UPDATE notifications SET status = 'cancelled', last_error = 'The interview time had passed'
   WHERE template = 'interview_reminder' AND status IN ('queued', 'failed')
     AND (payload ->> 'slot_datetime')::timestamptz <= now();
  FOR r IN
    SELECT b.id, b.application_id, b.slot_id,
           CASE WHEN s.slot_datetime <= now() + interval '1 hour' THEN '1h' ELSE '24h' END AS kind
    FROM interview_bookings b
    JOIN interview_slots s ON s.id = b.slot_id
    JOIN volunteer_applications a ON a.id = b.application_id
    WHERE a.status = 'pending'
      AND s.slot_datetime > now() AND s.slot_datetime <= now() + interval '24 hours'
      AND b.booked_at <= s.slot_datetime
            - CASE WHEN s.slot_datetime <= now() + interval '1 hour' THEN interval '1 hour' ELSE interval '24 hours' END
  LOOP
    PERFORM private.enqueue_applicant_email(r.application_id, 'interview_reminder',
      private.interview_payload(r.slot_id) || jsonb_build_object('kind', r.kind),
      'interview_reminder:' || r.kind || ':' || r.id || ':' || r.slot_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION private.send_interview_reminders() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('interview-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'interview-reminders');
  PERFORM cron.schedule('interview-reminders', '*/5 * * * *', 'SELECT private.send_interview_reminders()');
END $$;

-- An admin's "nudge" for an applicant who hasn't booked: at most one a Denver day. Returns when
-- the nudge was queued (today's earlier one if there was one).
CREATE OR REPLACE FUNCTION public.admin_nudge_applicant(p_application_id UUID)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  dedupe TEXT := 'interview_nudge:' || p_application_id || ':' || to_char(now() AT TIME ZONE 'America/Denver', 'YYYY-MM-DD');
  open_times INT := (SELECT count(*) FROM interview_slots s
                     WHERE s.slot_datetime > now() AND NOT EXISTS (SELECT 1 FROM interview_bookings b WHERE b.slot_id = s.id));
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can nudge applicants' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM volunteer_applications WHERE id = p_application_id AND status = 'pending') THEN
    RAISE EXCEPTION 'That application isn''t waiting for an interview' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM interview_bookings WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'They already have an interview booked' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.enqueue_applicant_email(p_application_id, 'interview_nudge',
    jsonb_build_object('open_times', open_times), dedupe);
  RETURN (SELECT created_at FROM notifications WHERE dedupe_key = dedupe);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_nudge_applicant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_nudge_applicant(UUID) TO authenticated;

-- ── 3. The volunteer profile ──────────────────────────────────
-- removed_by and verified_by are plain ids, not foreign keys: a second key from volunteers to
-- profiles would make every volunteers→profiles embed ambiguous (docs/specs/README.md).

ALTER TABLE volunteers
    ADD COLUMN IF NOT EXISTS legal_name                TEXT,
    ADD COLUMN IF NOT EXISTS preferred_name            TEXT,
    ADD COLUMN IF NOT EXISTS pronunciation             TEXT,
    ADD COLUMN IF NOT EXISTS bio                       TEXT,
    ADD COLUMN IF NOT EXISTS photo_path                TEXT,
    ADD COLUMN IF NOT EXISTS photo_consent_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS photo_guardian_name       TEXT,
    ADD COLUMN IF NOT EXISTS photo_guardian_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS accepted_at               TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS removed_at                TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS removed_reason            TEXT,
    ADD COLUMN IF NOT EXISTS removed_by                UUID;
-- Added without a default so volunteers accepted before this migration keep NULL (nothing overdue).
ALTER TABLE volunteers ALTER COLUMN accepted_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'volunteers_profile_lengths_check') THEN
    ALTER TABLE volunteers ADD CONSTRAINT volunteers_profile_lengths_check CHECK (
      coalesce(length(bio), 0) <= 300 AND coalesce(length(legal_name), 0) <= 100
      AND coalesce(length(preferred_name), 0) <= 60 AND coalesce(length(pronunciation), 0) <= 80
      AND coalesce(length(photo_guardian_name), 0) <= 100 AND coalesce(length(removed_reason), 0) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'volunteers_photo_path_check') THEN
    -- A volunteer's photo lives in their own folder of the bucket.
    ALTER TABLE volunteers ADD CONSTRAINT volunteers_photo_path_check
      CHECK (photo_path IS NULL OR photo_path LIKE id::text || '/%');
  END IF;
END $$;

-- Under 18 by the age on their latest application; no application counts as under 18.
CREATE OR REPLACE FUNCTION private.volunteer_is_minor(p_volunteer UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT a.age < 18 FROM volunteer_applications a WHERE a.user_id = p_volunteer
                   ORDER BY a.created_at DESC LIMIT 1), true);
$$;
REVOKE ALL ON FUNCTION private.volunteer_is_minor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.volunteer_is_minor(UUID) TO authenticated;

-- May parents see this volunteer's photo? A photo, the volunteer's consent and, under 18, a
-- guardian's.
CREATE OR REPLACE FUNCTION private.volunteer_photo_ok(p_volunteer UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1 FROM volunteers v
    WHERE v.id = p_volunteer AND v.photo_path IS NOT NULL AND v.photo_consent_at IS NOT NULL
      AND (v.photo_guardian_consent_at IS NOT NULL OR NOT private.volunteer_is_minor(v.id)));
$$;
REVOKE ALL ON FUNCTION private.volunteer_photo_ok(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.volunteer_photo_ok(UUID) TO authenticated;

-- The signed-in volunteer's profile, with whether a photo needs a guardian's consent and whether
-- parents can see it now.
CREATE OR REPLACE FUNCTION public.my_volunteer_profile()
RETURNS TABLE (legal_name TEXT, preferred_name TEXT, pronunciation TEXT, bio TEXT, photo_path TEXT,
               photo_consent_at TIMESTAMPTZ, photo_guardian_name TEXT, photo_guardian_consent_at TIMESTAMPTZ,
               needs_guardian BOOLEAN, photo_visible BOOLEAN, accepted_at TIMESTAMPTZ, removed_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT v.legal_name, v.preferred_name, v.pronunciation, v.bio, v.photo_path, v.photo_consent_at,
         v.photo_guardian_name, v.photo_guardian_consent_at, private.volunteer_is_minor(v.id),
         private.volunteer_photo_ok(v.id), v.accepted_at, v.removed_at
  FROM volunteers v WHERE v.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_volunteer_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_volunteer_profile() TO authenticated;

-- The volunteer saves their profile. Consent is stamped when first given and cleared when taken
-- back; a guardian's consent counts only with the guardian's name, and a new name re-stamps it.
CREATE OR REPLACE FUNCTION public.update_my_volunteer_profile(
    p_legal_name TEXT, p_preferred_name TEXT, p_pronunciation TEXT, p_bio TEXT,
    p_photo_path TEXT, p_photo_consent BOOLEAN, p_guardian_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me       UUID := auth.uid();
  cur      volunteers;
  consent  BOOLEAN := coalesce(p_photo_consent, false);
  guardian TEXT := nullif(btrim(p_guardian_name), '');
  minor    BOOLEAN;
BEGIN
  IF NOT private.auth_is_volunteer() THEN
    RAISE EXCEPTION 'Only crew members have a volunteer profile' USING ERRCODE = '42501';
  END IF;
  IF p_photo_path IS NOT NULL AND p_photo_path NOT LIKE me::text || '/%' THEN
    RAISE EXCEPTION 'That photo isn''t in your folder' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_bio, ''))) > 300 THEN
    RAISE EXCEPTION 'Keep your bio to 300 characters' USING ERRCODE = '22001';
  END IF;
  SELECT * INTO cur FROM volunteers WHERE id = me FOR UPDATE;
  minor := private.volunteer_is_minor(me);
  UPDATE volunteers SET
    legal_name     = nullif(btrim(p_legal_name), ''),
    preferred_name = nullif(btrim(p_preferred_name), ''),
    pronunciation  = nullif(btrim(p_pronunciation), ''),
    bio            = nullif(btrim(p_bio), ''),
    photo_path     = p_photo_path,
    photo_consent_at = CASE WHEN consent THEN coalesce(cur.photo_consent_at, now()) END,
    photo_guardian_name = CASE WHEN consent AND minor THEN guardian END,
    photo_guardian_consent_at = CASE
      WHEN NOT consent OR NOT minor OR guardian IS NULL THEN NULL
      WHEN guardian IS NOT DISTINCT FROM cur.photo_guardian_name THEN coalesce(cur.photo_guardian_consent_at, now())
      ELSE now() END
  WHERE id = me;
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_volunteer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_volunteer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- ── 4. Volunteer access ends at removal ───────────────────────
-- (migration_volunteer_role_gate.sql) A volunteer now = the volunteer role, a volunteers row, and
-- not removed from the season.
CREATE OR REPLACE FUNCTION private.auth_is_volunteer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM volunteers v JOIN profiles p ON p.id = v.id
                 WHERE v.id = auth.uid() AND p.role = 'volunteer' AND v.removed_at IS NULL);
$$;
REVOKE ALL ON FUNCTION private.auth_is_volunteer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_is_volunteer() TO authenticated;

-- Crew checks require a current volunteer too, so removal (which clears only this season's crew
-- spots) also ends access to a past season's sections the person crewed: section_roster(),
-- registrations, roll calls, section updates and their email list. Replaces the versions in
-- migration_security_hardening.sql and migration_camp_week_ops.sql (grants unchanged).
CREATE OR REPLACE FUNCTION private.auth_volunteer_has_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.auth_is_volunteer() AND EXISTS (
    SELECT 1 FROM sections sec
    WHERE sec.id = p_section_id
      AND (sec.lead_id = auth.uid()
           OR EXISTS (SELECT 1 FROM section_supports ss
                      WHERE ss.section_id = sec.id AND ss.volunteer_id = auth.uid())));
$$;

CREATE OR REPLACE FUNCTION private.auth_volunteer_leads_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.auth_is_volunteer()
     AND EXISTS (SELECT 1 FROM sections WHERE id = p_section_id AND lead_id = auth.uid());
$$;

-- ── 5. Onboarding checklist ───────────────────────────────────

CREATE TABLE IF NOT EXISTS onboarding_tasks (
    key                    TEXT PRIMARY KEY DEFAULT ('task-' || substr(md5(gen_random_uuid()::text), 1, 8)),
    label                  TEXT NOT NULL,
    help_url               TEXT,
    due_hours_after_accept INT NOT NULL DEFAULT 24,
    sort_order             INT NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_tasks_fields_check') THEN
    -- A help link is https or a path in this app (never javascript: or //host).
    ALTER TABLE onboarding_tasks ADD CONSTRAINT onboarding_tasks_fields_check CHECK (
      length(btrim(label)) BETWEEN 1 AND 160
      AND due_hours_after_accept BETWEEN 1 AND 2160
      AND (help_url IS NULL OR (length(help_url) <= 500
           AND (help_url ~ '^https://[^\s<>"]+$' OR help_url ~ '^/[A-Za-z0-9][^\s<>"]*$'))));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS volunteer_tasks (
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    task_key     TEXT NOT NULL REFERENCES onboarding_tasks(key) ON DELETE CASCADE ON UPDATE CASCADE,
    done_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by  UUID,
    PRIMARY KEY (volunteer_id, task_key)
);
CREATE INDEX IF NOT EXISTS volunteer_tasks_task_idx ON volunteer_tasks (task_key);

ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_tasks  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_onboarding_tasks" ON onboarding_tasks;
DROP POLICY IF EXISTS "crew_read_onboarding_tasks" ON onboarding_tasks;
DROP POLICY IF EXISTS "admin_all_volunteer_tasks"  ON volunteer_tasks;
DROP POLICY IF EXISTS "own_read_volunteer_tasks"   ON volunteer_tasks;
CREATE POLICY "admin_all_onboarding_tasks" ON onboarding_tasks FOR ALL TO authenticated
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "crew_read_onboarding_tasks" ON onboarding_tasks FOR SELECT TO authenticated
    USING (private.auth_is_volunteer());
CREATE POLICY "admin_all_volunteer_tasks" ON volunteer_tasks FOR ALL TO authenticated
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
-- Volunteers read their own; they tick and untick through set_my_onboarding_task().
CREATE POLICY "own_read_volunteer_tasks" ON volunteer_tasks FOR SELECT TO authenticated
    USING (volunteer_id = auth.uid());
REVOKE ALL ON onboarding_tasks, volunteer_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_tasks, volunteer_tasks TO authenticated;

DROP TRIGGER IF EXISTS touch_updated_at ON onboarding_tasks;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON onboarding_tasks
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- Denver's checklist from the inbox (spec 35): the info form is the profile; Discord, Remind and
-- the shared folder stay links (out of scope to automate). Admins add the links.
INSERT INTO onboarding_tasks (key, label, help_url, due_hours_after_accept, sort_order) VALUES
  ('profile', 'Fill in your volunteer profile: your names, a short bio and, if you like, a photo', '/volunteer/profile', 24, 1),
  ('discord', 'Join the crew Discord', NULL, 24, 2),
  ('remind',  'Join the Remind class for camp-day texts', NULL, 24, 3),
  ('shared-folder', 'Open the shared volunteer folder and read the welcome doc', NULL, 24, 4)
ON CONFLICT (key) DO NOTHING;

-- When an item is due for a volunteer: N hours after acceptance, or after the item was added if
-- that came later. NULL when the volunteer has no acceptance time.
CREATE OR REPLACE FUNCTION private.task_due_at(p_accepted_at TIMESTAMPTZ, p_task_created TIMESTAMPTZ, p_hours INT)
RETURNS TIMESTAMPTZ LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT greatest(p_accepted_at, p_task_created) + make_interval(hours => p_hours)
  WHERE p_accepted_at IS NOT NULL;
$$;

-- This camp season starts the day after the last session of an earlier camp year ended (else on
-- September 1 before the camp year). Volunteers accepted before it are last season's: their
-- checklist has no due times and nothing of theirs is overdue.
CREATE OR REPLACE FUNCTION private.season_start()
RETURNS DATE LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce((SELECT max(end_date) + 1 FROM sessions WHERE year < private.current_camp_year()),
                  make_date(private.current_camp_year() - 1, 9, 1));
$$;
REVOKE ALL ON FUNCTION private.season_start() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.volunteer_task_due(p_accepted_at TIMESTAMPTZ, p_task_created TIMESTAMPTZ, p_hours INT)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.task_due_at(p_accepted_at, p_task_created, p_hours)
  WHERE p_accepted_at >= (private.season_start()::timestamp AT TIME ZONE 'America/Denver');
$$;
REVOKE ALL ON FUNCTION private.volunteer_task_due(TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC, anon, authenticated;

-- The signed-in volunteer's checklist.
CREATE OR REPLACE FUNCTION public.my_onboarding()
RETURNS TABLE (key TEXT, label TEXT, help_url TEXT, due_at TIMESTAMPTZ, done_at TIMESTAMPTZ, verified BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT t.key, t.label, t.help_url, private.volunteer_task_due(v.accepted_at, t.created_at, t.due_hours_after_accept),
         vt.done_at, vt.verified_by IS NOT NULL
  FROM volunteers v
  CROSS JOIN onboarding_tasks t
  LEFT JOIN volunteer_tasks vt ON vt.volunteer_id = v.id AND vt.task_key = t.key
  WHERE v.id = auth.uid() AND private.auth_is_volunteer()
  ORDER BY t.sort_order, t.label;
$$;
REVOKE ALL ON FUNCTION public.my_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_onboarding() TO authenticated;

-- Tick or untick an item. Unticking clears an admin's check too.
CREATE OR REPLACE FUNCTION public.set_my_onboarding_task(p_key TEXT, p_done BOOLEAN)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  at TIMESTAMPTZ;
BEGIN
  IF NOT private.auth_is_volunteer() THEN
    RAISE EXCEPTION 'Only crew members have a checklist' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM onboarding_tasks WHERE key = p_key) THEN
    RAISE EXCEPTION 'That checklist item was removed. Reload the page.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_done, false) THEN
    INSERT INTO volunteer_tasks (volunteer_id, task_key) VALUES (auth.uid(), p_key)
    ON CONFLICT (volunteer_id, task_key) DO NOTHING;
    SELECT done_at INTO at FROM volunteer_tasks WHERE volunteer_id = auth.uid() AND task_key = p_key;
  ELSE
    DELETE FROM volunteer_tasks WHERE volunteer_id = auth.uid() AND task_key = p_key;
  END IF;
  RETURN at;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_onboarding_task(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_onboarding_task(TEXT, BOOLEAN) TO authenticated;

-- Admins: each current volunteer's due time per item (NULL: accepted in an earlier season, or
-- before checklists), and whether it's done. The admin tab reads this instead of working it out.
CREATE OR REPLACE FUNCTION public.admin_onboarding_due()
RETURNS TABLE (volunteer_id UUID, task_key TEXT, due_at TIMESTAMPTZ, done BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT v.id, t.key, private.volunteer_task_due(v.accepted_at, t.created_at, t.due_hours_after_accept),
         EXISTS (SELECT 1 FROM volunteer_tasks vt WHERE vt.volunteer_id = v.id AND vt.task_key = t.key)
  FROM volunteers v
  JOIN profiles p ON p.id = v.id AND p.role = 'volunteer'
  CROSS JOIN onboarding_tasks t
  WHERE private.auth_user_role() = 'admin' AND v.removed_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.admin_onboarding_due() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_due() TO authenticated;

-- Admins: every late item (not done, past due) of every current volunteer accepted this season.
CREATE OR REPLACE FUNCTION public.admin_onboarding_overdue()
RETURNS TABLE (volunteer_id UUID, volunteer_name TEXT, task_key TEXT, task_label TEXT, due_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT v.id, p.display_name, t.key, t.label,
         private.volunteer_task_due(v.accepted_at, t.created_at, t.due_hours_after_accept) AS due
  FROM volunteers v
  JOIN profiles p ON p.id = v.id AND p.role = 'volunteer'
  CROSS JOIN onboarding_tasks t
  WHERE private.auth_user_role() = 'admin'
    AND v.removed_at IS NULL
    AND private.volunteer_task_due(v.accepted_at, t.created_at, t.due_hours_after_accept) < now()
    AND NOT EXISTS (SELECT 1 FROM volunteer_tasks vt WHERE vt.volunteer_id = v.id AND vt.task_key = t.key)
  ORDER BY due, p.display_name, t.sort_order;
$$;
REVOKE ALL ON FUNCTION public.admin_onboarding_overdue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_overdue() TO authenticated;

-- ── 6. Decisions: accept, decline ─────────────────────────────
-- Accepting starts the checklist clock and clears an earlier removal; both decisions email the
-- applicant once. The accept email lists the checklist.
CREATE OR REPLACE FUNCTION private.volunteer_application_decided()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  tasks JSONB;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  IF OLD.status = 'pending' THEN
    PERFORM private.withdraw_interview_emails(NEW.id, ARRAY['interview_reminder', 'interview_nudge', 'interview_times_posted'],
      NULL, 'The application was decided');
  END IF;
  IF NEW.status = 'accepted' AND NEW.user_id IS NOT NULL THEN
    UPDATE volunteers SET accepted_at = now(), removed_at = NULL, removed_reason = NULL, removed_by = NULL
     WHERE id = NEW.user_id;
  END IF;
  IF NOT private.should_notify() THEN RETURN NULL; END IF;
  IF NEW.status = 'accepted' THEN
    SELECT jsonb_agg(jsonb_build_object('label', t.label, 'due_hours', t.due_hours_after_accept) ORDER BY t.sort_order, t.label)
      INTO tasks FROM onboarding_tasks t;
    PERFORM private.enqueue_applicant_email(NEW.id, 'application_accepted',
      jsonb_build_object('tasks', coalesce(tasks, '[]'::jsonb)),
      'application_accepted:' || NEW.id || ':' || txid_current());
  ELSIF NEW.status = 'rejected' THEN
    PERFORM private.enqueue_applicant_email(NEW.id, 'application_declined', '{}'::jsonb,
      'application_declined:' || NEW.id || ':' || txid_current());
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.volunteer_application_decided() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS volunteer_application_decided ON volunteer_applications;
CREATE TRIGGER volunteer_application_decided AFTER UPDATE OF status ON volunteer_applications
    FOR EACH ROW EXECUTE FUNCTION private.volunteer_application_decided();

-- ── 7. Remove from the season ─────────────────────────────────

-- This season's sections: in a session of the current camp year or later, or not tied to one.
CREATE OR REPLACE FUNCTION private.section_in_season(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM sections s LEFT JOIN sessions se ON se.id = s.session_id
                 WHERE s.id = p_section_id AND (se.id IS NULL OR se.year >= private.current_camp_year()));
$$;
REVOKE ALL ON FUNCTION private.section_in_season(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.section_in_season(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_from_season(p_volunteer_id UUID, p_reason TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  why   TEXT := nullif(btrim(p_reason), '');
  v     volunteers;
  first TEXT;
  n_lead INT; n_support INT;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can remove a volunteer from the season' USING ERRCODE = '42501';
  END IF;
  IF why IS NULL THEN
    RAISE EXCEPTION 'Give a reason. It goes in the email to them and in History.' USING ERRCODE = 'P0001';
  END IF;
  IF length(why) > 500 THEN
    RAISE EXCEPTION 'Keep the reason under 500 characters' USING ERRCODE = '22001';
  END IF;
  SELECT * INTO v FROM volunteers WHERE id = p_volunteer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No volunteer with that id' USING ERRCODE = 'P0002'; END IF;
  IF v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'They were already removed from this season' USING ERRCODE = 'P0001';
  END IF;

  -- Every row this changes carries the reason into the audit log (History).
  PERFORM private.set_reason('Removed from the season: ' || why);
  UPDATE sections s SET lead_id = NULL
   WHERE s.lead_id = p_volunteer_id AND private.section_in_season(s.id);
  GET DIAGNOSTICS n_lead = ROW_COUNT;
  DELETE FROM section_supports ss
   WHERE ss.volunteer_id = p_volunteer_id AND private.section_in_season(ss.section_id);
  GET DIAGNOSTICS n_support = ROW_COUNT;
  -- Upcoming duty claims only; past ones stay for hours records.
  DELETE FROM duty_assignments da USING duty_slots ds
   WHERE da.duty_slot_id = ds.id AND da.volunteer_id = p_volunteer_id
     AND ds.slot_date >= (now() AT TIME ZONE 'America/Denver')::date;
  UPDATE volunteers SET removed_at = now(), removed_reason = why, removed_by = auth.uid()
   WHERE id = p_volunteer_id;

  SELECT coalesce(nullif(btrim(v.preferred_name), ''),
                  (SELECT a.first_name FROM volunteer_applications a WHERE a.user_id = v.id ORDER BY a.created_at DESC LIMIT 1),
                  split_part(p.display_name, ' ', 1))
    INTO first FROM profiles p WHERE p.id = v.id;
  PERFORM private.enqueue_notification(p_volunteer_id, 'volunteer_removed',
    jsonb_build_object('first_name', first, 'reason', why, 'year', private.current_camp_year()),
    'volunteer_removed:' || p_volunteer_id || ':' || txid_current());
  PERFORM private.set_reason(NULL);
  RETURN n_lead + n_support;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_from_season(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_from_season(UUID, TEXT) TO authenticated;

-- A removed volunteer can't be put back on a crew (accept them again first).
CREATE OR REPLACE FUNCTION private.guard_removed_crew()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who UUID;
BEGIN
  -- Separate statements: NEW has only one of the two columns.
  IF TG_TABLE_NAME = 'sections' THEN who := NEW.lead_id; ELSE who := NEW.volunteer_id; END IF;
  IF who IS NOT NULL AND EXISTS (SELECT 1 FROM volunteers WHERE id = who AND removed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'That volunteer was removed from this season, so they can''t join a crew' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_removed_crew() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_removed_crew ON sections;
CREATE TRIGGER guard_removed_crew BEFORE INSERT OR UPDATE OF lead_id ON sections
    FOR EACH ROW WHEN (NEW.lead_id IS NOT NULL) EXECUTE FUNCTION private.guard_removed_crew();
DROP TRIGGER IF EXISTS guard_removed_crew ON section_supports;
CREATE TRIGGER guard_removed_crew BEFORE INSERT OR UPDATE ON section_supports
    FOR EACH ROW EXECUTE FUNCTION private.guard_removed_crew();

-- ── 8. Photos: private bucket, signed URLs ────────────────────
-- Files live at volunteer-photos/<volunteer id>/<file>. The volunteer uploads and deletes in their
-- own folder; admins read every photo; a parent reads a photo only while crew_photo_visible().

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('volunteer-photos', 'volunteer-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
                               allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The weeks (sessions) the signed-in parent has a seated camper in this camp year.
CREATE OR REPLACE FUNCTION private.my_seated_weeks()
RETURNS TABLE (session_id UUID, week SMALLINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT DISTINCT s.session_id, s.week
  FROM registrations r
  JOIN students st ON st.id = r.student_id AND st.parent_id = auth.uid()
  JOIN sections s ON s.id = r.section_id
  WHERE r.status IN ('confirmed', 'pending') AND r.year >= private.current_camp_year()
    AND s.cancelled_at IS NULL;
$$;
REVOKE ALL ON FUNCTION private.my_seated_weeks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.my_seated_weeks() TO authenticated;

-- Sections running in the same week as one of the caller's seated campers.
CREATE OR REPLACE FUNCTION private.section_in_my_weeks(p_session_id UUID, p_week SMALLINT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  -- Same session; or, where either side isn't tied to a session, overlapping weeks (a section
  -- with no week runs both).
  SELECT EXISTS (SELECT 1 FROM private.my_seated_weeks() w
                 WHERE (p_session_id IS NOT NULL AND w.session_id = p_session_id)
                    OR ((p_session_id IS NULL OR w.session_id IS NULL)
                        AND (w.week IS NULL OR p_week IS NULL OR w.week = p_week)));
$$;
REVOKE ALL ON FUNCTION private.section_in_my_weeks(UUID, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.section_in_my_weeks(UUID, SMALLINT) TO authenticated;

-- A parent may read this file: it is a current, consented photo of someone crewing a section in
-- one of their seated weeks.
CREATE OR REPLACE FUNCTION private.crew_photo_visible(p_path TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1 FROM volunteers v
    JOIN sections s ON s.cancelled_at IS NULL
     AND (s.lead_id = v.id OR EXISTS (SELECT 1 FROM section_supports ss WHERE ss.section_id = s.id AND ss.volunteer_id = v.id))
    WHERE v.photo_path = p_path AND v.removed_at IS NULL AND private.volunteer_photo_ok(v.id)
      AND private.section_in_season(s.id) AND private.section_in_my_weeks(s.session_id, s.week));
$$;
REVOKE ALL ON FUNCTION private.crew_photo_visible(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.crew_photo_visible(TEXT) TO authenticated;

DROP POLICY IF EXISTS "volunteer_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "volunteer_photos_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "volunteer_photos_read"       ON storage.objects;
CREATE POLICY "volunteer_photos_insert_own" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'volunteer-photos' AND (storage.foldername(name))[1] = auth.uid()::text
                AND private.auth_is_volunteer());
CREATE POLICY "volunteer_photos_delete_own" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'volunteer-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "volunteer_photos_read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'volunteer-photos' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.auth_user_role() = 'admin'
      OR private.crew_photo_visible(name)));

-- ── 9. Meet the teachers ──────────────────────────────────────
-- One row per crew member per section, for every week the caller (a parent) has a seated camper in
-- this camp year; admins get every week of the year. Only the preferred name (else the first
-- name), pronunciation, bio and a photo path when photo_ok. my_campers names the caller's campers
-- in that section.
CREATE OR REPLACE FUNCTION public.meet_the_crew()
RETURNS TABLE (session_id UUID, session_name TEXT, week SMALLINT, start_date DATE, end_date DATE,
               section_id UUID, class_name TEXT, section_label TEXT, room TEXT, my_campers TEXT,
               volunteer_id UUID, crew_role TEXT, name TEXT, pronunciation TEXT, bio TEXT, photo_path TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH crew AS (
    SELECT s.id AS section_id, s.lead_id AS volunteer_id, 'lead'::text AS crew_role FROM sections s WHERE s.lead_id IS NOT NULL
    UNION ALL
    SELECT ss.section_id, ss.volunteer_id, 'support' FROM section_supports ss
  )
  SELECT s.session_id, se.name, s.week, se.start_date, se.end_date,
         s.id, c.name, s.label, s.room,
         (SELECT string_agg(coalesce(nullif(st.first_name, ''), split_part(st.full_name, ' ', 1)), ' and ' ORDER BY st.full_name)
            FROM registrations r JOIN students st ON st.id = r.student_id
           WHERE r.section_id = s.id AND st.parent_id = auth.uid() AND r.status IN ('confirmed', 'pending')),
         v.id, cr.crew_role,
         coalesce(nullif(btrim(v.preferred_name), ''), split_part(p.display_name, ' ', 1)),
         v.pronunciation, v.bio,
         CASE WHEN private.volunteer_photo_ok(v.id) THEN v.photo_path END
  FROM crew cr
  JOIN sections s ON s.id = cr.section_id AND s.cancelled_at IS NULL
  JOIN classes c ON c.id = s.class_id
  LEFT JOIN sessions se ON se.id = s.session_id
  JOIN volunteers v ON v.id = cr.volunteer_id AND v.removed_at IS NULL
  JOIN profiles p ON p.id = v.id AND p.role = 'volunteer'
  WHERE (se.id IS NULL OR se.year >= private.current_camp_year())
    AND (private.auth_user_role() = 'admin' OR private.section_in_my_weeks(s.session_id, s.week))
  ORDER BY se.start_date NULLS LAST, s.week, c.name, s.label, cr.crew_role, 13;
$$;
REVOKE ALL ON FUNCTION public.meet_the_crew() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meet_the_crew() TO authenticated;

-- Rosters show the preferred name (migration_camp_week_ops.sql's version used the first word
-- of the account name).
CREATE OR REPLACE FUNCTION public.section_lead_names()
RETURNS TABLE (section_id UUID, lead_first_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, coalesce(nullif(btrim(v.preferred_name), ''), split_part(p.display_name, ' ', 1))
  FROM sections s JOIN profiles p ON p.id = s.lead_id LEFT JOIN volunteers v ON v.id = s.lead_id
  WHERE private.auth_user_role() = 'admin'
     OR private.auth_is_volunteer()
     OR private.auth_parent_has_section(s.id);
$$;

-- ── 10. Audit the new tables ──────────────────────────────────
DROP TRIGGER IF EXISTS audit_log_change ON interview_slot_links;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON interview_slot_links
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('slot_id');
DROP TRIGGER IF EXISTS audit_log_change ON onboarding_tasks;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON onboarding_tasks
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('key');
DROP TRIGGER IF EXISTS audit_log_change ON volunteer_tasks;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON volunteer_tasks
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('volunteer_id,task_key');

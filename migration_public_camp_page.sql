-- Migration: public camp page and "notify me" list (spec 30, #150)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: deploy the send-notifications Edge Function BEFORE applying this migration (it must know
-- the three new templates, or their emails fail; the redeployed sender also leaves any unknown
-- template queued instead of failing it). Then apply after migration_notifications.sql (the outbox
-- and pg_cron), migration_season_settings.sql and migration_audit_log.sql. Then re-apply
-- migration_demo_environment.sql on the demo project (its reset seeds sessions.location and
-- clears the notify list).
--
-- Decided 2026-10-17: one always-current public page per season, so emails link to it instead of
-- repeating details; a "notify me" signup needs a confirmation click (double opt-in) before we
-- send anything else, so the form can't be used to mail strangers.
--   * sessions.location: the building and address of each camp week (it was hard-coded in the app).
--   * public_camp_info(): what a signed-out visitor may see: season status, weeks with dates, hours,
--     place and daily schedule, and courses with ages and full / not full. No people, no counts.
--   * interest_signups and join_interest_list() / confirm_interest() / leave_interest_list(): the
--     notify list. Confirm and unsubscribe links carry an HMAC-signed token; the key is a Vault
--     secret made here, and it never leaves the database.
--   * my_interest() / set_my_interest(): the signed-in parent's checkbox. It needs a confirmed
--     login email, so there's no second opt-in.
--   * private.send_interest_notices(), every minute, for the public camp year only: one
--     'registration_opening_soon' email per announced opening time (a change sends exactly one
--     correction), and one 'registration_now_open' once the opening time has passed. Signups
--     still waiting when the public year rolls over move to the new year.
-- Season settings stay readable by signed-in users only; anon loses its unused table grant.

-- ── 1. Where each week happens ───────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'location') THEN
    ALTER TABLE sessions ADD COLUMN location TEXT;
    -- The app showed this venue for every week until now. Carry it over once, so nothing changes
    -- for families until an admin edits it; a re-run never refills a place an admin cleared.
    UPDATE sessions SET location = 'Cherry Creek High School';
  END IF;
END $$;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_location_length;
ALTER TABLE sessions ADD CONSTRAINT sessions_location_length CHECK (location IS NULL OR char_length(location) <= 200);
COMMENT ON COLUMN sessions.location IS 'Building and address of this camp week. Shown on /camp, the registration wizard, the parent Home sign and the volunteer apply page.';

-- Signed-out visitors read the opening time through public_camp_info() only. (RLS already
-- returned no rows to anon; this makes a direct read fail outright.)
REVOKE ALL ON season_settings FROM anon;

-- ── 2. The notify list ───────────────────────────────────────
-- One row per address per camp year. The address is stored lower-cased and trimmed, which gives
-- the case-insensitive uniqueness citext would, without another extension.

CREATE TABLE IF NOT EXISTS interest_signups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                TEXT NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
    year                 SMALLINT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at         TIMESTAMPTZ,
    unsubscribed_at      TIMESTAMPTZ,
    notified_opening_at  TIMESTAMPTZ,   -- when the last "opening soon" email was queued
    notified_opens_at    TIMESTAMPTZ,   -- the opening time that email announced (a new time sends one more)
    notified_open_at     TIMESTAMPTZ,   -- when the "now open" email was queued (once)
    UNIQUE (email, year)
);

ALTER TABLE interest_signups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_interest_signups" ON interest_signups;
CREATE POLICY "admin_read_interest_signups" ON interest_signups FOR SELECT TO authenticated
    USING (private.auth_user_role() = 'admin');
REVOKE ALL ON interest_signups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON interest_signups TO authenticated;   -- RLS: admins only. Every write goes through the RPCs below.

DROP TRIGGER IF EXISTS audit_log_change ON interest_signups;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON interest_signups
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');

-- ── 3. Which camp, and is it open? ───────────────────────────

-- The camp a visitor asking today means: the latest year with weeks on the sign-up forms, until
-- its last week is over, then the year after. With no weeks at all: this summer until the end of
-- June, then next summer.
CREATE OR REPLACE FUNCTION private.public_camp_year()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT (now() AT TIME ZONE 'America/Denver')::date AS today),
       a AS (SELECT max(year)::int AS y FROM sessions WHERE is_active)
  SELECT CASE
    WHEN a.y IS NULL THEN extract(year FROM t.today)::int + CASE WHEN extract(month FROM t.today) >= 7 THEN 1 ELSE 0 END
    WHEN EXISTS (SELECT 1 FROM sessions s WHERE s.is_active AND s.year = a.y AND s.end_date >= t.today) THEN a.y
    ELSE a.y + 1
  END
  FROM t, a;
$$;
REVOKE ALL ON FUNCTION private.public_camp_year() FROM PUBLIC, anon, authenticated;

-- A camp year's registration status, by the same rules registrations_before_insert() enforces:
--   upcoming       no classes are set up for the year's weeks yet, or the opening time is ahead
--   closed         an admin closed the camper form (Forms › on/off)
--   open           at least one class has a free seat
--   waitlist_only  every class is full, so a sign-up joins a waitlist
CREATE OR REPLACE FUNCTION private.camp_status(p_year INT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH secs AS (
    SELECT s.capacity,
           (SELECT count(*) FROM registrations r
             WHERE r.section_id = s.id AND r.status IN ('confirmed', 'pending', 'offered')) AS taken
    FROM sections s JOIN sessions se ON se.id = s.session_id
    WHERE se.is_active AND se.year = p_year AND s.cancelled_at IS NULL)
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM secs) THEN 'upcoming'
    WHEN (SELECT (config->>'enabled')::boolean FROM form_configs WHERE form_key = 'student_registration') IS FALSE THEN 'closed'
    WHEN coalesce((private.season_settings_for(p_year)).registration_opens_at > now(), false) THEN 'upcoming'
    WHEN EXISTS (SELECT 1 FROM secs WHERE taken < capacity) THEN 'open'
    ELSE 'waitlist_only'
  END;
$$;
REVOKE ALL ON FUNCTION private.camp_status(INT) FROM PUBLIC, anon, authenticated;

-- ── 4. The public page's data ────────────────────────────────
-- Only what a flyer would say. Weeks: name, dates, place, the days and hours classes run (earliest
-- start to latest end) and the daily schedule. Courses: name, description, the age range across
-- their sections and, per week, whether every section is full. No section labels, rooms, crews,
-- campers or seat counts.
CREATE OR REPLACE FUNCTION public.public_camp_info()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  yr      INT := private.public_camp_year();
  weeks   JSONB;
  courses JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'name', se.name, 'start_date', se.start_date, 'end_date', se.end_date, 'location', se.location,
           'days', h.days, 'starts', h.starts, 'ends', h.ends,
           'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object('title', i.title, 'start_time', i.start_time,
                                                                     'end_time', i.end_time, 'location', i.location)
                                                  ORDER BY i.start_time, i.title)
                                 FROM schedule_items i WHERE i.session_id = se.id), '[]'::jsonb))
         ORDER BY se.start_date), '[]'::jsonb)
    INTO weeks
  FROM sessions se
  LEFT JOIN LATERAL (
    SELECT mode() WITHIN GROUP (ORDER BY s.days) AS days, min(s.start_time) AS starts, max(s.end_time) AS ends
    FROM sections s WHERE s.session_id = se.id AND s.cancelled_at IS NULL) h ON true
  WHERE se.is_active AND se.year = yr;

  WITH secs AS (
    SELECT s.class_id, se.id AS session_id, se.name AS week, se.start_date, s.age_min, s.age_max,
           (SELECT count(*) FROM registrations r
             WHERE r.section_id = s.id AND r.status IN ('confirmed', 'pending', 'offered')) >= s.capacity AS is_full
    FROM sections s JOIN sessions se ON se.id = s.session_id
    WHERE se.is_active AND se.year = yr AND s.cancelled_at IS NULL),
  per_week AS (
    SELECT class_id, week, min(start_date) AS start_date, bool_and(is_full) AS is_full
    FROM secs GROUP BY class_id, session_id, week)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'name', c.name, 'description', c.description,
           'age_min', a.age_min, 'age_max', a.age_max, 'weeks', w.weeks)
         ORDER BY c.name), '[]'::jsonb)
    INTO courses
  FROM classes c
  JOIN LATERAL (SELECT min(x.age_min) AS age_min, max(x.age_max) AS age_max FROM secs x WHERE x.class_id = c.id) a ON true
  JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('week', p.week, 'full', p.is_full) ORDER BY p.start_date) AS weeks
                FROM per_week p WHERE p.class_id = c.id) w ON true
  WHERE EXISTS (SELECT 1 FROM secs x WHERE x.class_id = c.id);

  RETURN jsonb_build_object(
    'year', yr,
    'status', private.camp_status(yr),
    'registration_opens_at', (private.season_settings_for(yr)).registration_opens_at,
    'weeks', weeks,
    'courses', courses);
END;
$$;
REVOKE ALL ON FUNCTION public.public_camp_info() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_camp_info() TO anon, authenticated;

-- ── 5. Signed links ──────────────────────────────────────────
-- A token is "<signup id>.<first 32 hex of HMAC-SHA256(purpose:id)>", so a confirm link can't be
-- used to unsubscribe (or the reverse), and nobody can make one for an address they don't own.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'interest_link_key') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'interest_link_key',
      'Signs notify-me confirm and unsubscribe links (migration_public_camp_page.sql, spec 30)');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.interest_token(p_id UUID, p_purpose TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'interest_link_key');
BEGIN
  IF k IS NULL THEN
    RAISE EXCEPTION 'interest_link_key is missing from Vault: re-run migration_public_camp_page.sql';
  END IF;
  RETURN p_id::text || '.' || left(encode(extensions.hmac(p_purpose || ':' || p_id::text, k, 'sha256'), 'hex'), 32);
END;
$$;
REVOKE ALL ON FUNCTION private.interest_token(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- The signup a link points at, or NULL when the token is malformed or its signature doesn't match.
CREATE OR REPLACE FUNCTION private.interest_token_id(p_token TEXT, p_purpose TEXT)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid UUID;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{32}$' THEN
    RETURN NULL;
  END IF;
  sid := split_part(p_token, '.', 1)::uuid;
  RETURN CASE WHEN private.interest_token(sid, p_purpose) = p_token THEN sid END;
END;
$$;
REVOKE ALL ON FUNCTION private.interest_token_id(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Queue one email to a signup's address. Same dedupe key twice → queued once. Reserved
-- example.com addresses (the demo seed) are recorded as skipped, like every other email.
CREATE OR REPLACE FUNCTION private.queue_interest_email(p_email TEXT, p_template TEXT, p_payload JSONB, p_dedupe TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  undeliverable BOOLEAN := p_email LIKE '%@example.com' OR p_email LIKE '%.example.com';
BEGIN
  INSERT INTO notifications (recipient_email, template, payload, dedupe_key, status, last_error)
  VALUES (p_email, p_template, p_payload, p_dedupe,
          CASE WHEN undeliverable THEN 'cancelled' ELSE 'queued' END,
          CASE WHEN undeliverable THEN 'No deliverable address' END)
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.queue_interest_email(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 6. Join, confirm, leave (signed out) ─────────────────────

-- The inbox an address really reaches: lower-cased, without a +tag, and for Gmail without dots
-- (a.b+x@gmail.com and ab@googlemail.com are one mailbox). Caps count mailboxes, not spellings.
CREATE OR REPLACE FUNCTION private.mailbox(p_email TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  WITH a AS (SELECT split_part(split_part(lower(btrim(p_email)), '@', 1), '+', 1) AS l,
                    split_part(lower(btrim(p_email)), '@', 2) AS d)
  SELECT CASE WHEN d IN ('gmail.com', 'googlemail.com') THEN replace(l, '.', '') || '@gmail.com' ELSE l || '@' || d END
  FROM a;
$$;
REVOKE ALL ON FUNCTION private.mailbox(TEXT) FROM PUBLIC, anon, authenticated;

-- A keyed hash for the press log: HMAC-SHA256 under the same Vault key as the links, so a copy of
-- the log can't be reversed by hashing every likely IP or address.
CREATE OR REPLACE FUNCTION private.interest_hash(p_value TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'interest_link_key');
BEGIN
  IF k IS NULL THEN
    RAISE EXCEPTION 'interest_link_key is missing from Vault: re-run migration_public_camp_page.sql';
  END IF;
  RETURN encode(extensions.hmac('log:' || p_value, k, 'sha256'), 'hex');
END;
$$;
REVOKE ALL ON FUNCTION private.interest_hash(TEXT) FROM PUBLIC, anon, authenticated;

-- Every accepted "Notify me" press, for the caps below: keyed hashes of the caller's network and
-- of the mailbox, never the address itself. Rows older than two days are pruned on each press
-- and by the every-minute job.
CREATE TABLE IF NOT EXISTS private.interest_join_log (
    id       BIGSERIAL PRIMARY KEY,
    at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_hash  TEXT,
    mailbox_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS interest_join_log_at_idx ON private.interest_join_log (at);
REVOKE ALL ON private.interest_join_log FROM PUBLIC, anon, authenticated;

-- "Notify me" on /camp. Adds the address for the public camp year and sends one confirmation.
-- Caps, all counted on presses (never on who is on the list), all answered with the same
-- "try again later", so a refusal can't tell anyone whether an address is already confirmed:
--   per IP (Cloudflare's cf-connecting-ip only: x-forwarded-for's first entry is whatever the
--     client sends; skipped without it; IPv6 grouped by /64, since one household holds the whole
--     /64): 5 an hour, 20 a day;
--   per mailbox (see private.mailbox()): 3 a day, and one confirmation email a Denver day;
--   for the whole form: 20 a minute, 300 a day.
-- An advisory lock makes count-then-insert one step, so simultaneous presses can't overshoot.
CREATE OR REPLACE FUNCTION public.join_interest_list(p_email TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  addr    TEXT := lower(btrim(coalesce(p_email, '')));
  yr      INT  := private.public_camp_year();
  headers JSON := nullif(current_setting('request.headers', true), '')::json;
  ip      INET;
  ip_h    TEXT;
  box_h   TEXT;
  su      interest_signups;
BEGIN
  IF char_length(addr) > 254 OR addr ~ '[<>,;"()[:space:]]'
     OR addr !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Enter an email address like name@example.com.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    ip := nullif(btrim(headers->>'cf-connecting-ip'), '')::inet;
  EXCEPTION WHEN invalid_text_representation THEN
    ip := NULL;   -- not an address: no IP cap, like no header
  END;
  IF ip IS NOT NULL THEN
    ip_h := private.interest_hash('ip:' || network(set_masklen(ip, CASE WHEN family(ip) = 6 THEN 64 ELSE 32 END))::text);
  END IF;
  box_h := private.interest_hash('mailbox:' || private.mailbox(addr));

  PERFORM pg_advisory_xact_lock(hashtextextended('join_interest_list', 0));
  DELETE FROM private.interest_join_log WHERE at < now() - interval '2 days';
  IF (ip_h IS NOT NULL AND (
        (SELECT count(*) FROM private.interest_join_log WHERE ip_hash = ip_h AND at > now() - interval '1 hour') >= 5
     OR (SELECT count(*) FROM private.interest_join_log WHERE ip_hash = ip_h AND at > now() - interval '1 day') >= 20))
     OR (SELECT count(*) FROM private.interest_join_log WHERE mailbox_hash = box_h AND at > now() - interval '1 day') >= 3
     OR (SELECT count(*) FROM private.interest_join_log WHERE at > now() - interval '1 minute') >= 20
     OR (SELECT count(*) FROM private.interest_join_log WHERE at > now() - interval '1 day') >= 300 THEN
    RAISE EXCEPTION 'We couldn''t add this address right now. Please try again later.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO private.interest_join_log (ip_hash, mailbox_hash) VALUES (ip_h, box_h);

  INSERT INTO interest_signups (email, year) VALUES (addr, yr) ON CONFLICT (email, year) DO NOTHING;
  SELECT * INTO su FROM interest_signups WHERE email = addr AND year = yr;
  IF su.confirmed_at IS NOT NULL AND su.unsubscribed_at IS NULL THEN
    RETURN;   -- already on the list: nothing to confirm (and the same answer as everyone else)
  END IF;
  PERFORM private.queue_interest_email(addr, 'interest_confirm',
    jsonb_build_object('year', yr, 'token', private.interest_token(su.id, 'confirm')),
    'interest_confirm:' || box_h || ':' || (now() AT TIME ZONE 'America/Denver')::date);
END;
$$;
REVOKE ALL ON FUNCTION public.join_interest_list(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_interest_list(TEXT) TO anon, authenticated;

-- The confirm link (/camp/confirm). Also brings back an address that had unsubscribed: only the
-- inbox owner has the link. Returns the camp year.
CREATE OR REPLACE FUNCTION public.confirm_interest(p_token TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  sid UUID := private.interest_token_id(p_token, 'confirm');
  yr  INT;
BEGIN
  UPDATE interest_signups
     SET confirmed_at = CASE WHEN confirmed_at IS NULL OR unsubscribed_at IS NOT NULL THEN now() ELSE confirmed_at END,
         unsubscribed_at = NULL
   WHERE id = sid
  RETURNING year INTO yr;
  IF yr IS NULL THEN
    RAISE EXCEPTION 'This link doesn''t work. It may be cut short, or too old. Sign up again on the camp page.' USING ERRCODE = 'P0001';
  END IF;
  RETURN yr;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_interest(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_interest(TEXT) TO anon, authenticated;

-- The unsubscribe link in every notice (/camp/unsubscribe). Returns the camp year.
CREATE OR REPLACE FUNCTION public.leave_interest_list(p_token TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  sid UUID := private.interest_token_id(p_token, 'unsubscribe');
  yr  INT;
BEGIN
  UPDATE interest_signups SET unsubscribed_at = coalesce(unsubscribed_at, now())
   WHERE id = sid
  RETURNING year INTO yr;
  IF yr IS NULL THEN
    RAISE EXCEPTION 'This link doesn''t work. It may be cut short. Reply to any camp email and we''ll take you off the list.' USING ERRCODE = 'P0001';
  END IF;
  RETURN yr;
END;
$$;
REVOKE ALL ON FUNCTION public.leave_interest_list(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_interest_list(TEXT) TO anon, authenticated;

-- ── 7. The signed-in parent's checkbox ───────────────────────
-- Uses the login email, and only once sign-up has confirmed it.

CREATE OR REPLACE FUNCTION public.my_interest()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM interest_signups i JOIN auth.users u ON lower(u.email) = i.email
    WHERE u.id = auth.uid() AND i.year = private.public_camp_year()
      AND i.confirmed_at IS NOT NULL AND i.unsubscribed_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.my_interest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_interest() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_interest(p_on BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  addr TEXT := (SELECT lower(btrim(email)) FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL);
  yr   INT  := private.public_camp_year();
BEGIN
  IF addr IS NULL OR addr = '' THEN
    RAISE EXCEPTION 'Confirm your account email first, then try again' USING ERRCODE = '42501';
  END IF;
  IF p_on THEN
    INSERT INTO interest_signups (email, year, confirmed_at) VALUES (addr, yr, now())
    ON CONFLICT (email, year) DO UPDATE
      SET confirmed_at = coalesce(interest_signups.confirmed_at, now()), unsubscribed_at = NULL;
  ELSE
    UPDATE interest_signups SET unsubscribed_at = coalesce(unsubscribed_at, now())
     WHERE email = addr AND year = yr;
  END IF;
  RETURN public.my_interest();
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_interest(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_interest(BOOLEAN) TO authenticated;

-- ── 8. Notices (pg_cron, every minute) ───────────────────────
-- Only for the public camp year (private.public_camp_year()), confirmed and subscribed addresses.
--   0. The press log loses rows older than two days. A queued "opening soon" whose opening time
--      has passed says nothing true: it's cancelled (never a row that has failed for good).
--   1. When the public year rolls over, signups still waiting for "now open" move to the new year
--      (unless the address already has a row there). Nothing is ever sent for an earlier year.
--   2. With a future opening time, settled for 10 minutes (so fixing a typo doesn't send two):
--      a "now open" sent for an earlier opening is cleared (and a copy still waiting to send is
--      cancelled), since registration is shut again until the new time; then one
--      'registration_opening_soon' per signup whose last notice announced a different time, which
--      cancels that signup's older one if it hasn't gone out yet. The dedupe key holds the time and
--      the previous notice's stamp, so A → B → A sends exactly one correction each time.
--   3. Once the opening time has passed (and only then: no opening time, no "now open", even with
--      classes set up) and registration is open or waitlist-only: one 'registration_now_open'.
-- Each email carries its own unsubscribe link. Returns how many emails it queued.
CREATE OR REPLACE FUNCTION private.send_interest_notices()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  yr      INT := private.public_camp_year();
  ss      season_settings := private.season_settings_for(yr);
  opens   TIMESTAMPTZ := ss.registration_opens_at;
  su      RECORD;
  dk      TEXT;
  n       INT := 0;
BEGIN
  DELETE FROM private.interest_join_log WHERE at < now() - interval '2 days';
  UPDATE notifications SET status = 'cancelled', last_error = 'The opening time passed before it was sent'
   WHERE template = 'registration_opening_soon' AND status IN ('queued', 'failed') AND attempts < 3
     AND (payload->>'opens_at')::timestamptz <= now();

  UPDATE interest_signups i SET year = yr, notified_opening_at = NULL, notified_opens_at = NULL
   WHERE i.year < yr AND i.confirmed_at IS NOT NULL AND i.unsubscribed_at IS NULL AND i.notified_open_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM interest_signups j WHERE j.email = i.email AND j.year = yr)
     AND i.year = (SELECT max(j.year) FROM interest_signups j      -- one row per address moves
                    WHERE j.email = i.email AND j.year < yr AND j.confirmed_at IS NOT NULL
                      AND j.unsubscribed_at IS NULL AND j.notified_open_at IS NULL);

  IF opens IS NULL THEN
    RETURN n;
  ELSIF opens > now() THEN
    IF ss.updated_at > now() - interval '10 minutes' THEN RETURN n; END IF;
    UPDATE notifications SET status = 'cancelled', last_error = 'Registration was rescheduled before it was sent'
     WHERE template = 'registration_now_open' AND status IN ('queued', 'failed') AND attempts < 3
       AND payload->>'year' = yr::text;
    UPDATE interest_signups SET notified_open_at = NULL WHERE year = yr AND notified_open_at IS NOT NULL;
    FOR su IN
      SELECT id, email, notified_opening_at FROM interest_signups
       WHERE year = yr AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND notified_open_at IS NULL
         AND notified_opens_at IS DISTINCT FROM opens
    LOOP
      dk := 'interest_opening_soon:' || su.id || ':' || extract(epoch FROM opens)::bigint
              || ':' || coalesce(floor(extract(epoch FROM su.notified_opening_at) * 1000)::bigint, 0);
      UPDATE notifications SET status = 'cancelled', last_error = 'A newer opening time replaced it before it was sent'
       WHERE dedupe_key LIKE 'interest_opening_soon:' || su.id || ':%' AND dedupe_key <> dk
         AND status IN ('queued', 'failed') AND attempts < 3;
      PERFORM private.queue_interest_email(su.email, 'registration_opening_soon',
        jsonb_build_object('year', yr, 'opens_at', opens, 'token', private.interest_token(su.id, 'unsubscribe')), dk);
      UPDATE interest_signups SET notified_opening_at = clock_timestamp(), notified_opens_at = opens WHERE id = su.id;
      n := n + 1;
    END LOOP;
  ELSIF private.camp_status(yr) IN ('open', 'waitlist_only') THEN
    FOR su IN
      SELECT id, email, notified_opening_at FROM interest_signups
       WHERE year = yr AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND notified_open_at IS NULL
    LOOP
      PERFORM private.queue_interest_email(su.email, 'registration_now_open',
        jsonb_build_object('year', yr, 'token', private.interest_token(su.id, 'unsubscribe')),
        'interest_now_open:' || su.id || ':' || extract(epoch FROM opens)::bigint
          || ':' || coalesce(floor(extract(epoch FROM su.notified_opening_at) * 1000)::bigint, 0));
      UPDATE interest_signups SET notified_open_at = now() WHERE id = su.id;
      n := n + 1;
    END LOOP;
  END IF;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION private.send_interest_notices() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('interest-notices') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'interest-notices');
  PERFORM cron.schedule('interest-notices', '* * * * *', $cron$SELECT private.send_interest_notices()$cron$);
END $$;

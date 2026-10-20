-- Migration: a weekly duty minimum, in minutes (spec 38, #205)
-- Apply in Supabase Dashboard > SQL Editor (or via the Management API). Safe to re-run.
-- Order: after migration_duty_locks.sql (duty_settings, the drop rules) and
-- migration_volunteer_onboarding.sql (removed volunteers). Deploy send-notifications first: it
-- knows the two new templates (duty_assigned, duty_minimum_reminder); an older sender holds them
-- for 6 hours.
--
-- Decided 2026-10-19 (Q-V4):
--   * each duty type has a length in minutes; every volunteer crewed in a week needs
--     minutes_per_week duty minutes that week, any mix of duties (0 = no minimum, the default);
--   * the deadline is signup_deadline_days before the week starts: volunteers sign up through
--     that day; after it, a volunteer can't drop a duty that takes them under the minimum, and
--     admins assign anyone still short (no auto-assign);
--   * 2 days before the deadline, each crewed volunteer still short gets one reminder email;
--   * a volunteer an admin adds to a duty gets an email (not when they sign themselves up).
-- "Crewed in a week": lead or support on a section in that session (a section with no session
-- counts for every session of the current camp year), not cancelled, and not removed from the
-- season. A duty counts toward the session whose dates it falls in.

-- ── 1. Lengths and the minimum ────────────────────────────────

ALTER TABLE duty_types ADD COLUMN IF NOT EXISTS minutes SMALLINT NOT NULL DEFAULT 30
    CHECK (minutes BETWEEN 5 AND 480);
ALTER TABLE duty_settings
    ADD COLUMN IF NOT EXISTS minutes_per_week     SMALLINT NOT NULL DEFAULT 0 CHECK (minutes_per_week BETWEEN 0 AND 1200),
    ADD COLUMN IF NOT EXISTS signup_deadline_days SMALLINT NOT NULL DEFAULT 7 CHECK (signup_deadline_days BETWEEN 0 AND 60);

CREATE OR REPLACE FUNCTION private.duty_settings_for(p_year INT)
RETURNS duty_settings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s duty_settings;
BEGIN
  SELECT * INTO s FROM duty_settings WHERE year = p_year;
  IF NOT FOUND THEN
    s.year := p_year;
    s.drop_lock_days := 3;
    s.minutes_per_week := 0;
    s.signup_deadline_days := 7;
    s.updated_at := now();
  END IF;
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION private.duty_settings_for(INT) FROM PUBLIC, anon, authenticated;

-- ── 2. Helpers ────────────────────────────────────────────────

-- The sessions a volunteer is crewed in.
CREATE OR REPLACE FUNCTION private.crewed_sessions(p_volunteer UUID)
RETURNS SETOF sessions LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT DISTINCT se.*
  FROM sections s
  JOIN sessions se ON se.id = s.session_id
                   OR (s.session_id IS NULL AND se.year = private.current_camp_year())
  WHERE s.cancelled_at IS NULL
    AND (s.lead_id = p_volunteer
         OR EXISTS (SELECT 1 FROM section_supports ss WHERE ss.section_id = s.id AND ss.volunteer_id = p_volunteer))
    AND EXISTS (SELECT 1 FROM volunteers v WHERE v.id = p_volunteer AND v.removed_at IS NULL);
$$;
REVOKE ALL ON FUNCTION private.crewed_sessions(UUID) FROM PUBLIC, anon, authenticated;

-- A volunteer's duty minutes in a session (duties dated inside it).
CREATE OR REPLACE FUNCTION private.duty_minutes(p_volunteer UUID, p_session_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(dt.minutes), 0)::int
  FROM duty_assignments da
  JOIN duty_slots ds ON ds.id = da.duty_slot_id
  JOIN duty_types dt ON dt.id = ds.duty_type_id
  JOIN sessions se ON se.id = p_session_id
  WHERE da.volunteer_id = p_volunteer AND ds.slot_date BETWEEN se.start_date AND se.end_date;
$$;
REVOKE ALL ON FUNCTION private.duty_minutes(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- The last day to sign up for a week's duties.
CREATE OR REPLACE FUNCTION private.duty_deadline(p_session sessions)
RETURNS DATE LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT p_session.start_date - (private.duty_settings_for(p_session.year)).signup_deadline_days;
$$;
REVOKE ALL ON FUNCTION private.duty_deadline(sessions) FROM PUBLIC, anon, authenticated;

-- What a volunteer is called in emails: preferred name, else application first name, else the
-- first word of the account name (as remove_from_season() does).
CREATE OR REPLACE FUNCTION private.volunteer_first_name(p_volunteer UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(btrim(v.preferred_name), ''),
                  (SELECT a.first_name FROM volunteer_applications a WHERE a.user_id = v.id ORDER BY a.created_at DESC LIMIT 1),
                  split_part(p.display_name, ' ', 1))
  FROM volunteers v JOIN profiles p ON p.id = v.id WHERE v.id = p_volunteer;
$$;
REVOKE ALL ON FUNCTION private.volunteer_first_name(UUID) FROM PUBLIC, anon, authenticated;

-- ── 3. After the deadline, no drop below the minimum ──────────
-- Its own trigger, after duty_assignments_guard (spec 37) in name order, so it runs only on a
-- drop the lock rules already allow. One volunteer's drops queue behind each other, so two drops
-- at once can't both slip under the minimum.

CREATE OR REPLACE FUNCTION private.duty_assignments_minimum()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  slot   duty_slots;
  mins   INT;
  need   INT;
  se     sessions;
  today  DATE := (now() AT TIME ZONE 'America/Denver')::date;
BEGIN
  IF auth.uid() IS NULL OR private.auth_user_role() = 'admin' THEN
    RETURN OLD;
  END IF;
  SELECT * INTO slot FROM duty_slots WHERE id = OLD.duty_slot_id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  SELECT dt.minutes INTO mins FROM duty_types dt WHERE dt.id = slot.duty_type_id;

  PERFORM pg_advisory_xact_lock(hashtextextended('duty_minimum:' || OLD.volunteer_id, 0));
  FOR se IN SELECT * FROM private.crewed_sessions(OLD.volunteer_id) c
            WHERE slot.slot_date BETWEEN c.start_date AND c.end_date LOOP
    need := (private.duty_settings_for(se.year)).minutes_per_week;
    IF need > 0 AND today > private.duty_deadline(se)
       AND private.duty_minutes(OLD.volunteer_id, se.id) - mins < need THEN
      RAISE EXCEPTION 'You need this duty for your %-minute minimum in %. Ask the camp if you can''t make it.', need, se.name
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.duty_assignments_minimum() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS duty_assignments_minimum ON duty_assignments;
CREATE TRIGGER duty_assignments_minimum BEFORE DELETE ON duty_assignments
    FOR EACH ROW EXECUTE FUNCTION private.duty_assignments_minimum();

-- ── 4. What volunteers and admins read ────────────────────────

-- The caller's crewed weeks that haven't ended, with the minimum and their minutes. No rows when
-- there's no minimum.
CREATE OR REPLACE FUNCTION public.my_duty_weeks()
RETURNS TABLE (session_id UUID, name TEXT, start_date DATE, end_date DATE,
               required_minutes INT, my_minutes INT, deadline DATE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT c.id, c.name, c.start_date, c.end_date,
         (private.duty_settings_for(c.year)).minutes_per_week::int,
         private.duty_minutes(auth.uid(), c.id),
         private.duty_deadline(c)
  FROM private.crewed_sessions(auth.uid()) c
  WHERE c.end_date >= (now() AT TIME ZONE 'America/Denver')::date
    AND (private.duty_settings_for(c.year)).minutes_per_week > 0
  ORDER BY c.start_date;
$$;
REVOKE ALL ON FUNCTION public.my_duty_weeks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_duty_weeks() TO authenticated;

-- Admins: everyone crewed in a session who is under its minimum.
CREATE OR REPLACE FUNCTION public.admin_duty_shortfall(p_session_id UUID)
RETURNS TABLE (volunteer_id UUID, display_name TEXT, minutes INT, required_minutes INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  se   sessions;
  need INT;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can see who is short on duties' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO se FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN; END IF;
  need := (private.duty_settings_for(se.year)).minutes_per_week;
  IF need = 0 THEN RETURN; END IF;
  RETURN QUERY
    SELECT v.id, p.display_name, private.duty_minutes(v.id, se.id), need
    FROM volunteers v JOIN profiles p ON p.id = v.id
    WHERE EXISTS (SELECT 1 FROM private.crewed_sessions(v.id) c WHERE c.id = se.id)
      AND private.duty_minutes(v.id, se.id) < need
    ORDER BY private.duty_minutes(v.id, se.id), p.display_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_duty_shortfall(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_duty_shortfall(UUID) TO authenticated;

-- ── 5. Emails ─────────────────────────────────────────────────

-- An admin put a volunteer on a duty.
CREATE OR REPLACE FUNCTION private.notify_duty_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  slot duty_slots;
  dt   duty_types;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' OR NEW.volunteer_id = auth.uid()
     OR NOT private.should_notify() THEN
    RETURN NULL;
  END IF;
  SELECT * INTO slot FROM duty_slots WHERE id = NEW.duty_slot_id;
  SELECT * INTO dt FROM duty_types WHERE id = slot.duty_type_id;
  PERFORM private.enqueue_notification(NEW.volunteer_id, 'duty_assigned',
    jsonb_build_object('first_name', private.volunteer_first_name(NEW.volunteer_id),
                       'duty', dt.name, 'description', dt.description, 'minutes', dt.minutes,
                       'slot_date', slot.slot_date),
    'duty_assigned:' || NEW.id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_duty_assigned() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_duty_assigned ON duty_assignments;
CREATE TRIGGER notify_duty_assigned AFTER INSERT ON duty_assignments
    FOR EACH ROW EXECUTE FUNCTION private.notify_duty_assigned();

-- Daily: from 2 days before a week's deadline through the deadline, one reminder per short
-- volunteer and week (a missed run still sends the next day; the dedupe key keeps it to one).
-- Returns how many short volunteers it found.
CREATE OR REPLACE FUNCTION private.send_duty_minimum_reminders()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'America/Denver')::date;
  se    sessions;
  need  INT;
  r     RECORD;
  n     INT := 0;
BEGIN
  FOR se IN SELECT * FROM sessions WHERE is_active LOOP
    need := (private.duty_settings_for(se.year)).minutes_per_week;
    CONTINUE WHEN need = 0 OR today NOT BETWEEN private.duty_deadline(se) - 2 AND private.duty_deadline(se);
    FOR r IN
      SELECT v.id, private.duty_minutes(v.id, se.id) AS mins
      FROM volunteers v
      WHERE EXISTS (SELECT 1 FROM private.crewed_sessions(v.id) c WHERE c.id = se.id)
    LOOP
      CONTINUE WHEN r.mins >= need;
      PERFORM private.enqueue_notification(r.id, 'duty_minimum_reminder',
        jsonb_build_object('first_name', private.volunteer_first_name(r.id), 'week', se.name,
                           'minutes', r.mins, 'required', need, 'deadline', private.duty_deadline(se)),
        'duty_minimum_reminder:' || r.id || ':' || se.id);
      n := n + 1;
    END LOOP;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION private.send_duty_minimum_reminders() FROM PUBLIC, anon, authenticated;

-- 15:00 UTC is 9 AM in Denver in summer (8 AM in winter).
DO $$
BEGIN
  PERFORM cron.unschedule('duty-minimum-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'duty-minimum-reminders');
  PERFORM cron.schedule('duty-minimum-reminders', '0 15 * * *', 'SELECT private.send_duty_minimum_reminders()');
END $$;

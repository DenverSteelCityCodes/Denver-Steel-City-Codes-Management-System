-- One held spot per camper per camp week.
--
-- Camp runs one class per camper per week (the registration wizard already offers a single
-- class choice per week), but the class browser let a parent hold seats in two classes that
-- run at the same time. The rule is enforced here so it can't be bypassed from the client:
--   * a camper who already holds a spot (pending/confirmed) in a week can't take a second
--     open seat that same week;
--   * joining the WAITLIST of a full class as a backup is still allowed;
--   * admins keep their override (they return early, as before).
--
-- "Same week" is decided by sections.week, the column the admin UI edits and the wizard reads:
-- two sections clash when their weeks are equal or either runs both weeks (week IS NULL).
-- sections.session_id is derived from week by a trigger so the two can't drift apart (the
-- attendance board and CSV export find a week's sections by session_id).
--
-- Closing the camper registration form (Forms → Close form) is enforced here too, so it also
-- stops registrations from the class browser, not just the wizard.
--
-- Apply after migration_security_hardening.sql, and re-apply after migration_soft_cancel.sql
-- (the cancelled-section check reads sections.cancelled_at).

-- ── 1. sections.session_id follows sections.week ──────────────

CREATE OR REPLACE FUNCTION public.sections_sync_session()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr INT;
BEGIN
  -- An insert that names its session (the seed, a future UI) is taken as given.
  IF TG_OP = 'INSERT' AND NEW.session_id IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.week IS NOT DISTINCT FROM OLD.week THEN RETURN NEW; END IF;
  IF NEW.week IS NULL THEN NEW.session_id := NULL; RETURN NEW; END IF;

  -- Stay in the section's current camp year; a new section joins the active year.
  yr := COALESCE(
    (SELECT year FROM sessions WHERE id = NEW.session_id),
    (SELECT MAX(year) FROM sessions WHERE is_active),
    (SELECT MAX(year) FROM sessions));
  -- Week N is that year's Nth session by date, hidden or not (same rule as campSessions()).
  NEW.session_id := (SELECT id FROM sessions WHERE year = yr ORDER BY start_date OFFSET NEW.week - 1 LIMIT 1);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sections_sync_session() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sections_sync_session ON sections;
CREATE TRIGGER sections_sync_session BEFORE INSERT OR UPDATE OF week ON sections
    FOR EACH ROW EXECUTE FUNCTION public.sections_sync_session();

-- Sections created in the admin UI before this trigger existed have a week but no session.
UPDATE sections sec SET session_id = (
  SELECT s.id FROM sessions s
  WHERE s.year = COALESCE((SELECT MAX(year) FROM sessions WHERE is_active), (SELECT MAX(year) FROM sessions))
  ORDER BY s.start_date OFFSET sec.week - 1 LIMIT 1)
WHERE sec.week IS NOT NULL AND sec.session_id IS NULL;

-- ── 2. Registration rules ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrations_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  sec     sections%ROWTYPE;
  stu_age SMALLINT;
  taken   INT;
  clash   TEXT;
BEGIN
  -- Row lock serializes concurrent sign-ups for the same section so capacity can't be overrun.
  SELECT * INTO sec FROM sections WHERE id = NEW.section_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That section no longer exists' USING ERRCODE = 'P0001';
  END IF;

  NEW.year := COALESCE(
    (SELECT year FROM sessions WHERE id = sec.session_id),
    (SELECT MAX(year) FROM sessions WHERE is_active),
    NEW.year
  );

  -- Admins (and trusted server contexts) may place anyone anywhere with any status.
  IF auth.uid() IS NULL OR auth_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  -- A cancelled section takes no new sign-ups (migration_soft_cancel.sql adds the column).
  IF sec.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'That class was cancelled. Please pick another one.' USING ERRCODE = 'P0001';
  END IF;

  IF (SELECT (config->>'enabled')::boolean FROM form_configs WHERE form_key = 'student_registration') IS FALSE THEN
    RAISE EXCEPTION 'Camper registration is closed right now' USING ERRCODE = 'P0001';
  END IF;

  SELECT age INTO stu_age FROM students WHERE id = NEW.student_id;
  IF stu_age IS NULL OR stu_age < sec.age_min OR stu_age > sec.age_max THEN
    RAISE EXCEPTION 'This section is for ages %–%', sec.age_min, sec.age_max USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO taken FROM registrations
  WHERE section_id = sec.id AND status IN ('confirmed', 'pending');

  NEW.status := CASE WHEN taken >= sec.capacity THEN 'waitlisted'::registration_status
                     ELSE 'pending'::registration_status END;

  -- Same-week clash: only when this insert would HOLD a seat (waitlisting as a backup is fine).
  IF NEW.status = 'pending' THEN
    -- One camper at a time: two simultaneous sign-ups for different sections lock different
    -- section rows, so without this neither would see the other's seat.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.student_id::text, 0));
    SELECT c.name INTO clash
    FROM registrations r
    JOIN sections s ON s.id = r.section_id
    JOIN classes  c ON c.id = s.class_id
    WHERE r.student_id = NEW.student_id
      AND r.section_id <> sec.id
      AND r.status IN ('confirmed', 'pending')
      AND r.year = NEW.year
      AND (s.week IS NULL OR sec.week IS NULL OR s.week = sec.week)
    LIMIT 1;
    IF clash IS NOT NULL THEN
      RAISE EXCEPTION 'This camper already has a spot in % that week', clash USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrations_before_insert() FROM PUBLIC, anon, authenticated;

-- This file is the only definition of registrations_before_insert() (function and trigger).
DROP TRIGGER IF EXISTS registrations_before_insert ON registrations;
CREATE TRIGGER registrations_before_insert BEFORE INSERT ON registrations
    FOR EACH ROW EXECUTE FUNCTION public.registrations_before_insert();

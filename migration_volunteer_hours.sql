-- Migration: volunteer service hours and their letters (spec B2, #157)
-- Apply in Supabase Dashboard > SQL Editor (or via the Management API). Safe to re-run.
-- Order: after migration_duty_minimums.sql (duty_types.minutes) and
-- migration_volunteer_onboarding.sql (volunteers.legal_name, removed_at).
--
-- Hours for a week = crewed minutes + duty minutes, over the days of that week that have
-- happened (today included, Denver time):
--   * crewed: each weekday between the session's dates on which the volunteer leads or supports
--     a section with times, times the section's length. Two sections count their overlapping time once.
--     Days inside one of the volunteer's crew_absences don't count. A section with no start or
--     end time adds nothing (the admin list flags it). sections.days isn't parsed: every
--     section runs Mon–Fri today.
--   * duty: each duty they hold that week, at its type's minutes, except on an absence day.
-- Removed volunteers get nothing: they can't sign in, and the admin list leaves them out.
-- The letter's signer is app_settings hours_letter_signer_name / hours_letter_signer_title
-- (readable by everyone already, written by admins).

-- ── 1. One volunteer's week ───────────────────────────────────

-- "Week 2": the session's place among its year's sessions.
CREATE OR REPLACE FUNCTION private.session_week_number(p_session sessions)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM sessions s
  WHERE s.year = p_session.year AND (s.start_date, s.id) <= (p_session.start_date, p_session.id);
$$;
REVOKE ALL ON FUNCTION private.session_week_number(sessions) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.volunteer_week_hours(p_volunteer UUID, p_session UUID)
RETURNS TABLE (crewed BOOLEAN, crew_days INT, crew_minutes INT, duty_minutes INT, untimed_sections INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH se AS (
    SELECT * FROM sessions WHERE id = p_session
  ), today AS (
    SELECT (now() AT TIME ZONE 'America/Denver')::date AS d
  ), secs AS (
    SELECT s.start_time, s.end_time
    FROM sections s, se
    WHERE s.cancelled_at IS NULL
      -- A section names its session; one without (a "both weeks" section, or a week whose session
      -- row is missing) belongs to this season's weeks: all of them, or its week number's.
      AND (s.session_id = se.id
           OR (s.session_id IS NULL AND se.year = private.current_camp_year()
               AND (s.week IS NULL OR s.week = private.session_week_number((SELECT x FROM sessions x WHERE x.id = p_session)))))
      AND (s.lead_id = p_volunteer
           OR EXISTS (SELECT 1 FROM section_supports ss WHERE ss.section_id = s.id AND ss.volunteer_id = p_volunteer))
  ), day_minutes AS (
    -- The length of one crewed day: the union of the sections' times, so overlaps count once.
    SELECT coalesce((
      SELECT sum(extract(epoch FROM upper(r) - lower(r)))::int / 60
      FROM unnest((SELECT range_agg(tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time))
                   FROM secs WHERE start_time IS NOT NULL AND end_time > start_time)) r
    ), 0) AS m
  ), worked AS (
    SELECT g::date AS d
    FROM se, today, generate_series(se.start_date, least(se.end_date, today.d), interval '1 day') g
    WHERE extract(isodow FROM g) < 6
      AND NOT EXISTS (SELECT 1 FROM crew_absences a
                      WHERE a.volunteer_id = p_volunteer AND g::date BETWEEN a.from_date AND a.to_date)
  ), duty AS (
    SELECT coalesce(sum(dt.minutes), 0)::int AS m
    FROM duty_assignments da
    JOIN duty_slots ds ON ds.id = da.duty_slot_id
    JOIN duty_types dt ON dt.id = ds.duty_type_id
    CROSS JOIN se CROSS JOIN today
    WHERE da.volunteer_id = p_volunteer
      AND ds.slot_date BETWEEN se.start_date AND least(se.end_date, today.d)
      AND NOT EXISTS (SELECT 1 FROM crew_absences a
                      WHERE a.volunteer_id = p_volunteer AND ds.slot_date BETWEEN a.from_date AND a.to_date)
  )
  -- A crewed day needs a section with times: one without them adds no days and no minutes.
  SELECT EXISTS (SELECT 1 FROM secs),
         CASE WHEN (SELECT m FROM day_minutes) > 0 THEN (SELECT count(*) FROM worked)::int ELSE 0 END,
         (SELECT count(*) FROM worked)::int * (SELECT m FROM day_minutes),
         (SELECT m FROM duty),
         (SELECT count(*) FROM secs WHERE start_time IS NULL OR end_time IS NULL OR end_time <= start_time)::int
  FROM se;
$$;
REVOKE ALL ON FUNCTION private.volunteer_week_hours(UUID, UUID) FROM PUBLIC, anon, authenticated;


-- The name on a letter: the legal name from the volunteer's profile, else the account name.
CREATE OR REPLACE FUNCTION private.volunteer_letter_name(p_volunteer UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(btrim(v.legal_name), ''), p.display_name)
  FROM volunteers v JOIN profiles p ON p.id = v.id WHERE v.id = p_volunteer;
$$;
REVOKE ALL ON FUNCTION private.volunteer_letter_name(UUID) FROM PUBLIC, anon, authenticated;


-- ── 2. What volunteers and admins read ────────────────────────

-- The caller's weeks this camp year where they're crewed or hold a duty. A letter is ready from
-- the week's last day, once there are hours to certify.
CREATE OR REPLACE FUNCTION public.my_volunteer_hours()
RETURNS TABLE (session_id UUID, week_number INT, session_name TEXT, start_date DATE, end_date DATE,
               crew_days INT, crew_minutes INT, duty_minutes INT, letter_ready BOOLEAN,
               letter_name TEXT, has_legal_name BOOLEAN, signer_name TEXT, signer_title TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT se.id, private.session_week_number(se), se.name, se.start_date, se.end_date,
         h.crew_days, h.crew_minutes, h.duty_minutes,
         (now() AT TIME ZONE 'America/Denver')::date >= se.end_date AND h.crew_minutes + h.duty_minutes > 0,
         private.volunteer_letter_name(v.id),
         nullif(btrim(v.legal_name), '') IS NOT NULL,
         (SELECT nullif(btrim(value), '') FROM app_settings WHERE key = 'hours_letter_signer_name'),
         (SELECT nullif(btrim(value), '') FROM app_settings WHERE key = 'hours_letter_signer_title')
  FROM volunteers v
  CROSS JOIN sessions se
  CROSS JOIN LATERAL private.volunteer_week_hours(v.id, se.id) h
  WHERE v.id = auth.uid() AND v.removed_at IS NULL
    AND se.year = private.current_camp_year()
    AND (h.crewed OR h.duty_minutes > 0
         OR EXISTS (SELECT 1 FROM duty_assignments da JOIN duty_slots ds ON ds.id = da.duty_slot_id
                    WHERE da.volunteer_id = v.id AND ds.slot_date BETWEEN se.start_date AND se.end_date))
  ORDER BY se.start_date;
$$;
REVOKE ALL ON FUNCTION public.my_volunteer_hours() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_volunteer_hours() TO authenticated;

-- Admins: everyone crewed in a session or holding a duty in it, with the same numbers the
-- volunteer sees, and what to fix before letters go out.
CREATE OR REPLACE FUNCTION public.admin_volunteer_hours(p_session_id UUID)
RETURNS TABLE (volunteer_id UUID, display_name TEXT, letter_name TEXT, has_legal_name BOOLEAN,
               crew_days INT, crew_minutes INT, duty_minutes INT, untimed_sections INT,
               week_number INT, session_name TEXT, start_date DATE, end_date DATE, letter_ready BOOLEAN,
               signer_name TEXT, signer_title TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  se sessions;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can see everyone''s hours' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO se FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY
    SELECT v.id, p.display_name, private.volunteer_letter_name(v.id),
           nullif(btrim(v.legal_name), '') IS NOT NULL,
           h.crew_days, h.crew_minutes, h.duty_minutes, h.untimed_sections,
           private.session_week_number(se), se.name, se.start_date, se.end_date,
           (now() AT TIME ZONE 'America/Denver')::date >= se.end_date AND h.crew_minutes + h.duty_minutes > 0,
           (SELECT nullif(btrim(value), '') FROM app_settings WHERE key = 'hours_letter_signer_name'),
           (SELECT nullif(btrim(value), '') FROM app_settings WHERE key = 'hours_letter_signer_title')
    FROM volunteers v
    JOIN profiles p ON p.id = v.id
    CROSS JOIN LATERAL private.volunteer_week_hours(v.id, se.id) h
    WHERE v.removed_at IS NULL
      AND (h.crewed
           OR EXISTS (SELECT 1 FROM duty_assignments da JOIN duty_slots ds ON ds.id = da.duty_slot_id
                      WHERE da.volunteer_id = v.id AND ds.slot_date BETWEEN se.start_date AND se.end_date))
    ORDER BY p.display_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_volunteer_hours(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_volunteer_hours(UUID) TO authenticated;


-- ── 3. The letter's signer ────────────────────────────────────
-- Empty until an admin fills them in on Volunteers › Hours (the app saves settings by update,
-- so the rows must exist).
INSERT INTO app_settings (key, value) VALUES ('hours_letter_signer_name', ''), ('hours_letter_signer_title', '')
ON CONFLICT (key) DO NOTHING;

-- Migration: admin register-on-behalf (spec 32, #152). Late, walk-in, phone and lost-form sign-ups.
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after migration_course_rules.sql (private.prerequisite_met) and migration_season_settings.sql.
-- Then RE-APPLY migration_one_class_per_week.sql: its trigger now flags admin inserts that carry no
-- reason (section 5 below explains).
--
-- Admins used to have no way to add a registration: the insert trigger let them skip every rule,
-- silently. Now one RPC runs the same rules a parent meets. Each rule the admin skips must be named
-- (p_overrides) with a reason, and both go into audit.log, so History shows why. A full class isn't
-- refused: the camper joins the waitlist (behind everyone already on it) unless the admin overrides
-- 'capacity' to confirm over the limit.
--
-- Rules, as named in p_overrides and returned by admin_registration_check():
--   closed        camper registration is switched off on the Forms page (the season's close)
--   opening       before the season's scheduled opening time (spec 13)
--   cancelled     the class was cancelled
--   grade         the class's grades this fall (spec 31)
--   prerequisite  the class to take first (spec 31)
--   age           the section's age band
--   same_week     the camper already holds a class that week (or would wait for one)
--   capacity      the section is full: without the override the camper is waitlisted
-- A family without an account is invited first by the admin-invite-parent Edge Function.

-- ── 1. Which rules a sign-up breaks ───────────────────────────
-- For an existing camper pass p_student_id; for one not created yet pass their age and grade
-- (a new camper has no past classes, so a prerequisite is never met). Same order and words as
-- registrations_before_insert(), one row per broken rule.
CREATE OR REPLACE FUNCTION private.registration_rule_failures(
    p_section_id UUID, p_student_id UUID, p_age INT DEFAULT NULL, p_grade TEXT DEFAULT NULL)
RETURNS TABLE (rule TEXT, message TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  sec   sections%ROWTYPE;
  cls   classes%ROWTYPE;
  yr    INT;
  age   INT := p_age;
  grade TEXT := p_grade;
  opens TIMESTAMPTZ;
  taken INT;
  clash TEXT;
BEGIN
  SELECT * INTO sec FROM sections WHERE id = p_section_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That section no longer exists' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO cls FROM classes WHERE id = sec.class_id;
  yr := coalesce((SELECT year FROM sessions WHERE id = sec.session_id), (SELECT max(year) FROM sessions WHERE is_active));
  IF p_student_id IS NOT NULL THEN
    SELECT s.age, s.grade INTO age, grade FROM students s WHERE s.id = p_student_id;
  END IF;

  IF (SELECT (config->>'enabled')::boolean FROM form_configs WHERE form_key = 'student_registration') IS FALSE THEN
    rule := 'closed'; message := 'Camper registration is closed.'; RETURN NEXT;
  END IF;
  SELECT registration_opens_at INTO opens FROM season_settings WHERE year = yr;
  IF opens > now() THEN
    rule := 'opening';
    message := 'Registration opens ' || trim(to_char(opens AT TIME ZONE 'America/Denver', 'FMMonth FMDD "at" FMHH12:MI am')) || '.';
    RETURN NEXT;
  END IF;
  IF sec.cancelled_at IS NOT NULL THEN
    rule := 'cancelled'; message := 'This class was cancelled.'; RETURN NEXT;
  END IF;
  IF cardinality(cls.grades_allowed) > 0 AND (grade IS NULL OR NOT grade = ANY (cls.grades_allowed)) THEN
    rule := 'grade';
    message := format('%s is for %s this fall%s.', cls.name, private.grade_words(cls.grades_allowed),
                      CASE WHEN grade IS NULL THEN '; no grade on file' ELSE format('; this camper is in %s', grade) END);
    RETURN NEXT;
  END IF;
  IF cls.requires_class_id IS NOT NULL
     AND (p_student_id IS NULL OR NOT private.prerequisite_met(p_student_id, cls.requires_class_id, yr, sec.week)) THEN
    rule := 'prerequisite';
    message := format('%s needs %s first.', cls.name, (SELECT c.name FROM classes c WHERE c.id = cls.requires_class_id));
    RETURN NEXT;
  END IF;
  IF age IS NULL OR age < sec.age_min OR age > sec.age_max THEN
    rule := 'age';
    message := format('This section is for ages %s–%s%s.', sec.age_min, sec.age_max,
                      CASE WHEN age IS NULL THEN '' ELSE format('; this camper is %s', age) END);
    RETURN NEXT;
  END IF;
  IF p_student_id IS NOT NULL THEN
    SELECT c.name INTO clash
    FROM registrations r
    JOIN sections s ON s.id = r.section_id
    JOIN classes  c ON c.id = s.class_id
    WHERE r.student_id = p_student_id AND r.section_id <> sec.id
      AND r.status IN ('confirmed', 'pending') AND r.year = yr
      AND (s.week IS NULL OR sec.week IS NULL OR s.week = sec.week)
    LIMIT 1;
    IF clash IS NOT NULL THEN
      rule := 'same_week'; message := format('This camper already has a spot in %s that week.', clash); RETURN NEXT;
    END IF;
  END IF;
  SELECT count(*) INTO taken FROM registrations
  WHERE section_id = sec.id AND status IN ('confirmed', 'pending', 'offered');
  IF taken >= sec.capacity THEN
    rule := 'capacity';
    message := format('This section is full (%s of %s). Without an override the camper joins the waitlist.', taken, sec.capacity);
    RETURN NEXT;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.registration_rule_failures(UUID, UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;

-- The admin panel's preview: what a sign-up would break, before the admin presses Register.
CREATE OR REPLACE FUNCTION public.admin_registration_check(
    p_section_id UUID, p_student_id UUID DEFAULT NULL, p_age INT DEFAULT NULL, p_grade TEXT DEFAULT NULL)
RETURNS TABLE (rule TEXT, message TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM private.registration_rule_failures(p_section_id, p_student_id, p_age, nullif(trim(p_grade), ''));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_registration_check(UUID, UUID, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_registration_check(UUID, UUID, INT, TEXT) TO authenticated;

-- ── 2. Find the family by email ───────────────────────────────
-- The account's email lives in auth.users, which the app can't read. Returns no row when there's
-- no account (the panel then offers an invite). Staff and volunteer families are found too.
CREATE OR REPLACE FUNCTION public.admin_find_parent(p_email TEXT)
RETURNS TABLE (id UUID, display_name TEXT, role TEXT, email TEXT, campers JSONB)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, p.role::text, u.email::text,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'full_name', s.full_name, 'age', s.age,
                                                        'grade', s.grade, 'school_name', s.school_name)
                                     ORDER BY s.full_name)
                   FROM students s WHERE s.parent_id = p.id), '[]'::jsonb)
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(trim(p_email));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_find_parent(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_parent(TEXT) TO authenticated;

-- ── 3. Possible duplicates before a new camper is created (spec 14b) ──
-- Tolerant on purpose: the same last name plus the same grade or school, or the same first and
-- last name, under any account (the same family's own rows included). Date of birth isn't
-- collected (Q-P2). Campers from any year: a returning family is the usual duplicate.
CREATE OR REPLACE FUNCTION public.admin_camper_matches(
    p_first TEXT, p_last TEXT, p_grade TEXT DEFAULT NULL, p_school TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, full_name TEXT, age SMALLINT, grade TEXT, school_name TEXT, parent_id UUID, parent_name TEXT, why TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  f TEXT := lower(trim(coalesce(p_first, '')));
  l TEXT := lower(trim(coalesce(p_last, '')));
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF l = '' THEN RETURN; END IF;
  RETURN QUERY
  SELECT s.id, s.full_name, s.age, s.grade, s.school_name, s.parent_id, p.display_name,
         CASE WHEN f <> '' AND lower(trim(coalesce(s.first_name, split_part(s.full_name, ' ', 1)))) = f THEN 'same name'
              WHEN nullif(trim(p_grade), '') IS NOT NULL AND s.grade = trim(p_grade) THEN 'same last name and grade'
              ELSE 'same last name and school' END
  FROM students s
  LEFT JOIN profiles p ON p.id = s.parent_id
  WHERE lower(trim(coalesce(s.last_name, regexp_replace(s.full_name, '^.*\s', '')))) = l
    AND ((f <> '' AND lower(trim(coalesce(s.first_name, split_part(s.full_name, ' ', 1)))) = f)
         OR (nullif(trim(p_grade), '') IS NOT NULL AND s.grade = trim(p_grade))
         OR (nullif(trim(p_school), '') IS NOT NULL AND lower(trim(s.school_name)) = lower(trim(p_school))))
  ORDER BY s.full_name
  LIMIT 10;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_camper_matches(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_camper_matches(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── 4. Register on a family's behalf ──────────────────────────
-- p_student_id picks one of the family's campers; otherwise p_student creates one:
-- {"first_name", "last_name", "age", "grade", "school_name"}. Refused with every unnamed broken
-- rule (the hint lists their names, for the panel's checkboxes). The reason written to History:
--   Admin sign-up (walk-in) · skipped: grade, capacity · Paid at the door
-- The normal confirmed/waitlisted email goes to the family through the outbox trigger.
CREATE OR REPLACE FUNCTION public.admin_register(
    p_parent_email TEXT, p_student_id UUID, p_student JSONB, p_section_id UUID,
    p_source TEXT, p_reason TEXT, p_overrides TEXT[] DEFAULT '{}')
RETURNS TABLE (registration_id UUID, student_id UUID, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  parent    UUID;
  stu       UUID := p_student_id;
  fails     TEXT[];
  missing   TEXT[];
  skipped   TEXT[];
  st        registration_status;
  rid       UUID;
  v_first   TEXT;
  v_last    TEXT;
  why       TEXT := trim(coalesce(p_reason, ''));
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('late', 'walk_in', 'phone', 'recovery') THEN
    RAISE EXCEPTION 'Say how this sign-up came in: late, walk-in, phone or lost form' USING ERRCODE = '22023';
  END IF;
  IF length(why) < 3 THEN
    RAISE EXCEPTION 'Add a reason for History' USING ERRCODE = '22023';
  END IF;

  SELECT f.id INTO parent FROM public.admin_find_parent(p_parent_email) f;
  IF parent IS NULL THEN
    RAISE EXCEPTION 'No account uses that email. Send the family an invite first.' USING ERRCODE = 'P0002', HINT = 'no_account';
  END IF;

  -- Serialize with parents' own sign-ups: the section row, then the camper (as the trigger does).
  PERFORM 1 FROM sections WHERE id = p_section_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That section no longer exists' USING ERRCODE = 'P0001';
  END IF;

  IF stu IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM students s WHERE s.id = stu AND s.parent_id = parent) THEN
      RAISE EXCEPTION 'That camper isn''t on this family''s account' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(stu::text, 0));
    SELECT array_agg(f.rule) INTO fails FROM private.registration_rule_failures(p_section_id, stu) f;
  ELSE
    v_first := trim(coalesce(p_student->>'first_name', ''));
    v_last  := trim(coalesce(p_student->>'last_name', ''));
    IF v_first = '' OR v_last = '' OR (p_student->>'age') IS NULL THEN
      RAISE EXCEPTION 'A new camper needs a first name, last name and age' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(f.rule) INTO fails
    FROM private.registration_rule_failures(p_section_id, NULL, (p_student->>'age')::int, nullif(trim(p_student->>'grade'), '')) f;
  END IF;
  fails := coalesce(fails, '{}');

  -- 'capacity' only decides the status; every other broken rule must be named.
  SELECT array_agg(f) INTO missing FROM unnest(fails) f
  WHERE f <> 'capacity' AND NOT f = ANY (coalesce(p_overrides, '{}'));
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Name each rule you are skipping: %', array_to_string(missing, ', ')
      USING ERRCODE = 'P0001', HINT = 'rules:' || array_to_string(fails, ',');
  END IF;
  SELECT array_agg(f) INTO skipped FROM unnest(fails) f WHERE f = ANY (coalesce(p_overrides, '{}'));
  st := CASE WHEN 'capacity' = ANY (fails) AND NOT 'capacity' = ANY (coalesce(p_overrides, '{}'))
             THEN 'waitlisted' ELSE 'confirmed' END;

  PERFORM private.set_reason(
    'Admin sign-up (' || CASE p_source WHEN 'walk_in' THEN 'walk-in' WHEN 'recovery' THEN 'lost form' ELSE p_source END || ')'
    || CASE WHEN skipped IS NOT NULL THEN ' · skipped: ' || array_to_string(skipped, ', ') ELSE '' END
    || ' · ' || left(why, 300));

  IF stu IS NULL THEN
    INSERT INTO students (parent_id, full_name, first_name, last_name, age, grade, school_name)
    VALUES (parent, v_first || ' ' || v_last, v_first, v_last, (p_student->>'age')::smallint,
            nullif(trim(p_student->>'grade'), ''), nullif(trim(p_student->>'school_name'), ''))
    RETURNING id INTO stu;
  END IF;

  INSERT INTO registrations (student_id, section_id, status)
  VALUES (stu, p_section_id, st)
  RETURNING id INTO rid;

  PERFORM private.set_reason(NULL);
  registration_id := rid; student_id := stu; status := st::text;
  RETURN NEXT;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This camper already has a registration for that section. Change its status on their row instead.'
    USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_register(TEXT, UUID, JSONB, UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_register(TEXT, UUID, JSONB, UUID, TEXT, TEXT, TEXT[]) TO authenticated;

-- ── 5. Admin inserts outside admin_register() ─────────────────
-- Still allowed (repairs), but registrations_before_insert() (migration_one_class_per_week.sql)
-- now stamps 'admin_insert_no_reason' as the audit reason when the admin set none, so History
-- shows the row as a warning. Re-apply that file after this one.

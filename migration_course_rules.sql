-- Migration: course rules in the database: grades, prerequisites, repeat courses, "place with"
-- (spec 31, #151)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_public_camp_page.sql (it needs change_requests from
-- migration_parent_changes.sql, roll_call_marks from migration_camp_week_ops.sql and
-- private.registration_change_deadline()). On a database that already ran them, then RE-APPLY
-- migration_one_class_per_week.sql (registrations_before_insert() checks these rules),
-- migration_parent_swap.sql (swaps check them; my_swap_choices()) and public_camp_info() from
-- migration_public_camp_page.sql (courses carry their rules). Those call the helpers below only
-- once they exist, so they still apply on their own. Then re-apply migration_demo_environment.sql
-- on the demo project.
--
-- Decided (spec 31; default for its open question, 2026-10-18): the database refuses a parent's
-- sign-up or swap that breaks a class's grade limit or prerequisite, and the family can ask for an
-- exception instead, which lands in the admins' change-request queue. Admin edits keep bypassing
-- the rules (spec 32 adds the logged override). Taking the same course in both weeks is only a
-- warning in the UI. Eligibility uses the grade the camper enters this fall (students.grade).
-- This replaces src/lib/courseConstraints.ts, which matched "Microcontrollers" by class name.

-- ── 1. Rules on the class ─────────────────────────────────────
-- grades_allowed: the grades a camper may be entering this fall ('7th', …); NULL = any grade.
-- requires_class_id: a class the camper must have taken first: a held seat in it in an earlier
--   week this camp year, or a held seat in a past year.
-- requirement_note: one line for families, shown with the class (e.g. what counts).
-- next_class_id: what to suggest to a camper taking this course in both weeks.
ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS grades_allowed    TEXT[],
    ADD COLUMN IF NOT EXISTS requires_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS requirement_note  TEXT,
    ADD COLUMN IF NOT EXISTS next_class_id     UUID REFERENCES classes(id) ON DELETE SET NULL;
-- Two foreign keys from classes to classes: an embed of classes inside classes would need a
-- !hint (docs/specs/README.md). The app reads both as plain ids.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_grades_allowed_check') THEN
    -- An empty list would mean "nobody"; NULL is the way to say "any grade".
    ALTER TABLE classes ADD CONSTRAINT classes_grades_allowed_check
      CHECK (grades_allowed IS NULL OR (cardinality(grades_allowed) > 0 AND array_position(grades_allowed, NULL) IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_rule_links_check') THEN
    ALTER TABLE classes ADD CONSTRAINT classes_rule_links_check
      CHECK (requires_class_id IS DISTINCT FROM id AND next_class_id IS DISTINCT FROM id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_requirement_note_check') THEN
    ALTER TABLE classes ADD CONSTRAINT classes_requirement_note_check
      CHECK (char_length(requirement_note) <= 300);
  END IF;
END $$;

-- ── 2. "Place with" a friend or sibling ───────────────────────
-- The family's request, read by admins when they build sections. Nothing places campers
-- automatically (out of scope). Parents set it when they sign up and change it until the change
-- deadline through set_place_with(): they still have no UPDATE on registrations.
ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS place_with TEXT CONSTRAINT registrations_place_with_length CHECK (char_length(place_with) <= 100);

-- Crews read their sections' registrations (volunteer_read_registrations), but a placement request
-- is between the family and the admins. So clients may read every column of registrations except
-- place_with; parents read their own through my_place_with() and admins through admin_place_with()
-- (section 7). Parents can still write it when they sign up (INSERT is unchanged).
-- A column added to registrations later needs its own GRANT SELECT (col) (or re-run this block).
-- Deploy note: the app from before spec 31 reads registrations with select('*'), which this block
-- refuses. On a database that serves that app, apply this block when the spec 31 app ships.
DO $$
DECLARE
  cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'registrations' AND column_name <> 'place_with';
  REVOKE SELECT ON registrations FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON registrations TO anon, authenticated', cols);
END $$;

-- ── 3. Exception requests ─────────────────────────────────────
-- A family whose camper doesn't qualify asks the camp for an exception: a change request of kind
-- 'exception' naming the section it is for. section_id is a plain column on purpose: a foreign key
-- to sections would make change_requests a second path between students and sections
-- (docs/specs/README.md). An admin who agrees registers the camper (admins bypass the rules).
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS section_id UUID;
ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_kind_check;
ALTER TABLE change_requests ADD CONSTRAINT change_requests_kind_check
    CHECK (kind IN ('cancel', 'swap', 'other', 'crew_switch', 'deletion', 'exception'));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_requests_exception_target_check') THEN
    ALTER TABLE change_requests ADD CONSTRAINT change_requests_exception_target_check
      CHECK (kind <> 'exception' OR (student_id IS NOT NULL AND section_id IS NOT NULL));
  END IF;
END $$;
-- One open request per camper and class section.
CREATE UNIQUE INDEX IF NOT EXISTS change_requests_open_exception_idx
    ON change_requests (student_id, section_id) WHERE kind = 'exception' AND status = 'open';

-- ── 4. The rule src/lib/courseConstraints.ts matched by name ──
-- Microcontrollers is for rising 7th–9th graders and comes after Intermediate Python (when that
-- class exists); a camper repeating Intro to Python is pointed at Intermediate Python. Runs once
-- per database (app_settings 'course_rules_seeded'), so re-running this file never undoes an
-- admin's edits, including an admin who cleared every rule on purpose.
DO $$
DECLARE
  ipy UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM app_settings WHERE key = 'course_rules_seeded') THEN
    RETURN;
  END IF;
  INSERT INTO app_settings (key, value, updated_at) VALUES ('course_rules_seeded', 'true', now());
  IF (SELECT count(*) FROM classes WHERE name ILIKE 'intermediate python%') = 1 THEN
    SELECT id INTO ipy FROM classes WHERE name ILIKE 'intermediate python%';
  END IF;
  UPDATE classes SET grades_allowed = ARRAY['7th', '8th', '9th'], requires_class_id = ipy,
         requirement_note = CASE WHEN ipy IS NOT NULL THEN 'Taking Intermediate Python in Week 1 counts.' END
   WHERE name ILIKE '%microcontroller%';
  IF ipy IS NOT NULL THEN
    UPDATE classes SET next_class_id = ipy WHERE name ILIKE 'intro% python%' AND id <> ipy;
  END IF;
END $$;

-- ── 5. Helpers ────────────────────────────────────────────────

-- '{7th,8th,9th}' → 'grades 7–9'; '{7th}' → 'grade 7'; '{4th,6th}' → 'grades 4 and 6'. Grades
-- without a number (e.g. 'K') are kept as written. Mirrors gradeWords() in src/lib/courseRules.ts.
CREATE OR REPLACE FUNCTION private.grade_words(p_grades TEXT[])
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  nums  INT[];
  words TEXT[];
  n     INT;
BEGIN
  IF p_grades IS NULL OR cardinality(p_grades) = 0 THEN RETURN NULL; END IF;
  IF (SELECT bool_and(g ~ '^\s*\d+(st|nd|rd|th)?\s*$') FROM unnest(p_grades) g) THEN
    SELECT array_agg(DISTINCT substring(g FROM '\d+')::int ORDER BY substring(g FROM '\d+')::int)
      INTO nums FROM unnest(p_grades) g;
    n := cardinality(nums);
    IF n = 1 THEN RETURN 'grade ' || nums[1]; END IF;
    IF nums[n] - nums[1] = n - 1 THEN RETURN 'grades ' || nums[1] || '–' || nums[n]; END IF;
    words := nums::text[];
  ELSE
    words := p_grades;
  END IF;
  n := cardinality(words);
  IF n = 1 THEN RETURN 'grade ' || words[1]; END IF;
  RETURN 'grades ' || array_to_string(words[1:n - 1], ', ') || ' and ' || words[n];
END;
$$;
REVOKE ALL ON FUNCTION private.grade_words(TEXT[]) FROM PUBLIC, anon, authenticated;

-- Has this camper taken p_class_id before a class running in week p_week of camp year p_year?
-- A held seat (confirmed, or a legacy pending) counts in an earlier week of the same year, or in
-- any past year. A waitlist place or a cancelled spot doesn't; nor does a both-weeks section this
-- year, which isn't "earlier". p_ignore leaves one registration out (the one a swap moves).
CREATE OR REPLACE FUNCTION private.prerequisite_met(p_student_id UUID, p_class_id UUID, p_year INT, p_week INT, p_ignore UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM registrations r JOIN sections rs ON rs.id = r.section_id
     WHERE r.student_id = p_student_id AND rs.class_id = p_class_id
       AND r.id IS DISTINCT FROM p_ignore
       AND r.status IN ('confirmed', 'pending')
       AND (r.year < p_year OR (r.year = p_year AND rs.week < p_week)));
$$;
REVOKE ALL ON FUNCTION private.prerequisite_met(UUID, UUID, INT, INT, UUID) FROM PUBLIC, anon, authenticated;

-- Why this camper can't take that section under its class's rules, in the family's words, or
-- NULL when the rules allow it. A camper with no grade on file doesn't meet a grade limit.
-- Used by registrations_before_insert(), the swap functions and request_exception(); the UI words
-- the same sentences (courseRuleReason() in src/lib/courseRules.ts).
CREATE OR REPLACE FUNCTION private.course_rule_block(p_student_id UUID, p_section_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT CASE
    WHEN cardinality(c.grades_allowed) > 0 AND (st.grade IS NULL OR NOT st.grade = ANY (c.grades_allowed))
      THEN format('%s is for %s this fall.', c.name, private.grade_words(c.grades_allowed))
    WHEN c.requires_class_id IS NOT NULL
         AND NOT private.prerequisite_met(st.id, c.requires_class_id,
               coalesce((SELECT se.year FROM sessions se WHERE se.id = s.session_id),
                        (SELECT max(se2.year) FROM sessions se2 WHERE se2.is_active)),
               s.week)
      THEN format('%s needs %s first.', c.name, (SELECT r.name FROM classes r WHERE r.id = c.requires_class_id))
  END
  FROM sections s
  JOIN classes  c  ON c.id = s.class_id
  JOIN students st ON st.id = p_student_id
  WHERE s.id = p_section_id;
$$;
REVOKE ALL ON FUNCTION private.course_rule_block(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- A parent swap mustn't leave a later week's class without its prerequisite: moving out of
-- Intermediate Python in Week 1 while holding Microcontrollers in Week 2 is refused (cancelling it
-- isn't; that shows on the admins' "prerequisite at risk" list instead). The reason, or NULL.
CREATE OR REPLACE FUNCTION private.course_rule_dependent(p_registration_id UUID, p_target UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT format('%s in Week %s needs %s, so cancel that class first to switch.', dc.name, ds.week, sc.name)
    FROM registrations reg
    JOIN sections src ON src.id = reg.section_id
    JOIN classes  sc  ON sc.id = src.class_id
    JOIN sections tgt ON tgt.id = p_target
    JOIN registrations d ON d.student_id = reg.student_id AND d.id <> reg.id AND d.year = reg.year
                        AND d.status IN ('confirmed', 'pending', 'offered', 'waitlisted')
    JOIN sections ds ON ds.id = d.section_id
    JOIN classes  dc ON dc.id = ds.class_id
   WHERE reg.id = p_registration_id
     AND dc.requires_class_id = src.class_id
     AND tgt.class_id <> src.class_id
     AND ds.week > src.week
     AND NOT private.prerequisite_met(reg.student_id, src.class_id, reg.year, ds.week, reg.id)
   ORDER BY ds.week
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.course_rule_dependent(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ── 6. Ask the camp for an exception ──────────────────────────
-- Only for one of your campers, a class that's open, and only while the rules really refuse it.
CREATE OR REPLACE FUNCTION public.request_exception(p_student_id UUID, p_section_id UUID, p_message TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  camper TEXT;
  new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(nullif(first_name, ''), split_part(full_name, ' ', 1)) INTO camper
    FROM students WHERE id = p_student_id AND parent_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That camper isn''t on your account' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sections WHERE id = p_section_id AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'That class isn''t open' USING ERRCODE = 'P0001';
  END IF;
  IF private.course_rule_block(p_student_id, p_section_id) IS NULL THEN
    RAISE EXCEPTION '% can sign up for that class without an exception.', camper USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(trim(p_message), '') = '' THEN
    RAISE EXCEPTION 'Tell the camp why % is ready for this class', camper USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    INSERT INTO change_requests (student_id, section_id, requested_by, kind, message)
    VALUES (p_student_id, p_section_id, auth.uid(), 'exception', left(trim(p_message), 1000))
    RETURNING id INTO new_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You already asked about this class. The camp will email you.' USING ERRCODE = 'P0001';
  END;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_exception(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_exception(UUID, UUID, TEXT) TO authenticated;

-- ── 7. Change "place with" until the change deadline ──────────
CREATE OR REPLACE FUNCTION public.set_place_with(p_registration_id UUID, p_place_with TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg      registrations%ROWTYPE;
  val      TEXT := nullif(btrim(p_place_with), '');
  deadline TIMESTAMPTZ;
BEGIN
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND st.parent_id = auth.uid()
   FOR UPDATE OF r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501';
  END IF;
  IF reg.status = 'cancelled' THEN
    RAISE EXCEPTION 'That spot is cancelled' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(val) > 100 THEN
    RAISE EXCEPTION 'Keep it to 100 characters' USING ERRCODE = 'P0001';
  END IF;
  deadline := private.registration_change_deadline(reg.id);
  IF deadline IS NOT NULL AND now() >= deadline THEN
    RAISE EXCEPTION 'Online changes for this class closed on %. Use "Request a change" and the camp will help.',
      trim(to_char((deadline - interval '1 second') AT TIME ZONE 'America/Denver', 'FMMonth FMDD')) USING ERRCODE = 'P0001';
  END IF;
  IF val IS NOT DISTINCT FROM reg.place_with THEN RETURN; END IF;
  PERFORM private.set_reason('parent_place_with');
  UPDATE registrations SET place_with = val WHERE id = reg.id;
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.set_place_with(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_place_with(UUID, TEXT) TO authenticated;

-- Reading it: a parent sees their own campers' requests; an admin sees every one (or one section's).
CREATE OR REPLACE FUNCTION public.my_place_with()
RETURNS TABLE (registration_id UUID, place_with TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.place_with FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE st.parent_id = auth.uid() AND r.place_with IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.my_place_with() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_place_with() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_place_with(p_section_id UUID DEFAULT NULL)
RETURNS TABLE (registration_id UUID, place_with TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.id, r.place_with FROM registrations r
   WHERE r.place_with IS NOT NULL AND (p_section_id IS NULL OR r.section_id = p_section_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_place_with(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_place_with(UUID) TO authenticated;

-- ── 8. "Prerequisite at risk" (admin attention item) ──────────
-- This camp year's live registrations in a class with a prerequisite whose camper took it in an
-- earlier week, when either
--   'cancelled': that earlier spot was cancelled and the camper holds no other, or
--   'absent':    the camper still holds it but was marked absent at every arrival roll call taken
--                for them in it so far (missed_arrivals says how many).
-- A camper who completed the class in a past year is never at risk.
CREATE OR REPLACE FUNCTION public.admin_prerequisite_at_risk()
RETURNS TABLE (registration_id UUID, student_id UUID, camper_name TEXT, class_name TEXT,
               section_label TEXT, week SMALLINT, status TEXT, required_class_name TEXT,
               required_registration_id UUID, reason TEXT, missed_arrivals INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  yr INT := coalesce((SELECT max(se.year) FROM sessions se WHERE se.is_active), extract(year FROM now())::int);
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH live AS (
    SELECT r.id, r.student_id, r.status::text AS status, r.year, s.label, s.week, c.name, c.requires_class_id
      FROM registrations r
      JOIN sections s ON s.id = r.section_id
      JOIN classes  c ON c.id = s.class_id
     WHERE r.year = yr AND r.status IN ('confirmed', 'pending', 'offered', 'waitlisted')
       AND c.requires_class_id IS NOT NULL AND s.week IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM registrations p JOIN sections ps ON ps.id = p.section_id
                        WHERE p.student_id = r.student_id AND ps.class_id = c.requires_class_id
                          AND p.year < r.year AND p.status IN ('confirmed', 'pending'))),
  earlier AS (
    -- The camper's spots in the required class in an earlier week of the same year.
    SELECT l.id AS live_id, p.id, p.status::text AS status, p.section_id,
           (SELECT count(*) FROM roll_call_marks m
             WHERE m.section_id = p.section_id AND m.student_id = p.student_id AND m.roll_call = 'arrival')::int AS arrivals,
           (SELECT count(*) FROM roll_call_marks m
             WHERE m.section_id = p.section_id AND m.student_id = p.student_id AND m.roll_call = 'arrival' AND m.present)::int AS present
      FROM live l
      JOIN registrations p ON p.student_id = l.student_id AND p.year = l.year
      JOIN sections ps ON ps.id = p.section_id
     WHERE ps.class_id = l.requires_class_id AND ps.week < l.week)
  SELECT l.id, l.student_id, st.full_name, l.name, l.label, l.week::smallint, l.status,
         (SELECT rc.name FROM classes rc WHERE rc.id = l.requires_class_id),
         e.id, e.why, e.missed
    FROM live l
    JOIN students st ON st.id = l.student_id
    JOIN LATERAL (
      SELECT x.id, 'absent'::text AS why, x.arrivals AS missed
        FROM earlier x
       WHERE x.live_id = l.id AND x.status IN ('confirmed', 'pending') AND x.arrivals > 0 AND x.present = 0
      UNION ALL
      SELECT x.id, 'cancelled', 0
        FROM earlier x
       WHERE x.live_id = l.id AND x.status = 'cancelled'
         AND NOT EXISTS (SELECT 1 FROM earlier y WHERE y.live_id = l.id AND y.status IN ('confirmed', 'pending'))
      LIMIT 1) e ON true
   ORDER BY l.week, l.name, st.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_prerequisite_at_risk() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prerequisite_at_risk() TO authenticated;

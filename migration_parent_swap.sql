-- Migration: parents switch class within the same week (spec 12, #81)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_parent_changes.sql and migration_waitlist_offers.sql.
--
-- Decided 2026-10-16 (Q-W1, Q-W4): before the change deadline, a parent can move a held seat to
-- another class the same week, but only into a FREE seat. Same-week backups are blocked, so a
-- camper holding a seat can't wait for a full class: they'd have to cancel first.
-- The registration row is moved (section_id changes), so its history stays in one place. The seat
-- left behind is offered to that class's waitlist by the spec 10 trigger, and the family gets one
-- registration_moved email from the spec 09 trigger.
-- The admin move (Students page) still bypasses these checks on purpose; the audit log records it.
-- Course rules (spec 31): a class's grade limit and prerequisite apply to swaps too, through
-- migration_course_rules.sql's helpers once it has run (then re-apply this file).

-- ── 1. A section's change deadline (same rule as private.registration_change_deadline) ─
CREATE OR REPLACE FUNCTION private.section_change_deadline(p_section_id UUID, p_year INT)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT ((coalesce(se.start_date,
                    (SELECT min(s2.start_date) FROM sessions s2 WHERE s2.year = p_year))
          - (private.season_settings_for(p_year)).change_deadline_days)::timestamp
          AT TIME ZONE 'America/Denver')
  FROM sections s LEFT JOIN sessions se ON se.id = s.session_id
  WHERE s.id = p_section_id;
$$;
REVOKE ALL ON FUNCTION private.section_change_deadline(UUID, INT) FROM PUBLIC, anon, authenticated;

-- ── 2. Why can't this camper take that section? (NULL = they can) ─
-- Two layers, so the switch list can show a class the camper doesn't fit with its reason:
--   swap_move_reason: is the section a place this registration could move to at all? (it exists,
--     isn't the same one or cancelled, same year, same week, and no clash with another held seat)
--   swap_fit_reason: does the camper fit it? The class's course rules (spec 31, through
--     migration_course_rules.sql once it has run), the age band, and not leaving a later week's
--     class without its prerequisite.
-- swap_block_reason is the first of the two, as before.
CREATE OR REPLACE FUNCTION private.swap_move_reason(p_registration_id UUID, p_target UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg   registrations%ROWTYPE;
  src   sections%ROWTYPE;
  tgt   sections%ROWTYPE;
  clash TEXT;
  tyear INT;
BEGIN
  SELECT * INTO reg FROM registrations WHERE id = p_registration_id;
  SELECT * INTO src FROM sections WHERE id = reg.section_id;
  SELECT * INTO tgt FROM sections WHERE id = p_target;
  IF NOT FOUND THEN RETURN 'That class no longer exists'; END IF;
  IF tgt.id = src.id THEN RETURN 'That''s the class you already have'; END IF;
  IF tgt.cancelled_at IS NOT NULL THEN RETURN 'That class was cancelled'; END IF;

  tyear := coalesce((SELECT year FROM sessions WHERE id = tgt.session_id), reg.year);
  IF tyear IS DISTINCT FROM reg.year THEN RETURN 'You can only switch within the same camp year'; END IF;
  -- Same week: the same rule as the week-clash check (a both-weeks section overlaps either week).
  IF NOT (src.week IS NULL OR tgt.week IS NULL OR src.week = tgt.week) THEN
    RETURN 'You can only switch to a class in the same week. To change weeks, cancel this spot and sign up for the other week.';
  END IF;

  -- Moving into a both-weeks section mustn't collide with the camper's seat in the other week.
  SELECT c.name INTO clash
    FROM registrations r JOIN sections s ON s.id = r.section_id JOIN classes c ON c.id = s.class_id
   WHERE r.student_id = reg.student_id AND r.id <> reg.id AND r.year = reg.year
     AND r.status IN ('confirmed', 'pending', 'offered')
     AND (s.week IS NULL OR tgt.week IS NULL OR s.week = tgt.week)
   LIMIT 1;
  IF clash IS NOT NULL THEN
    RETURN format('This camper already has a spot in %s that week', clash);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.swap_move_reason(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.swap_fit_reason(p_registration_id UUID, p_target UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg registrations%ROWTYPE;
  tgt sections%ROWTYPE;
  age SMALLINT;
  why TEXT;
BEGIN
  SELECT * INTO reg FROM registrations WHERE id = p_registration_id;
  SELECT * INTO tgt FROM sections WHERE id = p_target;
  IF NOT FOUND THEN RETURN 'That class no longer exists'; END IF;
  IF to_regprocedure('private.course_rule_block(uuid,uuid)') IS NOT NULL THEN
    why := private.course_rule_block(reg.student_id, p_target);
    IF why IS NOT NULL THEN RETURN why; END IF;
  END IF;
  SELECT s.age INTO age FROM students s WHERE s.id = reg.student_id;
  IF age IS NULL OR age < tgt.age_min OR age > tgt.age_max THEN
    RETURN format('This class is for ages %s–%s', tgt.age_min, tgt.age_max);
  END IF;
  IF to_regprocedure('private.course_rule_dependent(uuid,uuid)') IS NOT NULL THEN
    why := private.course_rule_dependent(p_registration_id, p_target);
    IF why IS NOT NULL THEN RETURN why; END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.swap_fit_reason(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.swap_block_reason(p_registration_id UUID, p_target UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce(private.swap_move_reason(p_registration_id, p_target),
                  private.swap_fit_reason(p_registration_id, p_target));
$$;
REVOKE ALL ON FUNCTION private.swap_block_reason(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ── 3. What could this registration switch to? ────────────────
-- Every other open class that week, with live spots left (taken = confirmed + pending + offered,
-- as everywhere else). Full ones are listed so the UI can say why they can't be picked, and so
-- are ones the camper doesn't fit (blocked_reason), so the UI can grey them out with the reason.
-- rule_blocked marks a class's own rules (spec 31): the family may ask for an exception.
-- next_class_name is the class's suggested next course (for the repeat-course warning), when it
-- runs that week and the camper meets its rules.
CREATE OR REPLACE FUNCTION public.my_swap_choices(p_registration_id UUID)
RETURNS TABLE (section_id UUID, class_id UUID, class_name TEXT, label TEXT, week SMALLINT, days TEXT,
               start_time TIME, end_time TIME, room TEXT, spots_left INT,
               blocked_reason TEXT, rule_blocked BOOLEAN, next_class_name TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg   registrations%ROWTYPE;
  src   sections%ROWTYPE;
  rules BOOLEAN := to_regprocedure('private.course_rule_block(uuid,uuid)') IS NOT NULL;
  o     RECORD;
BEGIN
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND st.parent_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501';
  END IF;
  IF reg.status::text NOT IN ('confirmed', 'pending') THEN RETURN; END IF;
  SELECT * INTO src FROM sections WHERE id = reg.section_id;

  FOR o IN
    SELECT s.id, s.class_id, c.name, s.label, s.week, s.days, s.start_time, s.end_time, s.room,
           greatest(s.capacity - (SELECT count(*) FROM registrations x
                                   WHERE x.section_id = s.id AND x.status IN ('confirmed', 'pending', 'offered')), 0)::int AS spots,
           -- to_jsonb: the column only exists once migration_course_rules.sql has run.
           (to_jsonb(c) ->> 'next_class_id')::uuid AS next_id
      FROM sections s JOIN classes c ON c.id = s.class_id
     WHERE s.id <> reg.section_id AND s.cancelled_at IS NULL
       AND (src.week IS NULL OR s.week IS NULL OR s.week = src.week)
     ORDER BY c.name, s.label
  LOOP
    CONTINUE WHEN private.swap_move_reason(reg.id, o.id) IS NOT NULL;
    section_id := o.id; class_id := o.class_id; class_name := o.name; label := o.label;
    week := o.week::smallint; days := o.days; start_time := o.start_time; end_time := o.end_time;
    room := o.room; spots_left := o.spots;
    blocked_reason := private.swap_fit_reason(reg.id, o.id);
    rule_blocked := false;
    next_class_name := NULL;
    IF rules THEN
      rule_blocked := private.course_rule_block(reg.student_id, o.id) IS NOT NULL;
      SELECT nc.name INTO next_class_name
        FROM classes nc JOIN sections ns ON ns.class_id = nc.id
       WHERE nc.id = o.next_id AND ns.cancelled_at IS NULL
         AND (ns.week IS NULL OR ns.week IS NOT DISTINCT FROM src.week)
         AND private.course_rule_block(reg.student_id, ns.id) IS NULL
       LIMIT 1;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.my_swap_choices(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_swap_choices(UUID) TO authenticated;

-- The classes the camper can switch to right now (the app before spec 31 read this list).
CREATE OR REPLACE FUNCTION public.my_swap_options(p_registration_id UUID)
RETURNS TABLE (section_id UUID, class_name TEXT, label TEXT, week SMALLINT, days TEXT,
               start_time TIME, end_time TIME, room TEXT, spots_left INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT c.section_id, c.class_name, c.label, c.week, c.days, c.start_time, c.end_time, c.room, c.spots_left
    FROM public.my_swap_choices(p_registration_id) c
   WHERE c.blocked_reason IS NULL;
$$;
REVOKE ALL ON FUNCTION public.my_swap_options(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_swap_options(UUID) TO authenticated;

-- ── 4. Switch ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.swap_my_registration(p_registration_id UUID, p_target_section_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg      registrations%ROWTYPE;
  tgt      sections%ROWTYPE;
  why      TEXT;
  deadline TIMESTAMPTZ;
  taken    INT;
  src_name TEXT;
  tgt_name TEXT;
BEGIN
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND st.parent_id = auth.uid()
   FOR UPDATE OF r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501';
  END IF;
  IF reg.status::text NOT IN ('confirmed', 'pending') THEN
    RAISE EXCEPTION 'Only a confirmed spot can be switched' USING ERRCODE = 'P0001';
  END IF;

  -- One change per camper at a time (same lock as sign-ups), then both sections in id order so
  -- A→B and B→A at once can't deadlock.
  PERFORM pg_advisory_xact_lock(hashtextextended(reg.student_id::text, 0));
  PERFORM 1 FROM sections WHERE id IN (reg.section_id, p_target_section_id) ORDER BY id FOR UPDATE;

  why := private.swap_block_reason(reg.id, p_target_section_id);
  IF why IS NOT NULL THEN
    -- A class's own rules (spec 31): the hint lets the app offer "Request an exception".
    IF to_regprocedure('private.course_rule_block(uuid,uuid)') IS NOT NULL THEN
      IF private.course_rule_block(reg.student_id, p_target_section_id) IS NOT DISTINCT FROM why THEN
        RAISE EXCEPTION '% Request an exception?', why USING ERRCODE = 'P0001', HINT = 'course_rule';
      END IF;
    END IF;
    RAISE EXCEPTION '%', why USING ERRCODE = 'P0001';
  END IF;

  -- The deadline applies to both the class being left and the one being joined.
  deadline := least(private.registration_change_deadline(reg.id),
                    private.section_change_deadline(p_target_section_id, reg.year));
  IF deadline IS NOT NULL AND now() >= deadline THEN
    RAISE EXCEPTION 'Online changes for this week closed on %. Use "Request a change" and the camp will help.',
      trim(to_char((deadline - interval '1 second') AT TIME ZONE 'America/Denver', 'FMMonth FMDD')) USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO tgt FROM sections WHERE id = p_target_section_id;
  SELECT count(*) INTO taken FROM registrations
   WHERE section_id = tgt.id AND status IN ('confirmed', 'pending', 'offered');
  IF taken >= tgt.capacity THEN
    SELECT c.name || ' ' || s.label INTO src_name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = reg.section_id;
    SELECT c.name || ' ' || tgt.label INTO tgt_name FROM classes c WHERE c.id = tgt.class_id;
    RAISE EXCEPTION '% is full. To join its waitlist you''d need to cancel your spot in % first.', tgt_name, src_name
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.set_reason('parent_swap');
  UPDATE registrations SET section_id = tgt.id, status = 'confirmed' WHERE id = reg.id;
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.swap_my_registration(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_my_registration(UUID, UUID) TO authenticated;

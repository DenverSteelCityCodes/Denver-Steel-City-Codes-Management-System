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
-- Age band, the Microcontrollers grade rule (still matched by class name, as in
-- src/lib/courseConstraints.ts, until spec 23 moves it to sections.grades_allowed), a cancelled
-- class, and a clash with the camper's other held seats.
CREATE OR REPLACE FUNCTION private.swap_block_reason(p_registration_id UUID, p_target UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg   registrations%ROWTYPE;
  src   sections%ROWTYPE;
  tgt   sections%ROWTYPE;
  cname TEXT;
  stu   students%ROWTYPE;
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

  SELECT * INTO stu FROM students WHERE id = reg.student_id;
  IF stu.age IS NULL OR stu.age < tgt.age_min OR stu.age > tgt.age_max THEN
    RETURN format('This class is for ages %s–%s', tgt.age_min, tgt.age_max);
  END IF;
  SELECT name INTO cname FROM classes WHERE id = tgt.class_id;
  IF cname ILIKE '%microcontroller%' AND stu.grade IS NOT NULL AND stu.grade NOT IN ('7th', '8th', '9th') THEN
    RETURN 'Open to students entering grades 7–9';
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
REVOKE ALL ON FUNCTION private.swap_block_reason(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ── 3. What could this registration switch to? ────────────────
-- Every other open class that week the camper is eligible for, with live spots left (taken =
-- confirmed + pending + offered, as everywhere else). Full ones are listed too, so the UI can say
-- why they can't be picked.
CREATE OR REPLACE FUNCTION public.my_swap_options(p_registration_id UUID)
RETURNS TABLE (section_id UUID, class_name TEXT, label TEXT, week SMALLINT, days TEXT,
               start_time TIME, end_time TIME, room TEXT, spots_left INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  reg registrations%ROWTYPE;
BEGIN
  SELECT r.* INTO reg FROM registrations r JOIN students st ON st.id = r.student_id
   WHERE r.id = p_registration_id AND st.parent_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501';
  END IF;
  IF reg.status::text NOT IN ('confirmed', 'pending') THEN RETURN; END IF;

  RETURN QUERY
  SELECT s.id, c.name, s.label, s.week::smallint, s.days, s.start_time, s.end_time, s.room,
         greatest(s.capacity - (SELECT count(*) FROM registrations x
                                 WHERE x.section_id = s.id AND x.status IN ('confirmed', 'pending', 'offered')), 0)::int
    FROM sections s JOIN classes c ON c.id = s.class_id
   WHERE s.id <> reg.section_id
     AND private.swap_block_reason(reg.id, s.id) IS NULL
   ORDER BY c.name, s.label;
END;
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
  IF why IS NOT NULL THEN RAISE EXCEPTION '%', why USING ERRCODE = 'P0001'; END IF;

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

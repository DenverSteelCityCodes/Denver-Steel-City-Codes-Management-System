-- Migration: staffing board — ratios, teachers per course, week roles, room clashes (spec 39, #218)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after migration_volunteer_hours.sql (step 43 in docs/database.md). Needs
-- private.auth_user_role(), private.touch_updated_at(), private.current_camp_year(),
-- private.session_week_number(sessions), private.season_settings_for(int),
-- private.guard_removed_crew() (spec 35) and audit.log_change().
--
-- The board warns. It never assigns anyone, and it never blocks registration: section capacity
-- stays the only hard limit. Two sections cannot share a room in the same week. A week role
-- (admin room or floater) counts in the week's crew, not in a section's ratio, and it cannot
-- be combined with crewing a section that week. Check-in stays a duty, not a week role.
-- Dated cover (spec 33) is not here: a floater covering a section would keep the week role,
-- because that cover is not crewing. Cover suggestions stay as spec 25 left them.
--
-- Calls spec 35's crewing guard; there is still one.
-- region_id comes with spec 20.

-- ── 1. Season targets and a course's own minimum ──────────────

ALTER TABLE season_settings
    ADD COLUMN IF NOT EXISTS target_campers_per_crew SMALLINT NOT NULL DEFAULT 4,
    ADD COLUMN IF NOT EXISTS min_crew_per_section    SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE season_settings DROP CONSTRAINT IF EXISTS season_settings_target_crew_check;
ALTER TABLE season_settings ADD CONSTRAINT season_settings_target_crew_check
    CHECK (target_campers_per_crew BETWEEN 1 AND 20);
ALTER TABLE season_settings DROP CONSTRAINT IF EXISTS season_settings_min_crew_check;
ALTER TABLE season_settings ADD CONSTRAINT season_settings_min_crew_check
    CHECK (min_crew_per_section BETWEEN 1 AND 6);

-- Named defaults keep later season_settings columns from breaking this helper.
CREATE OR REPLACE FUNCTION private.season_settings_for(p_year INT)
RETURNS season_settings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s season_settings;
BEGIN
  SELECT * INTO s FROM season_settings WHERE year = p_year;
  IF NOT FOUND THEN
    s.year := p_year; s.registration_opens_at := NULL; s.change_deadline_days := 14;
    s.offer_hours := 48; s.offer_hours_final_week := 12; s.updated_at := now();
    s.target_campers_per_crew := 4; s.min_crew_per_section := 2;
  END IF;
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION private.season_settings_for(INT) FROM PUBLIC, anon, authenticated;

-- NULL means "use the season minimum". A number overrides it for every section of the course.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS min_teachers SMALLINT;
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_min_teachers_check;
ALTER TABLE classes ADD CONSTRAINT classes_min_teachers_check
    CHECK (min_teachers IS NULL OR min_teachers BETWEEN 1 AND 6);

-- Set on the staffing board. /apply only reads it ("Week 2 still needs teachers").
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS needs_teachers BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Week roles ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS week_roles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id  UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('admin_room', 'floater')),
    note          TEXT CHECK (note IS NULL OR char_length(note) <= 200),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (volunteer_id, session_id)
);
CREATE INDEX IF NOT EXISTS week_roles_session_idx ON week_roles (session_id);

ALTER TABLE week_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_week_roles" ON week_roles;
DROP POLICY IF EXISTS "volunteer_read_own_week_roles" ON week_roles;
-- Admins write. A volunteer reads their own rows. Parents and anon have no policy.
CREATE POLICY "admin_all_week_roles" ON week_roles FOR ALL
    USING (private.auth_user_role() = 'admin')
    WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "volunteer_read_own_week_roles" ON week_roles FOR SELECT TO authenticated
    USING (private.auth_user_role() = 'volunteer' AND volunteer_id = auth.uid());

REVOKE ALL ON week_roles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON week_roles TO authenticated;

DROP TRIGGER IF EXISTS touch_updated_at ON week_roles;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON week_roles
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- Spec 05, section 4: the row's key is id.
DROP TRIGGER IF EXISTS audit_log_change ON week_roles;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON week_roles
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');

-- Admins only, checked before any other trigger reads private data: triggers fire in name order,
-- and the guards below are SECURITY DEFINER, so without this a volunteer's refused insert could
-- still learn from the error which section a colleague leads. (RLS's WITH CHECK runs after them.)
CREATE OR REPLACE FUNCTION private.week_roles_admin_only()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.week_roles_admin_only() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS a_week_roles_admin_only ON week_roles;
CREATE TRIGGER a_week_roles_admin_only BEFORE INSERT OR UPDATE ON week_roles
    FOR EACH ROW EXECUTE FUNCTION private.week_roles_admin_only();

-- A volunteer demoted to another role loses their week roles, as profiles_release_volunteer()
-- (migration_volunteer_role_gate.sql) already releases their sections and duties.
CREATE OR REPLACE FUNCTION private.profiles_release_week_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'volunteer' AND NEW.role IS DISTINCT FROM 'volunteer' THEN
    DELETE FROM week_roles WHERE volunteer_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.profiles_release_week_roles() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_release_week_roles ON profiles;
CREATE TRIGGER profiles_release_week_roles AFTER UPDATE OF role ON profiles
    FOR EACH ROW EXECUTE FUNCTION private.profiles_release_week_roles();

-- Spec 35 owns the one crewing guard; a week role calls it like a section lead or support does.
-- migration_crewing_guard.sql (after this file) is that function's full rule: not removed,
-- accepted this season, agreement verified. This trigger stays pointed at it.
-- It reads volunteer_id on every table that isn't sections.
DROP TRIGGER IF EXISTS guard_removed_crew ON week_roles;
CREATE TRIGGER guard_removed_crew BEFORE INSERT OR UPDATE OF volunteer_id, session_id ON week_roles
    FOR EACH ROW EXECUTE FUNCTION private.guard_removed_crew();

-- ── 3. A section and a session overlap ────────────────────────
-- A section with no session runs both weeks of the current camp year (spec 39). A section
-- tied to a session runs only then.

CREATE OR REPLACE FUNCTION private.section_covers_session(
    p_section_session UUID, p_session UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1 FROM sessions se
    WHERE se.id = p_session
      AND (
        (p_section_session IS NOT NULL AND p_section_session = se.id)
        OR (
          p_section_session IS NULL
          AND se.year = private.current_camp_year()
          -- No session means both weeks, including legacy rows with a week number.
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION private.section_covers_session(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- "Room 101", " room  101 " and "ROOM 101" are the same room. A blank room is no room.
CREATE OR REPLACE FUNCTION private.room_key(p_room TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  -- Collapse every kind of whitespace first, then trim, so a trailing tab can't make a new room.
  SELECT nullif(btrim(lower(regexp_replace(coalesce(p_room, ''), '\s+', ' ', 'g'))), '');
$$;
REVOKE ALL ON FUNCTION private.room_key(TEXT) FROM PUBLIC, anon, authenticated;

-- True when two live sections would put the same room to work in the same week.
-- A cancelled section holds no room. A section with no session overlaps either current week.
CREATE OR REPLACE FUNCTION private.rooms_clash(a sections, b sections)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT a.id IS DISTINCT FROM b.id
     AND a.cancelled_at IS NULL AND b.cancelled_at IS NULL
     AND private.room_key(a.room) IS NOT NULL
     AND private.room_key(a.room) = private.room_key(b.room)
     AND (
       (a.session_id IS NOT NULL AND a.session_id = b.session_id)
       OR (a.session_id IS NULL AND b.session_id IS NULL)
       OR (a.session_id IS NULL AND private.section_covers_session(NULL, b.session_id))
       OR (b.session_id IS NULL AND private.section_covers_session(NULL, a.session_id))
     );
$$;
REVOKE ALL ON FUNCTION private.rooms_clash(sections, sections) FROM PUBLIC, anon, authenticated;

-- Refuse installation over an existing clash rather than silently accepting invalid rooms.
DO $$
DECLARE clash RECORD;
BEGIN
  SELECT a.label AS first_label, b.label AS second_label, a.room INTO clash
    FROM sections a JOIN sections b ON a.id < b.id AND private.rooms_clash(a, b) LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Resolve the existing room clash before applying staffing: % and % share %',
      clash.first_label, clash.second_label, clash.room;
  END IF;
END $$;

-- Named so it runs after sections_sync_session (alphabetical): an insert that only sets week
-- has its session filled in before the room is compared.
CREATE OR REPLACE FUNCTION private.guard_room_clash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  other_label TEXT;
BEGIN
  -- Serialize room allocations, including concurrent inserts into an empty room.
  PERFORM pg_advisory_xact_lock(hashtextextended('staffing:rooms', 0));
  IF NEW.cancelled_at IS NOT NULL THEN RETURN NEW; END IF;
  IF private.room_key(NEW.room) IS NULL THEN RETURN NEW; END IF;
  SELECT sec.label INTO other_label
    FROM sections sec
   WHERE private.rooms_clash(NEW, sec)
   LIMIT 1;
  IF other_label IS NOT NULL THEN
    RAISE EXCEPTION 'Room % is already used by % that week', btrim(NEW.room), other_label
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_room_clash() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS z_sections_room_clash ON sections;
CREATE TRIGGER z_sections_room_clash BEFORE INSERT OR UPDATE OF room, session_id, week, cancelled_at
    ON sections
    FOR EACH ROW EXECUTE FUNCTION private.guard_room_clash();

-- ── 4. Week role and section crew, both directions ────────────
-- A floater covering a section is spec 33's dated cover, which is not crewing, so it is not
-- refused here. The week role stays.

-- A section with no session runs both weeks, whatever its week column says. A section tied to
-- a session runs only in that session.
CREATE OR REPLACE FUNCTION private.guard_week_role_not_crewed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  label TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('staffing:assignments', 0));
  SELECT sec.label INTO label
    FROM sections sec
   WHERE sec.cancelled_at IS NULL
     AND private.section_covers_session(sec.session_id, NEW.session_id)
     AND (
       sec.lead_id = NEW.volunteer_id
       OR EXISTS (SELECT 1 FROM section_supports ss
                   WHERE ss.section_id = sec.id AND ss.volunteer_id = NEW.volunteer_id)
     )
   LIMIT 1;
  IF label IS NOT NULL THEN
    RAISE EXCEPTION 'That volunteer is already crewed on % that week, so they can''t take a week role', label
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_week_role_not_crewed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_week_role_not_crewed ON week_roles;
CREATE TRIGGER guard_week_role_not_crewed BEFORE INSERT OR UPDATE OF volunteer_id, session_id ON week_roles
    FOR EACH ROW EXECUTE FUNCTION private.guard_week_role_not_crewed();

CREATE OR REPLACE FUNCTION private.guard_crew_not_week_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  who UUID;
  sec_session UUID;
  sec_cancelled TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('staffing:assignments', 0));
  IF TG_TABLE_NAME = 'sections' THEN
    who := NEW.lead_id;
    IF NEW.cancelled_at IS NOT NULL THEN RETURN NEW; END IF;
    -- Moving/restoring a section must check its supports too, even with no lead.
    IF EXISTS (
      SELECT 1 FROM section_supports ss JOIN week_roles wr ON wr.volunteer_id = ss.volunteer_id
      WHERE ss.section_id = NEW.id
        AND private.section_covers_session(NEW.session_id, wr.session_id)
    ) THEN
      RAISE EXCEPTION 'A support has a week role that week, so this section cannot move there' USING ERRCODE = 'P0001';
    END IF;
    IF who IS NULL THEN RETURN NEW; END IF;
    sec_session := NEW.session_id;
  ELSE
    who := NEW.volunteer_id;
    SELECT s.session_id, s.cancelled_at INTO sec_session, sec_cancelled
      FROM sections s WHERE s.id = NEW.section_id;
    IF who IS NULL OR sec_cancelled IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM week_roles wr
     WHERE wr.volunteer_id = who
       AND private.section_covers_session(sec_session, wr.session_id)
  ) THEN
    RAISE EXCEPTION 'That volunteer has a week role that week, so they can''t join a crew'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_crew_not_week_role() FROM PUBLIC, anon, authenticated;

-- After sections_sync_session, so a new section's session_id is already set.
DROP TRIGGER IF EXISTS z_guard_crew_not_week_role ON sections;
CREATE TRIGGER z_guard_crew_not_week_role BEFORE INSERT OR UPDATE OF lead_id, session_id, week, cancelled_at
    ON sections
    FOR EACH ROW EXECUTE FUNCTION private.guard_crew_not_week_role();
DROP TRIGGER IF EXISTS guard_crew_not_week_role ON section_supports;
CREATE TRIGGER guard_crew_not_week_role BEFORE INSERT OR UPDATE OF volunteer_id, section_id
    ON section_supports
    FOR EACH ROW EXECUTE FUNCTION private.guard_crew_not_week_role();

-- ── 5. Removal also drops week roles (spec 35's function, plus this table) ─

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
  -- Week roles for this season and later. They are not crewing, but they are this season's staff.
  DELETE FROM week_roles wr USING sessions se
   WHERE wr.volunteer_id = p_volunteer_id AND wr.session_id = se.id
     AND se.year >= private.current_camp_year();
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

-- ── 6. Colour and wording (the same thresholds as src/lib/staffing.ts) ─
-- Red: crew below the section minimum, or campers per crew greater than target × 1.25.
-- Amber: above the target, at most target × 1.25. Green: at or under the target.
-- The word for a short crew is "Short N teacher(s)". Ratio words are the other three.

CREATE OR REPLACE FUNCTION private.staffing_status(p_seated INT, p_crew INT, p_target INT, p_min INT)
RETURNS TABLE (tone TEXT, word TEXT, campers_per_crew NUMERIC, required INT, small BOOLEAN)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  n INT := p_min - p_crew;
  ratio NUMERIC;
  limit_ratio NUMERIC := p_target * 1.25;
BEGIN
  required := greatest(p_min, ceil(p_seated::numeric / p_target))::int;
  small := p_seated <= p_target * p_min;
  campers_per_crew := CASE WHEN p_crew > 0 THEN p_seated::numeric / p_crew ELSE NULL END;
  IF n > 0 THEN
    tone := 'red';
    word := 'Short ' || n || CASE WHEN n = 1 THEN ' teacher' ELSE ' teachers' END;
    RETURN NEXT;
    RETURN;
  END IF;
  ratio := p_seated::numeric / p_crew;
  IF ratio > limit_ratio THEN
    tone := 'red'; word := 'Over the target';
  ELSIF ratio > p_target THEN
    tone := 'amber'; word := 'Above the target';
  ELSIF ratio = p_target THEN
    tone := 'green'; word := 'At the target';
  ELSE
    tone := 'green'; word := 'Under the target';
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION private.staffing_status(INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;

-- ── 7. The board, one week at a time ──────────────────────────
-- Read only. Absences are ignored: the count is planned crew, not who is in the room that day.
-- A both-weeks section is listed in every current week. Week roles count in the week's people,
-- not in a section's crew. Duty-slot holders with no section are their own group.

CREATE OR REPLACE FUNCTION public.admin_staffing(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  se sessions;
  target INT;
  season_min INT;
  wk INT;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can see the staffing board' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO se FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No session with that id' USING ERRCODE = 'P0002';
  END IF;
  target := (private.season_settings_for(se.year)).target_campers_per_crew;
  season_min := (private.season_settings_for(se.year)).min_crew_per_section;
  wk := private.session_week_number(se);

  RETURN (
    WITH latest_app AS (
      SELECT DISTINCT ON (a.user_id)
             a.user_id, a.status, a.course_first_choice, a.course_second_choice
        FROM volunteer_applications a
       WHERE a.user_id IS NOT NULL
       ORDER BY a.user_id, a.created_at DESC, a.id DESC
    ),
    accepted AS (
      SELECT v.id, v.experience_level,
             coalesce(nullif(btrim(v.preferred_name), ''), p.display_name) AS name,
             CASE wk WHEN 1 THEN v.availability_week_1
                      WHEN 2 THEN v.availability_week_2
                      ELSE v.availability_week_1 AND v.availability_week_2 END AS available
        FROM volunteers v
        JOIN profiles p ON p.id = v.id AND p.role = 'volunteer'   -- a demoted account isn't crew
        JOIN latest_app la ON la.user_id = v.id AND la.status = 'accepted'
       WHERE v.removed_at IS NULL
         AND v.accepted_at >= (private.season_start()::timestamp AT TIME ZONE 'America/Denver')
    ),
    live AS (
      SELECT sec.id, sec.class_id, c.name AS course, sec.label, sec.room, sec.capacity, sec.lead_id,
             coalesce(c.min_teachers, season_min) AS min_crew,
             (SELECT count(*) FROM registrations r
               WHERE r.section_id = sec.id AND r.status IN ('confirmed', 'pending', 'offered'))::int AS seated,
             (SELECT count(*) FROM registrations r
               WHERE r.section_id = sec.id AND r.status = 'waitlisted')::int AS waitlist,
             ((sec.lead_id IS NOT NULL)::int
              + (SELECT count(*) FROM section_supports ss WHERE ss.section_id = sec.id AND ss.volunteer_id IS DISTINCT FROM sec.lead_id))::int AS crew
        FROM sections sec
        JOIN classes c ON c.id = sec.class_id
       WHERE sec.cancelled_at IS NULL
         AND private.section_covers_session(sec.session_id, se.id)
    ),
    scored AS (
      SELECT l.*, st.tone, st.word, st.campers_per_crew, st.required, st.small,
             g.grade_low, g.grade_high
        FROM live l
        CROSS JOIN LATERAL private.staffing_status(l.seated, l.crew, target, l.min_crew) st
        LEFT JOIN LATERAL (
          SELECT (array_agg(x.grade ORDER BY x.n))[1] AS grade_low,
                 (array_agg(x.grade ORDER BY x.n DESC))[1] AS grade_high
            FROM (
              SELECT st2.grade, substring(st2.grade FROM '^[0-9]+')::int AS n
                FROM registrations r
                JOIN students st2 ON st2.id = r.student_id
               WHERE r.section_id = l.id AND r.status IN ('confirmed', 'pending', 'offered')
                 AND st2.grade IS NOT NULL
                 AND substring(st2.grade FROM '^[0-9]+') IS NOT NULL
            ) x
        ) g ON true
    ),
    on_section AS (
      SELECT l.lead_id AS volunteer_id FROM live l WHERE l.lead_id IS NOT NULL
      UNION
      SELECT ss.volunteer_id FROM section_supports ss JOIN live l ON l.id = ss.section_id
    ),
    on_duty AS (
      SELECT da.volunteer_id, dt.name AS duty
        FROM duty_assignments da
        JOIN duty_slots ds ON ds.id = da.duty_slot_id
        JOIN duty_types dt ON dt.id = ds.duty_type_id
       WHERE ds.session_id = se.id
          OR (ds.session_id IS NULL AND ds.slot_date BETWEEN se.start_date AND se.end_date)
    )
    SELECT jsonb_build_object(
      'session_id', se.id,
      'week_number', wk,
      'session_name', se.name,
      'target', target,
      'min_crew', season_min,
      'needs_teachers', se.needs_teachers,
      'projected_need', coalesce(ceil((SELECT sum(capacity) FROM live)::numeric / target), 0)::int,
      'available_accepted', (SELECT count(*) FROM accepted WHERE available)::int,
      'crew_total', (SELECT count(*) FROM (
        SELECT volunteer_id FROM on_section UNION SELECT volunteer_id FROM week_roles WHERE session_id = se.id
      ) people)::int,
      'sections', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'section_id', s.id, 'class_id', s.class_id, 'course', s.course, 'label', s.label,
          'room', nullif(btrim(s.room), ''), 'seated', s.seated, 'capacity', s.capacity,
          'waitlist', s.waitlist, 'crew', s.crew,
          'campers_per_crew', s.campers_per_crew, 'required', s.required, 'min_crew', s.min_crew,
          'grade_low', s.grade_low, 'grade_high', s.grade_high,
          'tone', s.tone, 'word', s.word, 'small', s.small
        ) ORDER BY s.course, s.label)
        FROM scored s), '[]'::jsonb),
      'courses', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'class_id', c.class_id, 'course', c.course,
          'required', c.required, 'assigned', c.assigned,
          'ranked_available', (
            SELECT count(*) FROM accepted a
              JOIN latest_app la ON la.user_id = a.id
             WHERE a.available
               AND (
                 lower(btrim(coalesce(la.course_first_choice, ''))) = lower(btrim(c.course))
                 OR lower(btrim(coalesce(la.course_second_choice, ''))) = lower(btrim(c.course))
               )
               AND NOT EXISTS (SELECT 1 FROM on_section os WHERE os.volunteer_id = a.id)
               AND NOT EXISTS (SELECT 1 FROM week_roles wr
                                WHERE wr.volunteer_id = a.id AND wr.session_id = se.id)
          )
        ) ORDER BY c.course)
        FROM (
          SELECT class_id, course, sum(required)::int AS required, sum(crew)::int AS assigned
            FROM scored GROUP BY class_id, course
        ) c), '[]'::jsonb),
      'week_roles', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', wr.id, 'volunteer_id', v.id, 'name', coalesce(nullif(btrim(v.preferred_name), ''), p.display_name),
          'level', v.experience_level, 'role', wr.role, 'note', wr.note, 'updated_at', wr.updated_at
        ) ORDER BY coalesce(nullif(btrim(v.preferred_name), ''), p.display_name))
        FROM week_roles wr
        JOIN volunteers v ON v.id = wr.volunteer_id
        JOIN profiles p ON p.id = v.id
        WHERE wr.session_id = se.id), '[]'::jsonb),
      'duty_holders', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'volunteer_id', a.id, 'name', a.name, 'level', a.experience_level, 'duties', d.duties
        ) ORDER BY a.name)
        FROM accepted a
        JOIN (
          SELECT volunteer_id, jsonb_agg(DISTINCT duty ORDER BY duty) AS duties
            FROM on_duty GROUP BY volunteer_id
        ) d ON d.volunteer_id = a.id
        WHERE NOT EXISTS (SELECT 1 FROM on_section os WHERE os.volunteer_id = a.id)), '[]'::jsonb),
      'unassigned', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'volunteer_id', a.id, 'name', a.name, 'level', a.experience_level
        ) ORDER BY a.name)
        FROM accepted a
        WHERE a.available
          AND NOT EXISTS (SELECT 1 FROM on_section os WHERE os.volunteer_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM week_roles wr
                          WHERE wr.volunteer_id = a.id AND wr.session_id = se.id)
          AND NOT EXISTS (SELECT 1 FROM on_duty od WHERE od.volunteer_id = a.id)), '[]'::jsonb)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_staffing(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_staffing(UUID) TO authenticated;

-- ── 8. Week roles earn the same service hours as section crew (B2) ──
CREATE OR REPLACE FUNCTION private.volunteer_week_hours(p_volunteer UUID, p_session UUID)
RETURNS TABLE (crewed BOOLEAN, crew_days INT, crew_minutes INT, duty_minutes INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH se AS (
    SELECT * FROM sessions WHERE id = p_session
  ), today AS (
    SELECT (now() AT TIME ZONE 'America/Denver')::date AS d
  ), crewed AS (
    SELECT EXISTS (SELECT 1 FROM week_roles wr WHERE wr.volunteer_id = p_volunteer AND wr.session_id = p_session) OR EXISTS (
      SELECT 1 FROM sections s, se
      WHERE s.cancelled_at IS NULL
        -- No session means both weeks, using the same rule as the staffing board.
        AND (s.session_id = se.id
             OR (s.session_id IS NULL AND se.year = private.current_camp_year()))
        AND (s.lead_id = p_volunteer
             OR EXISTS (SELECT 1 FROM section_supports ss WHERE ss.section_id = s.id AND ss.volunteer_id = p_volunteer))
    ) AS yes
  ), worked AS (
    SELECT g::date AS d
    FROM se, today, crewed, generate_series(se.start_date, least(se.end_date, today.d), interval '1 day') g
    WHERE crewed.yes
      AND extract(isodow FROM g) < 6
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
      AND ds.slot_date NOT IN (SELECT d FROM worked)
      AND NOT EXISTS (SELECT 1 FROM crew_absences a
                      WHERE a.volunteer_id = p_volunteer AND ds.slot_date BETWEEN a.from_date AND a.to_date)
  )
  SELECT (SELECT yes FROM crewed),
         (SELECT count(*) FROM worked)::int,
         (SELECT count(*) FROM worked)::int * 480,
         (SELECT m FROM duty)
  FROM se;
$$;
REVOKE ALL ON FUNCTION private.volunteer_week_hours(UUID, UUID) FROM PUBLIC, anon, authenticated;



-- ── 9. Notify week-role changes through the existing outbox ──
CREATE OR REPLACE FUNCTION private.notify_week_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE r week_roles; se sessions;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.volunteer_id, NEW.session_id, NEW.role, NEW.note)
      IS NOT DISTINCT FROM (OLD.volunteer_id, OLD.session_id, OLD.role, OLD.note) THEN RETURN NEW; END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (OLD.volunteer_id, OLD.session_id) IS DISTINCT FROM (NEW.volunteer_id, NEW.session_id)) THEN
    r := OLD;
    SELECT * INTO se FROM sessions WHERE id = r.session_id;
    PERFORM private.enqueue_notification(r.volunteer_id, 'week_role_changed',
      jsonb_build_object('week', private.session_week_number(se), 'removed', true, 'role', r.role),
      'week_role_removed:' || r.id || ':' || txid_current());
  END IF;
  IF TG_OP <> 'DELETE' THEN
    r := NEW;
    SELECT * INTO se FROM sessions WHERE id = r.session_id;
    PERFORM private.enqueue_notification(r.volunteer_id, 'week_role_changed',
      jsonb_build_object('week', private.session_week_number(se), 'removed', false, 'role', r.role, 'note', r.note),
      'week_role_changed:' || r.id || ':' || lower(TG_OP) || ':' || txid_current());
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.notify_week_role() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_week_role ON week_roles;
CREATE TRIGGER notify_week_role AFTER INSERT OR UPDATE OR DELETE ON week_roles
FOR EACH ROW EXECUTE FUNCTION private.notify_week_role();

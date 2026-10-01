-- Migration: camp-week operations (applied to rdckxazvoeixgwtjhrlf via MCP on 2026-09-30).
-- Apply after migration_one_class_per_week.sql. See test-plans/camp-week-gap-audit-2026-09-30.md.
--
--   1. Section schedule: days, start/end time, room (issue #41).
--   2. schedule_items: the daily camp schedule, one list per session, admin-editable.
--   3. roll_call_marks: named roll calls (arrival / after lunch / dismissal) taken by a section's
--      crew. Parents read their own campers' marks; admins see every section.
--   4. updates: posts from an admin (everyone / parents / volunteers / one section) or from a
--      section lead (their own section's parents). Readers are decided by RLS; the author name is
--      stamped server-side.
--   5. RPCs: section_lead_names() (first names for parents' "this week" card) and
--      update_recipient_emails() (fills the mail client's BCC; no server-side sending).

-- ── 1. Section schedule ───────────────────────────────────────

ALTER TABLE sections
    ADD COLUMN IF NOT EXISTS days       TEXT NOT NULL DEFAULT 'Mon–Fri',
    ADD COLUMN IF NOT EXISTS start_time TIME,
    ADD COLUMN IF NOT EXISTS end_time   TIME,
    ADD COLUMN IF NOT EXISTS room       TEXT;

-- ── 2. Daily schedule per session ─────────────────────────────

CREATE TABLE IF NOT EXISTS schedule_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    start_time  TIME NOT NULL,
    end_time    TIME,
    title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    location    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS schedule_items_session_idx ON schedule_items (session_id, start_time);

ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_schedule_items" ON schedule_items;
DROP POLICY IF EXISTS "read_schedule_items"      ON schedule_items;
CREATE POLICY "admin_all_schedule_items" ON schedule_items FOR ALL
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "read_schedule_items" ON schedule_items FOR SELECT TO authenticated USING (true);

-- ── 3. Roll calls ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roll_call_marks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id  UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    day         DATE NOT NULL,
    roll_call   TEXT NOT NULL CHECK (roll_call IN ('arrival', 'after_lunch', 'dismissal')),
    present     BOOLEAN NOT NULL,
    note        TEXT,
    marked_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    marked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (section_id, student_id, day, roll_call)
);
CREATE INDEX IF NOT EXISTS roll_call_marks_day_idx     ON roll_call_marks (day, section_id);
CREATE INDEX IF NOT EXISTS roll_call_marks_student_idx ON roll_call_marks (student_id);

-- A mark may only be written by the section's crew, for a camper who holds a seat in that section.
CREATE OR REPLACE FUNCTION private.roll_call_mark_ok(p_section_id UUID, p_student_id UUID, p_marked_by UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT p_marked_by = auth.uid()
     AND private.auth_volunteer_has_section(p_section_id)
     AND EXISTS (SELECT 1 FROM registrations r
                 WHERE r.section_id = p_section_id AND r.student_id = p_student_id
                   AND r.status IN ('confirmed', 'pending'));
$$;
-- Policies run as the caller, so the helper must be executable by authenticated (the private
-- schema is not exposed over REST, so it can't be called from outside a policy).
REVOKE ALL ON FUNCTION private.roll_call_mark_ok(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.roll_call_mark_ok(UUID, UUID, UUID) TO authenticated;

ALTER TABLE roll_call_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_roll_calls"       ON roll_call_marks;
DROP POLICY IF EXISTS "volunteer_read_roll_calls"  ON roll_call_marks;
DROP POLICY IF EXISTS "volunteer_write_roll_calls" ON roll_call_marks;
DROP POLICY IF EXISTS "volunteer_edit_roll_calls"  ON roll_call_marks;
DROP POLICY IF EXISTS "parent_read_roll_calls"     ON roll_call_marks;

CREATE POLICY "admin_all_roll_calls" ON roll_call_marks FOR ALL
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "volunteer_read_roll_calls" ON roll_call_marks FOR SELECT TO authenticated
    USING (private.auth_volunteer_has_section(section_id));
CREATE POLICY "volunteer_write_roll_calls" ON roll_call_marks FOR INSERT TO authenticated
    WITH CHECK (private.roll_call_mark_ok(section_id, student_id, marked_by));
CREATE POLICY "volunteer_edit_roll_calls" ON roll_call_marks FOR UPDATE TO authenticated
    USING (private.auth_volunteer_has_section(section_id))
    WITH CHECK (private.roll_call_mark_ok(section_id, student_id, marked_by));
CREATE POLICY "parent_read_roll_calls" ON roll_call_marks FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM students s WHERE s.id = roll_call_marks.student_id AND s.parent_id = auth.uid()));

-- ── 4. Updates ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS updates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL DEFAULT '',
    audience    TEXT NOT NULL CHECK (audience IN ('everyone', 'parents', 'volunteers', 'section')),
    section_id  UUID REFERENCES sections(id) ON DELETE CASCADE,
    body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((audience = 'section') = (section_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS updates_created_idx ON updates (created_at DESC);
CREATE INDEX IF NOT EXISTS updates_section_idx ON updates (section_id);

-- Does the caller lead this section? (posting rights)
CREATE OR REPLACE FUNCTION private.auth_volunteer_leads_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM sections WHERE id = p_section_id AND lead_id = auth.uid());
$$;
-- Does the caller have a camper holding a seat in this section? (reading rights)
CREATE OR REPLACE FUNCTION private.auth_parent_has_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM registrations r JOIN students s ON s.id = r.student_id
    WHERE r.section_id = p_section_id AND s.parent_id = auth.uid()
      AND r.status IN ('confirmed', 'pending'));
$$;
REVOKE ALL ON FUNCTION private.auth_volunteer_leads_section(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.auth_parent_has_section(UUID)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_volunteer_leads_section(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.auth_parent_has_section(UUID)     TO authenticated;

-- The author is always the signed-in user and the name is copied from their profile, so a post
-- can't be signed as someone else and readers don't need profile access to show who wrote it.
CREATE OR REPLACE FUNCTION public.updates_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id := auth.uid();
  END IF;
  SELECT display_name INTO NEW.author_name FROM profiles WHERE id = NEW.author_id;
  IF NEW.author_name IS NULL THEN
    RAISE EXCEPTION 'Unknown author' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.updates_before_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS updates_before_insert ON updates;
CREATE TRIGGER updates_before_insert BEFORE INSERT ON updates
    FOR EACH ROW EXECUTE FUNCTION updates_before_insert();

ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_updates"     ON updates;
DROP POLICY IF EXISTS "read_my_updates"       ON updates;
DROP POLICY IF EXISTS "lead_post_to_section"  ON updates;
DROP POLICY IF EXISTS "author_delete_update"  ON updates;

CREATE POLICY "admin_all_updates" ON updates FOR ALL
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "read_my_updates" ON updates FOR SELECT TO authenticated
    USING (
        audience = 'everyone'
        OR (audience = 'parents'    AND private.auth_user_role() = 'parent')
        OR (audience = 'volunteers' AND private.auth_user_role() = 'volunteer')
        OR (audience = 'section'    AND (private.auth_volunteer_has_section(section_id)
                                         OR private.auth_parent_has_section(section_id)))
    );
CREATE POLICY "lead_post_to_section" ON updates FOR INSERT TO authenticated
    WITH CHECK (audience = 'section' AND private.auth_volunteer_leads_section(section_id));
CREATE POLICY "author_delete_update" ON updates FOR DELETE TO authenticated
    USING (author_id = auth.uid());

-- ── 5. RPCs ───────────────────────────────────────────────────

-- Lead's first name per section: parents can't read profiles or volunteers, and a first name is
-- all the "this week" card needs.
CREATE OR REPLACE FUNCTION public.section_lead_names()
RETURNS TABLE (section_id UUID, lead_first_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, split_part(p.display_name, ' ', 1)
  FROM sections s JOIN profiles p ON p.id = s.lead_id
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.section_lead_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.section_lead_names() TO authenticated;

-- Email addresses for an update's audience, for the client to put in a mailto: BCC (or the
-- clipboard). Admins may ask for any audience; a section's crew may ask for that section's
-- families. A parent's address is their contact email, else their login email.
CREATE OR REPLACE FUNCTION public.update_recipient_emails(p_audience TEXT, p_section_id UUID DEFAULT NULL)
RETURNS TEXT[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  is_admin BOOLEAN := private.auth_user_role() = 'admin';
  parents  TEXT[];
  vols     TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;

  IF p_audience = 'section' THEN
    IF p_section_id IS NULL THEN
      RAISE EXCEPTION 'Pick a section' USING ERRCODE = 'P0001';
    END IF;
    IF NOT (is_admin OR private.auth_volunteer_has_section(p_section_id)) THEN
      RAISE EXCEPTION 'Only this section''s crew or an admin can email its families' USING ERRCODE = '42501';
    END IF;
    RETURN ARRAY(
      SELECT DISTINCT lower(coalesce(pp.email, u.email))
      FROM registrations r
      JOIN students st ON st.id = r.student_id
      JOIN auth.users u ON u.id = st.parent_id
      LEFT JOIN parent_profiles pp ON pp.id = st.parent_id
      WHERE r.section_id = p_section_id AND r.status IN ('confirmed', 'pending')
        AND coalesce(pp.email, u.email) IS NOT NULL
      ORDER BY 1);
  END IF;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  parents := ARRAY(
    SELECT DISTINCT lower(coalesce(pp.email, u.email))
    FROM students st
    JOIN auth.users u ON u.id = st.parent_id
    LEFT JOIN parent_profiles pp ON pp.id = st.parent_id
    WHERE coalesce(pp.email, u.email) IS NOT NULL
      AND EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = st.id AND r.status IN ('confirmed', 'pending'))
    ORDER BY 1);
  vols := ARRAY(
    SELECT DISTINCT lower(u.email) FROM volunteers v JOIN auth.users u ON u.id = v.id
    WHERE u.email IS NOT NULL ORDER BY 1);

  RETURN CASE p_audience
    WHEN 'parents'    THEN parents
    WHEN 'volunteers' THEN vols
    WHEN 'everyone'   THEN ARRAY(SELECT DISTINCT e FROM unnest(parents || vols) e ORDER BY e)
    ELSE NULL
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.update_recipient_emails(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_recipient_emails(TEXT, UUID) TO authenticated;

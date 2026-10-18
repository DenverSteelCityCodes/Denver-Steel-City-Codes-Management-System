-- Migration: volunteer access follows the current role (fix #143)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_camp_week_ops.sql, migration_duties.sql, migration_parent_changes.sql
-- and migration_volunteer_self_service.sql.
--
-- Bug: every volunteer-only check asked whether a `volunteers` row exists. Changing someone's role
-- on the Users page never removes that row (it holds their history), so a demoted volunteer still
-- read volunteer updates, schedules and lead names, stayed on the volunteer email list, could
-- claim and drop duty slots, report crew absences, edit preferences and file crew-switch requests.
-- Fix:
--   1. private.auth_is_volunteer() = the current role is 'volunteer' AND a volunteers row exists.
--   2. Every volunteer-only check uses it: duty claims, crew absences, preferences, crew-switch
--      requests, the volunteer email list and the cover suggestions on the admin absence list.
--   3. Moving a volunteer to another role clears their crew spots and upcoming duty claims in the
--      same transaction as the role change (trigger), instead of two client calls beforehand.
--      Past duty claims stay, for hours records. Re-promoting restores access (the row is kept).

-- ── 1. The check ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.auth_is_volunteer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM volunteers v JOIN profiles p ON p.id = v.id
                 WHERE v.id = auth.uid() AND p.role = 'volunteer');
$$;
REVOKE ALL ON FUNCTION private.auth_is_volunteer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_is_volunteer() TO authenticated;

-- ── 2. Duty claims and crew absences ──────────────────────────
DROP POLICY IF EXISTS "volunteer_manage_own_duties" ON duty_assignments;
CREATE POLICY "volunteer_manage_own_duties" ON duty_assignments FOR ALL TO authenticated
    USING      (volunteer_id = auth.uid() AND private.auth_is_volunteer())
    WITH CHECK (volunteer_id = auth.uid() AND private.auth_is_volunteer());

DROP POLICY IF EXISTS "own_insert_crew_absences" ON crew_absences;
CREATE POLICY "own_insert_crew_absences" ON crew_absences FOR INSERT TO authenticated
    WITH CHECK (volunteer_id = auth.uid() AND private.auth_is_volunteer()
                AND to_date >= (now() AT TIME ZONE 'America/Denver')::date);

-- ── 3. Preferences and crew-switch requests ───────────────────
CREATE OR REPLACE FUNCTION public.update_my_volunteer_prefs(
    p_week1 BOOLEAN, p_week2 BOOLEAN, p_first TEXT, p_second TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.auth_is_volunteer() THEN
    RAISE EXCEPTION 'Only accepted volunteers can set preferences' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(p_week1, false) AND NOT coalesce(p_week2, false) THEN
    RAISE EXCEPTION 'Pick at least one week you can help, or use "I can''t make it" for specific days' USING ERRCODE = 'P0001';
  END IF;
  IF length(p_first) > 100 OR length(p_second) > 100 THEN
    RAISE EXCEPTION 'Course choice is too long' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.set_reason('volunteer_prefs');
  UPDATE volunteers SET availability_week_1 = coalesce(p_week1, false), availability_week_2 = coalesce(p_week2, false)
   WHERE id = auth.uid();
  UPDATE volunteer_applications SET course_first_choice = nullif(trim(p_first), ''), course_second_choice = nullif(trim(p_second), '')
   WHERE id = (SELECT id FROM volunteer_applications WHERE user_id = auth.uid()
                ORDER BY (status = 'accepted') DESC, created_at DESC LIMIT 1);
  PERFORM private.set_reason(NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_volunteer_prefs(BOOLEAN, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_volunteer_prefs(BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_change(p_registration_id UUID, p_kind TEXT, p_message TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  stu UUID;
  new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF p_kind = 'crew_switch' AND NOT private.auth_is_volunteer() THEN
    RAISE EXCEPTION 'Only volunteers can ask to switch crews' USING ERRCODE = '42501';
  END IF;
  IF p_registration_id IS NOT NULL THEN
    SELECT r.student_id INTO stu FROM registrations r JOIN students st ON st.id = r.student_id
     WHERE r.id = p_registration_id AND st.parent_id = auth.uid();
    IF stu IS NULL THEN RAISE EXCEPTION 'That registration isn''t on your account' USING ERRCODE = '42501'; END IF;
    IF EXISTS (SELECT 1 FROM change_requests WHERE registration_id = p_registration_id AND status = 'open') THEN
      RAISE EXCEPTION 'You already have an open request for this spot. The camp will get back to you.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF coalesce(trim(p_message), '') = '' THEN
    RAISE EXCEPTION 'Tell the camp what you''d like to change' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO change_requests (registration_id, student_id, requested_by, kind, message)
  VALUES (p_registration_id, stu, auth.uid(), coalesce(p_kind, 'other'), left(trim(p_message), 1000))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_change(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_change(UUID, TEXT, TEXT) TO authenticated;

-- ── 4. The volunteer email list ───────────────────────────────
CREATE OR REPLACE FUNCTION public.update_recipient_emails(p_audience TEXT, p_section_id UUID DEFAULT NULL)
RETURNS TEXT[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  -- coalesce: a signed-in user with no profile row has a NULL role, and NOT (NULL OR false) is
  -- NULL, which would skip both permission checks below.
  is_admin BOOLEAN := coalesce(private.auth_user_role() = 'admin', false);
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
    IF NOT (is_admin OR coalesce(private.auth_volunteer_has_section(p_section_id), false)) THEN
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
  -- Only people who are volunteers now: a demoted volunteer keeps their volunteers row.
  vols := ARRAY(
    SELECT DISTINCT lower(u.email) FROM volunteers v
    JOIN profiles p ON p.id = v.id AND p.role = 'volunteer'
    JOIN auth.users u ON u.id = v.id
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

-- Cover suggestions on the admin absence list: only current volunteers.
CREATE OR REPLACE FUNCTION public.admin_crew_absences()
RETURNS TABLE (absence_id UUID, volunteer_name TEXT, from_date DATE, to_date DATE, note TEXT,
               section_id UUID, class_name TEXT, section_label TEXT, week SMALLINT, is_lead BOOLEAN,
               suggestions TEXT[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH crew AS (
    SELECT s.id AS section_id, s.lead_id AS volunteer_id, true AS is_lead FROM sections s WHERE s.lead_id IS NOT NULL
    UNION ALL
    SELECT ss.section_id, ss.volunteer_id, false FROM section_supports ss
  ), sec AS (
    SELECT s.id, s.label, s.week, c.name AS class_name,
           coalesce(se.start_date, (SELECT min(x.start_date) FROM sessions x WHERE x.is_active)) AS starts,
           coalesce(se.end_date,   (SELECT max(x.end_date)   FROM sessions x WHERE x.is_active)) AS ends
      FROM sections s JOIN classes c ON c.id = s.class_id LEFT JOIN sessions se ON se.id = s.session_id
     WHERE s.cancelled_at IS NULL
  )
  SELECT a.id, p.display_name, a.from_date, a.to_date, a.note,
         sec.id, sec.class_name, sec.label, sec.week, crew.is_lead,
         ARRAY(
           SELECT pp.display_name FROM volunteers v JOIN profiles pp ON pp.id = v.id
            WHERE v.experience_level = 'senior' AND v.id <> a.volunteer_id
              AND pp.role = 'volunteer'   -- a demoted volunteer keeps their volunteers row
              AND CASE sec.week WHEN 1 THEN v.availability_week_1 WHEN 2 THEN v.availability_week_2
                                ELSE v.availability_week_1 AND v.availability_week_2 END
              AND NOT EXISTS (SELECT 1 FROM crew c2 JOIN sections s2 ON s2.id = c2.section_id
                               WHERE c2.volunteer_id = v.id AND s2.cancelled_at IS NULL
                                 AND (s2.week IS NULL OR sec.week IS NULL OR s2.week = sec.week))
              AND NOT EXISTS (SELECT 1 FROM crew_absences a2 WHERE a2.volunteer_id = v.id
                               AND a2.from_date <= a.to_date AND a2.to_date >= a.from_date)
            ORDER BY pp.display_name LIMIT 5)
    FROM crew_absences a
    JOIN profiles p ON p.id = a.volunteer_id
    JOIN crew ON crew.volunteer_id = a.volunteer_id
    JOIN sec ON sec.id = crew.section_id
   WHERE a.to_date >= (now() AT TIME ZONE 'America/Denver')::date
     AND a.from_date <= sec.ends AND a.to_date >= sec.starts
   ORDER BY a.from_date, crew.is_lead DESC, sec.class_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_crew_absences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crew_absences() TO authenticated;

-- ── 5. Leaving the volunteer role releases crew spots and upcoming duties ──
-- Same transaction as the role change, so a failed role change leaves the crew untouched and
-- nobody stays on a crew without the volunteer role. Clearing a lead sends no "new lead" email
-- (notify_new_lead skips a NULL lead). The audit trigger records each removal.
CREATE OR REPLACE FUNCTION private.release_volunteer_on_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF OLD.role = 'volunteer' AND NEW.role IS DISTINCT FROM 'volunteer' THEN
    UPDATE sections SET lead_id = NULL WHERE lead_id = NEW.id;
    DELETE FROM section_supports WHERE volunteer_id = NEW.id;
    DELETE FROM duty_assignments da USING duty_slots ds
     WHERE da.duty_slot_id = ds.id AND da.volunteer_id = NEW.id
       AND ds.slot_date >= (now() AT TIME ZONE 'America/Denver')::date;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.release_volunteer_on_role_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_release_volunteer ON profiles;
CREATE TRIGGER profiles_release_volunteer AFTER UPDATE OF role ON profiles
    FOR EACH ROW EXECUTE FUNCTION private.release_volunteer_on_role_change();

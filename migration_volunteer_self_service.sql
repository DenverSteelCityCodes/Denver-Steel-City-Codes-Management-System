-- Migration: volunteer preferences, switch requests and "I can't make it" (spec 25, #99)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_parent_changes.sql (change_requests), migration_audit_log.sql and
-- migration_notifications.sql.
--
-- Decided 2026-10-16 (Q-V1): volunteers set preferences, admins assign. No self-pick.
--   * a volunteer edits their own week availability and course choices (never their experience
--     level, which stays admin-only: volunteers still have no UPDATE on `volunteers`);
--   * "Request a switch" is a change request of kind 'crew_switch' (request_change(), spec 11);
--   * "I can't make it" records dates in crew_absences; the admin dashboard shows which sections
--     it leaves short, with suggested cover (available seniors not crewed that week);
--   * when an admin replaces a section's lead, the section's families get one 'new_lead' email.

-- ── 1. Preferences ────────────────────────────────────────────
-- Course choices live on the accepted application (where the matcher reads them).
CREATE OR REPLACE FUNCTION public.my_volunteer_prefs()
RETURNS TABLE (availability_week_1 BOOLEAN, availability_week_2 BOOLEAN,
               course_first_choice TEXT, course_second_choice TEXT, experience_level TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.availability_week_1, v.availability_week_2, a.course_first_choice, a.course_second_choice,
         v.experience_level::text
  FROM volunteers v
  LEFT JOIN LATERAL (SELECT * FROM volunteer_applications va
                      WHERE va.user_id = v.id ORDER BY (va.status = 'accepted') DESC, va.created_at DESC LIMIT 1) a ON true
  WHERE v.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_volunteer_prefs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_volunteer_prefs() TO authenticated;

-- Course names for the choice lists. Volunteers read only their own section's class through RLS;
-- the names themselves are public (signed-out visitors see them on the apply form).
CREATE OR REPLACE FUNCTION public.course_names()
RETURNS SETOF TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT name FROM classes ORDER BY name;
$$;
REVOKE ALL ON FUNCTION public.course_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_names() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_my_volunteer_prefs(
    p_week1 BOOLEAN, p_week2 BOOLEAN, p_first TEXT, p_second TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM volunteers WHERE id = auth.uid()) THEN
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

-- ── 2. "I can't make it" ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS crew_absences (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id  UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    from_date     DATE NOT NULL,
    to_date       DATE NOT NULL,
    note          TEXT CHECK (length(note) <= 500),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (to_date >= from_date)
);
CREATE INDEX IF NOT EXISTS crew_absences_dates_idx ON crew_absences (to_date);

ALTER TABLE crew_absences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_crew_absences" ON crew_absences;
DROP POLICY IF EXISTS "own_read_crew_absences"  ON crew_absences;
DROP POLICY IF EXISTS "own_insert_crew_absences" ON crew_absences;
DROP POLICY IF EXISTS "own_delete_crew_absences" ON crew_absences;
CREATE POLICY "admin_all_crew_absences" ON crew_absences FOR ALL
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
CREATE POLICY "own_read_crew_absences" ON crew_absences FOR SELECT TO authenticated
    USING (volunteer_id = auth.uid());
-- Not in the past: an absence is a heads-up, not a record to rewrite later.
CREATE POLICY "own_insert_crew_absences" ON crew_absences FOR INSERT TO authenticated
    WITH CHECK (volunteer_id = auth.uid() AND to_date >= (now() AT TIME ZONE 'America/Denver')::date);
CREATE POLICY "own_delete_crew_absences" ON crew_absences FOR DELETE TO authenticated
    USING (volunteer_id = auth.uid());
GRANT SELECT, INSERT, DELETE ON crew_absences TO authenticated;
GRANT UPDATE ON crew_absences TO authenticated;   -- admins only, via RLS

DROP TRIGGER IF EXISTS audit_log_change ON crew_absences;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON crew_absences
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('id');

-- ── 3. Admin: who's out, which sections it leaves short, who could cover ─
-- One row per (upcoming absence × section the volunteer crews in the dates). Suggestions: seniors
-- available that week (availability_week_N), not crewing any section that week, not absent then.
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

-- ── 4. A section's lead changes → its families hear who it is now ─
-- Only a replacement (an earlier lead existed), and only from a signed-in admin, so seeding,
-- resets and the first assignments before camp don't email anyone.
CREATE OR REPLACE FUNCTION private.notify_new_lead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  fam RECORD;
  lead_name TEXT;
  cls TEXT;
BEGIN
  IF auth.uid() IS NULL OR OLD.lead_id IS NULL OR NEW.lead_id IS NULL OR NEW.lead_id = OLD.lead_id THEN
    RETURN NULL;
  END IF;
  SELECT split_part(display_name, ' ', 1) INTO lead_name FROM profiles WHERE id = NEW.lead_id;
  SELECT name INTO cls FROM classes WHERE id = NEW.class_id;
  FOR fam IN
    SELECT st.parent_id,
           string_agg(coalesce(nullif(st.first_name, ''), split_part(st.full_name, ' ', 1)), ' and ' ORDER BY st.full_name) AS campers
      FROM registrations r JOIN students st ON st.id = r.student_id
     WHERE r.section_id = NEW.id AND r.status IN ('confirmed', 'pending', 'offered')
     GROUP BY st.parent_id
  LOOP
    PERFORM private.enqueue_notification(fam.parent_id, 'new_lead',
      jsonb_build_object('camper', fam.campers, 'lead', lead_name, 'class', cls, 'section', NEW.label, 'week', NEW.week),
      'new_lead:' || NEW.id || ':' || fam.parent_id || ':' || txid_current());
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.notify_new_lead() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_new_lead ON sections;
CREATE TRIGGER notify_new_lead AFTER UPDATE OF lead_id ON sections
    FOR EACH ROW EXECUTE FUNCTION private.notify_new_lead();

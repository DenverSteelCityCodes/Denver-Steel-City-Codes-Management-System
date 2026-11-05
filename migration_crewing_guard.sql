-- Migration: one crewing guard (spec 35 follow-up, #220)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after migration_volunteer_onboarding.sql (step 37 in docs/database.md). After
-- migration_staffing_board.sql (step 43) when that file has been applied, so week_roles gets
-- this trigger too. If week_roles does not exist yet, the trigger is skipped;
-- migration_staffing_board.sql attaches the same function when it creates the table.
-- Then re-apply migration_demo_environment.sql on the demo project.
--
-- One guard, same name as before, so the triggers already on sections and section_supports
-- keep calling it. A volunteer can be a section lead, a section support, or hold a week role
-- only when all of these hold:
--   * not removed this season (volunteers.removed_at is null)
--   * their latest application is accepted, and volunteers.accepted_at is on or after
--     private.season_start() at Denver midnight
--   * an admin has verified the Signed volunteer agreement this season (volunteer_tasks row
--     for key 'agreement', verified_by set, done_at on or after that same instant)
-- Clearing a lead (NULL) and deleting a support are not checked. Each failure has its own
-- message, using the preferred name, else the latest application's first name, else the
-- first word of the display name. private.crew_block_reason() is that check; the trigger
-- raises its text. public.admin_crew_blocks() returns the same text for every volunteer,
-- and only an admin can call it. A signed-in non-admin is refused with 'Admins only'
-- before any of that is read, unless the update leaves the crewing column unchanged.

-- ── 1. The agreement task (an admin verifies it) ──────────────

INSERT INTO onboarding_tasks (key, label, help_url, due_hours_after_accept, sort_order)
VALUES ('agreement', 'Signed volunteer agreement', NULL, 24, 5)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label;

-- ── 2. The one guard ──────────────────────────────────────────
-- NULL means this person can be crewed. Otherwise the sentence an admin should see.
-- Not granted to the API: a signed-in caller reaches it only through the trigger or
-- admin_crew_blocks(), after the admin check.

CREATE OR REPLACE FUNCTION private.crew_block_reason(p_volunteer UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  person      TEXT;
  removed_at  TIMESTAMPTZ;
  accepted_at TIMESTAMPTZ;
  season_at   TIMESTAMPTZ;
  latest      TEXT;
BEGIN
  SELECT coalesce(nullif(btrim(v.preferred_name), ''),
                  (SELECT a.first_name FROM volunteer_applications a
                    WHERE a.user_id = v.id ORDER BY a.created_at DESC, a.id DESC LIMIT 1),
                  nullif(split_part(p.display_name, ' ', 1), ''),
                  'This volunteer'),
         v.removed_at, v.accepted_at
    INTO person, removed_at, accepted_at
  FROM volunteers v
  LEFT JOIN profiles p ON p.id = v.id
  WHERE v.id = p_volunteer;

  IF NOT FOUND THEN
    RETURN 'This volunteer wasn''t accepted this season, so they can''t join a crew';
  END IF;
  IF removed_at IS NOT NULL THEN
    RETURN person || ' was removed from this season, so they can''t join a crew';
  END IF;

  SELECT a.status INTO latest FROM volunteer_applications a
   WHERE a.user_id = p_volunteer ORDER BY a.created_at DESC, a.id DESC LIMIT 1;
  IF latest IS DISTINCT FROM 'accepted' THEN
    RETURN person || '''s latest application isn''t accepted, so they can''t join a crew';
  END IF;

  -- Same instant private.volunteer_task_due() uses: Denver midnight on the season's first day.
  season_at := private.season_start()::timestamp AT TIME ZONE 'America/Denver';
  IF accepted_at IS NULL OR accepted_at < season_at THEN
    RETURN person || ' wasn''t accepted this season, so they can''t join a crew';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM volunteer_tasks t
     WHERE t.volunteer_id = p_volunteer AND t.task_key = 'agreement'
       AND t.verified_by IS NOT NULL AND t.done_at >= season_at
  ) THEN
    RETURN person || '''s volunteer agreement isn''t verified yet, so they can''t join a crew';
  END IF;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.crew_block_reason(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.guard_removed_crew()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  who    UUID;
  reason TEXT;
BEGIN
  -- sections carries the person in lead_id; section_supports and week_roles use volunteer_id.
  IF TG_TABLE_NAME = 'sections' THEN who := NEW.lead_id; ELSE who := NEW.volunteer_id; END IF;

  -- An update that leaves the person in place is not a crewing change. A lead can save the
  -- section's other fields, even when the write repeats the current lead_id. This returns
  -- before any read, so it cannot leak another volunteer's name or vetting.
  -- Nested on purpose: plpgsql resolves every NEW.field in a condition, so one combined AND
  -- would read NEW.volunteer_id on sections (no such column) and fail.
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'sections' THEN
      IF NEW.lead_id IS NOT DISTINCT FROM OLD.lead_id THEN RETURN NEW; END IF;
    ELSIF NEW.volunteer_id IS NOT DISTINCT FROM OLD.volunteer_id THEN
      RETURN NEW;
    END IF;
  END IF;
  -- Clearing a lead is always allowed. A support row and a week role have no null person.
  IF who IS NULL THEN RETURN NEW; END IF;

  -- SECURITY DEFINER runs before RLS, so a signed-in non-admin must be refused before the
  -- function reads who they named. auth.uid() null is the table owner and the SQL tests.
  IF auth.uid() IS NOT NULL AND private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  reason := private.crew_block_reason(who);
  IF reason IS NOT NULL THEN
    RAISE EXCEPTION '%', reason USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_removed_crew() FROM PUBLIC, anon, authenticated;

-- The same sentences the trigger raises, for every volunteer. Admins only.
CREATE OR REPLACE FUNCTION public.admin_crew_blocks()
RETURNS TABLE (volunteer_id UUID, reason TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT v.id, private.crew_block_reason(v.id)
    FROM volunteers v
    ORDER BY v.id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_crew_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crew_blocks() TO authenticated;

-- Existing triggers keep the name. Recreate them so a database that lost one gets it back.
-- UPDATE OF lead_id, and only when the new lead is set: setting the lead to NULL stays allowed.
DROP TRIGGER IF EXISTS guard_removed_crew ON sections;
CREATE TRIGGER guard_removed_crew BEFORE INSERT OR UPDATE OF lead_id ON sections
    FOR EACH ROW WHEN (NEW.lead_id IS NOT NULL) EXECUTE FUNCTION private.guard_removed_crew();

-- INSERT and UPDATE only. DELETE (removing a support) is always allowed.
DROP TRIGGER IF EXISTS guard_removed_crew ON section_supports;
CREATE TRIGGER guard_removed_crew BEFORE INSERT OR UPDATE ON section_supports
    FOR EACH ROW EXECUTE FUNCTION private.guard_removed_crew();

-- week_roles arrives with spec 39. Skip the trigger when this file runs first.
DO $$
BEGIN
  IF to_regclass('public.week_roles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS guard_removed_crew ON week_roles;
    CREATE TRIGGER guard_removed_crew BEFORE INSERT OR UPDATE OF volunteer_id, session_id ON week_roles
        FOR EACH ROW EXECUTE FUNCTION private.guard_removed_crew();
  END IF;
END $$;

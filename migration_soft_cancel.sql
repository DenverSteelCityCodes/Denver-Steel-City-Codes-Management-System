-- Migration: soft-cancel registrations; cancel a section without deleting history (spec 06, #74)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after migration_audit_log.sql (uses private.set_reason()), then RE-APPLY
-- migration_one_class_per_week.sql, whose registrations_before_insert() now refuses sign-ups for a
-- cancelled section (it reads the sections.cancelled_at column added here).
--
-- Before: "Remove registration" was a DELETE, and deleting a section cascaded away its
-- registrations, roll calls and updates. Now:
--   * a registration is cancelled (status 'cancelled' + when/who/why), never deleted from the UI;
--   * a section with any registration can't be deleted (FK RESTRICT); admins cancel it instead
--     with cancel_section(), which cancels its registrations and marks the campers as displaced
--     (they go first on that week's waitlists, spec 10);
--   * reset_demo() deletes registrations before sections, so the nightly reset is unaffected.
--
-- cancel_reason values: admin_removed, parent_cancel, section_cancelled, declined_offer,
-- offer_expired, took_other_seat, merged. Not a CHECK constraint, so later specs can add reasons.

-- ── 1. Registration cancel details ────────────────────────────

ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS cancelled_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_reason          TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- Deliberately NOT a foreign key: a second FK from registrations to sections makes every
    -- `registrations → sections(...)` embed in the app ambiguous (PostgREST answers HTTP 300, and
    -- browsers may cache that). It's only read by the waitlist ordering (spec 10).
    ADD COLUMN IF NOT EXISTS displaced_from_section UUID;

-- An earlier version of this file added that FK; drop it if present.
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_displaced_from_section_fkey;

-- Rows cancelled before this migration get a timestamp so "cancelled" always has one.
UPDATE registrations SET cancelled_at = created_at WHERE status = 'cancelled' AND cancelled_at IS NULL;

-- Stamp who/when/why whenever a registration becomes cancelled; clear it if it's restored.
-- The reason comes from the write itself, else from private.set_reason() in the calling RPC,
-- else 'admin_removed' for an admin.
CREATE OR REPLACE FUNCTION private.registrations_cancel_stamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  ctx TEXT := nullif(current_setting('app.reason', true), '');
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_by := auth.uid();
    NEW.cancel_reason := coalesce(
      NEW.cancel_reason,
      CASE WHEN ctx IN ('admin_removed', 'parent_cancel', 'section_cancelled', 'declined_offer',
                        'offer_expired', 'took_other_seat', 'merged') THEN ctx END,
      CASE WHEN private.auth_user_role() = 'admin' THEN 'admin_removed' END);
  ELSIF NEW.status IS DISTINCT FROM 'cancelled' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL;
    NEW.cancelled_by := NULL;
    NEW.cancel_reason := NULL;
    NEW.displaced_from_section := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.registrations_cancel_stamp() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS registrations_cancel_stamp ON registrations;
CREATE TRIGGER registrations_cancel_stamp BEFORE UPDATE OF status ON registrations
    FOR EACH ROW EXECUTE FUNCTION private.registrations_cancel_stamp();

-- ── 2. Sections with registrations can't be deleted ───────────

ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_section_id_fkey;
ALTER TABLE registrations ADD CONSTRAINT registrations_section_id_fkey
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT;

-- ── 3. Cancelled sections ─────────────────────────────────────

ALTER TABLE sections
    ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Cancel one section: cancels every registration in it (any status), marks those campers as
-- displaced from it, and marks the section cancelled. Returns how many registrations it cancelled.
CREATE OR REPLACE FUNCTION public.cancel_section(p_section_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  n INT;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM sections WHERE id = p_section_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That section no longer exists' USING ERRCODE = 'P0001';
  END IF;
  -- Every registration up front, in id order, before any trigger takes a week's lock (laptop
  -- loans, spec 29): a parent's request holds its registration and then waits for the week, so
  -- locking rows one by one mid-update could deadlock with it.
  PERFORM 1 FROM registrations WHERE section_id = p_section_id AND status <> 'cancelled' ORDER BY id FOR UPDATE;
  PERFORM private.set_reason('section_cancelled');
  UPDATE registrations
     SET status = 'cancelled', cancel_reason = 'section_cancelled', displaced_from_section = p_section_id
   WHERE section_id = p_section_id AND status <> 'cancelled';
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE sections
     SET cancelled_at = coalesce(cancelled_at, now()), cancel_reason = nullif(trim(p_reason), '')
   WHERE id = p_section_id;
  PERFORM private.set_reason(NULL);
  -- Spec 09 enqueues a 'section_cancelled' email per family here.
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_section(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_section(UUID, TEXT) TO authenticated;

-- Cancel every section of a class. Returns the total registrations cancelled.
CREATE OR REPLACE FUNCTION public.cancel_class(p_class_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  sid UUID;
  total INT := 0;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  -- All the class's registrations up front, in id order, before cancelling any section (see
  -- cancel_section: the week locks taken by the laptop-loan trigger mustn't come first).
  PERFORM 1 FROM registrations r JOIN sections s ON s.id = r.section_id
   WHERE s.class_id = p_class_id AND s.cancelled_at IS NULL AND r.status <> 'cancelled'
   ORDER BY r.id FOR UPDATE OF r;
  FOR sid IN SELECT id FROM sections WHERE class_id = p_class_id AND cancelled_at IS NULL ORDER BY id LOOP
    total := total + public.cancel_section(sid, p_reason);
  END LOOP;
  RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_class(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_class(UUID, TEXT) TO authenticated;

-- Migration: duty sign-ups lock close to the day (spec 37, #204)
-- Apply in Supabase Dashboard > SQL Editor (or via the Management API). Safe to re-run.
-- Order: after migration_security_hardening.sql (capacity trigger), migration_audit_log.sql and
-- migration_volunteer_onboarding.sql (private.auth_is_volunteer() with removed volunteers).
--
-- Decided 2026-10-19 (Q-V4):
--   * a volunteer can drop a duty until drop_lock_days (default 3) before it, Denver date: a Friday
--     duty can be dropped until Monday and is locked from Tuesday;
--   * signing up late stays open up to the day itself (it helps cover gaps), and is locked at once;
--   * an admin can lock a slot: volunteers can't join or drop it, whatever the date;
--   * nobody but an admin changes a past slot (hours records, backlog B2);
--   * volunteers can't UPDATE an assignment at all, only claim or drop it.
-- Admins and jobs (no signed-in user: reset_demo, cron) skip the rules.

-- ── 1. Per-year duty settings ─────────────────────────────────

CREATE TABLE IF NOT EXISTS duty_settings (
    year            SMALLINT PRIMARY KEY,
    drop_lock_days  SMALLINT NOT NULL DEFAULT 3 CHECK (drop_lock_days BETWEEN 0 AND 30),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE duty_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_duty_settings" ON duty_settings;
DROP POLICY IF EXISTS "read_duty_settings"      ON duty_settings;
CREATE POLICY "admin_all_duty_settings" ON duty_settings FOR ALL
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
-- Volunteers read it so the Duties tab can explain the lock; nothing in it is sensitive.
CREATE POLICY "read_duty_settings" ON duty_settings FOR SELECT TO authenticated USING (true);
GRANT SELECT ON duty_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON duty_settings TO authenticated;   -- RLS limits writes to admins

DROP TRIGGER IF EXISTS touch_updated_at ON duty_settings;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON duty_settings
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
DROP TRIGGER IF EXISTS audit_log_change ON duty_settings;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON duty_settings
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('year');

-- The year's settings, or the defaults when there's no row. Fields are set by name (not a
-- positional ROW(...)), so adding a column later (spec 38) can't break the defaults.
CREATE OR REPLACE FUNCTION private.duty_settings_for(p_year INT)
RETURNS duty_settings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s duty_settings;
BEGIN
  SELECT * INTO s FROM duty_settings WHERE year = p_year;
  IF NOT FOUND THEN
    s.year := p_year;
    s.drop_lock_days := 3;
    s.updated_at := now();
  END IF;
  RETURN s;
END;
$$;
REVOKE ALL ON FUNCTION private.duty_settings_for(INT) FROM PUBLIC, anon, authenticated;

-- ── 2. Admin lock on a slot ───────────────────────────────────

ALTER TABLE duty_slots ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

-- ── 3. The rules, on every claim and drop ─────────────────────

-- The camp year a slot belongs to: its session's, else its date's.
CREATE OR REPLACE FUNCTION private.duty_slot_year(p_slot duty_slots)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT se.year FROM sessions se WHERE se.id = p_slot.session_id),
                  extract(year FROM p_slot.slot_date)::int);
$$;
REVOKE ALL ON FUNCTION private.duty_slot_year(duty_slots) FROM PUBLIC, anon, authenticated;

-- Why a volunteer may not drop this slot right now, or NULL when they may. Shared with spec 38.
CREATE OR REPLACE FUNCTION private.duty_drop_block(p_slot duty_slots)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'America/Denver')::date;
  lock_days INT := (private.duty_settings_for(private.duty_slot_year(p_slot))).drop_lock_days;
BEGIN
  IF p_slot.slot_date < today THEN
    RETURN 'That duty has already happened, so it can''t be changed';
  ELSIF p_slot.locked THEN
    RETURN 'The camp has locked this duty. Use Tell the camp if you can''t make it.';
  ELSIF p_slot.slot_date - today <= lock_days THEN
    RETURN format('Duties lock %s days before. Use Tell the camp if you can''t make it.', lock_days);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.duty_drop_block(duty_slots) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.duty_assignments_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  slot duty_slots;
  why  TEXT;
BEGIN
  -- Jobs (no user) and admins aren't limited.
  IF auth.uid() IS NULL OR private.auth_user_role() = 'admin' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO slot FROM duty_slots WHERE id = NEW.duty_slot_id;
    IF slot.slot_date < (now() AT TIME ZONE 'America/Denver')::date THEN
      RAISE EXCEPTION 'That duty has already happened' USING ERRCODE = 'P0001';
    ELSIF slot.locked THEN
      RAISE EXCEPTION 'The camp has locked this duty, so it can''t take sign-ups' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE. A slot being deleted with its assignments is an admin action, handled above.
  SELECT * INTO slot FROM duty_slots WHERE id = OLD.duty_slot_id;
  IF FOUND THEN
    why := private.duty_drop_block(slot);
    IF why IS NOT NULL THEN
      RAISE EXCEPTION '%', why USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.duty_assignments_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS duty_assignments_guard ON duty_assignments;
CREATE TRIGGER duty_assignments_guard BEFORE INSERT OR DELETE ON duty_assignments
    FOR EACH ROW EXECUTE FUNCTION private.duty_assignments_guard();

-- ── 4. Volunteers claim and drop; they never edit ─────────────
-- Replaces the FOR ALL policy from migration_duties.sql / migration_security_hardening.sql.

DROP POLICY IF EXISTS "volunteer_manage_own_duties" ON duty_assignments;
DROP POLICY IF EXISTS "volunteer_claim_own_duties"  ON duty_assignments;
DROP POLICY IF EXISTS "volunteer_drop_own_duties"   ON duty_assignments;
CREATE POLICY "volunteer_claim_own_duties" ON duty_assignments FOR INSERT TO authenticated
    WITH CHECK (volunteer_id = auth.uid() AND private.auth_is_volunteer());
CREATE POLICY "volunteer_drop_own_duties" ON duty_assignments FOR DELETE TO authenticated
    USING (volunteer_id = auth.uid() AND private.auth_is_volunteer());

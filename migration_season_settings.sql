-- Migration: season settings — registration opening time, change deadline, offer windows (spec 13, #82)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after migration_audit_log.sql and migration_edit_conflicts.sql, then RE-APPLY
-- migration_one_class_per_week.sql, whose registrations_before_insert() reads
-- registration_opens_at from here.
--
-- Decided 2026-10-16: registration opens at ONE fixed date and time for everyone, first come first
-- served (Q-R1); parents may cancel or switch until 14 days before a session (Q-W1); waitlist
-- offers last 48 hours, or 12 in the final week (Q-W2). One row per camp year; no row (or a null
-- opening time) means "no scheduled opening" — the Forms on/off switch still applies.
-- chapter_id comes with spec 20.

CREATE TABLE IF NOT EXISTS season_settings (
    year                    SMALLINT PRIMARY KEY,
    registration_opens_at   TIMESTAMPTZ,
    change_deadline_days    SMALLINT NOT NULL DEFAULT 14 CHECK (change_deadline_days BETWEEN 0 AND 120),
    offer_hours             SMALLINT NOT NULL DEFAULT 48 CHECK (offer_hours BETWEEN 1 AND 336),
    offer_hours_final_week  SMALLINT NOT NULL DEFAULT 12 CHECK (offer_hours_final_week BETWEEN 1 AND 336),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE season_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_season_settings"  ON season_settings;
DROP POLICY IF EXISTS "read_season_settings"       ON season_settings;
CREATE POLICY "admin_all_season_settings" ON season_settings FOR ALL
    USING (private.auth_user_role() = 'admin') WITH CHECK (private.auth_user_role() = 'admin');
-- Parents need the opening time for the countdown; it isn't sensitive.
CREATE POLICY "read_season_settings" ON season_settings FOR SELECT TO authenticated USING (true);
GRANT SELECT ON season_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON season_settings TO authenticated;   -- RLS limits writes to admins

-- updated_at + audit, like the other edited tables.
DROP TRIGGER IF EXISTS touch_updated_at ON season_settings;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON season_settings
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
DROP TRIGGER IF EXISTS audit_log_change ON season_settings;
CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON season_settings
    FOR EACH ROW EXECUTE FUNCTION audit.log_change('year');

-- Helper for later RPCs (specs 10–12): this camp year's settings, with defaults if there's no row.
CREATE OR REPLACE FUNCTION private.season_settings_for(p_year INT)
RETURNS season_settings LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT s FROM season_settings s WHERE s.year = p_year),
    ROW(p_year, NULL, 14, 48, 12, now())::season_settings);
$$;
REVOKE ALL ON FUNCTION private.season_settings_for(INT) FROM PUBLIC, anon, authenticated;

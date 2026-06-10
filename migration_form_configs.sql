-- Migration: admin form editor (Issue #22)
-- Apply in Supabase Dashboard > SQL Editor

-- ── 1. Form configs ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS form_configs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_key   TEXT NOT NULL UNIQUE,
    config     JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO form_configs (form_key, config) VALUES
    ('volunteer_application', '{"enabled": true, "fields": {}}'),
    ('student_registration',  '{"enabled": true, "fields": {}}')
ON CONFLICT (form_key) DO NOTHING;

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE form_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "admin_all_form_configs" ON form_configs
    FOR ALL USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY IF NOT EXISTS "read_form_configs"      ON form_configs
    FOR SELECT USING (true);

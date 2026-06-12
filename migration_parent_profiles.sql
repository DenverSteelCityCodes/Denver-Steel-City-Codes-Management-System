-- Migration: parent profiles (Issue #27)
-- Stores parent contact info that persists across years.
-- Apply in Supabase Dashboard > SQL Editor

-- ── 1. Parent profiles table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS parent_profiles (
    id                          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    phone                       TEXT,
    emergency_contact_name      TEXT,
    emergency_contact_phone     TEXT,
    emergency_contact_relation  TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent_own_profile"  ON parent_profiles;
DROP POLICY IF EXISTS "admin_all_parent_profiles" ON parent_profiles;

CREATE POLICY "parent_own_profile" ON parent_profiles
    FOR ALL
    USING  (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "admin_all_parent_profiles" ON parent_profiles
    FOR ALL
    USING  (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

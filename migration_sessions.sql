-- Migration: camp sessions as a first-class data model (Issue #19)
-- Apply in Supabase Dashboard > SQL Editor after migration_sections.sql

-- ── 1. Create sessions table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    year       SMALLINT NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Seed the two 2026 sessions ────────────────────────────

INSERT INTO sessions (name, year, start_date, end_date, is_active)
VALUES
    ('Session 1', 2026, '2026-06-01', '2026-06-05', true),
    ('Session 2', 2026, '2026-06-08', '2026-06-12', true)
ON CONFLICT DO NOTHING;

-- ── 3. Add session_id to sections ────────────────────────────

ALTER TABLE sections ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sections_session_id_idx ON sections (session_id);

-- Backfill: week 1 → Session 1, week 2 → Session 2
UPDATE sections SET session_id = (SELECT id FROM sessions WHERE name = 'Session 1' AND year = 2026 LIMIT 1)
WHERE week = 1 AND session_id IS NULL;

UPDATE sections SET session_id = (SELECT id FROM sessions WHERE name = 'Session 2' AND year = 2026 LIMIT 1)
WHERE week = 2 AND session_id IS NULL;

-- ── 4. RLS for sessions ───────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_sessions"      ON sessions;
DROP POLICY IF EXISTS "all_read_active_sessions" ON sessions;

CREATE POLICY "admin_all_sessions" ON sessions FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "all_read_active_sessions" ON sessions FOR SELECT
    USING (true);

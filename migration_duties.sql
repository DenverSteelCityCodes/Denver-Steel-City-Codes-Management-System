-- Migration: volunteer daily duty roles (Issue #20)
-- Apply in Supabase Dashboard > SQL Editor after migration_sessions.sql

-- ── 1. Duty types ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS duty_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO duty_types (name, description) VALUES
    ('Morning Check-In', 'Welcome students and check them in at arrival'),
    ('Lunch Duty', 'Supervise students during the lunch period'),
    ('Afternoon Dismissal', 'Supervise student dismissal at end of day'),
    ('Break Supervision', 'Supervise students during scheduled breaks')
ON CONFLICT (name) DO NOTHING;

-- ── 2. Duty slots ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS duty_slots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duty_type_id  UUID NOT NULL REFERENCES duty_types(id) ON DELETE CASCADE,
    session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
    slot_date     DATE NOT NULL,
    capacity      SMALLINT NOT NULL DEFAULT 2,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS duty_slots_session_id_idx ON duty_slots (session_id);
CREATE INDEX IF NOT EXISTS duty_slots_slot_date_idx ON duty_slots (slot_date);

-- ── 3. Duty assignments ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS duty_assignments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duty_slot_id  UUID NOT NULL REFERENCES duty_slots(id) ON DELETE CASCADE,
    volunteer_id  UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (duty_slot_id, volunteer_id)
);

CREATE INDEX IF NOT EXISTS duty_assignments_volunteer_id_idx ON duty_assignments (volunteer_id);

-- ── 4. RLS ────────────────────────────────────────────────────

ALTER TABLE duty_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "admin_all_duty_types"       ON duty_types        FOR ALL USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY IF NOT EXISTS "read_duty_types"             ON duty_types        FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "admin_all_duty_slots"        ON duty_slots        FOR ALL USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY IF NOT EXISTS "read_duty_slots"             ON duty_slots        FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "admin_all_duty_assignments"  ON duty_assignments  FOR ALL USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY IF NOT EXISTS "read_duty_assignments"       ON duty_assignments  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "volunteer_manage_own_duties" ON duty_assignments
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM volunteers v WHERE v.id = duty_assignments.volunteer_id AND v.id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM volunteers v WHERE v.id = duty_assignments.volunteer_id AND v.id = auth.uid())
    );

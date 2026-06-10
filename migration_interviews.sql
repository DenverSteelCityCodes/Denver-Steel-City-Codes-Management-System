-- Migration: interview scheduling (Issue #17)
-- Apply in Supabase Dashboard > SQL Editor

-- ── 1. Interview slots ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interview_slots (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_datetime    TIMESTAMPTZ NOT NULL,
    duration_minutes SMALLINT NOT NULL DEFAULT 15,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interview_slots_datetime_idx ON interview_slots (slot_datetime);

-- ── 2. Interview bookings ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS interview_bookings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id        UUID NOT NULL REFERENCES interview_slots(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES volunteer_applications(id) ON DELETE CASCADE,
    admin_notes    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (slot_id),
    UNIQUE (application_id)
);

CREATE INDEX IF NOT EXISTS interview_bookings_application_id_idx ON interview_bookings (application_id);

-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE interview_slots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "admin_all_interview_slots"    ON interview_slots
    FOR ALL USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY IF NOT EXISTS "read_interview_slots"          ON interview_slots
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "admin_all_interview_bookings" ON interview_bookings
    FOR ALL USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY IF NOT EXISTS "volunteer_read_own_booking"   ON interview_bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM volunteer_applications va
            WHERE va.id = interview_bookings.application_id
              AND va.user_id = auth.uid()
        )
    );

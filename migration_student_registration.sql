-- Migration: extended student registration fields (Issue #18)
-- Apply in Supabase Dashboard > SQL Editor after migration_sessions.sql

-- ── 1. Extend students table with full signup form fields ─────

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS email               TEXT,
    ADD COLUMN IF NOT EXISTS school_district     TEXT,
    ADD COLUMN IF NOT EXISTS school_name         TEXT,
    ADD COLUMN IF NOT EXISTS grade               TEXT,
    ADD COLUMN IF NOT EXISTS shirt_size          TEXT,
    ADD COLUMN IF NOT EXISTS laptop_available    BOOLEAN,
    ADD COLUMN IF NOT EXISTS ethnic_background   TEXT[],
    ADD COLUMN IF NOT EXISTS gender              TEXT,
    ADD COLUMN IF NOT EXISTS parent_name         TEXT,
    ADD COLUMN IF NOT EXISTS parent_phone        TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_name     TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_phone    TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT,
    ADD COLUMN IF NOT EXISTS allergies           TEXT,
    ADD COLUMN IF NOT EXISTS medical_conditions  TEXT,
    ADD COLUMN IF NOT EXISTS free_reduced_lunch  BOOLEAN,
    ADD COLUMN IF NOT EXISTS lunch_provision     BOOLEAN,
    ADD COLUMN IF NOT EXISTS how_heard           TEXT,
    ADD COLUMN IF NOT EXISTS previous_program    BOOLEAN,
    ADD COLUMN IF NOT EXISTS candy_consent       BOOLEAN,
    ADD COLUMN IF NOT EXISTS waiver_signature    TEXT,
    ADD COLUMN IF NOT EXISTS guardian_signature  TEXT,
    ADD COLUMN IF NOT EXISTS waiver_signed_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS registration_year   SMALLINT DEFAULT 2026;

-- Backfill: migrate existing medical_info to medical_conditions
UPDATE students SET medical_conditions = medical_info WHERE medical_info IS NOT NULL AND medical_conditions IS NULL;

-- ── 2. Add year to registrations ──────────────────────────────

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS year SMALLINT DEFAULT 2026;
UPDATE registrations SET year = 2026 WHERE year IS NULL;

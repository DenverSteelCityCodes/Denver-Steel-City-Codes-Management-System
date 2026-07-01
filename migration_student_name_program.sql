-- Migration: student name split + program fields for official-form parity (Issue #43)
-- Apply in Supabase Dashboard > SQL Editor after migration_student_registration.sql
-- (Already applied to the Denver project rdckxazvoeixgwtjhrlf on 2026-06-30 via MCP.)
--
-- Additive + idempotent. full_name remains the canonical display value, composed from
-- first_name + last_name on registration; existing rows keep their full_name and NULLs here.

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS first_name        TEXT,
    ADD COLUMN IF NOT EXISTS last_name         TEXT,
    ADD COLUMN IF NOT EXISTS other_info        TEXT,
    ADD COLUMN IF NOT EXISTS program_last_year TEXT;

-- Migration: interview slots are admin-only to read (fix #144)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_security_hardening.sql and migration_interview_self_booking.sql.
--
-- Bug: "read_interview_slots" (migration_security_hardening.sql §8) let every signed-in parent and
-- volunteer select all of interview_slots, including the free-text `notes` column, the natural
-- place for an admin to paste a meeting link or passcode. Nobody but admins needs the table:
-- applicants list open times with open_interview_slots(), see their own with my_interview() and
-- book with book_my_interview(), all SECURITY DEFINER and returning only id, time and duration.
-- Fix: drop the blanket read policy; "admin_all_interview_slots" keeps admins' full access.
-- Meeting links get their own admin-only table in spec 35.

DROP POLICY IF EXISTS "read_interview_slots" ON interview_slots;

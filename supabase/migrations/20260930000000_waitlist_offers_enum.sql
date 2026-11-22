-- Migrated from root migration_waitlist_offers_enum.sql by spec 01 (#69).
-- Fresh installs apply this via `supabase db reset` / `supabase db push`.
--
-- Migration (part 1 of 2): the 'offered' registration status (spec 10, #79).
-- Must run BEFORE any migration that references status = 'offered' in SQL
-- (security_hardening, one_class_per_week, review_hardening, …). Own file so
-- ADD VALUE is committed before later migrations use the label.
-- Part 2 (waitlist offer windows) stays at 20261017000011_waitlist_offers.sql.

ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'offered';

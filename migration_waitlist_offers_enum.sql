-- Migration (part 1 of 2): the 'offered' registration status (spec 10, #79).
-- Postgres can't use a new enum value in the transaction that adds it, so this runs on its own,
-- BEFORE migration_waitlist_offers.sql. Safe to re-run.
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'offered';

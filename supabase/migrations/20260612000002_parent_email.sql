-- Migrated from root migration_parent_email.sql by spec 01 (#69).
-- Fresh installs apply this via `supabase db reset` / `supabase db push`.
-- Do not edit the root copy; it is removed after conversion.

-- Migration: store the parent/guardian email collected by the registration form (#52)
-- Apply in Supabase Dashboard > SQL Editor after migration_parent_profiles.sql
-- (applied to rdckxazvoeixgwtjhrlf via MCP on 2026-09-30).
--
-- Parent contact details live on parent_profiles (one row per parent account, reused across
-- years — #54) rather than being copied onto every camper row.

ALTER TABLE parent_profiles ADD COLUMN IF NOT EXISTS email TEXT;

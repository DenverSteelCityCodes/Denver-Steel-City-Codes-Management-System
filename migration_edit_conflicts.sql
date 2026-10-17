-- Migration: updated_at on edited records, so the app can refuse silent overwrites (spec 07, #75)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after migration_audit_log.sql, then RE-APPLY migration_audit_log.sql, whose trigger now
-- ignores updates that only move updated_at.
--
-- The app saves with `.eq('updated_at', <the value it loaded>)`. If someone else saved in between,
-- no row matches, and the app shows a conflict instead of overwriting their change
-- (src/lib/editConflict.ts). updated_at is owned by the database: this trigger sets it on every
-- real change, and ignores a client-supplied value.

ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE classes  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- parent_profiles already has updated_at (it used to be written from the browser clock).

CREATE OR REPLACE FUNCTION private.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Only a real change moves the stamp; a no-op save keeps it, so it can't cause a false conflict.
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.touch_updated_at() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['students', 'sections', 'classes', 'sessions', 'parent_profiles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()', t);
  END LOOP;
END $$;

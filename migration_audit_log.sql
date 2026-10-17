-- Migration: audit log — who changed what, when (spec 05, issue #73)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
--
-- Order: after every other migration_*.sql (it attaches triggers to their tables). Needs
-- private.auth_user_role() from migration_security_hardening.sql.
--
-- Every INSERT/UPDATE/DELETE on the tracked tables writes one row to audit.log: the signed-in user
-- (null for the SQL editor, cron and reset_demo()), their role, the table, the row's key, the old
-- and new row as JSON, and an optional reason. An RPC sets the reason with
-- private.set_reason('parent_cancel') before writing, and it applies to the rest of that
-- transaction. The log copies whole rows, so it holds the same PII as the tables: only admins can
-- read it, through admin_history().
--
-- Adding a table later: attach the trigger the same way (section 4), with its key column(s) as
-- the trigger argument.

-- ── 1. Schema and table (not exposed to the API) ──────────────

CREATE SCHEMA IF NOT EXISTS audit;
REVOKE ALL ON SCHEMA audit FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS audit.log (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id    UUID,
    actor_role  TEXT,
    table_name  TEXT NOT NULL,
    row_id      TEXT,
    action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old         JSONB,
    new         JSONB,
    reason      TEXT
);
CREATE INDEX IF NOT EXISTS log_row_idx   ON audit.log (table_name, row_id, at DESC);
CREATE INDEX IF NOT EXISTS log_actor_idx ON audit.log (actor_id, at DESC);
REVOKE ALL ON audit.log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE audit.log_id_seq FROM PUBLIC, anon, authenticated;

-- ── 2. Reason helper for RPCs ─────────────────────────────────

CREATE OR REPLACE FUNCTION private.set_reason(p_reason TEXT)
RETURNS VOID LANGUAGE sql SET search_path = public AS $$
  SELECT set_config('app.reason', coalesce(p_reason, ''), true);
$$;
REVOKE ALL ON FUNCTION private.set_reason(TEXT) FROM PUBLIC, anon, authenticated;

-- ── 3. Trigger function ───────────────────────────────────────
-- TG_ARGV[0] names the key column(s), comma-separated for composite keys
-- (e.g. 'section_id,volunteer_id'); the row id is their values joined with ':'.

CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, audit AS $$
DECLARE
  o   JSONB;
  n   JSONB;
  rid TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  -- An UPDATE that changed nothing isn't worth a row.
  IF TG_OP = 'UPDATE' AND o = n THEN RETURN NULL; END IF;

  SELECT string_agg(coalesce(n, o) ->> trim(k), ':' ORDER BY ord)
    INTO rid
    FROM unnest(string_to_array(coalesce(TG_ARGV[0], 'id'), ',')) WITH ORDINALITY AS t(k, ord);

  INSERT INTO audit.log (actor_id, actor_role, table_name, row_id, action, old, new, reason)
  VALUES (auth.uid(), private.auth_user_role()::text, TG_TABLE_NAME, rid, TG_OP, o, n,
          nullif(current_setting('app.reason', true), ''));
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION audit.log_change() FROM PUBLIC, anon, authenticated;

-- ── 4. Attach to the tracked tables ───────────────────────────
-- roll_call_marks is left out on purpose: it already records marked_by/marked_at, and it's the
-- highest-volume table during camp week.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT * FROM (VALUES
      ('students', 'id'), ('registrations', 'id'), ('sections', 'id'),
      ('section_supports', 'section_id,volunteer_id'), ('classes', 'id'), ('sessions', 'id'),
      ('volunteers', 'id'), ('volunteer_notes', 'volunteer_id'), ('parent_profiles', 'id'),
      ('profiles', 'id'), ('form_configs', 'id'), ('app_settings', 'key'),
      ('duty_slots', 'id'), ('duty_assignments', 'id'), ('interview_bookings', 'id'),
      ('volunteer_applications', 'id'), ('updates', 'id')
    ) AS v(tbl, keycols)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_log_change ON public.%I', t.tbl);
      EXECUTE format('CREATE TRIGGER audit_log_change AFTER INSERT OR UPDATE OR DELETE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION audit.log_change(%L)', t.tbl, t.keycols);
    END IF;
  END LOOP;
END $$;

-- ── 5. Admin-only read ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_history(p_table TEXT, p_row_id TEXT, p_limit INT DEFAULT 50)
RETURNS TABLE (
    id          BIGINT,
    at          TIMESTAMPTZ,
    actor_id    UUID,
    actor_name  TEXT,
    actor_role  TEXT,
    action      TEXT,
    old         JSONB,
    new         JSONB,
    reason      TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, audit AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT l.id, l.at, l.actor_id, p.display_name, l.actor_role, l.action, l.old, l.new, l.reason
    FROM audit.log l
    LEFT JOIN profiles p ON p.id = l.actor_id
    WHERE l.table_name = p_table AND l.row_id = p_row_id
    ORDER BY l.at DESC, l.id DESC
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_history(TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_history(TEXT, TEXT, INT) TO authenticated;

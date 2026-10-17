-- Migration: admin MFA (spec 27, #101)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_security_hardening.sql (which holds private.auth_user_role(), the
-- function that enforces this) and migration_audit_log.sql.
--
-- Admins can see every child's medical notes and every family's contacts, so an admin must pass
-- a second step (an authenticator-app code, Supabase Auth TOTP) before any admin data is served:
--   * private.auth_user_role() returns no role for an admin whose session is below aal2, so RLS
--     and every admin RPC refuse them (the API enforces it, not just the UI);
--   * the app sends such an admin to /mfa to enroll (first time) or enter a code;
--   * another admin can reset a colleague's second step (lost phone): logged in audit.log.
-- Switch: app_settings 'admin_mfa_required' ('true' unless set to 'false'). The public demo sets
-- it to 'false' (migration_demo_environment.sql) so its one-click admin keeps working.

INSERT INTO app_settings (key, value, updated_at) VALUES ('admin_mfa_required', 'true', now())
ON CONFLICT (key) DO NOTHING;

-- ── 1. Does this user need the second step? (the app's /mfa guard) ─
-- Reads the profile role directly (auth_user_role() hides it until aal2).
CREATE OR REPLACE FUNCTION public.my_mfa_requirement()
RETURNS TABLE (required BOOLEAN, aal TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(p.role = 'admin', false)
           AND coalesce((SELECT s.value FROM app_settings s WHERE s.key = 'admin_mfa_required'), 'true') <> 'false',
         coalesce(auth.jwt() ->> 'aal', 'aal1')
  FROM profiles p WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_mfa_requirement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mfa_requirement() TO authenticated;

-- ── 2. Which admins have a second step set up (Admin → Users) ─
CREATE OR REPLACE FUNCTION public.admin_mfa_status()
RETURNS TABLE (user_id UUID, factors INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, (SELECT count(*)::int FROM auth.mfa_factors f WHERE f.user_id = p.id AND f.status = 'verified')
    FROM profiles p WHERE p.role = 'admin';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mfa_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mfa_status() TO authenticated;

-- ── 3. Reset a colleague's second step (lost phone) ───────────
-- Removes their authenticator factors and signs them out everywhere; at their next sign-in they
-- set up a new one. Not for yourself: someone else has to vouch for you. Logged in audit.log.
CREATE OR REPLACE FUNCTION public.admin_reset_mfa(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  gone JSONB;
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Ask another admin to reset your two-step sign-in' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'friendly_name', friendly_name, 'created_at', created_at)), '[]')
    INTO gone FROM auth.mfa_factors WHERE user_id = p_user_id;
  DELETE FROM auth.mfa_factors WHERE user_id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  INSERT INTO audit.log (actor_id, actor_role, table_name, row_id, action, old, new, reason)
  VALUES (auth.uid(), 'admin', 'mfa_factors', p_user_id::text, 'DELETE', jsonb_build_object('factors', gone), NULL, 'mfa_reset');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reset_mfa(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_mfa(UUID) TO authenticated;

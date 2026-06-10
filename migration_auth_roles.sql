-- Migration: server-side profile creation from signup metadata
-- Fixes: volunteer applicants always becoming parents
-- Apply in Supabase Dashboard > SQL Editor

-- Create the trigger function (SECURITY DEFINER bypasses RLS, runs before email confirmation)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'parent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill: create profiles for any existing auth users that have no profile row
-- (safe to re-run; ON CONFLICT DO NOTHING is idempotent)
INSERT INTO public.profiles (id, display_name, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'User'),
  COALESCE((u.raw_user_meta_data->>'role')::user_role, 'parent')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

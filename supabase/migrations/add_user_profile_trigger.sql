-- Migration: Add trigger to automatically create user profiles
-- Description: When a new user is created in auth.users, automatically create their profile in public.user_profiles

-- Create a function that will be triggered when a new user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_default_permissions JSONB;
BEGIN
  -- Set default permissions for new users
  v_default_permissions := jsonb_build_object(
    'clients', jsonb_build_object('view', true, 'edit', false),
    'interactions', jsonb_build_object('view', true, 'edit', false),
    'metrics', jsonb_build_object('view', true),
    'settings', jsonb_build_object('view', false, 'edit', false),
    'users', jsonb_build_object('view', false, 'edit', false)
  );

  -- Insert the user profile
  INSERT INTO public.user_profiles (
    id,
    full_name,
    email,
    role,
    permissions,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.user_metadata->>'full_name', NEW.email),
    NEW.email,
    'viewer',
    v_default_permissions,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NEW.user_metadata->>'full_name', NEW.email),
    email = NEW.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

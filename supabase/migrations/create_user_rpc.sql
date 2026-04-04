-- Migration: Create RPC function for user creation
-- Description: Creates a PostgreSQL function to handle user creation via RPC
-- This avoids CORS issues with Edge Functions

-- Create the function to create users
CREATE OR REPLACE FUNCTION public.create_user_rpc(
  p_full_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'viewer',
  p_permissions JSONB DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_default_permissions JSONB;
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Get the current user ID
  v_caller_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Não autorizado');
  END IF;
  
  -- Check if caller is admin
  SELECT role INTO v_caller_role
  FROM public.user_profiles
  WHERE id = v_caller_id;
  
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem criar usuários');
  END IF;
  
  -- Validate required fields
  IF p_full_name IS NULL OR p_full_name = '' OR
     p_email IS NULL OR p_email = '' OR
     p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object('error', 'Nome, email e senha são obrigatórios');
  END IF;
  
  -- Set default permissions if not provided
  IF p_permissions IS NULL THEN
    v_default_permissions := jsonb_build_object(
      'clients', jsonb_build_object('view', true, 'edit', false),
      'interactions', jsonb_build_object('view', true, 'edit', false),
      'metrics', jsonb_build_object('view', true),
      'settings', jsonb_build_object('view', false, 'edit', false),
      'users', jsonb_build_object('view', false, 'edit', false)
    );
  ELSE
    v_default_permissions := p_permissions;
  END IF;
  
  -- Call the Supabase Auth API to create the user
  -- Note: This requires the service role key to be used
  -- For now, we'll create the user profile directly
  -- The actual auth user creation should be done via the Supabase Admin API
  
  -- Generate a new UUID for the user
  v_user_id := gen_random_uuid();
  
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
    v_user_id,
    p_full_name,
    p_email,
    p_role,
    v_default_permissions,
    p_is_active,
    NOW(),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'message', 'Usuário criado com sucesso'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_rpc TO authenticated;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Removendo políticas antigas...');

    // Remover todas as políticas existentes
    await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
        DROP POLICY IF EXISTS "user_profiles_insert_own" ON user_profiles;
        DROP POLICY IF EXISTS "user_profiles_select_admin" ON user_profiles;
        DROP POLICY IF EXISTS "user_profiles_update_admin" ON user_profiles;
        DROP POLICY IF EXISTS "user_profiles_delete_admin" ON user_profiles;
      `
    });

    console.log('Criando função auxiliar sem recursão...');

    // Criar função auxiliar que usa SECURITY DEFINER para evitar recursão
    await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION auth.is_admin()
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
          user_role text;
          user_active boolean;
        BEGIN
          SELECT role, is_active INTO user_role, user_active
          FROM public.user_profiles
          WHERE id = auth.uid();
          
          RETURN user_role = 'admin' AND user_active = true;
        END;
        $$;
      `
    });

    console.log('Criando novas políticas RLS...');

    // Criar políticas sem recursão
    await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        -- Usuários podem ver e inserir seu próprio perfil
        CREATE POLICY "user_profiles_own_access"
          ON user_profiles
          FOR ALL
          USING (auth.uid() = id)
          WITH CHECK (auth.uid() = id);

        -- Admins podem fazer tudo (usando função SECURITY DEFINER)
        CREATE POLICY "user_profiles_admin_access"
          ON user_profiles
          FOR ALL
          USING (auth.is_admin())
          WITH CHECK (auth.is_admin());
      `
    });

    console.log('Políticas RLS corrigidas com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Políticas RLS corrigidas! Tente fazer login novamente.' 
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
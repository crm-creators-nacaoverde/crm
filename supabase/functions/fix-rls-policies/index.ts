import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    // Criar cliente Supabase com service_role key para ter permissões administrativas
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Iniciando correção das políticas RLS...');

    // 1. Remover todas as políticas existentes da tabela user_profiles
    const dropPoliciesSQL = `
      DO $$ 
      DECLARE
        policy_record RECORD;
      BEGIN
        FOR policy_record IN 
          SELECT policyname 
          FROM pg_policies 
          WHERE tablename = 'user_profiles'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', policy_record.policyname);
        END LOOP;
      END $$;
    `;

    const { error: dropError } = await supabase.rpc('exec_sql', { 
      sql_query: dropPoliciesSQL 
    });

    if (dropError) {
      console.error('Erro ao remover políticas antigas:', dropError);
      // Continuar mesmo com erro, pois as políticas podem não existir
    }

    // 2. Criar função auxiliar para verificar se é admin (evita recursão)
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      AS $$
        SELECT EXISTS (
          SELECT 1 
          FROM user_profiles 
          WHERE id = user_id 
            AND role = 'admin' 
            AND is_active = true
        );
      $$;
    `;

    const { error: funcError } = await supabase.rpc('exec_sql', { 
      sql_query: createFunctionSQL 
    });

    if (funcError) {
      console.error('Erro ao criar função auxiliar:', funcError);
    }

    // 3. Criar novas políticas sem recursão
    const createPoliciesSQL = `
      -- Política 1: Usuários podem ver seu próprio perfil
      CREATE POLICY "user_profiles_select_own"
        ON user_profiles
        FOR SELECT
        USING (auth.uid() = id);

      -- Política 2: Usuários podem inserir seu próprio perfil durante cadastro
      CREATE POLICY "user_profiles_insert_own"
        ON user_profiles
        FOR INSERT
        WITH CHECK (auth.uid() = id);

      -- Política 3: Administradores podem ver todos os perfis
      CREATE POLICY "user_profiles_select_admin"
        ON user_profiles
        FOR SELECT
        USING (is_admin(auth.uid()));

      -- Política 4: Administradores podem atualizar qualquer perfil
      CREATE POLICY "user_profiles_update_admin"
        ON user_profiles
        FOR UPDATE
        USING (is_admin(auth.uid()));

      -- Política 5: Administradores podem deletar perfis
      CREATE POLICY "user_profiles_delete_admin"
        ON user_profiles
        FOR DELETE
        USING (is_admin(auth.uid()));
    `;

    const { error: policiesError } = await supabase.rpc('exec_sql', { 
      sql_query: createPoliciesSQL 
    });

    if (policiesError) {
      console.error('Erro ao criar novas políticas:', policiesError);
      throw policiesError;
    }

    console.log('Políticas RLS corrigidas com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Políticas RLS corrigidas com sucesso!' 
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao corrigir políticas RLS:', error);
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

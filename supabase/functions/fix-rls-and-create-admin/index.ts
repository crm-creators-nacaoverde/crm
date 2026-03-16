import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Etapa 1: Removendo políticas RLS antigas...');

    // Remover todas as políticas existentes da tabela user_profiles
    const dropPoliciesSQL = `
      DO $$ 
      DECLARE
        pol record;
      BEGIN
        FOR pol IN 
          SELECT policyname 
          FROM pg_policies 
          WHERE tablename = 'user_profiles'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
        END LOOP;
      END $$;
    `;

    const { error: dropError } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: dropPoliciesSQL
    });

    if (dropError) {
      console.error('Erro ao remover políticas:', dropError);
    }

    console.log('Etapa 2: Criando função auxiliar sem recursão...');

    // Criar função auxiliar que usa SECURITY DEFINER para evitar recursão
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      AS $$
        SELECT EXISTS (
          SELECT 1 
          FROM public.user_profiles 
          WHERE id = user_id 
            AND role = 'admin' 
            AND is_active = true
        );
      $$;
    `;

    const { error: funcError } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: createFunctionSQL
    });

    if (funcError) {
      console.error('Erro ao criar função:', funcError);
    }

    console.log('Etapa 3: Criando novas políticas RLS sem recursão...');

    // Criar políticas sem recursão
    const createPoliciesSQL = `
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
        USING (public.is_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()));
    `;

    const { error: policiesError } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: createPoliciesSQL
    });

    if (policiesError) {
      console.error('Erro ao criar políticas:', policiesError);
    }

    console.log('Etapa 4: Verificando e criando perfil do primeiro usuário...');

    // Buscar o usuário pelo email
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Erro ao buscar usuários: ${authError.message}`);
    }

    const targetUser = authUsers.users.find(u => u.email === 'marketing.nacaoverde@gmail.com');
    
    if (!targetUser) {
      throw new Error('Usuário com email marketing.nacaoverde@gmail.com não encontrado');
    }

    // Verificar se o perfil já existe
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', targetUser.id)
      .maybeSingle();

    if (existingProfile) {
      // Atualizar perfil existente para admin
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          role: 'admin',
          is_active: true,
          permissions: {
            clients: { view: true, edit: true },
            interactions: { view: true, edit: true },
            metrics: { view: true },
            settings: { view: true, edit: true },
            users: { view: true, edit: true }
          }
        })
        .eq('id', targetUser.id);

      if (updateError) {
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }

      console.log('Perfil atualizado para administrador!');
    } else {
      // Criar novo perfil como admin
      const { error: insertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: targetUser.id,
          email: targetUser.email,
          full_name: targetUser.user_metadata?.full_name || 'Administrador',
          role: 'admin',
          is_active: true,
          permissions: {
            clients: { view: true, edit: true },
            interactions: { view: true, edit: true },
            metrics: { view: true },
            settings: { view: true, edit: true },
            users: { view: true, edit: true }
          }
        });

      if (insertError) {
        throw new Error(`Erro ao criar perfil: ${insertError.message}`);
      }

      console.log('Perfil criado como administrador!');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sistema corrigido! Você já pode fazer login como administrador.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
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
    const { userId, email, fullName } = await req.json();

    if (!userId || !email || !fullName) {
      return new Response(
        JSON.stringify({ error: 'userId, email e fullName são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service_role key (bypassa RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se já existem usuários
    const { data: existingUsers, error: countError } = await supabaseAdmin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });

    const isFirstUser = !countError && (!existingUsers || existingUsers.length === 0);

    // Inserir perfil do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        role: isFirstUser ? 'admin' : 'viewer',
        is_active: isFirstUser,
        permissions: isFirstUser ? {
          clients: { view: true, edit: true },
          interactions: { view: true, edit: true },
          metrics: { view: true },
          settings: { view: true, edit: true },
          users: { view: true, edit: true }
        } : {
          clients: { view: false, edit: false },
          interactions: { view: false, edit: false },
          metrics: { view: false },
          settings: { view: false, edit: false },
          users: { view: false, edit: false }
        }
      })
      .select()
      .single();

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile,
        isFirstUser 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
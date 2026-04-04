import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Max-Age": "86400",
};

// Helper function to create CORS response
function corsResponse(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  console.log(`[create-user] ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[create-user] Handling OPTIONS request");
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[create-user] Missing authorization header");
      return corsResponse({ error: "Não autorizado - header de autorização ausente" }, 401);
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error("[create-user] Missing environment variables");
      return corsResponse({ error: "Configuração do servidor incompleta" }, 500);
    }

    // Create admin client with service role to verify user's token
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user from the provided token
    const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(authHeader.split(' ')[1]);
    if (authError || !callerUser) {
      console.error("[create-user] Auth error:", authError?.message);
      return corsResponse({ error: "Não autorizado - token inválido" }, 401);
    }

    console.log(`[create-user] User authenticated: ${callerUser.id}`);

    // Check if caller is admin
    const { data: callerProfile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("[create-user] Profile query error:", profileError.message);
      return corsResponse({ error: "Erro ao verificar permissões" }, 500);
    }

    if (!callerProfile || callerProfile.role !== "admin") {
      console.error("[create-user] User is not admin");
      return corsResponse({ error: "Apenas administradores podem criar usuários" }, 403);
    }

    console.log("[create-user] User is admin, proceeding with user creation");

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[create-user] Invalid JSON body:", e.message);
      return corsResponse({ error: "Corpo da requisição inválido" }, 400);
    }

    const { full_name, email, password, role, permissions, is_active } = body;

    // Validate required fields
    if (!full_name || !email || !password) {
      console.error("[create-user] Missing required fields");
      return corsResponse({ error: "Nome, email e senha são obrigatórios" }, 400);
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[create-user] Creating auth user for ${email}`);

    // Create auth user
    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      console.error("[create-user] Auth creation error:", createError.message);
      
      let errorMsg = "Erro ao criar usuário";
      if (createError.message.includes("already been registered") || 
          createError.message.includes("already exists")) {
        errorMsg = "Este email já está cadastrado";
      }
      
      return corsResponse({ error: errorMsg }, 400);
    }

    if (!newAuthUser?.user?.id) {
      console.error("[create-user] No user ID returned from auth creation");
      return corsResponse({ error: "Erro ao criar usuário - ID não retornado" }, 500);
    }

    console.log(`[create-user] Auth user created: ${newAuthUser.user.id}`);

    // Create user profile
    const defaultPermissions = {
      clients: { view: true, edit: false },
      interactions: { view: true, edit: false },
      metrics: { view: true },
      settings: { view: false, edit: false },
      users: { view: false, edit: false },
    };

    const { error: profileError: insertProfileError } = await adminClient
      .from("user_profiles")
      .insert({
        id: newAuthUser.user.id,
        full_name,
        email,
        role: role || "viewer",
        permissions: permissions || defaultPermissions,
        is_active: is_active !== undefined ? is_active : true,
      });

    if (insertProfileError) {
      console.error("[create-user] Profile creation error:", insertProfileError.message);
      
      // Rollback: delete auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      
      return corsResponse({ error: "Erro ao criar perfil do usuário" }, 500);
    }

    console.log(`[create-user] User profile created successfully`);

    return corsResponse({
      success: true,
      user_id: newAuthUser.user.id,
      message: "Usuário criado com sucesso",
    }, 200);

  } catch (error) {
    console.error("[create-user] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return corsResponse({ error: errorMessage }, 500);
  }
});

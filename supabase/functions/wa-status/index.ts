import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);

    // Buscar config
    const { data: config } = await db
      .from("wa_config")
      .select("id, api_url, api_key, instance_name")
      .limit(1)
      .single();

    if (!config?.api_url || !config?.api_key) {
      return new Response(JSON.stringify({
        is_connected: false,
        error: "Evolution API não configurada",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consultar status na Evolution API
    const apiUrl = config.api_url.replace(/\/$/, "");
    const statusRes = await fetch(
      `${apiUrl}/instance/connectionState/${config.instance_name}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.api_key,
        },
      }
    );

    if (!statusRes.ok) {
      const errData = await statusRes.json().catch(() => ({}));
      console.error("[wa-status] Evolution API error:", errData);

      // Marcar como desconectado no banco
      await db.from("wa_config").update({
        is_connected: false,
        updated_at: new Date().toISOString(),
      }).eq("id", config.id);

      return new Response(JSON.stringify({
        is_connected: false,
        error: "Falha ao consultar Evolution API",
        details: errData,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusData = await statusRes.json();
    console.log("[wa-status] response:", JSON.stringify(statusData));

    // Evolution API retorna: { instance: { state: "open" | "close" | "connecting" } }
    const state       = statusData?.instance?.state || statusData?.state || "close";
    const isConnected = state === "open";
    const phoneNumber = statusData?.instance?.profileName || null;

    // Atualizar banco com status real
    await db.from("wa_config").update({
      is_connected: isConnected,
      phone_number: phoneNumber,
      updated_at: new Date().toISOString(),
    }).eq("id", config.id);

    return new Response(JSON.stringify({
      is_connected: isConnected,
      state,
      phone_number: phoneNumber,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[wa-status] error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Autenticar usuário ─────────────────────────────────────────────────
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

    // ── Verificar permissão whatsapp ───────────────────────────────────────
    const { data: profile } = await db
      .from("user_profiles")
      .select("role, permissions, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const hasAccess = profile?.role === "admin" || profile?.role === "manager" ||
      (profile?.permissions?.whatsapp?.view === true);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, message, message_type = "text" } = await req.json();
    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: "conversation_id e message são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Buscar conversa + config ───────────────────────────────────────────
    const [{ data: conv }, { data: config }] = await Promise.all([
      db.from("wa_conversations").select("remote_jid, status").eq("id", conversation_id).single(),
      db.from("wa_config").select("api_url, api_key, instance_name").limit(1).single(),
    ]);

    if (!conv) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config?.api_url || !config?.api_key) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Enviar via Evolution API ───────────────────────────────────────────
    const number = conv.remote_jid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    const evoResponse = await fetch(
      `${config.api_url}/message/sendText/${config.instance_name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.api_key,
        },
        body: JSON.stringify({
          number,
          text: message,
          delay: 1000,
        }),
      }
    );

    const evoData = await evoResponse.json();
    const waMessageId = evoData?.key?.id || evoData?.id || null;

    if (!evoResponse.ok) {
      // Registrar falha mas não travar o fluxo
      await db.from("wa_messages").insert({
        conversation_id,
        direction: "outbound",
        message_type,
        body: message,
        wa_message_id: null,
        sent_by: user.id,
        sent_by_name: profile?.full_name || user.email,
        status: "failed",
      });
      return new Response(JSON.stringify({ error: "Falha ao enviar pelo WhatsApp", details: evoData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Persistir mensagem enviada ─────────────────────────────────────────
    const { data: savedMsg } = await db.from("wa_messages").insert({
      conversation_id,
      direction: "outbound",
      message_type,
      body: message,
      wa_message_id: waMessageId,
      sent_by: user.id,
      sent_by_name: profile?.full_name || user.email,
      status: "sent",
    }).select().single();

    // Atualizar preview da conversa
    await db.from("wa_conversations").update({
      last_message: message,
      last_message_at: new Date().toISOString(),
      status: conv.status === "pending" ? "open" : conv.status,
      updated_at: new Date().toISOString(),
    }).eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true, message: savedMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[wa-send] error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

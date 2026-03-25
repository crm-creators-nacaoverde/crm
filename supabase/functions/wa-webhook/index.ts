import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // ── Buscar config para validar webhook_secret ──────────────────────────
    const { data: config } = await db
      .from("wa_config")
      .select("api_url, api_key, instance_name, webhook_secret")
      .limit(1)
      .single();

    // Validar x-api-key se webhook_secret estiver configurado
    if (config?.webhook_secret) {
      const incomingKey = req.headers.get("x-api-key");
      if (incomingKey !== config.webhook_secret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    console.log("[wa-webhook] evento recebido:", body?.event, body?.instance);

    const event = body?.event;
    const data  = body?.data;

    // ── Evento: MESSAGES_UPSERT (mensagem recebida) ────────────────────────
    if (event === "messages.upsert" && data?.key) {
      const key        = data.key;
      const remoteJid  = key.remoteJid;
      const fromMe     = key.fromMe ?? false;
      const waId       = key.id;
      const messageType = Object.keys(data?.message || {})[0] || "text";
      const body_text  =
        data?.message?.conversation ||
        data?.message?.extendedTextMessage?.text ||
        data?.message?.imageMessage?.caption ||
        null;

      if (!remoteJid || remoteJid.includes("@g.us")) {
        // Ignorar grupos
        return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar ou criar conversa
      let { data: conv } = await db
        .from("wa_conversations")
        .select("id, status, unread_count")
        .eq("remote_jid", remoteJid)
        .maybeSingle();

      if (!conv) {
        // Tentar encontrar cliente pelo telefone
        const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
        const { data: client } = await db
          .from("clients")
          .select("id, name")
          .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
          .maybeSingle();

        const { data: newConv } = await db
          .from("wa_conversations")
          .insert({
            remote_jid: remoteJid,
            client_id:   client?.id   || null,
            client_name: client?.name || phone,
            status: "pending",
            last_message: body_text,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? 0 : 1,
          })
          .select()
          .single();

        conv = newConv;
      } else {
        // Atualizar conversa existente
        await db.from("wa_conversations").update({
          last_message: body_text,
          last_message_at: new Date().toISOString(),
          unread_count: fromMe ? conv.unread_count : (conv.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", conv.id);
      }

      if (!conv?.id) {
        return new Response(JSON.stringify({ error: "Falha ao criar conversa" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Salvar mensagem (evitar duplicatas pelo wa_message_id)
      const { error: msgError } = await db.from("wa_messages").upsert({
        conversation_id: conv.id,
        direction: fromMe ? "outbound" : "inbound",
        message_type: messageType === "conversation" ? "text" : messageType.replace("Message", ""),
        body: body_text,
        wa_message_id: waId,
        status: "delivered",
      }, { onConflict: "wa_message_id", ignoreDuplicates: true });

      if (msgError) {
        console.error("[wa-webhook] erro ao salvar mensagem:", msgError);
      }
    }

    // ── Evento: CONNECTION_UPDATE (status de conexão) ──────────────────────
    if (event === "connection.update") {
      const state = data?.state;
      const isConnected = state === "open";
      const qrCode = data?.qrcode?.base64 || null;

      await db.from("wa_config").update({
        is_connected: isConnected,
        qr_code: qrCode,
        updated_at: new Date().toISOString(),
      }).eq("instance_name", body?.instance || config?.instance_name);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[wa-webhook] error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

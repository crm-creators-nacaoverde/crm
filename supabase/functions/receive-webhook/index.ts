// supabase/functions/receive-webhook/index.ts
// Deploy: npx supabase functions deploy receive-webhook
//
// URL de uso: https://<project>.supabase.co/functions/v1/receive-webhook/<token>
// Método: POST | Content-Type: application/json

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Só aceita POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Extrair token da URL: /receive-webhook/<token>
  const url   = new URL(req.url);
  const parts = url.pathname.split('/');
  const token = parts[parts.length - 1];

  if (!token || token === 'receive-webhook') {
    return new Response(JSON.stringify({ error: 'Token não informado' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Criar cliente Supabase com service_role (bypassa RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Buscar endpoint pelo token
  const { data: endpoint, error: endpointErr } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (endpointErr || !endpoint) {
    return new Response(JSON.stringify({ error: 'Token inválido ou webhook inativo' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Ler payload
  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Payload JSON inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip        = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;

  // ── Mapear campos do payload para campos do CRM ───────────────────────────
  // field_mapping: { "campo_fonte": "campo_crm" }
  // Ex: { "nome": "name", "celular": "phone" }
  const mapping: Record<string, string> = endpoint.field_mapping || {};
  const mapped: Record<string, unknown> = {};

  for (const [sourceKey, crmKey] of Object.entries(mapping)) {
    // Suporte a chaves aninhadas: "lead_data.name"
    const val = sourceKey.split('.').reduce<unknown>((obj, k) => {
      if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k];
      return undefined;
    }, payload);
    if (val !== undefined) mapped[crmKey as string] = val;
  }

  // Campos obrigatórios com fallback
  const name  = (mapped.name  as string) || (payload.name  as string) || 'Lead via Webhook';
  const phone = (mapped.phone as string) || (payload.phone as string) || (payload.telefone as string) || '';
  const email = (mapped.email as string) || (payload.email as string) || '';

  // ── Verificar duplicata ───────────────────────────────────────────────────
  let existingClient: { id: string; name: string } | null = null;

  if (phone || email) {
    const orFilters: string[] = [];
    if (phone) orFilters.push(`phone.eq.${phone}`);
    if (email) orFilters.push(`email.eq.${email}`);

    const { data: dup } = await supabase
      .from('clients')
      .select('id, name')
      .or(orFilters.join(','))
      .limit(1)
      .maybeSingle();

    existingClient = dup || null;
  }

  let logStatus: string   = 'created';
  let clientId: string    = '';
  let clientName: string  = name;
  let dealId: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (existingClient && endpoint.duplicate_mode === 'ignore') {
      // ── Duplicata ignorada ────────────────────────────────────────────────
      logStatus  = 'duplicate';
      clientId   = existingClient.id;
      clientName = existingClient.name;

    } else if (existingClient && endpoint.duplicate_mode === 'update') {
      // ── Atualizar creator existente ───────────────────────────────────────
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (mapped.phone || phone) updatePayload.phone = mapped.phone || phone;
      if (mapped.email || email) updatePayload.email = mapped.email || email;

      await supabase.from('clients').update(updatePayload).eq('id', existingClient.id);

      logStatus  = 'updated';
      clientId   = existingClient.id;
      clientName = existingClient.name;

    } else {
      // ── Criar novo creator ────────────────────────────────────────────────
      const clientPayload: Record<string, unknown> = {
        name,
        email:    email || `${name.toLowerCase().replace(/\s+/g, '.')}@webhook.com`,
        phone:    phone || null,
        status:   'active',
        category: (mapped.category as string) || 'Creators',
        platform: (mapped.platform as string) || 'TikTok',
        chave_pix:      (mapped.chave_pix as string) || null,
        chave_pix_tipo: (mapped.chave_pix_tipo as string) || null,
        cpf_cnpj:       (mapped.cpf_cnpj as string) || null,
        notes:          (mapped.notes as string) || null,
        tiktok_links:   [],
        gmv_geral: 0, revenue: 0, followers: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newClient, error: clientErr } = await supabase
        .from('clients')
        .insert(clientPayload)
        .select('id, name')
        .single();

      if (clientErr) throw new Error(`Erro ao criar creator: ${clientErr.message}`);

      clientId   = newClient.id;
      clientName = newClient.name;

      // ── Criar deal no funil configurado ──────────────────────────────────
      if (endpoint.funnel_id && endpoint.stage_id) {
        const dealPayload = {
          title:          `${name} - Webhook`,
          client_id:      clientId,
          client_name:    clientName,
          funnel_id:      endpoint.funnel_id,
          stage:          endpoint.stage_id,
          assigned_to:    endpoint.assigned_to || null,
          assigned_name:  endpoint.assigned_name || null,
          priority:       'medium',
          tags:           ['webhook'],
          value:          0,
          created_at:     new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        };

        const { data: newDeal } = await supabase
          .from('deals')
          .insert(dealPayload)
          .select('id')
          .single();

        dealId = newDeal?.id || null;
      }

      // ── Registrar no client_history ───────────────────────────────────────
      await supabase.from('client_history').insert({
        client_id:  clientId,
        event_type: 'cadastro',
        title:      'Creator recebido via Webhook',
        description: `Fonte: ${endpoint.source_label || 'Externo'} | Endpoint: ${endpoint.name}`,
        user_name:  'Sistema (Webhook)',
        created_at: new Date().toISOString(),
      });

      logStatus = 'created';
    }
  } catch (err: unknown) {
    logStatus    = 'error';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // ── Salvar log da chamada ─────────────────────────────────────────────────
  await supabase.from('webhook_logs').insert({
    endpoint_id:   endpoint.id,
    status:        logStatus,
    payload,
    client_id:     clientId || null,
    client_name:   clientName || null,
    deal_id:       dealId,
    error_message: errorMessage,
    ip_address:    ip,
    user_agent:    userAgent,
    created_at:    new Date().toISOString(),
  });

  // ── Resposta ──────────────────────────────────────────────────────────────
  const responseBody = {
    ok:          logStatus !== 'error',
    status:      logStatus,
    client_id:   clientId || null,
    client_name: clientName || null,
    deal_id:     dealId,
    ...(errorMessage ? { error: errorMessage } : {}),
  };

  return new Response(JSON.stringify(responseBody), {
    status: logStatus === 'error' ? 500 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// src/hooks/useWebhookEndpoints.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ── URL base da Edge Function ─────────────────────────────────────────────────
// Usa a URL do cliente Supabase já configurado no projeto (mais confiável)
const SUPABASE_URL = (supabase as any).supabaseUrl
  || import.meta.env.VITE_SUPABASE_URL
  || '';

const WEBHOOK_BASE_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/receive-webhook`
  : 'https://avlstqdaqhbgtyeoupck.supabase.co/functions/v1/receive-webhook';

export interface WebhookEndpoint {
  id: string;
  form_id: string | null;
  form_name: string;
  name: string;
  token: string;
  funnel_id: string | null;
  funnel_name: string | null;
  stage_id: string | null;
  stage_label: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  field_mapping: Record<string, string>;
  duplicate_mode: 'ignore' | 'update' | 'allow';
  is_active: boolean;
  source_label: string | null;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  endpoint_id: string;
  status: 'received' | 'created' | 'updated' | 'duplicate' | 'error';
  payload: Record<string, unknown>;
  client_id: string | null;
  client_name: string | null;
  deal_id: string | null;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

export function useWebhookEndpoints(formId?: string) {
  const { profile } = useAuth();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [logs, setLogs]           = useState<WebhookLog[]>([]);
  const [loading, setLoading]     = useState(false);

  const webhookBaseUrl = WEBHOOK_BASE_URL;
  const getWebhookUrl  = (token: string) => `${webhookBaseUrl}/${token}`;

  // ── Buscar endpoints (por form ou todos) ─────────────────────────────────
  const fetchEndpoints = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('webhook_endpoints').select('*').order('created_at', { ascending: false });
    if (formId) query = query.eq('form_id', formId);
    const { data } = await query;
    setEndpoints((data as WebhookEndpoint[]) || []);
    setLoading(false);
  }, [formId]);

  // ── Criar endpoint ───────────────────────────────────────────────────────
  const createEndpoint = useCallback(async (params: {
    form_id?: string;
    form_name?: string;
    name: string;
    funnel_id?: string;
    funnel_name?: string;
    stage_id?: string;
    stage_label?: string;
    assigned_to?: string;
    assigned_name?: string;
    field_mapping: Record<string, string>;
    duplicate_mode: 'ignore' | 'update' | 'allow';
    source_label?: string;
  }): Promise<WebhookEndpoint | null> => {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        ...params,
        created_by: profile?.id || null,
        is_active:  true,
      })
      .select()
      .single();

    if (error) { console.error('[Webhook] Erro ao criar:', error); return null; }
    await fetchEndpoints();
    return data as WebhookEndpoint;
  }, [profile?.id, fetchEndpoints]);

  // ── Atualizar endpoint ────────────────────────────────────────────────────
  const updateEndpoint = useCallback(async (
    id: string,
    params: Partial<Omit<WebhookEndpoint, 'id' | 'token' | 'created_at'>>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('webhook_endpoints')
      .update({ ...params, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { console.error('[Webhook] Erro ao atualizar:', error); return false; }
    await fetchEndpoints();
    return true;
  }, [fetchEndpoints]);

  // ── Deletar endpoint ─────────────────────────────────────────────────────
  const deleteEndpoint = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id);
    if (error) { console.error('[Webhook] Erro ao deletar:', error); return false; }
    await fetchEndpoints();
    return true;
  }, [fetchEndpoints]);

  // ── Alternar ativo/inativo ────────────────────────────────────────────────
  const toggleEndpoint = useCallback(async (id: string, isActive: boolean): Promise<void> => {
    await supabase.from('webhook_endpoints').update({ is_active: isActive }).eq('id', id);
    setEndpoints(prev => prev.map(e => e.id === id ? { ...e, is_active: isActive } : e));
  }, []);

  // ── Buscar logs de um endpoint ────────────────────────────────────────────
  const fetchLogs = useCallback(async (endpointId: string, limit = 50): Promise<void> => {
    const { data } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('endpoint_id', endpointId)
      .order('created_at', { ascending: false })
      .limit(limit);
    setLogs((data as WebhookLog[]) || []);
  }, []);

  // ── Regenerar token (segurança) ───────────────────────────────────────────
  const regenerateToken = useCallback(async (id: string): Promise<string | null> => {
    // Gerar novo token via SQL para usar gen_random_bytes
    const { data } = await supabase.rpc('generate_webhook_token' as any) as any;
    const newToken = data || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const { error } = await supabase
      .from('webhook_endpoints')
      .update({ token: newToken, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return null;
    await fetchEndpoints();
    return newToken;
  }, [fetchEndpoints]);

  return {
    endpoints,
    logs,
    loading,
    webhookBaseUrl,
    getWebhookUrl,
    fetchEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    toggleEndpoint,
    fetchLogs,
    regenerateToken,
  };
}

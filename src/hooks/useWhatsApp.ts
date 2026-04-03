import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface WaConversation {
  id: string;
  remote_jid: string;
  client_id: string | null;
  client_name: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  status: 'open' | 'pending' | 'closed';
  outcome: 'won' | 'lost' | null;
  outcome_reason_id: string | null;
  funnel_id: string | null;
  stage_id: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface WaMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'image' | 'audio' | 'document' | 'video';
  body: string | null;
  media_url: string | null;
  wa_message_id: string | null;
  sent_by: string | null;
  sent_by_name: string | null;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
}

export interface WaConfig {
  id: string;
  instance_name: string;
  api_url: string | null;
  api_key: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  is_connected: boolean;
  qr_code: string | null;
  phone_number: string | null;
}

// ─── Helper: garante https:// na URL ──────────────────────────────────────────
const ensureProtocol = (url: string): string => {
  if (!url) return url;
  url = url.trim().replace(/\/+$/, '');
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
};

// ─── URL do webhook outbound (n8n) ────────────────────────────────────────────
const N8N_OUTBOUND_URL = 'https://n8n.metodoia.com.br/webhook/wa-enviar';

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useWhatsApp() {
  const { profile, user } = useAuth();
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'mine' | 'all' | 'pending'>('all');
  const channelRef = useRef<any>(null);
  const msgChannelRef = useRef<any>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  // ── Carregar conversas ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('wa_conversations')
      .select('*')
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false });

    if (filter === 'mine') query = query.eq('assigned_to', profile?.id);
    if (filter === 'pending') query = query.eq('status', 'pending');
    if (!isAdmin && filter === 'all') query = query.eq('assigned_to', profile?.id);

    const { data } = await query;
    setConversations(data || []);
    setLoading(false);
  }, [filter, profile?.id, isAdmin]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Realtime: conversas ───────────────────────────────────────────────────
  useEffect(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel('wa_conversations_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' },
        () => { loadConversations(); }
      )
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [loadConversations]);

  // ── Carregar mensagens da conversa ativa ──────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);

    // Zerar unread da conversa ao abrir
    await supabase.from('wa_conversations').update({ unread_count: 0 }).eq('id', convId);
  }, []);

  // ── Realtime: mensagens da conversa ativa ─────────────────────────────────
  useEffect(() => {
    msgChannelRef.current?.unsubscribe();
    if (!activeConvId) { setMessages([]); return; }

    loadMessages(activeConvId);

    msgChannelRef.current = supabase
      .channel(`wa_messages_${activeConvId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          setMessages(prev => {
            const exists = prev.some(m => m.id === payload.new.id);
            return exists ? prev : [...prev, payload.new as WaMessage];
          });
        }
      )
      .subscribe();

    return () => { msgChannelRef.current?.unsubscribe(); };
  }, [activeConvId, loadMessages]);

  // ── Selecionar conversa ───────────────────────────────────────────────────
  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  const activeConversation = conversations.find(c => c.id === activeConvId) || null;

  // ── Enviar mensagem (via n8n outbound webhook) ────────────────────────────
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!activeConvId || !text.trim()) return false;

    // Buscar remote_jid: tenta state local primeiro, senão vai direto no banco
    let remoteJid = conversations.find(c => c.id === activeConvId)?.remote_jid;

    if (!remoteJid) {
      const { data } = await supabase
        .from('wa_conversations')
        .select('remote_jid')
        .eq('id', activeConvId)
        .single();
      remoteJid = data?.remote_jid;
    }

    if (!remoteJid) return false;

    setSending(true);
    try {
      const response = await fetch(N8N_OUTBOUND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvId,
          remote_jid: remoteJid,
          body: text.trim(),
          sent_by: user?.id || null,
          sent_by_name: profile?.full_name || '',
        }),
      });
      return response.ok;
    } catch { return false; }
    finally { setSending(false); }
  }, [activeConvId, conversations, user?.id, profile?.full_name]);

  // ── Atribuir conversa ─────────────────────────────────────────────────────
  const assignConversation = useCallback(async (convId: string, userId: string, userName: string) => {
    await supabase.from('wa_conversations').update({
      assigned_to: userId,
      assigned_name: userName,
      status: 'open',
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
  }, []);

  // ── Vincular creator à conversa ───────────────────────────────────────────
  const linkClient = useCallback(async (convId: string, clientId: string, clientName: string) => {
    await supabase.from('wa_conversations').update({
      client_id: clientId,
      client_name: clientName,
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
  }, []);

  // ── Encerrar conversa ─────────────────────────────────────────────────────
  const closeConversation = useCallback(async (
    convId: string,
    outcome: 'won' | 'lost',
    outcomeReasonId: string | null,
    funnelId: string | null,
    stageId: string | null,
  ) => {
    await supabase.from('wa_conversations').update({
      status: 'closed',
      outcome,
      outcome_reason_id: outcomeReasonId,
      funnel_id: funnelId,
      stage_id: stageId,
      updated_at: new Date().toISOString(),
    }).eq('id', convId);

    // Criar deal se tiver funil + creator vinculado
    const conv = conversations.find(c => c.id === convId);
    if (conv?.client_id && funnelId && stageId) {
      await supabase.from('deals').insert({
        title: `${conv.client_name} — WhatsApp`,
        client_id: conv.client_id,
        stage: stageId,
        funnel_id: funnelId,
        priority: 'medium',
        value: 0,
        assigned_to: conv.assigned_to,
        assigned_name: conv.assigned_name,
        description: `Conversa WhatsApp encerrada — ${outcome === 'won' ? 'Ganho' : 'Perdido'}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Registrar interação
      await supabase.from('interactions').insert({
        client_id: conv.client_id,
        type: 'whatsapp',
        title: `Atendimento WhatsApp — ${outcome === 'won' ? 'Ganho' : 'Perdido'}`,
        description: `Conversa encerrada via WhatsApp CRM`,
        date: new Date().toISOString(),
        created_by: profile?.id || null,
      });
    }

    if (activeConvId === convId) setActiveConvId(null);
    await loadConversations();
  }, [conversations, activeConvId, profile?.id, loadConversations]);

  // ── Nova conversa ativa ────────────────────────────────────────────────────
  const startConversation = useCallback(async (
    phone: string,
    clientId: string | null,
    clientName: string,
  ): Promise<string | null> => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null; // Impede criação sem número

    const jid = digits + '@s.whatsapp.net';

    // Verifica se já existe conversa aberta/pendente para esse número
    const { data: existing } = await supabase
      .from('wa_conversations')
      .select('id')
      .eq('remote_jid', jid)
      .in('status', ['open', 'pending'])
      .maybeSingle();

    if (existing) {
      setActiveConvId(existing.id);
      return existing.id;
    }

    const { data } = await supabase.from('wa_conversations').insert({
      remote_jid: jid,
      phone: digits,
      client_id: clientId,
      client_name: clientName,
      assigned_to: profile?.id,
      assigned_name: profile?.full_name,
      status: 'open',
      unread_count: 0,
    }).select().single();
    if (data) { setActiveConvId(data.id); return data.id; }
    return null;
  }, [profile]);

  return {
    conversations,
    messages,
    activeConvId,
    activeConversation,
    loading,
    loadingMessages,
    sending,
    filter,
    totalUnread,
    isAdmin,
    setFilter,
    selectConversation,
    sendMessage,
    assignConversation,
    linkClient,
    closeConversation,
    startConversation,
    loadConversations,
  };
}

// ─── Hook de configuração (admin) ─────────────────────────────────────────────
export function useWaConfig() {
  const [config, setConfig] = useState<WaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from('wa_config').select('*').limit(1).single();
    setConfig(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = async (updates: Partial<WaConfig>) => {
    if (!config?.id) return;
    await supabase.from('wa_config').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', config.id);
    await loadConfig();
  };

  const fetchQrCode = async (): Promise<string | null> => {
    if (!config?.api_url || !config?.api_key || !config?.instance_name) return null;
    try {
      const baseUrl = ensureProtocol(config.api_url);
      const r = await fetch(`${baseUrl}/instance/connect/${config.instance_name}`, {
        headers: { apikey: config.api_key },
      });
      const data = await r.json();
      const qr = data?.base64 || data?.qrcode?.base64 || null;
      if (qr) await saveConfig({ qr_code: qr, is_connected: false });
      return qr;
    } catch { return null; }
  };

  const checkConnection = async (): Promise<boolean> => {
    if (!config?.api_url || !config?.api_key || !config?.instance_name) return false;
    try {
      const baseUrl = ensureProtocol(config.api_url);
      const r = await fetch(`${baseUrl}/instance/connectionState/${config.instance_name}`, {
        headers: { apikey: config.api_key },
      });
      const data = await r.json();
      const connected = data?.instance?.state === 'open';
      await saveConfig({ is_connected: connected, qr_code: connected ? null : config.qr_code });
      return connected;
    } catch { return false; }
  };

  return { config, loading, saveConfig, fetchQrCode, checkConnection, loadConfig };
}

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

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useWhatsApp() {
  const { profile } = useAuth();
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

  // ── Enviar mensagem ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!activeConvId || !text.trim()) return false;
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/wa-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ conversation_id: activeConvId, message: text }),
        }
      );
      return response.ok;
    } catch { return false; }
    finally { setSending(false); }
  }, [activeConvId]);

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
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
    const { data } = await supabase.from('wa_conversations').insert({
      remote_jid: jid,
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
  const configChannelRef = useRef<any>(null);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from('wa_config').select('*').limit(1).single();
    setConfig(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Realtime: atualiza config automaticamente (is_connected, qr_code) ────
  useEffect(() => {
    configChannelRef.current?.unsubscribe();
    configChannelRef.current = supabase
      .channel('wa_config_live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wa_config' },
        (payload) => {
          // Atualiza o config local diretamente sem precisar recarregar
          setConfig(prev => prev ? { ...prev, ...payload.new as WaConfig } : payload.new as WaConfig);
        }
      )
      .subscribe();
    return () => { configChannelRef.current?.unsubscribe(); };
  }, []);

  const saveConfig = async (updates: Partial<WaConfig>) => {
    if (!config?.id) return;
    await supabase.from('wa_config').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', config.id);
    await loadConfig();
  };

  // ── Gerar QR Code — via Edge Function (evita CORS) ───────────────────────
  const fetchQrCode = async (): Promise<string | null> => {
    if (!config?.api_url || !config?.api_key || !config?.instance_name) return null;
    try {
      const r = await fetch(`${config.api_url.replace(/\/$/, '')}/instance/connect/${config.instance_name}`, {
        headers: { apikey: config.api_key },
      });
      const data = await r.json();
      const qr = data?.base64 || data?.qrcode?.base64 || null;
      if (qr) await saveConfig({ qr_code: qr, is_connected: false });
      return qr;
    } catch { return null; }
  };

  // ── Verificar status — chama wa-status Edge Function ─────────────────────
  // Usa a Edge Function para evitar CORS e atualizar o banco corretamente
  const checkConnection = async (): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return false;

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/wa-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          },
        }
      );

      if (!response.ok) return false;

      const result = await response.json();
      const connected = result?.is_connected === true;

      // Atualiza o estado local imediatamente
      setConfig(prev => prev ? {
        ...prev,
        is_connected: connected,
        phone_number: result?.phone_number || prev.phone_number,
      } : prev);

      return connected;
    } catch {
      return false;
    }
  };

  return { config, loading, saveConfig, fetchQrCode, checkConnection, loadConfig };
}

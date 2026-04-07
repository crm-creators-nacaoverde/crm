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
  push_name: string | null;
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

export function useWhatsApp() {
  const { profile, user } = useAuth();
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'mine' | 'all' | 'pending' | 'closed'>('all');
  const channelRef = useRef<any>(null);
  const msgChannelRef = useRef<any>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  // ── Carregar conversas com regras de visibilidade ─────────────────────────
  const loadConversations = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('wa_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (isAdmin) {
      if (filter === 'closed') {
        query = query.eq('status', 'closed');
      } else if (filter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (filter === 'mine') {
        query = query.eq('assigned_to', profile?.id).neq('status', 'closed');
      } else {
        query = query.neq('status', 'closed');
      }
    } else {
      query = query.neq('status', 'closed');
      if (filter === 'pending') {
        query = query.is('assigned_to', null).eq('status', 'pending');
      } else if (filter === 'mine') {
        query = query.eq('assigned_to', profile?.id);
      } else {
        query = query.or(`assigned_to.is.null,assigned_to.eq.${profile?.id}`);
      }
    }

    const { data } = await query;
    setConversations(data || []);
    setLoading(false);
  }, [filter, profile?.id, isAdmin]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Realtime conversas ────────────────────────────────────────────────────
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

  // ── Mensagens ─────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);
    await supabase.from('wa_conversations').update({ unread_count: 0 }).eq('id', convId);
  }, []);

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

  const selectConversation = useCallback((id: string) => setActiveConvId(id), []);
  const activeConversation = conversations.find(c => c.id === activeConvId) || null;

  // ── Verificar se pode responder ───────────────────────────────────────────
  const canReply = useCallback((conv: WaConversation | null): boolean => {
    if (!conv) return false;
    if (isAdmin) return true;
    if (!conv.assigned_to) return true;
    return conv.assigned_to === profile?.id;
  }, [isAdmin, profile?.id]);

  // ── Enviar áudio via N8N ────────────────────────────────────────────────────
  const sendAudio = useCallback(async (audioBlob: Blob, duration: number): Promise<boolean> => {
    if (!activeConvId) return false;
    const conv = conversations.find(c => c.id === activeConvId);
    if (!canReply(conv || null)) return false;

    setSending(true);
    try {
      // Converter Blob para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const n8nUrl = 'https://n8n.metodoia.com.br/webhook/wa-enviar';
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvId,
          remote_jid: conv?.remote_jid,
          message_type: 'audio',
          audio_base64: base64Audio,
          audio_duration: duration,
          sent_by: user?.id || null,
          sent_by_name: profile?.full_name || user?.email || 'Especialista',
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      return false;
    }
    finally { setSending(false); }
  }, [activeConvId, conversations, canReply, user, profile]);

  // ── Enviar mensagem via N8N ───────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!activeConvId || !text.trim()) return false;
    const conv = conversations.find(c => c.id === activeConvId);
    if (!canReply(conv || null)) return false;

    setSending(true);
    try {
      const n8nUrl = 'https://n8n.metodoia.com.br/webhook/wa-enviar';
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvId,
          remote_jid: conv?.remote_jid,
          body: text.trim(),
          sent_by: user?.id || null,
          sent_by_name: profile?.full_name || user?.email || 'Especialista',
        }),
      });
      return response.ok;
    } catch { return false; }
    finally { setSending(false); }
  }, [activeConvId, conversations, canReply, user, profile]);

  // ── Assumir conversa ──────────────────────────────────────────────────────
  const assignConversation = useCallback(async (convId: string, userId: string, userName: string) => {
    await supabase.from('wa_conversations').update({
      assigned_to: userId,
      assigned_name: userName,
      status: 'open',
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
    await loadConversations();
  }, [loadConversations]);

  // ── Transferir conversa ───────────────────────────────────────────────────
  const transferConversation = useCallback(async (
    convId: string,
    userId: string,
    userName: string,
  ) => {
    await supabase.from('wa_conversations').update({
      assigned_to: userId,
      assigned_name: userName,
      status: 'open',
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
    
    if (activeConvId === convId) {
      setActiveConvId(null);
    }
    await loadConversations();
  }, [activeConvId, loadConversations]);

  // ── Vincular creator ──────────────────────────────────────────────────────
  const linkClient = useCallback(async (convId: string, clientId: string, clientName: string) => {
    await supabase.from('wa_conversations').update({
      client_id: clientId,
      client_name: clientName,
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
    await loadConversations();
  }, [loadConversations]);

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
        description: 'Conversa encerrada via WhatsApp CRM',
        date: new Date().toISOString(),
        created_by: profile?.id || null,
      });
    }

    if (activeConvId === convId) setActiveConvId(null);
    await loadConversations();
  }, [conversations, activeConvId, profile?.id, loadConversations]);

  // ── Nova conversa ─────────────────────────────────────────────────────────
  const startConversation = useCallback(async (
    phone: string,
    clientId: string | null,
    clientName: string,
  ): Promise<string | null> => {
    let digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    
    // Garantir prefixo 55 para números brasileiros
    if (digits.length > 0 && !digits.startsWith('55')) {
      digits = '55' + digits;
    }
    
    const jid = digits + '@s.whatsapp.net';

    const { data: existing } = await supabase
      .from('wa_conversations')
      .select('id, status')
      .eq('remote_jid', jid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Se a conversa já existe mas está fechada, reabre ela
      if (existing.status === 'closed') {
        await supabase.from('wa_conversations').update({
          status: 'open',
          assigned_to: profile?.id,
          assigned_name: profile?.full_name,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        await loadConversations();
      }
      
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
    sendAudio,
    assignConversation,
    transferConversation,
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

  const fetchQrCode = useCallback(async (): Promise<string | null> => {
    if (!config?.api_url || !config?.api_key || !config?.instance_name) return null;
    try {
      const response = await fetch(`${config.api_url}/instance/fetch-qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.api_key,
        },
        body: JSON.stringify({ instanceName: config.instance_name }),
      });
      const data = await response.json();
      if (response.ok && data.qrcode) {
        await saveConfig({ qr_code: data.qrcode, is_connected: false });
        return data.qrcode;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
      return null;
    }
  }, [config, saveConfig]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!config?.api_url || !config?.api_key || !config?.instance_name) return false;
    try {
      const response = await fetch(`${config.api_url}/instance/connection-state`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.api_key,
        },
      });
      const data = await response.json();
      const isConnected = response.ok && data.state === 'connected';
      await saveConfig({ is_connected: isConnected, qr_code: isConnected ? null : config.qr_code });
      return isConnected;
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      await saveConfig({ is_connected: false });
      return false;
    }
  }, [config, saveConfig]);

  return { config, loading, saveConfig, loadConfig, fetchQrCode, checkConnection };
}

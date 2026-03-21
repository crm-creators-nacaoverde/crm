import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCompanySettings } from '../contexts/CompanySettingsContext';

export interface SampleAlert {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  type: 'pending' | 'transit_long' | 'no_address';
  daysElapsed: number;
  dealTitle?: string;
  createdAt: string;
  read: boolean;
}

const STORAGE_KEY = 'crm_sample_alerts_read';
const NOTIFIED_KEY = 'crm_sample_alerts_notified';

function getReadAlerts(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function getNotifiedAlerts(): string[] {
  try {
    const stored = localStorage.getItem(NOTIFIED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotifiedAlerts(ids: string[]) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(ids));
}

function markAlertRead(alertId: string) {
  const read = getReadAlerts();
  if (!read.includes(alertId)) {
    read.push(alertId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(read));
  }
}

function markAllRead(alertIds: string[]) {
  const read = getReadAlerts();
  const merged = [...new Set([...read, ...alertIds])];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

const alertLabels: Record<string, string> = {
  pending:      'Amostra pendente',
  transit_long: 'Em trânsito há muito tempo',
  no_address:   'Sem endereço cadastrado',
};

function sendPushNotification(newAlerts: SampleAlert[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const settings = localStorage.getItem('crm_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.notifications === false) return;
    }
  } catch { /* continua */ }

  if (newAlerts.length === 1) {
    const alert = newAlerts[0];
    const notif = new Notification(`📦 ${alertLabels[alert.type]}`, {
      body: `${alert.clientName} — ${alert.daysElapsed} dias${alert.dealTitle ? ` • ${alert.dealTitle}` : ''}`,
      icon: '/favicon.ico',
      tag: `sample_alert_${alert.id}`,
    });
    notif.onclick = () => { window.focus(); notif.close(); };
  } else if (newAlerts.length > 1) {
    const pendingCount = newAlerts.filter(a => a.type === 'pending').length;
    const transitCount = newAlerts.filter(a => a.type === 'transit_long').length;
    const noAddrCount  = newAlerts.filter(a => a.type === 'no_address').length;

    const parts: string[] = [];
    if (pendingCount > 0) parts.push(`${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`);
    if (transitCount > 0) parts.push(`${transitCount} em trânsito`);
    if (noAddrCount  > 0) parts.push(`${noAddrCount} sem endereço`);

    const notif = new Notification(`📦 ${newAlerts.length} novos alertas de amostra`, {
      body: parts.join(' • '),
      icon: '/favicon.ico',
      tag: 'sample_alerts_batch',
    });
    notif.onclick = () => { window.focus(); notif.close(); };
  }
}

export function useSampleAlerts() {
  const [alerts, setAlerts]   = useState<SampleAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const previousAlertIdsRef   = useRef<Set<string>>(new Set());
  const isFirstCheckRef       = useRef(true);

  const { profile }                      = useAuth();
  const { settings: companySettings }    = useCompanySettings();

  const getThresholdDays = useCallback(() => {
    try {
      const ls = localStorage.getItem('crm_settings');
      if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed.sampleAlertDays) return parsed.sampleAlertDays;
      }
    } catch { /* ignore */ }
    return companySettings.sample_alert_days ?? 3;
  }, [companySettings.sample_alert_days]);

  const checkAlerts = useCallback(async () => {
    // Aguarda perfil carregar
    if (!profile) return;

    const isAdmin = profile.role === 'admin';

    try {
      const thresholdDays = getThresholdDays();
      const now = new Date();

      // ── Buscar deals do usuário ────────────────────────────────────────────
      // Admin vê todos; outros veem apenas os atribuídos a si
      let dealsQuery = supabase
        .from('deals')
        .select('id, title, client_id, assigned_to');

      if (!isAdmin) {
        dealsQuery = dealsQuery.eq('assigned_to', profile.id);
      }

      const { data: deals } = await dealsQuery;

      // IDs de clients que pertencem ao usuário (via deals)
      const myClientIds = new Set((deals || []).map(d => d.client_id).filter(Boolean));

      // ── Buscar clients ativos ──────────────────────────────────────────────
      let clientsQuery = supabase
        .from('clients')
        .select('id, name, phone, amostra_enviada, amostra_data_envio, codigo_rastreio, endereco_cep, created_at, status, created_by')
        .eq('status', 'active');

      // Se não for admin, filtra pelos clients dos seus deals
      // Também inclui clients criados pelo próprio usuário (sem deal vinculado)
      if (!isAdmin) {
        const idsArray = Array.from(myClientIds);

        // Adiciona clients criados pelo próprio usuário
        const { data: createdByMe } = await supabase
          .from('clients')
          .select('id')
          .eq('created_by', profile.id)
          .eq('status', 'active');

        const createdIds = (createdByMe || []).map(c => c.id);
        const allMyIds   = [...new Set([...idsArray, ...createdIds])];

        if (allMyIds.length === 0) {
          // Usuário não tem clients — limpar alertas
          setAlerts([]);
          setLoading(false);
          return;
        }

        clientsQuery = clientsQuery.in('id', allMyIds);
      }

      const { data: clients, error } = await clientsQuery;
      if (error) throw error;
      if (!clients) return;

      const readAlerts  = getReadAlerts();
      const newAlerts: SampleAlert[] = [];

      for (const client of clients) {
        const clientDeal = deals?.find(d => d.client_id === client.id);

        // ── Amostra não enviada e sem código de rastreio ───────────────────
        if (!client.amostra_enviada && !client.codigo_rastreio) {
          const referenceDate = new Date(client.created_at);
          const diffDays = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays >= thresholdDays) {
            const alertId = `pending_${client.id}`;
            newAlerts.push({
              id: alertId, clientId: client.id, clientName: client.name,
              clientPhone: client.phone || '', type: 'pending',
              daysElapsed: diffDays, dealTitle: clientDeal?.title,
              createdAt: client.created_at, read: readAlerts.includes(alertId),
            });
          }
        }

        // ── Em trânsito há muito tempo ─────────────────────────────────────
        if (
          companySettings.sample_alert_transit &&
          !client.amostra_enviada && client.codigo_rastreio && client.amostra_data_envio
        ) {
          const sendDate = new Date(client.amostra_data_envio);
          const diffDays = Math.floor((now.getTime() - sendDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays >= thresholdDays) {
            const alertId = `transit_${client.id}`;
            newAlerts.push({
              id: alertId, clientId: client.id, clientName: client.name,
              clientPhone: client.phone || '', type: 'transit_long',
              daysElapsed: diffDays, dealTitle: clientDeal?.title,
              createdAt: client.amostra_data_envio, read: readAlerts.includes(alertId),
            });
          }
        }

        // ── Sem endereço cadastrado ────────────────────────────────────────
        if (
          companySettings.sample_alert_no_address &&
          !client.amostra_enviada && !client.endereco_cep
        ) {
          const referenceDate = new Date(client.created_at);
          const diffDays = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays >= thresholdDays) {
            const alertId = `noaddr_${client.id}`;
            newAlerts.push({
              id: alertId, clientId: client.id, clientName: client.name,
              clientPhone: client.phone || '', type: 'no_address',
              daysElapsed: diffDays, dealTitle: clientDeal?.title,
              createdAt: client.created_at, read: readAlerts.includes(alertId),
            });
          }
        }
      }

      // Ordenar por urgência (mais dias primeiro)
      newAlerts.sort((a, b) => b.daysElapsed - a.daysElapsed);

      // ── Push notification para alertas novos ───────────────────────────────
      const notifiedIds    = getNotifiedAlerts();
      const currentIds     = new Set(newAlerts.map(a => a.id));
      const brandNewAlerts = newAlerts.filter(
        a => !a.read && !notifiedIds.includes(a.id) && !previousAlertIdsRef.current.has(a.id)
      );

      if (!isFirstCheckRef.current && brandNewAlerts.length > 0) {
        sendPushNotification(brandNewAlerts);
      }

      const allNotified     = [...new Set([...notifiedIds, ...brandNewAlerts.map(a => a.id)])];
      const cleanedNotified = allNotified.filter(id => currentIds.has(id));
      saveNotifiedAlerts(cleanedNotified);

      previousAlertIdsRef.current = currentIds;
      isFirstCheckRef.current     = false;

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Erro ao verificar alertas de amostra:', error);
    } finally {
      setLoading(false);
    }
  }, [profile, getThresholdDays, companySettings]);

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAlerts]);

  const markAsRead = useCallback((alertId: string) => {
    markAlertRead(alertId);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
  }, []);

  const markAllAsRead = useCallback(() => {
    const ids = alerts.map(a => a.id);
    markAllRead(ids);
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }, [alerts]);

  const unreadCount = alerts.filter(a => !a.read).length;

  return { alerts, loading, unreadCount, markAsRead, markAllAsRead, refresh: checkAlerts };
}

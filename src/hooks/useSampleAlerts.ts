import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
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
  pending: 'Amostra pendente',
  transit_long: 'Em trânsito há muito tempo',
  no_address: 'Sem endereço cadastrado',
};

function sendPushNotification(newAlerts: SampleAlert[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const settings = localStorage.getItem('crm_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.notifications === false) return;
    }
  } catch {
    // continua
  }

  if (newAlerts.length === 1) {
    const alert = newAlerts[0];
    const notif = new Notification(`📦 ${alertLabels[alert.type]}`, {
      body: `${alert.clientName} — ${alert.daysElapsed} dias${alert.dealTitle ? ` • ${alert.dealTitle}` : ''}`,
      icon: '/favicon.ico',
      tag: `sample_alert_${alert.id}`,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } else if (newAlerts.length > 1) {
    const pendingCount = newAlerts.filter(a => a.type === 'pending').length;
    const transitCount = newAlerts.filter(a => a.type === 'transit_long').length;
    const noAddrCount = newAlerts.filter(a => a.type === 'no_address').length;

    const parts: string[] = [];
    if (pendingCount > 0) parts.push(`${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`);
    if (transitCount > 0) parts.push(`${transitCount} em trânsito`);
    if (noAddrCount > 0) parts.push(`${noAddrCount} sem endereço`);

    const notif = new Notification(`📦 ${newAlerts.length} novos alertas de amostra`, {
      body: parts.join(' • '),
      icon: '/favicon.ico',
      tag: 'sample_alerts_batch',
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  }
}

export function useSampleAlerts() {
  const [alerts, setAlerts] = useState<SampleAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const previousAlertIdsRef = useRef<Set<string>>(new Set());
  const isFirstCheckRef = useRef(true);

  // Ler configurações da empresa (Supabase — com cache)
  const { settings: companySettings } = useCompanySettings();

  const getThresholdDays = useCallback(() => {
    // Prioridade: preferência do usuário (localStorage) → config global (Supabase)
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
    try {
      const thresholdDays = getThresholdDays();
      const now = new Date();

      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, phone, amostra_enviada, amostra_data_envio, codigo_rastreio, endereco_cep, created_at, status')
        .eq('status', 'active');

      if (error) throw error;
      if (!clients) return;

      const { data: deals } = await supabase
        .from('deals')
        .select('id, title, client_id');

      const readAlerts = getReadAlerts();
      const newAlerts: SampleAlert[] = [];

      for (const client of clients) {
        const clientDeal = deals?.find(d => d.client_id === client.id);

        // Amostra não enviada e sem código de rastreio
        if (!client.amostra_enviada && !client.codigo_rastreio) {
          const referenceDate = new Date(client.created_at);
          const diffMs = now.getTime() - referenceDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays >= thresholdDays) {
            const alertId = `pending_${client.id}`;
            newAlerts.push({
              id: alertId,
              clientId: client.id,
              clientName: client.name,
              clientPhone: client.phone || '',
              type: 'pending',
              daysElapsed: diffDays,
              dealTitle: clientDeal?.title,
              createdAt: client.created_at,
              read: readAlerts.includes(alertId),
            });
          }
        }

        // Em trânsito há muito tempo (código de rastreio mas não confirmada)
        if (companySettings.sample_alert_transit && !client.amostra_enviada && client.codigo_rastreio && client.amostra_data_envio) {
          const sendDate = new Date(client.amostra_data_envio);
          const diffMs = now.getTime() - sendDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays >= thresholdDays) {
            const alertId = `transit_${client.id}`;
            newAlerts.push({
              id: alertId,
              clientId: client.id,
              clientName: client.name,
              clientPhone: client.phone || '',
              type: 'transit_long',
              daysElapsed: diffDays,
              dealTitle: clientDeal?.title,
              createdAt: client.amostra_data_envio,
              read: readAlerts.includes(alertId),
            });
          }
        }

        // Sem endereço cadastrado (não pode enviar amostra)
        if (companySettings.sample_alert_no_address && !client.amostra_enviada && !client.endereco_cep) {
          const alertId = `noaddr_${client.id}`;
          const referenceDate = new Date(client.created_at);
          const diffMs = now.getTime() - referenceDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays >= thresholdDays) {
            newAlerts.push({
              id: alertId,
              clientId: client.id,
              clientName: client.name,
              clientPhone: client.phone || '',
              type: 'no_address',
              daysElapsed: diffDays,
              dealTitle: clientDeal?.title,
              createdAt: client.created_at,
              read: readAlerts.includes(alertId),
            });
          }
        }
      }

      // Ordenar por dias (mais urgente primeiro)
      newAlerts.sort((a, b) => b.daysElapsed - a.daysElapsed);

      // Detectar alertas novos e enviar push
      const notifiedIds = getNotifiedAlerts();
      const currentIds = new Set(newAlerts.map(a => a.id));
      const brandNewAlerts = newAlerts.filter(
        a => !a.read && !notifiedIds.includes(a.id) && !previousAlertIdsRef.current.has(a.id)
      );

      if (!isFirstCheckRef.current && brandNewAlerts.length > 0) {
        sendPushNotification(brandNewAlerts);
      }

      // Salvar IDs notificados
      const allNotified = [...new Set([...notifiedIds, ...brandNewAlerts.map(a => a.id)])];
      // Limpar IDs que não existem mais
      const cleanedNotified = allNotified.filter(id => currentIds.has(id));
      saveNotifiedAlerts(cleanedNotified);

      previousAlertIdsRef.current = currentIds;
      isFirstCheckRef.current = false;

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Erro ao verificar alertas de amostra:', error);
    } finally {
      setLoading(false);
    }
  }, [getThresholdDays]);

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000); // Verifica a cada 5 min
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

  return {
    alerts,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: checkAlerts,
  };
}

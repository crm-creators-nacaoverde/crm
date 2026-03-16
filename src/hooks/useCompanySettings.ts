import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface CompanySettingsData {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  website: string;
  logo_url: string;
  logo_base64: string;
  primary_color: string;
  sample_alert_days: number;
  sample_alert_transit: boolean;
  sample_alert_no_address: boolean;
}

const DEFAULTS: CompanySettingsData = {
  id: '',
  name: 'CRM Creators',
  email: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  website: '',
  logo_url: '',
  logo_base64: '',
  primary_color: '#004aad',
  sample_alert_days: 3,
  sample_alert_transit: true,
  sample_alert_no_address: true,
};

// Cache em memória para evitar múltiplas leituras simultâneas
let cachedSettings: CompanySettingsData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minuto

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettingsData>(
    cachedSettings ?? DEFAULTS
  );
  const [loading, setLoading] = useState(!cachedSettings);
  const mountedRef = useRef(true);

  const load = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedSettings && now - cacheTimestamp < CACHE_TTL) {
      setSettings(cachedSettings);
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data && mountedRef.current) {
        const merged: CompanySettingsData = { ...DEFAULTS, ...data };
        cachedSettings = merged;
        cacheTimestamp = Date.now();
        setSettings(merged);

        // Aplicar cor primária como CSS var global
        applyPrimaryColor(merged.primary_color);
      }
    } catch (err) {
      console.error('[useCompanySettings] Erro ao carregar:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();

    // Escutar atualizações em tempo real via Supabase Realtime
    const channel = supabase
      .channel('company_settings_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'company_settings' },
        (payload) => {
          if (payload.new && mountedRef.current) {
            const merged: CompanySettingsData = { ...DEFAULTS, ...payload.new };
            cachedSettings = merged;
            cacheTimestamp = Date.now();
            setSettings(merged);
            applyPrimaryColor(merged.primary_color);
          }
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Forçar reload (chamado após salvar na página de config)
  const invalidate = useCallback(() => {
    cachedSettings = null;
    cacheTimestamp = 0;
    load(true);
  }, [load]);

  return { settings, loading, invalidate };
}

// Aplica a cor primária como variável CSS no :root
export function applyPrimaryColor(color: string) {
  if (!color || typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--color-primary', color);

  // Calcular variante mais escura para hover
  const darker = shadeColor(color, -15);
  document.documentElement.style.setProperty('--color-primary-dark', darker);

  // Calcular variante com opacidade para backgrounds
  document.documentElement.style.setProperty('--color-primary-10', `${color}1a`);
  document.documentElement.style.setProperty('--color-primary-20', `${color}33`);
}

function shadeColor(hex: string, percent: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent * 2.55));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent * 2.55));
    const b = Math.min(255, Math.max(0, (num & 0xff) + percent * 2.55));
    return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
  } catch {
    return hex;
  }
}

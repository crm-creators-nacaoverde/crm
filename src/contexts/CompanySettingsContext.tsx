import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

interface CompanySettingsContextType {
  settings: CompanySettingsData;
  loading: boolean;
  invalidate: () => void;
}

const CompanySettingsContext = createContext<CompanySettingsContextType>({
  settings: DEFAULTS,
  loading: true,
  invalidate: () => {},
});

// ── Aplicar cor primária como CSS vars no :root ──────────────────────────
export function applyPrimaryColor(hex: string) {
  if (!hex || typeof document === 'undefined') return;

  const r = document.documentElement;
  r.style.setProperty('--color-primary', hex);
  r.style.setProperty('--color-primary-dark', shadeColor(hex, -15));
  r.style.setProperty('--color-primary-light', shadeColor(hex, 20));

  // Substituir dinamicamente a cor nos elementos que usam Tailwind hardcoded
  // via uma <style> injetada no <head>
  const styleId = 'crm-primary-override';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const dark = shadeColor(hex, -15);
  const alpha10 = hexToRgba(hex, 0.1);
  const alpha20 = hexToRgba(hex, 0.2);
  const alpha05 = hexToRgba(hex, 0.05);

  styleEl.textContent = `
    /* CRM Primary Color Override — gerado automaticamente */

    /* Backgrounds sólidos */
    .bg-\\[\\#004aad\\] { background-color: ${hex} !important; }
    .hover\\:bg-\\[\\#004aad\\]:hover { background-color: ${hex} !important; }
    .bg-\\[\\#003d91\\] { background-color: ${dark} !important; }
    .hover\\:bg-\\[\\#003d91\\]:hover { background-color: ${dark} !important; }

    /* Backgrounds com opacidade */
    .bg-\\[\\#004aad\\]\\/5  { background-color: ${alpha05} !important; }
    .bg-\\[\\#004aad\\]\\/10 { background-color: ${alpha10} !important; }
    .bg-\\[\\#004aad\\]\\/20 { background-color: ${alpha20} !important; }
    .hover\\:bg-\\[\\#004aad\\]\\/5:hover  { background-color: ${alpha05} !important; }
    .hover\\:bg-\\[\\#004aad\\]\\/10:hover { background-color: ${alpha10} !important; }
    .hover\\:bg-\\[\\#004aad\\]\\/20:hover { background-color: ${alpha20} !important; }

    /* Textos */
    .text-\\[\\#004aad\\] { color: ${hex} !important; }
    .hover\\:text-\\[\\#004aad\\]:hover { color: ${hex} !important; }

    /* Bordas */
    .border-\\[\\#004aad\\] { border-color: ${hex} !important; }
    .focus\\:border-\\[\\#004aad\\]:focus { border-color: ${hex} !important; }

    /* Ring / outline */
    .ring-\\[\\#004aad\\] { --tw-ring-color: ${hex} !important; }
    .focus\\:ring-\\[\\#004aad\\]:focus { --tw-ring-color: ${hex} !important; }

    /* 5de0e6 — cor de acento (manter, mas substituir onde necessário) */
    .focus\\:border-\\[\\#5de0e6\\]:focus { border-color: ${alpha20} !important; }
    .focus\\:ring-\\[\\#5de0e6\\]\\/30:focus { --tw-ring-color: ${alpha20} !important; }
    .bg-\\[\\#5de0e6\\]\\/10 { background-color: ${alpha10} !important; }
    .bg-\\[\\#5de0e6\\]\\/20 { background-color: ${alpha20} !important; }
    .hover\\:bg-\\[\\#5de0e6\\]\\/20:hover { background-color: ${alpha20} !important; }
    .text-\\[\\#5de0e6\\] { color: ${hex} !important; }
  `;
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

function hexToRgba(hex: string, alpha: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return hex;
  }
}

// ── Provider ─────────────────────────────────────────────────────────────
export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanySettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data && mountedRef.current) {
        const merged: CompanySettingsData = { ...DEFAULTS, ...data };
        setSettings(merged);
        applyPrimaryColor(merged.primary_color);
      }
    } catch (err) {
      console.error('[CompanySettings] Erro:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();

    // Realtime — opcional, não crasha se falhar
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('crm_company_settings')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'company_settings' },
          (payload) => {
            try {
              if (payload.new && mountedRef.current) {
                const merged: CompanySettingsData = { ...DEFAULTS, ...payload.new };
                setSettings(merged);
                applyPrimaryColor(merged.primary_color);
              }
            } catch (e) {
              console.warn('[CompanySettings] Realtime payload error:', e);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[CompanySettings] Realtime subscribe error — usando polling');
          }
        });
    } catch (e) {
      console.warn('[CompanySettings] Realtime not available:', e);
    }

    return () => {
      mountedRef.current = false;
      if (channel) {
        try { supabase.removeChannel(channel); } catch (_) {}
      }
    };
  }, [load]);

  const invalidate = useCallback(() => {
    load();
  }, [load]);

  return (
    <CompanySettingsContext.Provider value={{ settings, loading, invalidate }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

// ── Hook para consumir o contexto ─────────────────────────────────────────
export function useCompanySettings() {
  return useContext(CompanySettingsContext);
}

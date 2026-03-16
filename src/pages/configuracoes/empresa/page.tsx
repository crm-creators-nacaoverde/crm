import { useState, useEffect, useRef } from 'react';
import AppLayout from '../../../components/feature/AppLayout';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import { useCompanySettings, applyPrimaryColor } from '../../../contexts/CompanySettingsContext';

interface CompanySettings {
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

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const COLOR_PRESETS = [
  { value: '#004aad', label: 'Azul CRM' },
  { value: '#7c3aed', label: 'Roxo' },
  { value: '#059669', label: 'Verde' },
  { value: '#dc2626', label: 'Vermelho' },
  { value: '#d97706', label: 'Âmbar' },
  { value: '#0891b2', label: 'Ciano' },
  { value: '#db2777', label: 'Rosa' },
  { value: '#374151', label: 'Cinza' },
];

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[fadeIn_0.2s_ease-out]">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl ${type === 'success' ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white'}`}>
        <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${type === 'success' ? 'bg-emerald-500/20' : 'bg-white/20'}`}>
          <i className={`text-lg ${type === 'success' ? 'ri-check-line text-emerald-400' : 'ri-error-warning-line text-white'}`}></i>
        </div>
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

export default function ConfiguracoesEmpresaPage() {
  const { profile } = useAuth();
  const { logActivity } = useActivityLog();
  const { invalidate: invalidateCompany } = useCompanySettings();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'identity' | 'contact' | 'alerts' | 'appearance'>('identity');

  const [form, setForm] = useState<Omit<CompanySettings, 'id'>>({
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
  });

  // Somente admins
  const isAdmin = profile?.role === 'admin';

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
      if (data) {
        setForm({
          name: data.name || 'CRM Creators',
          email: data.email || '',
          phone: data.phone || '',
          whatsapp: data.whatsapp || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
          website: data.website || '',
          logo_url: data.logo_url || '',
          logo_base64: data.logo_base64 || '',
          primary_color: data.primary_color || '#004aad',
          sample_alert_days: data.sample_alert_days ?? 3,
          sample_alert_transit: data.sample_alert_transit ?? true,
          sample_alert_no_address: data.sample_alert_no_address ?? true,
        });
        if (data.logo_base64) setLogoPreview(data.logo_base64);
        else if (data.logo_url) setLogoPreview(data.logo_url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setToast({ message: 'Imagem deve ter no máximo 2MB', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setLogoPreview(b64);
      setForm(f => ({ ...f, logo_base64: b64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('company_settings').select('id').limit(1).maybeSingle();
      const payload = { ...form, updated_by: profile?.id, updated_at: new Date().toISOString() };
      if (existing?.id) {
        const { error } = await supabase.from('company_settings').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_settings').insert(payload);
        if (error) throw error;
      }
      await logActivity({ action: 'update', module: 'settings', entityId: 'company', entityName: form.name, details: { section: activeSection } });
      // Propagar mudanças para todo o sistema imediatamente
      invalidateCompany();
      setToast({ message: 'Configurações da empresa salvas!', type: 'success' });
    } catch {
      setToast({ message: 'Erro ao salvar. Tente novamente.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  const NAV = [
    { id: 'identity',   label: 'Identidade',    icon: 'ri-building-line' },
    { id: 'contact',    label: 'Contato',        icon: 'ri-contacts-line' },
    { id: 'alerts',     label: 'Alertas',        icon: 'ri-alarm-warning-line' },
    { id: 'appearance', label: 'Aparência',      icon: 'ri-palette-line' },
  ] as const;

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    </AppLayout>
  );

  if (!isAdmin) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center">
          <i className="ri-lock-line text-3xl text-rose-400"></i>
        </div>
        <p className="text-sm font-medium text-gray-600">Acesso restrito a administradores</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── HEADER ── */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#5de0e6]/10 rounded-2xl flex items-center justify-center">
            <i className="ri-building-4-line text-2xl text-[#004aad]"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Configurações da Empresa</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gerencie as informações e preferências globais do sistema</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold rounded-lg">
            <i className="ri-shield-star-line text-sm"></i>Somente Admins
          </span>
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-6">
          {/* ── SIDEBAR NAV ── */}
          <div className="space-y-1">
            {NAV.map(n => (
              <button key={n.id} onClick={() => setActiveSection(n.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeSection === n.id ? 'bg-[#5de0e6]/10 text-[#004aad]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                <i className={`${n.icon} text-base`}></i>{n.label}
              </button>
            ))}

            {/* Logo preview na sidebar */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Preview</p>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border-2 border-gray-200 flex items-center justify-center">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                    : <i className="ri-building-line text-2xl text-gray-300"></i>}
                </div>
                <p className="text-xs font-semibold text-gray-700 text-center truncate w-full">{form.name || 'CRM Creators'}</p>
                <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: form.primary_color }}></div>
              </div>
            </div>
          </div>

          {/* ── CONTENT ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

            {/* ── IDENTIDADE ── */}
            {activeSection === 'identity' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center">
                    <i className="ri-building-line text-[#004aad] text-base"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Identidade da Empresa</h3>
                    <p className="text-xs text-gray-400">Nome, logo e informações principais</p>
                  </div>
                </div>

                {/* Logo Upload */}
                <div>
                  <label className={lbl}>Logo da empresa</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#5de0e6] transition-colors group relative"
                      onClick={() => logoInputRef.current?.click()}>
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                        : <div className="flex flex-col items-center gap-1">
                            <i className="ri-image-add-line text-2xl text-gray-300 group-hover:text-[#5de0e6] transition-colors"></i>
                            <span className="text-[10px] text-gray-400">Upload</span>
                          </div>}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                        <i className="ri-edit-line text-white text-xl"></i>
                      </div>
                    </div>
                    <div className="flex-1">
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <p className="text-xs text-gray-500 mb-2">PNG, JPG ou SVG · Máximo 2MB · Recomendado 256×256px</p>
                      <div className="flex gap-2">
                        <button onClick={() => logoInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#004aad] bg-[#5de0e6]/10 hover:bg-[#5de0e6]/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                          <i className="ri-upload-2-line text-xs"></i>Enviar arquivo
                        </button>
                        {logoPreview && (
                          <button onClick={() => { setLogoPreview(null); setForm(f => ({ ...f, logo_base64: '', logo_url: '' })); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                            <i className="ri-delete-bin-line text-xs"></i>Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nome */}
                <div>
                  <label className={lbl}>Nome da empresa <span className="text-rose-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: CRM Creators" className={inp} maxLength={80} />
                </div>

                {/* Website */}
                <div>
                  <label className={lbl}>Website</label>
                  <div className="relative">
                    <i className="ri-global-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input type="url" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                      placeholder="https://suaempresa.com.br" className={`${inp} pl-9`} />
                  </div>
                </div>
              </div>
            )}

            {/* ── CONTATO ── */}
            {activeSection === 'contact' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <i className="ri-contacts-line text-emerald-600 text-base"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Informações de Contato</h3>
                    <p className="text-xs text-gray-400">E-mail, telefone e endereço da empresa</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>E-mail corporativo</label>
                    <div className="relative">
                      <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="contato@empresa.com" className={`${inp} pl-9`} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Telefone</label>
                    <div className="relative">
                      <i className="ri-phone-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+55 11 3333-4444" className={`${inp} pl-9`} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={lbl}>WhatsApp da empresa</label>
                  <div className="relative">
                    <i className="ri-whatsapp-line absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm"></i>
                    <input type="tel" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="+55 11 99999-9999" className={`${inp} pl-9`} />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Endereço</p>
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>Rua / Logradouro</label>
                      <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="Av. Paulista, 1000" className={inp} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className={lbl}>Cidade</label>
                        <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                          placeholder="São Paulo" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Estado</label>
                        <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                          className={`${inp} cursor-pointer`}>
                          <option value="">UF</option>
                          {ESTADOS_BR.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="w-1/3">
                      <label className={lbl}>CEP</label>
                      <input type="text" value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))}
                        placeholder="01310-100" className={inp} maxLength={9} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ALERTAS ── */}
            {activeSection === 'alerts' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
                    <i className="ri-alarm-warning-line text-rose-600 text-base"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Alertas Globais de Amostra</h3>
                    <p className="text-xs text-gray-400">Configuração padrão aplicada a todos os usuários</p>
                  </div>
                </div>

                {/* Prazo */}
                <div>
                  <label className={lbl}>Alertar após quantos dias sem envio?</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                      <button type="button" onClick={() => setForm(f => ({ ...f, sample_alert_days: Math.max(1, f.sample_alert_days - 1) }))}
                        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors">
                        <i className="ri-subtract-line text-sm"></i>
                      </button>
                      <input type="number" min={1} max={90} value={form.sample_alert_days}
                        onChange={e => setForm(f => ({ ...f, sample_alert_days: Math.min(90, Math.max(1, parseInt(e.target.value) || 1)) }))}
                        className="w-14 h-10 text-center text-sm font-semibold text-gray-900 border-x border-gray-200 bg-white focus:outline-none" />
                      <button type="button" onClick={() => setForm(f => ({ ...f, sample_alert_days: Math.min(90, f.sample_alert_days + 1) }))}
                        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors">
                        <i className="ri-add-line text-sm"></i>
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">dias</span>
                  </div>
                  {/* Atalhos */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[{ d: 1, l: '1 dia' }, { d: 3, l: '3 dias' }, { d: 5, l: '5 dias' }, { d: 7, l: '1 semana' }, { d: 14, l: '2 semanas' }, { d: 30, l: '1 mês' }].map(p => (
                      <button key={p.d} type="button" onClick={() => setForm(f => ({ ...f, sample_alert_days: p.d }))}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap ${form.sample_alert_days === p.d ? 'bg-[#004aad] border-[#004aad] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipos de alerta */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <p className={lbl}>Tipos de alerta ativos</p>
                  {[
                    { key: 'sample_alert_transit' as const, label: 'Em trânsito há muito tempo', desc: 'Amostra com código de rastreio sem confirmação além do prazo', icon: 'ri-truck-line', color: 'text-amber-500 bg-amber-50' },
                    { key: 'sample_alert_no_address' as const, label: 'Sem endereço cadastrado', desc: 'Creator sem endereço de entrega após o prazo configurado', icon: 'ri-map-pin-line', color: 'text-sky-500 bg-sky-50' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                          <i className={`${item.icon} text-sm`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.label}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, [item.key]: !f[item.key] }))}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form[item.key] ? 'bg-[#004aad]' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form[item.key] ? 'translate-x-5' : 'translate-x-0'}`}></span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── APARÊNCIA ── */}
            {activeSection === 'appearance' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                    <i className="ri-palette-line text-violet-600 text-base"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Aparência do Sistema</h3>
                    <p className="text-xs text-gray-400">Cor principal e identidade visual</p>
                  </div>
                </div>

                <div>
                  <label className={lbl}>Cor principal da marca</label>
                  <div className="flex items-center gap-3 flex-wrap mb-4">
                    {COLOR_PRESETS.map(c => (
                      <button key={c.value} onClick={() => { setForm(f => ({ ...f, primary_color: c.value })); applyPrimaryColor(c.value); }} title={c.label}
                        className={`w-9 h-9 rounded-xl cursor-pointer transition-all hover:scale-110 ${form.primary_color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                        style={{ backgroundColor: c.value }}>
                      </button>
                    ))}
                    {/* Custom color */}
                    <div className="relative">
                      <input type="color" value={form.primary_color} onChange={e => { setForm(f => ({ ...f, primary_color: e.target.value })); applyPrimaryColor(e.target.value); }}
                        className="w-9 h-9 rounded-xl cursor-pointer border-2 border-gray-200 p-0.5" title="Cor personalizada" />
                    </div>
                  </div>
                  {/* Preview da cor */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Preview</p>
                    <div className="flex items-center gap-3">
                      <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl shadow-sm" style={{ backgroundColor: form.primary_color }}>
                        <i className="ri-add-line"></i>Novo Acompanhamento
                      </button>
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: `${form.primary_color}20`, color: form.primary_color }}>
                        <i className="ri-star-line text-xs"></i>Embaixador Elite
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">A cor é aplicada em botões, badges e destaques do sistema.</p>
                  </div>
                </div>

                {/* Ações perigosas */}
                <div className="pt-4 border-t border-gray-100">
                  <p className={lbl + ' text-rose-500'}>Zona de perigo</p>
                  <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                    <p className="text-xs text-rose-600 mb-3">Ações irreversíveis que afetam todos os dados do sistema.</p>
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-delete-bin-line text-sm"></i>Limpar Todos os Dados
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── FOOTER SAVE ── */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Modificações afetam todos os usuários do sistema</p>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm">
                {saving
                  ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</>
                  : <><i className="ri-save-line"></i>Salvar Configurações</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}

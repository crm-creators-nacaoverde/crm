import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import { Client, supabase } from '../../../lib/supabase';
import { useNotificationContext } from '../../../contexts/NotificationContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import { useClientHistory, historyEvent } from '../../../hooks/useClientHistory';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (data: Record<string, unknown>) => void;
}

type TabId = 'obrigatorio' | 'endereco' | 'acompanhamento';

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const PIX_TIPOS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

// Fallbacks caso o banco esteja vazio
const CATEGORIAS_DEFAULT = ['Creators', 'Embaixadores', 'Influenciadores', 'Parceiros', 'Afiliados'];
const PLATAFORMAS_DEFAULT = ['TikTok', 'Instagram', 'YouTube', 'Kwai', 'Facebook', 'Twitter/X', 'Twitch', 'Pinterest', 'LinkedIn', 'Outro'];

const formatCpfCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const validateCpfCnpj = (value: string): boolean => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14 || digits.length === 0;
};

export default function ClientModal({ isOpen, onClose, client, onSave }: ClientModalProps) {
  const { sendNotification } = useNotificationContext();
  const { logActivity } = useActivityLog();
  const { logClientEvent } = useClientHistory();
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFAULT);
  const [plataformas, setPlataformas] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [fontes, setFontes] = useState<string[]>([]);

  useEffect(() => {
    const loadCadastros = async () => {
      const [catRes, platRes, srcRes] = await Promise.all([
        supabase.from('creator_categories').select('name').eq('is_active', true).order('sort_order'),
        supabase.from('platforms').select('name, icon, color').eq('is_active', true).order('sort_order'),
        supabase.from('capture_sources').select('name').eq('is_active', true).order('sort_order'),
      ]);
      if (catRes.data && catRes.data.length > 0) setCategorias(catRes.data.map(c => c.name));
      if (platRes.data && platRes.data.length > 0) setPlataformas(platRes.data);
      else setPlataformas(PLATAFORMAS_DEFAULT.map(n => ({ name: n, icon: 'ri-global-line', color: '#6b7280' })));
      if (srcRes.data && srcRes.data.length > 0) setFontes(srcRes.data.map(s => s.name));
    };
    loadCadastros();
  }, []);
  const [activeTab, setActiveTab] = useState<TabId>('obrigatorio');
  const [tiktokLinks, setTiktokLinks] = useState<string[]>(['']);
  const [gmvPeriod, setGmvPeriod] = useState<'7' | '14' | '28' | '30'>('7');
  const [videosPeriod, setVideosPeriod] = useState<'7' | '14' | '28' | '30'>('7');
  const [livesPeriod, setLivesPeriod] = useState<'7' | '14' | '28' | '30'>('7');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingCep, setLoadingCep] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cpf_cnpj: '',
    platform: 'TikTok',
    instagram_profile: '',
    youtube_canal: '',
    category: 'Creators' as string,
    capture_source: '' as string,
    gmv_geral: '',
    produtos_divulgados: '',
    comissao_organica: '',
    comissao_trafego: '',
    gmv_interno_7d: '',
    gmv_interno_14d: '',
    gmv_interno_28d: '',
    gmv_interno_30d: '',
    whatsapp_group_link: '',
    videos_7d: '',
    videos_14d: '',
    videos_28d: '',
    videos_30d: '',
    lives_7d: '',
    lives_14d: '',
    lives_28d: '',
    lives_30d: '',
    status: 'active' as 'active' | 'inactive',
    endereco_cep: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',
    chave_pix: '',
    chave_pix_tipo: '',
    codigo_rastreio: '',
    amostra_enviada: false,
    amostra_data_envio: '',
    amostra_observacao: '',
  });

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        cpf_cnpj: client.cpf_cnpj || '',
        platform: client.platform || 'TikTok',
        category: client.category || 'Creators',
        capture_source: (client as any).capture_source || '',
        instagram_profile: (client as any).instagram_profile || '',
        youtube_canal: (client as any).youtube_canal || '',
        gmv_geral: client.gmv_geral?.toString() || '',
        produtos_divulgados: client.produtos_divulgados || '',
        comissao_organica: client.comissao_organica?.toString() || '',
        comissao_trafego: client.comissao_trafego?.toString() || '',
        gmv_interno_7d: client.gmv_interno_7d?.toString() || '',
        gmv_interno_14d: client.gmv_interno_14d?.toString() || '',
        gmv_interno_28d: client.gmv_interno_28d?.toString() || '',
        gmv_interno_30d: client.gmv_interno_30d?.toString() || '',
        whatsapp_group_link: client.whatsapp_group_link || '',
        videos_7d: client.videos_7d?.toString() || '',
        videos_14d: client.videos_14d?.toString() || '',
        videos_28d: client.videos_28d?.toString() || '',
        videos_30d: client.videos_30d?.toString() || '',
        lives_7d: client.lives_7d?.toString() || '',
        lives_14d: client.lives_14d?.toString() || '',
        lives_28d: client.lives_28d?.toString() || '',
        lives_30d: client.lives_30d?.toString() || '',
        status: client.status || 'active',
        endereco_cep: client.endereco_cep || '',
        endereco_rua: client.endereco_rua || '',
        endereco_numero: client.endereco_numero || '',
        endereco_complemento: client.endereco_complemento || '',
        endereco_bairro: client.endereco_bairro || '',
        endereco_cidade: client.endereco_cidade || '',
        endereco_estado: client.endereco_estado || '',
        chave_pix: client.chave_pix || '',
        chave_pix_tipo: client.chave_pix_tipo || '',
        codigo_rastreio: client.codigo_rastreio || '',
        amostra_enviada: client.amostra_enviada || false,
        amostra_data_envio: client.amostra_data_envio ? client.amostra_data_envio.slice(0, 10) : '',
        amostra_observacao: client.amostra_observacao || '',
      });
      setTiktokLinks(client.tiktok_links?.length ? [...client.tiktok_links] : ['']);
    } else {
      setForm({
        name: '', email: '', phone: '', cpf_cnpj: '', platform: 'TikTok',
        category: 'Creators', capture_source: '',
        instagram_profile: '', youtube_canal: '',
        gmv_geral: '', produtos_divulgados: '',
        comissao_organica: '', comissao_trafego: '',
        gmv_interno_7d: '', gmv_interno_14d: '', gmv_interno_28d: '', gmv_interno_30d: '',
        whatsapp_group_link: '',
        videos_7d: '', videos_14d: '', videos_28d: '', videos_30d: '',
        lives_7d: '', lives_14d: '', lives_28d: '', lives_30d: '',
        status: 'active',
        endereco_cep: '', endereco_rua: '', endereco_numero: '', endereco_complemento: '',
        endereco_bairro: '', endereco_cidade: '', endereco_estado: '',
        chave_pix: '', chave_pix_tipo: '',
        codigo_rastreio: '', amostra_enviada: false, amostra_data_envio: '', amostra_observacao: '',
      });
      setTiktokLinks(['']);
    }
    setActiveTab('obrigatorio');
    setErrors({});
  }, [client, isOpen]);

  const addTiktokLink = () => {
    if (tiktokLinks.length < 5) setTiktokLinks([...tiktokLinks, '']);
  };
  const removeTiktokLink = (index: number) => {
    if (tiktokLinks.length > 1) setTiktokLinks(tiktokLinks.filter((_, i) => i !== index));
  };
  const updateTiktokLink = (index: number, value: string) => {
    const updated = [...tiktokLinks];
    updated[index] = value;
    setTiktokLinks(updated);
  };

  const handleCepSearch = async () => {
    const cep = form.endereco_cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          endereco_rua: data.logradouro || prev.endereco_rua,
          endereco_bairro: data.bairro || prev.endereco_bairro,
          endereco_cidade: data.localidade || prev.endereco_cidade,
          endereco_estado: data.uf || prev.endereco_estado,
        }));
      }
    } catch { /* silently fail */ }
    finally { setLoadingCep(false); }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!form.phone.trim()) newErrors.phone = 'Telefone é obrigatório';
    if (form.cpf_cnpj && !validateCpfCnpj(form.cpf_cnpj)) newErrors.cpf_cnpj = 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) setActiveTab('obrigatorio');
    return Object.keys(newErrors).length === 0;
  };

  const buildPayload = () => {
    const validLinks = tiktokLinks.filter(l => l.trim());
    return {
      name: form.name,
      email: form.email || (form.name.toLowerCase().replace(/\s+/g, '.') + '@creator.com'),
      phone: form.phone,
      cpf_cnpj: form.cpf_cnpj,
      platform: form.platform,
      category: form.category,
      capture_source: form.capture_source || null,
      instagram_profile: form.instagram_profile || null,
      youtube_canal: form.youtube_canal || null,
      followers: 0,
      revenue: parseFloat(form.gmv_geral) || 0,
      status: form.status,
      tiktok_links: validLinks,
      gmv_geral: parseFloat(form.gmv_geral) || 0,
      produtos_divulgados: form.produtos_divulgados,
      comissao_organica: parseFloat(form.comissao_organica) || 0,
      comissao_trafego: parseFloat(form.comissao_trafego) || 0,
      gmv_interno_7d: parseFloat(form.gmv_interno_7d) || 0,
      gmv_interno_14d: parseFloat(form.gmv_interno_14d) || 0,
      gmv_interno_28d: parseFloat(form.gmv_interno_28d) || 0,
      gmv_interno_30d: parseFloat(form.gmv_interno_30d) || 0,
      whatsapp_group_link: form.whatsapp_group_link,
      videos_7d: parseInt(form.videos_7d) || 0,
      videos_14d: parseInt(form.videos_14d) || 0,
      videos_28d: parseInt(form.videos_28d) || 0,
      videos_30d: parseInt(form.videos_30d) || 0,
      lives_7d: parseInt(form.lives_7d) || 0,
      lives_14d: parseInt(form.lives_14d) || 0,
      lives_28d: parseInt(form.lives_28d) || 0,
      lives_30d: parseInt(form.lives_30d) || 0,
      endereco_cep: form.endereco_cep,
      endereco_rua: form.endereco_rua,
      endereco_numero: form.endereco_numero,
      endereco_complemento: form.endereco_complemento,
      endereco_bairro: form.endereco_bairro,
      endereco_cidade: form.endereco_cidade,
      endereco_estado: form.endereco_estado,
      chave_pix: form.chave_pix,
      chave_pix_tipo: form.chave_pix_tipo,
      codigo_rastreio: form.codigo_rastreio,
      amostra_enviada: form.amostra_enviada,
      amostra_data_envio: form.amostra_enviada && form.amostra_data_envio
        ? new Date(form.amostra_data_envio).toISOString() : null,
      amostra_observacao: form.amostra_observacao,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = buildPayload();
    try {
      if (client) {
        const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
        if (error) throw error;

        // Registrar alterações no histórico
        const fieldLabels: Record<string, string> = {
          name: 'Nome',
          email: 'E-mail',
          phone: 'Telefone',
          cpf_cnpj: 'CPF/CNPJ',
          platform: 'Plataforma',
          category: 'Categoria',
          capture_source: 'Fonte de Captura',
          instagram_profile: 'Instagram',
          youtube_canal: 'YouTube',
          status: 'Status',
          endereco_cep: 'CEP',
          endereco_rua: 'Rua',
          endereco_numero: 'Número',
          endereco_bairro: 'Bairro',
          endereco_cidade: 'Cidade',
          endereco_estado: 'Estado',
          chave_pix: 'Chave PIX',
          chave_pix_tipo: 'Tipo PIX',
          codigo_rastreio: 'Código de Rastreio',
        };

        const changedFields: string[] = [];
        for (const [key, newValue] of Object.entries(payload)) {
          const oldValue = (client as any)[key];
          
          // Comparação simples para strings, números e booleanos
          // Ignorar campos que não queremos logar detalhadamente ou que são objetos complexos
          if (fieldLabels[key] && String(oldValue || '') !== String(newValue || '')) {
            await logClientEvent({
              client_id: client.id,
              ...historyEvent.dadosAlterados(fieldLabels[key], String(oldValue || ''), String(newValue || ''))
            });
            changedFields.push(fieldLabels[key]);
          }
        }

        sendNotification('Creator Atualizado', { body: `${form.name} foi atualizado com sucesso.` });
        await logActivity({ action: 'update', module: 'creators', entityId: client.id, entityName: form.name, details: { fields: changedFields } });
      } else {
        const { error, data: newData } = await supabase.from('clients').insert([payload]).select('id').single();
        if (error) throw error;
        sendNotification('Novo Creator Adicionado! 🎉', { body: `${form.name} foi cadastrado com sucesso.` });
        await logActivity({ action: 'create', module: 'creators', entityId: newData?.id, entityName: form.name });
      }
      onSave({});
      onClose();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    }
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'obrigatorio', label: 'Dados do Creator', icon: 'ri-user-star-line' },
    { id: 'endereco', label: 'Endereço / PIX / Amostra', icon: 'ri-map-pin-line' },
    { id: 'acompanhamento', label: 'Acompanhamento', icon: 'ri-line-chart-line' },
  ];

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white transition-all';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';
  const errorClass = 'text-[11px] text-rose-500 mt-1';

  // Ícone da plataforma selecionada
  // Ícone da plataforma — usa dados do banco ou fallback
  const getPlatformIcon = (name: string): string => {
    const found = plataformas.find(p => p.name === name);
    return found?.icon || 'ri-global-line';
  };

  const periodTabs = (value: '7' | '14' | '28' | '30', onChange: (v: '7' | '14' | '28' | '30') => void) => (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mb-3">
      {(['7', '14', '28', '30'] as const).map(p => (
        <button key={p} type="button" onClick={() => onChange(p)}
          className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap cursor-pointer transition-all ${value === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          {p} dias
        </button>
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={client ? 'Editar Creator' : 'Novo Creator'}
      subtitle={client ? client.name : 'Cadastre as informações do creator'}
      size="lg">
      <form onSubmit={handleSubmit}>
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 mb-6">
          {tabs.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${tab.icon} text-base`}></i>
              {tab.label}
              {tab.id === 'obrigatorio' && Object.keys(errors).length > 0 && (
                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: Dados do Creator ── */}
        {activeTab === 'obrigatorio' && (
          <div className="space-y-4">
            {/* Nome + E-mail + Telefone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Nome <span className="text-rose-500">*</span></label>
                <input type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo do creator"
                  className={`${inputClass} ${errors.name ? 'border-rose-300' : ''}`} />
                {errors.name && <p className={errorClass}>{errors.name}</p>}
              </div>
              <div>
                <label className={labelClass}>E-mail</label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className={`${inputClass} pl-9`} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Telefone (WhatsApp) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <i className="ri-whatsapp-line absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm"></i>
                  <input type="tel" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+55 11 99999-9999"
                    className={`${inputClass} pl-9 ${errors.phone ? 'border-rose-300' : ''}`} />
                </div>
                {errors.phone && <p className={errorClass}>{errors.phone}</p>}
              </div>
            </div>

            {/* CPF/CNPJ */}
            <div>
              <label className={labelClass}>CPF / CNPJ</label>
              <div className="relative">
                <i className="ri-file-text-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input type="text" value={form.cpf_cnpj}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
                    setForm({ ...form, cpf_cnpj: formatCpfCnpj(raw) });
                  }}
                  placeholder="000.000.000-00"
                  className={`${inputClass} pl-9 ${errors.cpf_cnpj ? 'border-rose-300' : ''}`}
                  maxLength={18} />
              </div>
              {errors.cpf_cnpj && <p className={errorClass}>{errors.cpf_cnpj}</p>}
            </div>

            {/* ── PLATAFORMAS ── */}
            <div className="bg-gradient-to-r from-[#004aad]/5 to-[#5de0e6]/5 border border-[#5de0e6]/30 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <i className="ri-broadcast-line text-[#004aad] text-base"></i>
                <span className="text-xs font-semibold text-gray-800">Plataformas e Canais</span>
              </div>

              {/* Categoria */}
              <div>
                <label className={labelClass}>Categoria <span className="text-rose-500">*</span></label>
                <div className="flex items-center gap-2 flex-wrap">
                  {categorias.map((cat) => (
                    <button key={cat} type="button" onClick={() => setForm({ ...form, category: cat })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all cursor-pointer whitespace-nowrap ${
                        form.category === cat
                          ? 'border-[#004aad] bg-[#004aad] text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#004aad]/40'
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fonte de Captura */}
              {fontes.length > 0 && (
                <div>
                  <label className={labelClass}>Fonte de Captura</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => setForm({ ...form, capture_source: '' })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all cursor-pointer whitespace-nowrap ${
                        !form.capture_source
                          ? 'border-[#004aad] bg-[#004aad] text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#004aad]/40'
                      }`}>
                      Não informado
                    </button>
                    {fontes.map(fonte => (
                      <button key={fonte} type="button" onClick={() => setForm({ ...form, capture_source: fonte })}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all cursor-pointer whitespace-nowrap ${
                          form.capture_source === fonte
                            ? 'border-[#004aad] bg-[#004aad] text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-[#004aad]/40'
                        }`}>
                        {fonte}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Plataforma Principal */}
              <div>
                <label className={labelClass}>Plataforma Principal <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <i className={`${getPlatformIcon(form.platform)} absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm`}></i>
                  <select value={form.platform}
                    onChange={e => setForm({ ...form, platform: e.target.value })}
                    className={`${inputClass} pl-9 cursor-pointer`}>
                    {plataformas.map(p => p.name).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Links TikTok */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`${labelClass} mb-0 flex items-center gap-1.5`}>
                    <i className="ri-tiktok-line text-gray-700 text-xs"></i>
                    Links do TikTok
                    <span className="text-gray-400 font-normal">({tiktokLinks.length}/5)</span>
                  </label>
                  {tiktokLinks.length < 5 && (
                    <button type="button" onClick={addTiktokLink}
                      className="text-xs text-[#004aad] hover:text-[#003d91] font-medium cursor-pointer flex items-center gap-1">
                      <i className="ri-add-line text-sm"></i>Adicionar
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {tiktokLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <i className="ri-tiktok-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-800 text-sm"></i>
                        <input type="url" value={link}
                          onChange={e => updateTiktokLink(index, e.target.value)}
                          placeholder="https://tiktok.com/@usuario"
                          className={`${inputClass} pl-9`} />
                      </div>
                      {tiktokLinks.length > 1 && (
                        <button type="button" onClick={() => removeTiktokLink(index)}
                          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer">
                          <i className="ri-close-line text-base"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Instagram */}
              <div>
                <label className={`${labelClass} flex items-center gap-1.5`}>
                  <i className="ri-instagram-line text-pink-500 text-xs"></i>
                  Perfil do Instagram
                </label>
                <div className="relative">
                  <i className="ri-instagram-line absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 text-sm"></i>
                  <input type="url" value={form.instagram_profile}
                    onChange={e => setForm({ ...form, instagram_profile: e.target.value })}
                    placeholder="https://instagram.com/@seuperfil"
                    className={`${inputClass} pl-9`} />
                </div>
              </div>

              {/* YouTube */}
              <div>
                <label className={`${labelClass} flex items-center gap-1.5`}>
                  <i className="ri-youtube-line text-red-500 text-xs"></i>
                  Canal do YouTube
                </label>
                <div className="relative">
                  <i className="ri-youtube-line absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-sm"></i>
                  <input type="url" value={form.youtube_canal}
                    onChange={e => setForm({ ...form, youtube_canal: e.target.value })}
                    placeholder="https://youtube.com/@seucanal"
                    className={`${inputClass} pl-9`} />
                </div>
              </div>
            </div>

            {/* GMV + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>GMV Geral</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" step="0.01" value={form.gmv_geral}
                    onChange={e => setForm({ ...form, gmv_geral: e.target.value })}
                    placeholder="0,00"
                    className={`${inputClass} pl-10 ${errors.gmv_geral ? 'border-rose-300' : ''}`} />
                </div>
                {errors.gmv_geral && <p className={errorClass}>{errors.gmv_geral}</p>}
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                  className={`${inputClass} cursor-pointer`}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            {/* Produtos */}
            <div>
              <label className={labelClass}>Produtos Divulgados</label>
              <textarea value={form.produtos_divulgados}
                onChange={e => setForm({ ...form, produtos_divulgados: e.target.value.slice(0, 500) })}
                rows={2} maxLength={500}
                placeholder="Ex: Skincare, Maquiagem, Perfumes..."
                className={`${inputClass} resize-none`} />
              <p className="text-[11px] text-gray-400 text-right mt-1">{form.produtos_divulgados.length}/500</p>
            </div>
          </div>
        )}

        {/* ── TAB: Endereço / PIX / Amostra ── */}
        {activeTab === 'endereco' && (
          <div className="space-y-5">
            {/* Endereço */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-map-pin-line text-rose-500"></i>Endereço Completo
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>CEP</label>
                    <div className="relative">
                      <input type="text" value={form.endereco_cep}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                          const formatted = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
                          setForm({ ...form, endereco_cep: formatted });
                        }}
                        onBlur={handleCepSearch}
                        placeholder="00000-000" className={inputClass} maxLength={9} />
                      {loadingCep && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Rua / Logradouro</label>
                    <input type="text" value={form.endereco_rua}
                      onChange={e => setForm({ ...form, endereco_rua: e.target.value })}
                      placeholder="Rua, Avenida..." className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Número</label>
                    <input type="text" value={form.endereco_numero}
                      onChange={e => setForm({ ...form, endereco_numero: e.target.value })}
                      placeholder="123" className={inputClass} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Complemento</label>
                    <input type="text" value={form.endereco_complemento}
                      onChange={e => setForm({ ...form, endereco_complemento: e.target.value })}
                      placeholder="Apto, Bloco..." className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Bairro</label>
                    <input type="text" value={form.endereco_bairro}
                      onChange={e => setForm({ ...form, endereco_bairro: e.target.value })}
                      placeholder="Bairro" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Cidade</label>
                    <input type="text" value={form.endereco_cidade}
                      onChange={e => setForm({ ...form, endereco_cidade: e.target.value })}
                      placeholder="Cidade" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <select value={form.endereco_estado}
                      onChange={e => setForm({ ...form, endereco_estado: e.target.value })}
                      className={`${inputClass} cursor-pointer`}>
                      <option value="">Selecione...</option>
                      {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* PIX */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-bank-card-line text-emerald-500"></i>Chave PIX
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select value={form.chave_pix_tipo}
                    onChange={e => setForm({ ...form, chave_pix_tipo: e.target.value })}
                    className={`${inputClass} cursor-pointer`}>
                    <option value="">Selecione...</option>
                    {PIX_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Chave PIX</label>
                  <div className="relative">
                    <i className="ri-key-2-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input type="text" value={form.chave_pix}
                      onChange={e => setForm({ ...form, chave_pix: e.target.value })}
                      placeholder="Digite a chave PIX"
                      className={`${inputClass} pl-9`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Amostra */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-gift-line text-amber-500"></i>Amostra de Produto
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Código de Rastreio</label>
                    <div className="relative">
                      <i className="ri-truck-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input type="text" value={form.codigo_rastreio}
                        onChange={e => setForm({ ...form, codigo_rastreio: e.target.value.toUpperCase() })}
                        placeholder="Ex: BR123456789BR"
                        className={`${inputClass} pl-9 font-mono text-xs`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Data de Envio</label>
                    <input type="date" value={form.amostra_data_envio}
                      onChange={e => setForm({ ...form, amostra_data_envio: e.target.value })}
                      className={inputClass} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setForm(prev => ({ ...prev, amostra_enviada: !prev.amostra_enviada }))}
                    className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-5 rounded-full transition-all relative ${form.amostra_enviada ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${form.amostra_enviada ? 'left-5' : 'left-0.5'}`}></div>
                    </div>
                    <span className={`text-sm font-medium ${form.amostra_enviada ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {form.amostra_enviada ? 'Amostra Enviada' : 'Amostra Não Enviada'}
                    </span>
                  </button>
                </div>
                <div>
                  <label className={labelClass}>Observação</label>
                  <textarea value={form.amostra_observacao}
                    onChange={e => setForm({ ...form, amostra_observacao: e.target.value.slice(0, 500) })}
                    rows={2} maxLength={500}
                    placeholder="Detalhes sobre o envio..."
                    className={`${inputClass} resize-none`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Acompanhamento ── */}
        {activeTab === 'acompanhamento' && (
          <div className="space-y-5">
            <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5 flex items-start gap-3">
              <i className="ri-information-line text-amber-500 text-lg mt-0.5"></i>
              <div>
                <p className="text-sm font-medium text-amber-800">Campos de acompanhamento</p>
                <p className="text-xs text-amber-600 mt-0.5">Estes campos podem ser preenchidos conforme o creator avança nas etapas.</p>
              </div>
            </div>

            {/* Comissão */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-percent-line text-brand-500"></i>Comissão Acordada
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Orgânica (%)</label>
                  <div className="relative">
                    <input type="number" step="0.1" min="0" max="100" value={form.comissao_organica}
                      onChange={e => setForm({ ...form, comissao_organica: e.target.value })}
                      placeholder="0" className={inputClass} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Tráfego (%)</label>
                  <div className="relative">
                    <input type="number" step="0.1" min="0" max="100" value={form.comissao_trafego}
                      onChange={e => setForm({ ...form, comissao_trafego: e.target.value })}
                      placeholder="0" className={inputClass} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GMV */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-money-dollar-circle-line text-emerald-500"></i>GMV Interno
              </h4>
              {periodTabs(gmvPeriod, setGmvPeriod)}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="number" step="0.01"
                  value={form[`gmv_interno_${gmvPeriod}d` as keyof typeof form] as string}
                  onChange={e => setForm({ ...form, [`gmv_interno_${gmvPeriod}d`]: e.target.value })}
                  placeholder="0,00" className={`${inputClass} pl-10`} />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-whatsapp-line text-emerald-500"></i>Link do Grupo WhatsApp
              </h4>
              <input type="url" value={form.whatsapp_group_link}
                onChange={e => setForm({ ...form, whatsapp_group_link: e.target.value })}
                placeholder="https://chat.whatsapp.com/..." className={inputClass} />
            </div>

            {/* Vídeos */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-video-line text-brand-500"></i>Vídeos Feitos
              </h4>
              {periodTabs(videosPeriod, setVideosPeriod)}
              <input type="number" min="0"
                value={form[`videos_${videosPeriod}d` as keyof typeof form] as string}
                onChange={e => setForm({ ...form, [`videos_${videosPeriod}d`]: e.target.value })}
                placeholder="0" className={inputClass} />
            </div>

            {/* Lives */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-live-line text-rose-500"></i>Lives Feitas
              </h4>
              {periodTabs(livesPeriod, setLivesPeriod)}
              <input type="number" min="0"
                value={form[`lives_${livesPeriod}d` as keyof typeof form] as string}
                onChange={e => setForm({ ...form, [`lives_${livesPeriod}d`]: e.target.value })}
                placeholder="0" className={inputClass} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 pt-5 mt-5 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">
            {client ? 'Salvar Alterações' : 'Cadastrar Creator'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

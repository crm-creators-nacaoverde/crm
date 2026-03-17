import { useState, useEffect, useCallback } from 'react';
import Modal from '../../../components/base/Modal';
import { supabase } from '../../../lib/supabase';
import { Deal } from './KanbanSection';
import RequestSampleModal from './RequestSampleModal';
import DealTasksSection from './DealTasksSection';

interface DealDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  stages: { id: string; label: string; color: string }[];
  onEdit: (deal: Deal) => void;
  onClientUpdated?: () => Promise<void>;
}

interface ClientFull {
  id: string;
  name: string;
  phone: string;
  email: string;
  platform: string;
  followers: number;
  category: string;
  status: string;
  notes: string;
  cpf_cnpj: string;
  tiktok_links: string[];
  gmv_geral: number;
  produtos_divulgados: string;
  comissao_organica: number;
  comissao_trafego: number;
  gmv_interno_7d: number;
  gmv_interno_14d: number;
  gmv_interno_28d: number;
  gmv_interno_30d: number;
  whatsapp_group_link: string;
  videos_7d: number;
  videos_14d: number;
  videos_28d: number;
  videos_30d: number;
  lives_7d: number;
  lives_14d: number;
  lives_28d: number;
  lives_30d: number;
  endereco_cep: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  chave_pix: string;
  chave_pix_tipo: string;
  codigo_rastreio: string;
  amostra_enviada: boolean;
  amostra_data_envio: string;
  amostra_observacao: string;
}

type EditSection = 'endereco' | 'pix' | 'amostra' | 'resultados' | 'contato' | null;

interface HistoryEvent {
  id: string;
  action: string;
  module: string;
  entity_name: string | null;
  user_name: string | null;
  user_email: string | null;
  details: Record<string, any> | null;
  created_at: string;
  source: 'deal' | 'creator' | 'form';
}

// ─── Bloco de Pagamento — sincronizado com o módulo Financeiro ──────────────
function PaymentBlock({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [lastPayment, setLastPayment] = useState<{
    id: string; type: string; amount: number; status: string;
    pix_key: string | null; paid_at: string | null; created_at: string;
  } | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewPayment, setShowNewPayment] = useState(false);

  const TYPES: Record<string, { label: string; icon: string; color: string }> = {
    premiacao: { label: 'Premiação',  icon: 'ri-trophy-line',              color: 'text-amber-700 bg-amber-100' },
    cache:     { label: 'Cachê',      icon: 'ri-money-dollar-circle-line', color: 'text-blue-700 bg-blue-100' },
    bonus:     { label: 'Bônus',      icon: 'ri-gift-line',                color: 'text-purple-700 bg-purple-100' },
    reembolso: { label: 'Reembolso',  icon: 'ri-refund-line',              color: 'text-teal-700 bg-teal-100' },
    outro:     { label: 'Outro',      icon: 'ri-more-line',                color: 'text-gray-600 bg-gray-100' },
  };

  const STATUS: Record<string, { label: string; color: string; icon: string }> = {
    pendente:  { label: 'Pendente',  color: 'text-amber-700 bg-amber-100',   icon: 'ri-time-line' },
    pago:      { label: 'Pago',      color: 'text-emerald-700 bg-emerald-100', icon: 'ri-checkbox-circle-line' },
    cancelado: { label: 'Cancelado', color: 'text-rose-700 bg-rose-100',     icon: 'ri-close-circle-line' },
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : null;
  const fmtMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    if (!clientId) return;
    const load = async () => {
      setLoading(true);
      const [lastRes, totalRes] = await Promise.all([
        supabase.from('creator_payments').select('id,type,amount,status,pix_key,paid_at,created_at')
          .eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('creator_payments').select('amount').eq('client_id', clientId).neq('status', 'cancelado'),
      ]);
      setLastPayment(lastRes.data || null);
      const sum = (totalRes.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      setTotal(sum);
      setLoading(false);
    };
    load();
  }, [clientId]);

  const hasPayment = !!lastPayment;
  const t = lastPayment ? (TYPES[lastPayment.type] || TYPES.outro) : null;
  const s = lastPayment ? (STATUS[lastPayment.status] || STATUS.pendente) : null;

  return (
    <div className={`border rounded-xl p-4 ${hasPayment ? 'bg-[#004aad]/5 border-[#004aad]/15' : 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <i className={`ri-money-dollar-circle-line text-sm ${hasPayment ? 'text-[#004aad]' : 'text-gray-400'}`}></i>
          Pagamentos
        </h4>
        <div className="flex items-center gap-1">
          {hasPayment && (
            <a href="/financeiro" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#004aad] hover:underline mr-1">
              <i className="ri-external-link-line text-xs"></i>Ver todos
            </a>
          )}
          <button
            onClick={() => setShowNewPayment(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-md transition-all cursor-pointer whitespace-nowrap shadow-sm">
            <i className="ri-add-line text-xs"></i>Novo Pagamento
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <i className="ri-loader-4-line animate-spin text-gray-400 text-sm"></i>
          <span className="text-xs text-gray-400">Carregando...</span>
        </div>
      ) : hasPayment ? (
        <div className="space-y-2">
          {/* Total acumulado */}
          {total > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-gray-500">Total pago:</span>
              <span className="text-sm font-bold text-[#004aad]">{fmtMoney(total)}</span>
            </div>
          )}
          {/* Último pagamento */}
          <div className="bg-white/70 rounded-lg px-3 py-2 border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">Último pagamento</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {t && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${t.color}`}>
                  <i className={`${t.icon} text-[10px]`}></i>{t.label}
                </span>
              )}
              {s && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${s.color}`}>
                  <i className={`${s.icon} text-[10px]`}></i>{s.label}
                </span>
              )}
              <span className="text-xs font-bold text-gray-800">{fmtMoney(lastPayment!.amount)}</span>
              {lastPayment!.paid_at && (
                <span className="text-[11px] text-gray-400">em {fmt(lastPayment!.paid_at)}</span>
              )}
            </div>
            {lastPayment!.pix_key && (
              <p className="text-[11px] text-gray-500 mt-1 font-mono truncate">PIX: {lastPayment!.pix_key}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">Nenhum pagamento registrado</p>
      )}

      {/* Mini-modal de novo pagamento */}
      {showNewPayment && (
        <QuickPaymentForm
          clientId={clientId}
          clientName={clientName}
          onClose={() => setShowNewPayment(false)}
          onSaved={() => {
            setShowNewPayment(false);
            // Recarregar bloco
            setLoading(true);
            const load = async () => {
              const [lastRes, totalRes] = await Promise.all([
                supabase.from('creator_payments').select('id,type,amount,status,pix_key,paid_at,created_at')
                  .eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
                supabase.from('creator_payments').select('amount').eq('client_id', clientId).neq('status', 'cancelado'),
              ]);
              setLastPayment(lastRes.data || null);
              const sum = (totalRes.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
              setTotal(sum);
              setLoading(false);
            };
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Formulário rápido de pagamento inline ──────────────────────────────────
function QuickPaymentForm({
  clientId, clientName, onClose, onSaved,
}: { clientId: string; clientName: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('premiacao');
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const TYPES = [
    { value: 'premiacao', label: 'Premiação', icon: 'ri-trophy-line' },
    { value: 'cache',     label: 'Cachê',     icon: 'ri-money-dollar-circle-line' },
    { value: 'bonus',     label: 'Bônus',     icon: 'ri-gift-line' },
    { value: 'reembolso', label: 'Reembolso', icon: 'ri-refund-line' },
    { value: 'outro',     label: 'Outro',     icon: 'ri-more-line' },
  ];

  useEffect(() => {
    // Puxar PIX do creator
    supabase.from('clients').select('chave_pix').eq('id', clientId).maybeSingle()
      .then(({ data }) => { if (data?.chave_pix) setPixKey(data.chave_pix); });
  }, [clientId]);

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('creator_payments').insert({
      client_id: clientId, client_name: clientName,
      type, amount: parseFloat(amount), status: 'pendente',
      pix_key: pixKey || null, notes: notes || null,
      created_by: user?.id || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    if (user) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
        user_email: user.email || '',
        action: 'create', module: 'financeiro',
        entity_name: clientName,
        details: { type, amount: parseFloat(amount), source: 'deal_detail' },
      });
    }
    setSaving(false);
    onSaved();
  };

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white';

  return (
    <div className="mt-3 p-3.5 bg-white border border-[#004aad]/20 rounded-xl space-y-3 animate-[fadeIn_0.15s_ease-out]">
      <p className="text-xs font-semibold text-gray-600">Registrar pagamento rápido</p>

      {/* Tipo */}
      <div className="grid grid-cols-5 gap-1">
        {TYPES.map(t => (
          <button key={t.value} type="button" onClick={() => setType(t.value)}
            className={`py-2 px-1 text-[10px] font-medium rounded-lg border cursor-pointer transition-all text-center flex flex-col items-center gap-0.5
              ${type === t.value ? 'border-[#004aad]/40 bg-[#004aad]/5 text-[#004aad]' : 'border-gray-100 text-gray-500 hover:border-gray-200 bg-white'}`}>
            <i className={`${t.icon} text-sm`}></i>{t.label}
          </button>
        ))}
      </div>

      {/* Valor e PIX */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Valor (R$) *</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0,00" className={inp} />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Chave PIX</label>
          <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)}
            placeholder="Chave PIX" className={`${inp} font-mono text-xs`} />
        </div>
      </div>

      {/* Observação */}
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Observação (opcional)" className={inp} />

      <div className="flex gap-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
          Cancelar
        </button>
        <button type="button" onClick={handleSave} disabled={saving || !amount}
          className="flex-1 py-2 text-xs font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
          {saving ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</> : <><i className="ri-add-line"></i>Registrar</>}
        </button>
      </div>
    </div>
  );
}

export default function DealDetailModal({
  isOpen,
  onClose,
  deal,
  stages,
  onEdit,
  onClientUpdated,
}: DealDetailModalProps) {
  const [client, setClient] = useState<ClientFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'resultados' | 'historico' | 'tarefas'>('info');
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [editData, setEditData] = useState<Partial<ClientFull>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showSampleModal, setShowSampleModal] = useState(false);

  const loadClient = useCallback(async () => {
    if (!deal?.client_id) {
      setClient(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', deal.client_id)
      .maybeSingle();
    if (error) {
      console.error('Failed to fetch client:', error);
      setClient(null);
    } else {
      setClient(data as ClientFull | null);
    }
    setLoading(false);
  }, [deal?.client_id]);

  const loadHistory = useCallback(async () => {
    if (!deal) return;
    setLoadingHistory(true);
    try {
      // Buscar logs do deal
      const { data: dealLogs } = await supabase
        .from('activity_logs')
        .select('id, action, module, entity_name, user_name, user_email, details, created_at')
        .eq('module', 'deals')
        .eq('entity_id', deal.id)
        .order('created_at', { ascending: false });

      // Buscar logs do creator vinculado
      let clientLogs: any[] = [];
      if (deal.client_id) {
        const { data } = await supabase
          .from('activity_logs')
          .select('id, action, module, entity_name, user_name, user_email, details, created_at')
          .eq('module', 'creators')
          .eq('entity_id', deal.client_id)
          .order('created_at', { ascending: false });
        clientLogs = data || [];
      }

      // Buscar submissões de formulários vinculadas ao creator
      let formLogs: any[] = [];
      if (deal.client_id) {
        const { data } = await supabase
          .from('activity_logs')
          .select('id, action, module, entity_name, user_name, user_email, details, created_at')
          .eq('module', 'form_submissions')
          .eq('entity_id', deal.client_id)
          .order('created_at', { ascending: false });
        formLogs = data || [];
      }

      const allEvents: HistoryEvent[] = [
        ...(dealLogs || []).map(l => ({ ...l, source: 'deal' as const })),
        ...clientLogs.map(l => ({ ...l, source: 'creator' as const })),
        ...formLogs.map(l => ({ ...l, source: 'form' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setHistory(allEvents);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [deal]);

  useEffect(() => {
    if (isOpen) {
      loadClient();
      setEditSection(null);
      setSaveSuccess(null);
      if (activeTab === 'historico') loadHistory();
    }
  }, [isOpen, loadClient]);

  useEffect(() => {
    if (activeTab === 'historico' && isOpen) loadHistory();
  }, [activeTab]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const startEdit = (section: EditSection) => {
    if (!client) return;
    setEditSection(section);
    setSaveSuccess(null);

    if (section === 'contato') {
      setEditData({
        phone: client.phone || '',
        email: client.email || '',
        cpf_cnpj: client.cpf_cnpj || '',
      });
    } else if (section === 'endereco') {
      setEditData({
        endereco_cep: client.endereco_cep || '',
        endereco_rua: client.endereco_rua || '',
        endereco_numero: client.endereco_numero || '',
        endereco_complemento: client.endereco_complemento || '',
        endereco_bairro: client.endereco_bairro || '',
        endereco_cidade: client.endereco_cidade || '',
        endereco_estado: client.endereco_estado || '',
      });
    } else if (section === 'pix') {
      setEditData({
        chave_pix: client.chave_pix || '',
        chave_pix_tipo: client.chave_pix_tipo || '',
      });
    } else if (section === 'amostra') {
      setEditData({
        amostra_enviada: client.amostra_enviada || false,
        codigo_rastreio: client.codigo_rastreio || '',
        amostra_data_envio: client.amostra_data_envio ? client.amostra_data_envio.split('T')[0] : '',
        amostra_observacao: client.amostra_observacao || '',
      });
    } else if (section === 'resultados') {
      setEditData({
        gmv_geral: client.gmv_geral || 0,
        comissao_organica: client.comissao_organica || 0,
        comissao_trafego: client.comissao_trafego || 0,
        gmv_interno_7d: client.gmv_interno_7d || 0,
        gmv_interno_14d: client.gmv_interno_14d || 0,
        gmv_interno_28d: client.gmv_interno_28d || 0,
        gmv_interno_30d: client.gmv_interno_30d || 0,
        videos_7d: client.videos_7d || 0,
        videos_14d: client.videos_14d || 0,
        videos_28d: client.videos_28d || 0,
        videos_30d: client.videos_30d || 0,
        lives_7d: client.lives_7d || 0,
        lives_14d: client.lives_14d || 0,
        lives_28d: client.lives_28d || 0,
        lives_30d: client.lives_30d || 0,
        produtos_divulgados: client.produtos_divulgados || '',
        tiktok_links: client.tiktok_links || [],
        whatsapp_group_link: client.whatsapp_group_link || '',
      });
    }
  };

  const cancelEdit = () => {
    setEditSection(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const updatePayload: Record<string, unknown> = { ...editData, updated_at: new Date().toISOString() };
      
      if (editSection === 'amostra' && editData.amostra_data_envio) {
        updatePayload.amostra_data_envio = new Date(editData.amostra_data_envio as string).toISOString();
      }
      if (editSection === 'amostra' && !editData.amostra_data_envio) {
        updatePayload.amostra_data_envio = null;
      }

      const { error } = await supabase
        .from('clients')
        .update(updatePayload)
        .eq('id', client.id);

      if (error) throw error;

      await loadClient();
      if (onClientUpdated) await onClientUpdated();
      
      const sectionLabels: Record<string, string> = {
        contato: 'Contato',
        endereco: 'Endereço',
        pix: 'PIX',
        amostra: 'Amostra',
        resultados: 'Resultados',
      };
      setSaveSuccess(sectionLabels[editSection || ''] || 'Dados');
      setEditSection(null);
      setEditData({});
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  if (!deal) return null;

  const stage = stages.find((s) => s.id === deal.stage);
  const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
    high: { label: 'Alta', color: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' },
    medium: { label: 'Média', color: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
    low: { label: 'Baixa', color: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  };
  const priority = priorityConfig[deal.priority] || priorityConfig.medium;

  const formatCurrency = (val: number) =>
    `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hasAddress = client && (client.endereco_cep || client.endereco_rua || client.endereco_cidade);
  const hasPix = client && client.chave_pix;
  const hasSample = client && (client.codigo_rastreio || client.amostra_enviada);

  const fullAddress = client
    ? [
        client.endereco_rua,
        client.endereco_numero ? `nº ${client.endereco_numero}` : '',
        client.endereco_complemento,
        client.endereco_bairro,
        client.endereco_cidade && client.endereco_estado
          ? `${client.endereco_cidade} - ${client.endereco_estado}`
          : client.endereco_cidade || client.endereco_estado,
        client.endereco_cep ? `CEP: ${client.endereco_cep}` : '',
      ].filter(Boolean).join(', ')
    : '';

  const pixTipoLabel: Record<string, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'E-mail',
    telefone: 'Telefone',
    aleatoria: 'Chave Aleatória',
  };

  const gmvData = client
    ? [
        { label: '7 dias', value: client.gmv_interno_7d, field: 'gmv_interno_7d' },
        { label: '14 dias', value: client.gmv_interno_14d, field: 'gmv_interno_14d' },
        { label: '28 dias', value: client.gmv_interno_28d, field: 'gmv_interno_28d' },
        { label: '30 dias', value: client.gmv_interno_30d, field: 'gmv_interno_30d' },
      ]
    : [];

  const videosData = client
    ? [
        { label: '7d', value: client.videos_7d, field: 'videos_7d' },
        { label: '14d', value: client.videos_14d, field: 'videos_14d' },
        { label: '28d', value: client.videos_28d, field: 'videos_28d' },
        { label: '30d', value: client.videos_30d, field: 'videos_30d' },
      ]
    : [];

  const livesData = client
    ? [
        { label: '7d', value: client.lives_7d, field: 'lives_7d' },
        { label: '14d', value: client.lives_14d, field: 'lives_14d' },
        { label: '28d', value: client.lives_28d, field: 'lives_28d' },
        { label: '30d', value: client.lives_30d, field: 'lives_30d' },
      ]
    : [];

  const maxVideos = Math.max(...videosData.map((v) => Number(v.value || 0)), 1);
  const maxLives = Math.max(...livesData.map((v) => Number(v.value || 0)), 1);

  const EditButton = ({ section }: { section: EditSection }) => (
    <button
      onClick={(e) => { e.stopPropagation(); startEdit(section); }}
      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#004aad] hover:bg-[#5de0e6]/10 rounded-md transition-all cursor-pointer whitespace-nowrap"
      title="Editar"
    >
      <i className="ri-pencil-line text-xs"></i>
      Editar
    </button>
  );

  const SaveCancelButtons = () => (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={saveEdit}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#5de0e6] hover:bg-[#004aad] rounded-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
      >
        {saving ? (
          <i className="ri-loader-4-line text-xs animate-spin"></i>
        ) : (
          <i className="ri-check-line text-xs"></i>
        )}
        Salvar
      </button>
      <button
        onClick={cancelEdit}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
      >
        Cancelar
      </button>
    </div>
  );

  const inputClass = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6] transition-all';
  const labelClass = 'text-[11px] font-medium text-gray-500 mb-1 block';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={deal.title}
      subtitle="Detalhes do Acompanhamento"
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <i className="ri-loader-4-line text-3xl text-[#5de0e6] animate-spin"></i>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Toast de sucesso */}
          {saveSuccess && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl animate-[fadeIn_0.2s_ease-out]">
              <i className="ri-check-double-line text-emerald-500"></i>
              <span className="text-sm text-emerald-700 font-medium">{saveSuccess} atualizado com sucesso!</span>
            </div>
          )}

          {/* Header com info do deal */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg">
                  {(deal.client_name || 'N').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {deal.client_name || 'Sem creator'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {stage && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border"
                      style={{
                        backgroundColor: `${stage.color}15`,
                        color: stage.color,
                        borderColor: `${stage.color}30`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }}></span>
                      {stage.label}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${priority.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`}></span>
                    Atenção: {priority.label}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => onEdit(deal), 200);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#004aad] bg-[#5de0e6]/10 hover:bg-[#5de0e6]/20 rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-edit-line text-sm"></i>
              Editar Deal
            </button>
          </div>

          {/* Info rápida do deal */}
          <div className="grid grid-cols-3 gap-3">
            {deal.assigned_name && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Responsável</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 bg-gray-200 rounded-md flex items-center justify-center">
                    <i className="ri-user-line text-[10px] text-gray-500"></i>
                  </div>
                  <span className="text-xs font-medium text-gray-700">{deal.assigned_name}</span>
                </div>
              </div>
            )}
            {deal.supervisor_name && (
              <div className="bg-amber-50/60 rounded-lg p-3">
                <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1">Supervisor</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 bg-amber-100 rounded-md flex items-center justify-center">
                    <i className="ri-shield-user-line text-[10px] text-amber-500"></i>
                  </div>
                  <span className="text-xs font-medium text-amber-700">{deal.supervisor_name}</span>
                </div>
              </div>
            )}
            {deal.expected_close_date && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Previsão</p>
                <div className="flex items-center gap-1.5">
                  <i className="ri-calendar-line text-xs text-gray-400"></i>
                  <span className="text-xs font-medium text-gray-700">
                    {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {deal.tags && deal.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {deal.tags.map((tag) => (
                <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-teal-50 text-teal-600 border border-teal-100">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Descrição */}
          {deal.description && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Descrição</p>
              <p className="text-sm text-gray-600">{deal.description}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => { setActiveTab('info'); cancelEdit(); }}
              className={`flex-1 text-sm font-medium py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'info' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-user-line mr-1.5"></i>
              Endereço / PIX / Amostra
            </button>
            <button
              onClick={() => { setActiveTab('resultados'); cancelEdit(); }}
              className={`flex-1 text-sm font-medium py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'resultados' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-bar-chart-line mr-1.5"></i>
              Resultados
            </button>
            <button
              onClick={() => { setActiveTab('historico'); cancelEdit(); }}
              className={`flex-1 text-sm font-medium py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'historico' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-history-line mr-1.5"></i>
              Histórico
            </button>
            <button
              onClick={() => { setActiveTab('tarefas'); cancelEdit(); }}
              className={`flex-1 text-sm font-medium py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'tarefas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-task-line mr-1.5"></i>
              Tarefas
            </button>
          </div>

          {/* Tab: Info (Endereço / PIX / Amostra) */}
          {activeTab === 'info' && client && (
            <div className="space-y-4">
              {/* Contato */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                  {editSection !== 'contato' ? (
                    <>
                      {client.phone && (
                        <a
                          href={`https://wa.me/${client.phone.replace(/\\D/g, '')}`}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg text-sm text-emerald-700 font-medium transition-all cursor-pointer"
                        >
                          <i className="ri-whatsapp-line text-sm"></i>
                          {client.phone}
                        </a>
                      )}
                      {client.email && (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                          <i className="ri-mail-line text-sm text-gray-400"></i>
                          {client.email}
                        </span>
                      )}
                      {client.cpf_cnpj && (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                          <i className="ri-file-text-line text-sm text-gray-400"></i>
                          <span className="font-mono text-xs">{client.cpf_cnpj}</span>
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
                {editSection !== 'contato' && <EditButton section="contato" />}
              </div>

              {/* Contato - Edição */}
              {editSection === 'contato' && (
                <div className="bg-teal-50/30 border border-teal-100 rounded-xl p-4 space-y-3 animate-[fadeIn_0.15s_ease-out]">
                  <div className="flex items-center gap-2 mb-1">
                    <i className="ri-pencil-line text-xs text-teal-500"></i>
                    <span className="text-xs font-semibold text-teal-700">Editando Contato</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Telefone</label>
                      <input type="text" className={inputClass} value={(editData.phone as string) || ''} onChange={e => updateField('phone', e.target.value)} placeholder="(11) 99999-9999" />
                    </div>
                    <div>
                      <label className={labelClass}>E-mail</label>
                      <input type="email" className={inputClass} value={(editData.email as string) || ''} onChange={e => updateField('email', e.target.value)} placeholder="email@exemplo.com" />
                    </div>
                    <div>
                      <label className={labelClass}>CPF/CNPJ</label>
                      <input type="text" className={inputClass} value={(editData.cpf_cnpj as string) || ''} onChange={e => updateField('cpf_cnpj', e.target.value)} placeholder="000.000.000-00" />
                    </div>
                  </div>
                  <SaveCancelButtons />
                </div>
              )}

              {/* Endereço */}
              <div className={`border rounded-xl p-4 ${hasAddress ? 'bg-sky-50/40 border-sky-100' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <i className={`ri-map-pin-line text-sm ${hasAddress ? 'text-sky-500' : 'text-gray-400'}`}></i>
                    Endereço
                  </h4>
                  {editSection !== 'endereco' && <EditButton section="endereco" />}
                </div>
                {editSection !== 'endereco' ? (
                  hasAddress ? (
                    <p className="text-sm text-gray-600">{fullAddress}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Nenhum endereço cadastrado</p>
                  )
                ) : (
                  <div className="space-y-3 animate-[fadeIn_0.15s_ease-out]">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>CEP</label>
                        <input type="text" className={inputClass} value={(editData.endereco_cep as string) || ''} onChange={e => updateField('endereco_cep', e.target.value)} placeholder="00000-000" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass}>Rua</label>
                        <input type="text" className={inputClass} value={(editData.endereco_rua as string) || ''} onChange={e => updateField('endereco_rua', e.target.value)} placeholder="Nome da rua" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className={labelClass}>Número</label>
                        <input type="text" className={inputClass} value={(editData.endereco_numero as string) || ''} onChange={e => updateField('endereco_numero', e.target.value)} placeholder="Nº" />
                      </div>
                      <div>
                        <label className={labelClass}>Complemento</label>
                        <input type="text" className={inputClass} value={(editData.endereco_complemento as string) || ''} onChange={e => updateField('endereco_complemento', e.target.value)} placeholder="Apto, Bloco..." />
                      </div>
                      <div>
                        <label className={labelClass}>Bairro</label>
                        <input type="text" className={inputClass} value={(editData.endereco_bairro as string) || ''} onChange={e => updateField('endereco_bairro', e.target.value)} placeholder="Bairro" />
                      </div>
                      <div>
                        <label className={labelClass}>Cidade</label>
                        <input type="text" className={inputClass} value={(editData.endereco_cidade as string) || ''} onChange={e => updateField('endereco_cidade', e.target.value)} placeholder="Cidade" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className={labelClass}>Estado</label>
                        <input type="text" className={inputClass} value={(editData.endereco_estado as string) || ''} onChange={e => updateField('endereco_estado', e.target.value)} placeholder="UF" />
                      </div>
                    </div>
                    <SaveCancelButtons />
                  </div>
                )}
              </div>

              {/* PIX */}
              <div className={`border rounded-xl p-4 ${hasPix ? 'bg-emerald-50/40 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <i className={`ri-bank-card-line text-sm ${hasPix ? 'text-emerald-500' : 'text-gray-400'}`}></i>
                    Chave PIX
                  </h4>
                  {editSection !== 'pix' && <EditButton section="pix" />}
                </div>
                {editSection !== 'pix' ? (
                  hasPix ? (
                    <div>
                      {client.chave_pix_tipo && (
                        <p className="text-[11px] text-emerald-600 font-medium mb-1">
                          {pixTipoLabel[client.chave_pix_tipo] || client.chave_pix_tipo}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 font-mono bg-white/60 px-2.5 py-1.5 rounded-lg border border-emerald-100 break-all inline-block">
                        {client.chave_pix}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Nenhuma chave PIX cadastrada</p>
                  )
                ) : (
                  <div className="space-y-3 animate-[fadeIn_0.15s_ease-out]">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Tipo da Chave</label>
                        <select className={inputClass} value={(editData.chave_pix_tipo as string) || ''} onChange={e => updateField('chave_pix_tipo', e.target.value)}>
                          <option value="">Selecione...</option>
                          <option value="cpf">CPF</option>
                          <option value="cnpj">CNPJ</option>
                          <option value="email">E-mail</option>
                          <option value="telefone">Telefone</option>
                          <option value="aleatoria">Chave Aleatória</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Chave PIX</label>
                        <input type="text" className={inputClass} value={(editData.chave_pix as string) || ''} onChange={e => updateField('chave_pix', e.target.value)} placeholder="Informe a chave PIX" />
                      </div>
                    </div>
                    <SaveCancelButtons />
                  </div>
                )}
              </div>

              {/* Amostra */}
              <div className={`border rounded-xl p-4 ${client.amostra_enviada ? 'bg-emerald-50/40 border-emerald-100' : hasSample ? 'bg-amber-50/40 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <i className={`ri-gift-line text-sm ${hasSample ? 'text-amber-500' : 'text-gray-400'}`}></i>
                    Amostra de Produto
                  </h4>
                  <div className="flex items-center gap-1">
                    {editSection !== 'amostra' && deal?.client_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSampleModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-md transition-all cursor-pointer whitespace-nowrap shadow-sm"
                        title="Solicitar Amostra"
                      >
                        <i className="ri-send-plane-line text-xs"></i>
                        Solicitar Amostra
                      </button>
                    )}
                    {editSection !== 'amostra' && <EditButton section="amostra" />}
                  </div>
                </div>
                {editSection !== 'amostra' ? (
                  hasSample ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${client.amostra_enviada ? 'text-emerald-600 bg-emerald-100' : 'text-amber-600 bg-amber-100'}`}>
                          <i className={`text-xs ${client.amostra_enviada ? 'ri-check-line' : 'ri-time-line'}`}></i>
                          {client.amostra_enviada ? 'Enviada' : 'Pendente / Em trânsito'}
                        </span>
                        {client.amostra_data_envio && (
                          <span className="text-[11px] text-gray-500">
                            em {new Date(client.amostra_data_envio).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      {client.codigo_rastreio && (
                        <div className="mt-2">
                          <p className="text-[11px] text-gray-500 mb-0.5">Código de rastreio:</p>
                          <p className="text-xs text-gray-700 font-mono bg-white/60 px-2.5 py-1.5 rounded-lg border border-gray-200 break-all inline-block">
                            {client.codigo_rastreio}
                          </p>
                        </div>
                      )}
                      {client.amostra_observacao && (
                        <p className="text-xs text-gray-500 mt-2 italic">{client.amostra_observacao}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Nenhuma amostra registrada</p>
                  )
                ) : (
                  <div className="space-y-3 animate-[fadeIn_0.15s_ease-out]">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editData.amostra_enviada as boolean) || false}
                          onChange={e => updateField('amostra_enviada', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 font-medium">Amostra enviada</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Código de Rastreio</label>
                        <input type="text" className={inputClass} value={(editData.codigo_rastreio as string) || ''} onChange={e => updateField('codigo_rastreio', e.target.value)} placeholder="Código de rastreio" />
                      </div>
                      <div>
                        <label className={labelClass}>Data de Envio</label>
                        <input type="date" className={inputClass} value={(editData.amostra_data_envio as string) || ''} onChange={e => updateField('amostra_data_envio', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Observação</label>
                      <input type="text" className={inputClass} value={(editData.amostra_observacao as string) || ''} onChange={e => updateField('amostra_observacao', e.target.value)} placeholder="Observação sobre a amostra" />
                    </div>
                    <SaveCancelButtons />
                  </div>
                )}
              </div>

              {/* Pagamento */}
              <PaymentBlock clientId={client.id} clientName={client.name} />

            </div>
          )}

          {/* Tab: Resultados */}
          {activeTab === 'resultados' && client && (
            <div className="space-y-5">
              {/* Botão editar resultados */}
              <div className="flex justify-end">
                {editSection !== 'resultados' && <EditButton section="resultados" />}
              </div>

              {editSection !== 'resultados' ? (
                <>
                  {/* GMV Geral */}
                  <div className="bg-gradient-to-r from-[#5de0e6]/20 to-emerald-50 border border-[#5de0e6]/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#004aad] font-medium">GMV Geral</p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(client.gmv_geral)}</p>
                    </div>
                    <div className="w-12 h-12 bg-[#5de0e6]/20 rounded-xl flex items-center justify-center">
                      <i className="ri-money-dollar-circle-line text-xl text-[#004aad]"></i>
                    </div>
                  </div>

                  {/* Comissões */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Comissão Orgânica</p>
                      <p className="text-xl font-bold text-gray-900">{Number(client.comissao_organica || 0)}%</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Comissão Tráfego</p>
                      <p className="text-xl font-bold text-gray-900">{Number(client.comissao_trafego || 0)}%</p>
                    </div>
                  </div>

                  {/* GMV Interno */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <i className="ri-money-dollar-circle-line text-emerald-500 text-sm"></i>
                      GMV Interno
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      {gmvData.map((item, i) => (
                        <div key={i} className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-center">
                          <p className="text-[11px] text-emerald-600 font-medium mb-1">{item.label}</p>
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(item.value || 0))}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vídeos e Lives */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <i className="ri-video-line text-teal-500 text-sm"></i>
                        Vídeos Feitos
                      </h4>
                      <div className="space-y-2">
                        {videosData.map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-8">{item.label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full flex items-center justify-end pr-2 transition-all"
                                style={{ width: `${Math.max((Number(item.value || 0) / maxVideos) * 100, 8)}%` }}
                              >
                                <span className="text-[10px] font-bold text-white">{Number(item.value || 0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <i className="ri-live-line text-rose-500 text-sm"></i>
                        Lives Feitas
                      </h4>
                      <div className="space-y-2">
                        {livesData.map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-8">{item.label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full flex items-center justify-end pr-2 transition-all"
                                style={{ width: `${Math.max((Number(item.value || 0) / maxLives) * 100, 8)}%` }}
                              >
                                <span className="text-[10px] font-bold text-white">{Number(item.value || 0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Produtos Divulgados */}
                  {client.produtos_divulgados && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <i className="ri-shopping-bag-line text-teal-500 text-sm"></i>
                        Produtos Divulgados
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {client.produtos_divulgados.split(',').map((p, i) => (
                          <span key={i} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-md border border-teal-100">
                            {p.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TikTok Links */}
                  {client.tiktok_links && client.tiktok_links.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <i className="ri-tiktok-line text-gray-800 text-sm"></i>
                        Contas TikTok ({client.tiktok_links.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {client.tiktok_links.map((link, i) => (
                          <a key={i} href={link} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg text-sm text-gray-700 transition-all cursor-pointer">
                            <i className="ri-tiktok-line text-sm"></i>
                            <span className="truncate max-w-[180px]">{link.replace('https://tiktok.com/', '').replace('https://www.tiktok.com/', '')}</span>
                            <i className="ri-external-link-line text-xs text-gray-400"></i>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp Group */}
                  {client.whatsapp_group_link && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <i className="ri-whatsapp-line text-emerald-500 text-sm"></i>
                        Grupo do WhatsApp
                      </h4>
                      <a href={client.whatsapp_group_link} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg text-sm text-emerald-700 font-medium transition-all cursor-pointer">
                        <i className="ri-external-link-line text-sm"></i>
                        Abrir grupo
                      </a>
                    </div>
                  )}
                </>
              ) : (
                /* Edição de Resultados */
                <div className="space-y-4 animate-[fadeIn_0.15s_ease-out]">
                  <div className="flex items-center gap-2 mb-1">
                    <i className="ri-pencil-line text-xs text-teal-500"></i>
                    <span className="text-xs font-semibold text-teal-700">Editando Resultados</span>
                  </div>

                  {/* GMV e Comissões */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>GMV Geral (R$)</label>
                      <input type="number" step="0.01" className={inputClass} value={Number(editData.gmv_geral || 0)} onChange={e => updateField('gmv_geral', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className={labelClass}>Comissão Orgânica (%)</label>
                      <input type="number" step="0.1" className={inputClass} value={Number(editData.comissao_organica || 0)} onChange={e => updateField('comissao_organica', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className={labelClass}>Comissão Tráfego (%)</label>
                      <input type="number" step="0.1" className={inputClass} value={Number(editData.comissao_trafego || 0)} onChange={e => updateField('comissao_trafego', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>

                  {/* GMV Interno */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">GMV Interno (R$)</p>
                    <div className="grid grid-cols-4 gap-3">
                      {gmvData.map((item) => (
                        <div key={item.field}>
                          <label className={labelClass}>{item.label}</label>
                          <input type="number" step="0.01" className={inputClass} value={Number((editData as Record<string, unknown>)[item.field] || 0)} onChange={e => updateField(item.field, parseFloat(e.target.value) || 0)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vídeos */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Vídeos Feitos</p>
                    <div className="grid grid-cols-4 gap-3">
                      {videosData.map((item) => (
                        <div key={item.field}>
                          <label className={labelClass}>{item.label}</label>
                          <input type="number" className={inputClass} value={Number((editData as Record<string, unknown>)[item.field] || 0)} onChange={e => updateField(item.field, parseInt(e.target.value) || 0)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lives */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Lives Feitas</p>
                    <div className="grid grid-cols-4 gap-3">
                      {livesData.map((item) => (
                        <div key={item.field}>
                          <label className={labelClass}>{item.label}</label>
                          <input type="number" className={inputClass} value={Number((editData as Record<string, unknown>)[item.field] || 0)} onChange={e => updateField(item.field, parseInt(e.target.value) || 0)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Produtos e Links */}
                  <div>
                    <label className={labelClass}>Produtos Divulgados (separados por vírgula)</label>
                    <input type="text" className={inputClass} value={(editData.produtos_divulgados as string) || ''} onChange={e => updateField('produtos_divulgados', e.target.value)} placeholder="Produto 1, Produto 2, ..." />
                  </div>

                  <div>
                    <label className={labelClass}>Link do Grupo WhatsApp</label>
                    <input type="text" className={inputClass} value={(editData.whatsapp_group_link as string) || ''} onChange={e => updateField('whatsapp_group_link', e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                  </div>

                  <div>
                    <label className={labelClass}>Contas TikTok (uma por linha)</label>
                    <textarea
                      className={`${inputClass} min-h-[80px]`}
                      value={((editData.tiktok_links as string[]) || []).join('\n')}
                      onChange={e => updateField('tiktok_links', e.target.value.split('\n').filter(l => l.trim()))}
                      placeholder={"https://www.tiktok.com/@usuario1\nhttps://www.tiktok.com/@usuario2"}
                    />
                  </div>

                  <SaveCancelButtons />
                </div>
              )}
            </div>
          )}

          {/* Tab: Histórico */}
          {activeTab === 'historico' && (
            <HistoryTimeline
              history={history}
              loading={loadingHistory}
              clientCreatedAt={client?.created_at || null}
              dealCreatedAt={deal.created_at}
              dealTitle={deal.title}
              clientName={deal.client_name || null}
            />
          )}

          {/* Tab: Tarefas */}
          {activeTab === 'tarefas' && (
            <DealTasksSection
              dealId={deal.id}
              clientId={deal.client_id}
              dealTitle={deal.title}
            />
          )}

          {/* Sem creator vinculado */}
          {!client && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                <i className="ri-user-unfollow-line text-2xl"></i>
              </div>
              <p className="text-sm font-medium">Nenhum creator vinculado</p>
              <p className="text-xs text-gray-300 mt-1">Edite o acompanhamento para vincular um creator</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Solicitar Amostra */}
      {deal && deal.client_id && (
        <RequestSampleModal
          isOpen={showSampleModal}
          onClose={() => setShowSampleModal(false)}
          clientId={deal.client_id}
          dealId={deal.id}
          dealTitle={deal.title}
          onSuccess={async () => {
            await loadClient();
            if (onClientUpdated) await onClientUpdated();
          }}
        />
      )}
    </Modal>
  );
}
/* ─── HistoryTimeline component ─── */
interface HistoryTimelineProps {
  history: {
    id: string; action: string; module: string;
    entity_name: string | null; user_name: string | null;
    user_email: string | null; details: Record<string, any> | null;
    created_at: string; source: 'deal' | 'creator' | 'form';
  }[];
  loading: boolean;
  clientCreatedAt: string | null;
  dealCreatedAt: string;
  dealTitle: string;
  clientName: string | null;
}

function HistoryTimeline({ history, loading, clientCreatedAt, dealCreatedAt, dealTitle, clientName }: HistoryTimelineProps) {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getEventConfig = (event: HistoryTimelineProps['history'][0]) => {
    // Deal events
    if (event.source === 'deal') {
      const isMove = event.details?.action === 'move_stage';
      if (isMove) return {
        icon: 'ri-arrow-right-circle-line',
        color: 'text-[#004aad] bg-[#004aad]/10 border-[#004aad]/20',
        dot: 'bg-[#004aad]',
        label: `Movido para "${event.details?.to || 'nova etapa'}"`,
        sub: event.details?.from ? `Antes: ${event.details.from}` : null,
      };
      if (event.action === 'create') return {
        icon: 'ri-kanban-view',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        dot: 'bg-emerald-500',
        label: 'Acompanhamento criado no funil',
        sub: dealTitle,
      };
      if (event.action === 'update') return {
        icon: 'ri-edit-line',
        color: 'text-amber-700 bg-amber-50 border-amber-100',
        dot: 'bg-amber-500',
        label: 'Acompanhamento atualizado',
        sub: null,
      };
      if (event.action === 'delete') return {
        icon: 'ri-delete-bin-line',
        color: 'text-rose-700 bg-rose-50 border-rose-100',
        dot: 'bg-rose-500',
        label: 'Acompanhamento removido',
        sub: null,
      };
    }

    // Creator/client events
    if (event.source === 'creator') {
      if (event.action === 'create') return {
        icon: 'ri-user-add-line',
        color: 'text-teal-700 bg-teal-50 border-teal-100',
        dot: 'bg-teal-500',
        label: 'Creator cadastrado no sistema',
        sub: event.entity_name,
      };
      // Detectar campos alterados
      const before = event.details?.before || {};
      const after = event.details?.after || {};
      const changedFields: string[] = [];
      const fieldLabels: Record<string, string> = {
        name: 'Nome', phone: 'Telefone', email: 'E-mail', cpf_cnpj: 'CPF/CNPJ',
        platform: 'Plataforma', category: 'Categoria', status: 'Status',
        gmv_geral: 'GMV Geral', comissao_organica: 'Comissão Orgânica', comissao_trafego: 'Comissão Tráfego',
        chave_pix: 'Chave PIX', chave_pix_tipo: 'Tipo PIX',
        endereco_cep: 'CEP', amostra_enviada: 'Amostra', codigo_rastreio: 'Rastreio',
        instagram_profile: 'Instagram', youtube_canal: 'YouTube', tiktok_links: 'TikTok',
        produtos_divulgados: 'Produtos', whatsapp_group_link: 'Grupo WhatsApp',
      };
      for (const key of Object.keys(fieldLabels)) {
        const bv = JSON.stringify(before[key]), av = JSON.stringify(after[key]);
        if (bv !== av && av !== undefined) changedFields.push(fieldLabels[key]);
      }
      return {
        icon: 'ri-user-settings-line',
        color: 'text-purple-700 bg-purple-50 border-purple-100',
        dot: 'bg-purple-500',
        label: `Dados atualizados`,
        sub: changedFields.length > 0 ? changedFields.slice(0, 4).join(', ') + (changedFields.length > 4 ? ` +${changedFields.length - 4}` : '') : null,
      };
    }

    // Form submission
    if (event.source === 'form') {
      return {
        icon: 'ri-survey-line',
        color: 'text-sky-700 bg-sky-50 border-sky-100',
        dot: 'bg-sky-500',
        label: 'Formulário preenchido',
        sub: event.entity_name || null,
      };
    }

    return {
      icon: 'ri-information-line',
      color: 'text-gray-500 bg-gray-50 border-gray-100',
      dot: 'bg-gray-400',
      label: event.action,
      sub: null,
    };
  };

  // Descobrir a origem da criação do creator (formulário ou manual)
  const creatorCreatedByForm = history.some(e => e.source === 'form' && e.action === 'create');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <i className="ri-loader-4-line text-2xl text-[#5de0e6] animate-spin"></i>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header de resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-r from-[#004aad]/5 to-[#5de0e6]/5 border border-[#5de0e6]/20 rounded-xl p-3.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Creator desde</p>
          <p className="text-sm font-bold text-gray-900">
            {clientCreatedAt ? formatDate(clientCreatedAt) : '—'}
          </p>
          {clientName && <p className="text-[11px] text-gray-500 mt-0.5">{clientName}</p>}
          <div className="flex items-center gap-1 mt-1.5">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${creatorCreatedByForm ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <i className={`${creatorCreatedByForm ? 'ri-survey-line' : 'ri-user-add-line'} mr-0.5`}></i>
              {creatorCreatedByForm ? 'Via formulário' : 'Cadastro manual'}
            </span>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Acompanhamento criado</p>
          <p className="text-sm font-bold text-gray-900">{formatDate(dealCreatedAt)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">{dealTitle}</p>
          <p className="text-[10px] text-gray-400 mt-1.5">
            <i className="ri-list-check mr-0.5"></i>
            {history.length} {history.length === 1 ? 'evento' : 'eventos'} registrados
          </p>
        </div>
      </div>

      {/* Timeline */}
      {history.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-history-line text-2xl text-gray-200"></i>
          </div>
          <p className="text-sm font-medium text-gray-400">Nenhum evento registrado</p>
          <p className="text-xs text-gray-300 mt-1">As ações futuras aparecerão aqui</p>
        </div>
      ) : (
        <div className="relative">
          {/* Linha vertical da timeline */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-100"></div>

          <div className="space-y-1">
            {history.map((event, idx) => {
              const cfg = getEventConfig(event);
              const isFirst = idx === 0;
              // Verificar se precisa mostrar separador de data
              const prevDate = idx > 0 ? formatDate(history[idx - 1].created_at) : null;
              const currDate = formatDate(event.created_at);
              const showDateDivider = prevDate !== currDate;

              return (
                <div key={event.id}>
                  {showDateDivider && idx > 0 && (
                    <div className="flex items-center gap-3 my-3 pl-10">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{currDate}</span>
                      <div className="flex-1 h-px bg-gray-100"></div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 relative">
                    {/* Dot na timeline */}
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 z-10 ${cfg.color}`}>
                      <i className={`${cfg.icon} text-sm`}></i>
                    </div>

                    {/* Conteúdo */}
                    <div className={`flex-1 min-w-0 pb-3 ${idx < history.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 leading-snug">{cfg.label}</p>
                          {cfg.sub && (
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{cfg.sub}</p>
                          )}
                          {/* Quem fez */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {event.user_name ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                <i className="ri-user-line text-[9px]"></i>
                                {event.user_name}
                              </span>
                            ) : event.source === 'form' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-md">
                                <i className="ri-survey-line text-[9px]"></i>
                                Preenchido pelo creator
                              </span>
                            ) : null}
                            <span className="text-[10px] text-gray-400">
                              {formatDateTime(event.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Marco final: creator entrou no sistema */}
            {clientCreatedAt && (
              <div className="flex items-start gap-3 relative mt-2">
                <div className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 z-10 text-teal-700 bg-teal-50 border-teal-100">
                  <i className="ri-user-star-line text-sm"></i>
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-sm font-medium text-gray-800">Creator entrou no sistema</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{clientName || '—'}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">{formatDateTime(clientCreatedAt)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

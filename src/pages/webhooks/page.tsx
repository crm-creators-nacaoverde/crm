import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import { useWebhookEndpoints, type WebhookEndpoint, type WebhookLog } from '../../hooks/useWebhookEndpoints';
import { useFunnels } from '../../hooks/useFunnels';
import { useFunnelStages } from '../../hooks/useFunnelStages';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const DUPLICATE_OPTIONS = [
  { value: 'ignore', label: 'Ignorar duplicatas',   desc: 'Lead existente nao e modificado',        icon: 'ri-shield-line' },
  { value: 'update', label: 'Atualizar duplicatas', desc: 'Atualiza dados do creator existente',    icon: 'ri-refresh-line' },
  { value: 'allow',  label: 'Permitir duplicatas',  desc: 'Cria novo creator mesmo se ja existir', icon: 'ri-add-circle-line' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  received:  { label: 'Recebido',   color: 'text-gray-600 bg-gray-100',      icon: 'ri-download-line' },
  created:   { label: 'Criado',     color: 'text-emerald-700 bg-emerald-100', icon: 'ri-user-add-line' },
  updated:   { label: 'Atualizado', color: 'text-blue-700 bg-blue-100',       icon: 'ri-refresh-line' },
  duplicate: { label: 'Duplicata',  color: 'text-amber-700 bg-amber-100',     icon: 'ri-git-branch-line' },
  error:     { label: 'Erro',       color: 'text-rose-700 bg-rose-100',       icon: 'ri-error-warning-line' },
};

const CRM_FIELDS = [
  { value: 'name',              label: 'Nome' },
  { value: 'phone',             label: 'Telefone / WhatsApp' },
  { value: 'email',             label: 'E-mail' },
  { value: 'cpf_cnpj',         label: 'CPF / CNPJ' },
  { value: 'followers',        label: 'Seguidores' },
  { value: 'chave_pix',        label: 'Chave PIX' },
  { value: 'chave_pix_tipo',   label: 'Tipo de PIX' },
  { value: 'platform',         label: 'Plataforma' },
  { value: 'category',         label: 'Categoria' },
  { value: 'notes',            label: 'Observacoes' },
  { value: 'instagram_profile', label: 'Instagram' },
  { value: 'youtube_canal',    label: 'YouTube' },
  { value: 'tiktok_links',     label: 'Link TikTok' },
];

// HOOK PRINCIPAL DA CORRECAO: busca fontes dinamicamente do banco
function useCaptureSources() {
  const [sources, setSources] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from('capture_sources')
      .select('name')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setSources((data || []).map((s: { name: string }) => s.name)));
  }, []);
  return sources;
}

export default function WebhooksPage() {
  const { hasPermission } = useAuth();
  const { endpoints, loading, fetchEndpoints, toggleEndpoint, deleteEndpoint, getWebhookUrl } = useWebhookEndpoints();
  const captureSources = useCaptureSources();
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [logsFor, setLogsFor] = useState<WebhookEndpoint | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const canEdit = hasPermission('forms', 'edit');

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(getWebhookUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteEndpoint(deletingId);
    setDeletingId(null);
  };

  const filtered = endpoints.filter(ep => {
    const matchSearch = !search ||
      ep.name.toLowerCase().includes(search.toLowerCase()) ||
      ep.form_name?.toLowerCase().includes(search.toLowerCase()) ||
      ep.funnel_name?.toLowerCase().includes(search.toLowerCase());
    const matchSource = filterSource === 'all' || ep.source_label === filterSource;
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' ? ep.is_active : !ep.is_active);
    return matchSearch && matchSource && matchStatus;
  });

  const totalActive   = endpoints.filter(e => e.is_active).length;
  const totalInactive = endpoints.filter(e => !e.is_active).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="ri-webhook-line text-violet-600"></i>Webhooks
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Receba leads automaticamente de fontes externas</p>
          </div>
          {canEdit && (
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl cursor-pointer transition-colors shadow-sm">
              <i className="ri-add-line"></i>Novo Webhook
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',    value: endpoints.length,      icon: 'ri-webhook-line',         bg: 'bg-violet-50',  ic: 'text-violet-600' },
            { label: 'Ativos',   value: totalActive,            icon: 'ri-checkbox-circle-line', bg: 'bg-emerald-50', ic: 'text-emerald-600' },
            { label: 'Inativos', value: totalInactive,          icon: 'ri-pause-circle-line',    bg: 'bg-amber-50',   ic: 'text-amber-600' },
            { label: 'Fontes',   value: captureSources.length,  icon: 'ri-git-branch-line',      bg: 'bg-blue-50',    ic: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <i className={`${s.icon} text-lg ${s.ic}`}></i>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input type="text" placeholder="Buscar por nome, formulario ou funil..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400" />
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none cursor-pointer appearance-none bg-white">
                <option value="all">Todas as fontes</option>
                {captureSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                {[{ v: 'all', l: 'Todos' }, { v: 'active', l: 'Ativos' }, { v: 'inactive', l: 'Inativos' }].map(opt => (
                  <button key={opt.v} onClick={() => setFilterStatus(opt.v)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap
                      ${filterStatus === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <i className="ri-loader-4-line text-3xl text-violet-400 animate-spin"></i>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
              <i className="ri-webhook-line text-3xl text-violet-300"></i>
            </div>
            {endpoints.length === 0 ? (
              <>
                <p className="text-sm font-semibold text-gray-700 mb-1">Nenhum webhook configurado</p>
                <p className="text-xs text-gray-400 mb-5 max-w-xs">Crie um webhook para receber leads automaticamente</p>
                {canEdit && (
                  <button onClick={() => { setEditing(null); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl cursor-pointer transition-colors">
                    <i className="ri-add-line"></i>Criar primeiro webhook
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm font-medium text-gray-600">Nenhum resultado — ajuste os filtros</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ep => (
              <div key={ep.id} className={`bg-white rounded-xl border transition-all
                ${ep.is_active ? 'border-gray-100 hover:border-violet-200 hover:shadow-sm' : 'border-gray-100 opacity-60'}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ep.is_active ? 'bg-violet-50' : 'bg-gray-100'}`}>
                        <i className={`ri-webhook-line text-lg ${ep.is_active ? 'text-violet-600' : 'text-gray-400'}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-bold text-gray-900">{ep.name}</h3>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                            ${ep.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                            {ep.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                          {ep.source_label && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              {ep.source_label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 mb-2">
                          {ep.funnel_name && (
                            <span className="flex items-center gap-1">
                              <i className="ri-kanban-view text-[10px]"></i>
                              {ep.funnel_name}{ep.stage_label ? ` -> ${ep.stage_label}` : ''}
                            </span>
                          )}
                          {ep.assigned_name && (
                            <span className="flex items-center gap-1">
                              <i className="ri-user-line text-[10px]"></i>{ep.assigned_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <i className="ri-shield-line text-[10px]"></i>
                            {DUPLICATE_OPTIONS.find(d => d.value === ep.duplicate_mode)?.label || ep.duplicate_mode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <i className="ri-links-line text-gray-400 text-xs flex-shrink-0"></i>
                          <code className="text-[11px] font-mono text-gray-600 truncate flex-1">{getWebhookUrl(ep.token)}</code>
                          <button onClick={() => handleCopy(ep.token)}
                            className="flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-800 cursor-pointer whitespace-nowrap transition-colors flex-shrink-0">
                            <i className={`${copied === ep.token ? 'ri-check-line text-emerald-500' : 'ri-file-copy-line'} text-xs`}></i>
                            {copied === ep.token ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleEndpoint(ep.id, !ep.is_active)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all
                          ${ep.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title={ep.is_active ? 'Pausar' : 'Ativar'}>
                        <i className={`${ep.is_active ? 'ri-pause-line' : 'ri-play-line'} text-sm`}></i>
                      </button>
                      <button onClick={() => setLogsFor(ep)}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg cursor-pointer transition-all" title="Ver logs">
                        <i className="ri-list-check text-sm"></i>
                      </button>
                      {canEdit && (
                        <button onClick={() => { setEditing(ep); setShowForm(true); }}
                          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-lg cursor-pointer transition-all" title="Editar">
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => setDeletingId(ep.id)}
                          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all" title="Excluir">
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  {Object.keys(ep.field_mapping || {}).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Mapeamento</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(ep.field_mapping).slice(0, 6).map(([src, crm]) => (
                          <span key={src} className="inline-flex items-center gap-1 text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                            {src} <i className="ri-arrow-right-line text-[9px] text-gray-400"></i> {crm}
                          </span>
                        ))}
                        {Object.keys(ep.field_mapping).length > 6 && (
                          <span className="text-[10px] text-gray-400 px-2 py-0.5">+{Object.keys(ep.field_mapping).length - 6} campos</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <WebhookFormModal
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => fetchEndpoints()}
          editing={editing}
          captureSources={captureSources}
        />
      )}

      {logsFor && <LogsDrawer endpoint={logsFor} onClose={() => setLogsFor(null)} />}

      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-rose-50 rounded-xl flex items-center justify-center">
                <i className="ri-delete-bin-line text-rose-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Excluir webhook</p>
                <p className="text-xs text-gray-500">Todos os logs tambem serao excluidos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function WebhookFormModal({ isOpen, onClose, onSaved, editing, captureSources }: {
  isOpen: boolean; onClose: () => void; onSaved: () => void;
  editing: WebhookEndpoint | null; captureSources: string[];
}) {
  const { createEndpoint, updateEndpoint } = useWebhookEndpoints();
  const { funnels } = useFunnels();
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const { stages } = useFunnelStages(selectedFunnelId || undefined);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [forms, setForms] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'mapping'>('config');
  const [mappingRows, setMappingRows] = useState<{ source: string; crm: string }[]>([
    { source: 'nome', crm: 'name' },
    { source: 'telefone', crm: 'phone' },
    { source: 'email', crm: 'email' },
  ]);
  const defaultSource = captureSources.find(s => s === 'Webhook') || captureSources[0] || '';
  const [form, setForm] = useState({
    name: 'Novo Webhook', source_label: defaultSource,
    form_id: '', form_name: '', funnel_id: '', funnel_name: '',
    stage_id: '', stage_label: '', assigned_to: '', assigned_name: '',
    duplicate_mode: 'ignore' as 'ignore' | 'update' | 'allow', is_active: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    supabase.from('user_profiles').select('id, full_name').eq('is_active', true).order('full_name')
      .then(({ data }) => setUsers(data || []));
    supabase.from('form_templates').select('id, name').order('name')
      .then(({ data }) => setForms(data || []));
    if (editing) {
      setForm({
        name: editing.name, source_label: editing.source_label || defaultSource,
        form_id: editing.form_id || '', form_name: editing.form_name || '',
        funnel_id: editing.funnel_id || '', funnel_name: editing.funnel_name || '',
        stage_id: editing.stage_id || '', stage_label: editing.stage_label || '',
        assigned_to: editing.assigned_to || '', assigned_name: editing.assigned_name || '',
        duplicate_mode: editing.duplicate_mode, is_active: editing.is_active,
      });
      setSelectedFunnelId(editing.funnel_id || '');
      const rows = Object.entries(editing.field_mapping || {}).map(([source, crm]) => ({ source, crm }));
      if (rows.length > 0) setMappingRows(rows);
    } else {
      setForm(p => ({ ...p, name: 'Novo Webhook', source_label: defaultSource,
        form_id: '', form_name: '', funnel_id: '', funnel_name: '',
        stage_id: '', stage_label: '', assigned_to: '', assigned_name: '',
        duplicate_mode: 'ignore', is_active: true }));
      setSelectedFunnelId('');
      setMappingRows([{ source: 'nome', crm: 'name' }, { source: 'telefone', crm: 'phone' }, { source: 'email', crm: 'email' }]);
    }
    setActiveTab('config');
  }, [isOpen, editing]);

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300/40 focus:border-violet-400 bg-white transition-all';
  const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ff = forms.find(f => f.id === form.form_id);
    const params = {
      name: form.name, source_label: form.source_label,
      form_id: form.form_id || undefined, form_name: ff?.name || 'Sem formulario',
      funnel_id: form.funnel_id || undefined, funnel_name: form.funnel_name || undefined,
      stage_id: form.stage_id || undefined, stage_label: form.stage_label || undefined,
      assigned_to: form.assigned_to || undefined, assigned_name: form.assigned_name || undefined,
      duplicate_mode: form.duplicate_mode,
      field_mapping: Object.fromEntries(mappingRows.filter(r => r.source.trim()).map(r => [r.source.trim(), r.crm])),
      is_active: form.is_active,
    };
    if (editing) await updateEndpoint(editing.id, params);
    else await createEndpoint(params);
    setSaving(false); onSaved(); onClose();
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
              <i className="ri-webhook-line text-violet-600 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{editing ? 'Editar Webhook' : 'Novo Webhook'}</p>
              <p className="text-[11px] text-gray-400">Configure como receber leads externos</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>
        <div className="flex gap-1 px-6 pt-3 flex-shrink-0">
          {[{ id: 'config', label: 'Configuracao', icon: 'ri-settings-3-line' }, { id: 'mapping', label: 'Mapeamento', icon: 'ri-git-branch-line' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${activeTab === tab.id ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${tab.icon} text-sm`}></i>{tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Nome do Webhook</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Fonte de Captura</label>
                  <select value={form.source_label} onChange={e => setForm(p => ({ ...p, source_label: e.target.value }))} className={inp}>
                    <option value="">Selecione uma fonte...</option>
                    {captureSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Formulario vinculado <span className="text-gray-400 font-normal normal-case">(opcional)</span></label>
                <select value={form.form_id} onChange={e => { const f = forms.find(f => f.id === e.target.value); setForm(p => ({ ...p, form_id: e.target.value, form_name: f?.name || '' })); }} className={inp}>
                  <option value="">Sem formulario especifico</option>
                  {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><i className="ri-kanban-view text-[#004aad]"></i>Destino no Kanban</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Funil</label>
                    <select value={form.funnel_id} onChange={e => { const f = funnels.find(f => f.id === e.target.value); setSelectedFunnelId(e.target.value); setForm(p => ({ ...p, funnel_id: e.target.value, funnel_name: f?.name || '', stage_id: '', stage_label: '' })); }} className={inp}>
                      <option value="">Selecione o funil...</option>
                      {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Etapa inicial</label>
                    <select value={form.stage_id} onChange={e => { const s = stages.find(s => s.id === e.target.value); setForm(p => ({ ...p, stage_id: e.target.value, stage_label: s?.label || '' })); }} disabled={!form.funnel_id} className={`${inp} disabled:opacity-50`}>
                      <option value="">Selecione a etapa...</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Responsavel automatico</label>
                  <select value={form.assigned_to} onChange={e => { const u = users.find(u => u.id === e.target.value); setForm(p => ({ ...p, assigned_to: e.target.value, assigned_name: u?.full_name || '' })); }} className={inp}>
                    <option value="">Sem responsavel</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Comportamento para duplicatas</label>
                <div className="space-y-2">
                  {DUPLICATE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm(p => ({ ...p, duplicate_mode: opt.value as any }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${form.duplicate_mode === opt.value ? 'border-violet-400 bg-violet-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                      <i className={`${opt.icon} text-lg mt-0.5 ${form.duplicate_mode === opt.value ? 'text-violet-600' : 'text-gray-400'}`}></i>
                      <div>
                        <p className={`text-sm font-medium ${form.duplicate_mode === opt.value ? 'text-violet-800' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl">
                <div><p className="text-sm font-medium text-gray-700">Webhook ativo</p><p className="text-[11px] text-gray-400">Desative para pausar temporariamente</p></div>
                <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))} className="cursor-pointer">
                  <div className={`w-11 h-6 rounded-full transition-all relative ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`}></div>
                  </div>
                </button>
              </div>
            </div>
          )}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex items-start gap-2.5">
                <i className="ri-information-line text-amber-500 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-medium text-amber-800">Como funciona</p>
                  <p className="text-xs text-amber-600 mt-1">Campo da fonte: nome exato da chave no JSON. Campo no CRM: onde salvar no creator. Suporte a aninhamento: field_data.0.values.0</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 px-1">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Campo da fonte (JSON)</p>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Campo no CRM</p>
              </div>
              <div className="space-y-2">
                {mappingRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 items-center">
                    <input type="text" value={row.source} onChange={e => setMappingRows(prev => prev.map((r, idx) => idx === i ? { ...r, source: e.target.value } : r))} placeholder="ex: lead_name" className={`${inp} font-mono text-xs`} />
                    <div className="flex items-center gap-2">
                      <select value={row.crm} onChange={e => setMappingRows(prev => prev.map((r, idx) => idx === i ? { ...r, crm: e.target.value } : r))} className={inp}>
                        {CRM_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <button onClick={() => setMappingRows(prev => prev.filter((_, idx) => idx !== i))} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-all flex-shrink-0">
                        <i className="ri-close-line text-sm"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setMappingRows(prev => [...prev, { source: '', crm: 'name' }])} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 rounded-lg cursor-pointer transition-colors">
                <i className="ri-add-line text-sm"></i>Adicionar campo
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</> : <><i className="ri-save-line"></i>{editing ? 'Salvar alteracoes' : 'Criar Webhook'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogsDrawer({ endpoint, onClose }: { endpoint: WebhookEndpoint; onClose: () => void }) {
  const { logs, fetchLogs } = useWebhookEndpoints();
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetchLogs(endpoint.id, 100).then(() => setLoading(false)); }, [endpoint.id]);
  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div><p className="text-sm font-bold text-gray-900">Logs - {endpoint.name}</p><p className="text-[11px] text-gray-400">Ultimas 100 chamadas</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchLogs(endpoint.id, 100)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><i className="ri-refresh-line text-sm"></i>Atualizar</button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer"><i className="ri-close-line text-gray-500"></i></button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 px-6 py-3 border-b border-gray-100 flex-shrink-0">
          {[{ label: 'Total', value: logs.length, color: 'text-gray-700' }, { label: 'Criados', value: logs.filter(l => l.status === 'created').length, color: 'text-emerald-700' }, { label: 'Duplicatas', value: logs.filter(l => l.status === 'duplicate').length, color: 'text-amber-700' }, { label: 'Erros', value: logs.filter(l => l.status === 'error').length, color: 'text-rose-700' }].map(s => (
            <div key={s.label} className="text-center"><p className={`text-lg font-bold ${s.color}`}>{s.value}</p><p className="text-[10px] text-gray-400">{s.label}</p></div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? <div className="flex items-center justify-center py-12"><i className="ri-loader-4-line text-2xl text-violet-400 animate-spin"></i></div> :
           logs.length === 0 ? <div className="flex flex-col items-center justify-center py-16"><i className="ri-inbox-line text-2xl text-gray-300 mb-2"></i><p className="text-sm text-gray-400">Nenhuma chamada ainda</p></div> :
           logs.map(log => {
             const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.received;
             return (
               <details key={log.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden group">
                 <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none">
                   <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${cfg.color}`}><i className={`${cfg.icon} text-[10px]`}></i>{cfg.label}</span>
                   <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{log.client_name || 'Lead nao identificado'}</p>{log.error_message && <p className="text-[11px] text-rose-500 truncate">{log.error_message}</p>}</div>
                   <span className="text-[11px] text-gray-400 flex-shrink-0">{fmt(log.created_at)}</span>
                   <i className="ri-arrow-down-s-line text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0"></i>
                 </summary>
                 <div className="border-t border-gray-100 px-4 py-3">
                   {log.client_id && <p className="text-xs text-gray-500 font-mono mb-2">Creator: {log.client_id}</p>}
                   <pre className="text-[11px] font-mono text-gray-700 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-40">{JSON.stringify(log.payload, null, 2)}</pre>
                 </div>
               </details>
             );
           })}
        </div>
      </div>
    </div>
  );
}

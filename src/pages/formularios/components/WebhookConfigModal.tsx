// src/pages/formularios/components/WebhookConfigModal.tsx
import { useState, useEffect } from 'react';
import { useWebhookEndpoints, type WebhookEndpoint } from '../../../hooks/useWebhookEndpoints';
import { useFunnels } from '../../../hooks/useFunnels';
import { useFunnelStages } from '../../../hooks/useFunnelStages';
import { supabase } from '../../../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formName: string;
  editingEndpoint?: WebhookEndpoint | null;
}

// Campos CRM disponíveis para mapeamento
const CRM_FIELDS = [
  { value: 'name',           label: 'Nome' },
  { value: 'phone',          label: 'Telefone / WhatsApp' },
  { value: 'email',          label: 'E-mail' },
  { value: 'cpf_cnpj',      label: 'CPF / CNPJ' },
  { value: 'chave_pix',     label: 'Chave PIX' },
  { value: 'chave_pix_tipo',label: 'Tipo de PIX' },
  { value: 'platform',      label: 'Plataforma' },
  { value: 'category',      label: 'Categoria' },
  { value: 'notes',         label: 'Observações' },
  { value: 'instagram_profile', label: 'Instagram' },
  { value: 'youtube_canal', label: 'YouTube' },
];

const SOURCE_OPTIONS = [
  { value: 'Genérico',         label: 'Genérico / Outro' },
  { value: 'Facebook Lead Ads',label: 'Facebook Lead Ads' },
  { value: 'RD Station',       label: 'RD Station' },
  { value: 'Typeform',         label: 'Typeform (via Zapier)' },
  { value: 'Zapier',           label: 'Zapier' },
  { value: 'Make',             label: 'Make (Integromat)' },
  { value: 'ActiveCampaign',   label: 'ActiveCampaign' },
];

const DUPLICATE_OPTIONS = [
  { value: 'ignore', label: 'Ignorar duplicatas',         desc: 'Lead já existente não é modificado' },
  { value: 'update', label: 'Atualizar duplicatas',       desc: 'Atualiza telefone/e-mail do creator existente' },
  { value: 'allow',  label: 'Permitir duplicatas',        desc: 'Cria novo creator mesmo se já existir' },
];

export default function WebhookConfigModal({ isOpen, onClose, formId, formName, editingEndpoint }: Props) {
  const { createEndpoint, updateEndpoint, getWebhookUrl } = useWebhookEndpoints(formId);
  const { funnels } = useFunnels();
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const { stages } = useFunnelStages(selectedFunnelId || undefined);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  const [saving, setSaving]       = useState(false);
  const [copied, setCopied]       = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'mapping'>('config');

  // Mapeamento de campos: array de pares [campoFonte, campoCRM]
  const [mappingRows, setMappingRows] = useState<{ source: string; crm: string }[]>([
    { source: 'nome', crm: 'name' },
    { source: 'telefone', crm: 'phone' },
    { source: 'email', crm: 'email' },
  ]);

  const [form, setForm] = useState({
    name:           'Webhook Principal',
    source_label:   'Genérico',
    funnel_id:      '',
    funnel_name:    '',
    stage_id:       '',
    stage_label:    '',
    assigned_to:    '',
    assigned_name:  '',
    duplicate_mode: 'ignore' as 'ignore' | 'update' | 'allow',
    is_active:      true,
  });

  useEffect(() => {
    if (!isOpen) return;
    loadUsers();
    if (editingEndpoint) {
      setForm({
        name:           editingEndpoint.name,
        source_label:   editingEndpoint.source_label || 'Genérico',
        funnel_id:      editingEndpoint.funnel_id || '',
        funnel_name:    editingEndpoint.funnel_name || '',
        stage_id:       editingEndpoint.stage_id || '',
        stage_label:    editingEndpoint.stage_label || '',
        assigned_to:    editingEndpoint.assigned_to || '',
        assigned_name:  editingEndpoint.assigned_name || '',
        duplicate_mode: editingEndpoint.duplicate_mode,
        is_active:      editingEndpoint.is_active,
      });
      setSelectedFunnelId(editingEndpoint.funnel_id || '');
      const rows = Object.entries(editingEndpoint.field_mapping || {}).map(([source, crm]) => ({ source, crm }));
      if (rows.length > 0) setMappingRows(rows);
    } else {
      setForm({
        name: 'Webhook Principal', source_label: 'Genérico',
        funnel_id: '', funnel_name: '', stage_id: '', stage_label: '',
        assigned_to: '', assigned_name: '', duplicate_mode: 'ignore', is_active: true,
      });
      setSelectedFunnelId('');
      setMappingRows([
        { source: 'nome', crm: 'name' },
        { source: 'telefone', crm: 'phone' },
        { source: 'email', crm: 'email' },
      ]);
    }
    setActiveTab('config');
  }, [isOpen, editingEndpoint]);

  const loadUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id, full_name').eq('is_active', true).order('full_name');
    setUsers(data || []);
  };

  const handleFunnelChange = (funnelId: string) => {
    const funnel = funnels.find(f => f.id === funnelId);
    setSelectedFunnelId(funnelId);
    setForm(p => ({ ...p, funnel_id: funnelId, funnel_name: funnel?.name || '', stage_id: '', stage_label: '' }));
  };

  const handleStageChange = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    setForm(p => ({ ...p, stage_id: stageId, stage_label: stage?.label || '' }));
  };

  const handleUserChange = (userId: string) => {
    const user = users.find(u => u.id === userId);
    setForm(p => ({ ...p, assigned_to: userId, assigned_name: user?.full_name || '' }));
  };

  const addMappingRow = () => setMappingRows(prev => [...prev, { source: '', crm: 'name' }]);
  const removeMappingRow = (i: number) => setMappingRows(prev => prev.filter((_, idx) => idx !== i));
  const updateMappingRow = (i: number, field: 'source' | 'crm', value: string) => {
    setMappingRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const buildFieldMapping = (): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const row of mappingRows) {
      if (row.source.trim() && row.crm) map[row.source.trim()] = row.crm;
    }
    return map;
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const params = {
      form_id:        formId || undefined,
      form_name:      formName,
      name:           form.name,
      source_label:   form.source_label,
      funnel_id:      form.funnel_id || undefined,
      funnel_name:    form.funnel_name || undefined,
      stage_id:       form.stage_id || undefined,
      stage_label:    form.stage_label || undefined,
      assigned_to:    form.assigned_to || undefined,
      assigned_name:  form.assigned_name || undefined,
      duplicate_mode: form.duplicate_mode,
      field_mapping:  buildFieldMapping(),
      is_active:      form.is_active,
    };

    if (editingEndpoint) {
      await updateEndpoint(editingEndpoint.id, params);
    } else {
      await createEndpoint(params);
    }

    setSaving(false);
    onClose();
  };

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(getWebhookUrl(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white';
  const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
              <i className="ri-webhook-line text-violet-600 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {editingEndpoint ? 'Editar Webhook' : 'Configurar Webhook'}
              </p>
              <p className="text-[11px] text-gray-400">{formName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        {/* URL do Webhook (se editando) */}
        {editingEndpoint && (
          <div className="px-6 py-3 bg-violet-50 border-b border-violet-100">
            <p className="text-[11px] font-semibold text-violet-700 mb-1.5 uppercase tracking-wide">URL do Webhook</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-violet-900 bg-white border border-violet-200 rounded-lg px-3 py-2 truncate">
                {getWebhookUrl(editingEndpoint.token)}
              </code>
              <button onClick={() => copyUrl(editingEndpoint.token)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-700 bg-white border border-violet-200 rounded-lg hover:bg-violet-50 cursor-pointer whitespace-nowrap transition-colors">
                <i className={`${copied ? 'ri-check-line text-emerald-500' : 'ri-file-copy-line'} text-sm`}></i>
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-[10px] text-violet-500 mt-1.5">Método: POST | Content-Type: application/json</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 flex-shrink-0">
          {[
            { id: 'config',  label: 'Configuração',    icon: 'ri-settings-3-line' },
            { id: 'mapping', label: 'Mapeamento de Campos', icon: 'ri-git-branch-line' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer
                ${activeTab === tab.id ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${tab.icon} text-sm`}></i>{tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── TAB: Configuração ── */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              {/* Nome e Fonte */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nome do Webhook</label>
                  <input type="text" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Facebook Lead Ads" className={inp} />
                </div>
                <div>
                  <label className={labelClass}>Fonte</label>
                  <select value={form.source_label}
                    onChange={e => setForm(p => ({ ...p, source_label: e.target.value }))}
                    className={inp}>
                    {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Funil e Etapa */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <i className="ri-kanban-view text-[#004aad]"></i>
                  Destino no Kanban
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Funil</label>
                    <select value={form.funnel_id} onChange={e => handleFunnelChange(e.target.value)} className={inp}>
                      <option value="">Selecione o funil...</option>
                      {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Etapa inicial</label>
                    <select value={form.stage_id} onChange={e => handleStageChange(e.target.value)}
                      disabled={!form.funnel_id} className={`${inp} disabled:opacity-50`}>
                      <option value="">Selecione a etapa...</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Responsável automático</label>
                  <select value={form.assigned_to} onChange={e => handleUserChange(e.target.value)} className={inp}>
                    <option value="">Sem responsável</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Duplicatas */}
              <div>
                <label className={labelClass}>Comportamento para duplicatas</label>
                <div className="space-y-2">
                  {DUPLICATE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(p => ({ ...p, duplicate_mode: opt.value as any }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                        ${form.duplicate_mode === opt.value
                          ? 'border-violet-400 bg-violet-50'
                          : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                      <p className={`text-sm font-medium ${form.duplicate_mode === opt.value ? 'text-violet-800' : 'text-gray-700'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ativo */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-700">Webhook ativo</p>
                  <p className="text-[11px] text-gray-400">Desative para parar de receber leads temporariamente</p>
                </div>
                <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className="cursor-pointer">
                  <div className={`w-11 h-6 rounded-full transition-all relative ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`}></div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: Mapeamento de Campos ── */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex items-start gap-2.5">
                <i className="ri-information-line text-amber-500 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-medium text-amber-800">Como funciona o mapeamento</p>
                  <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                    Coluna <strong>Campo da fonte</strong>: nome exato do campo no JSON recebido (ex: <code className="bg-amber-100 px-1 rounded">lead_name</code>).<br />
                    Coluna <strong>Campo no CRM</strong>: onde esse valor será salvo no creator.
                    Suporte a chaves aninhadas: <code className="bg-amber-100 px-1 rounded">field_data.0.values.0</code>
                  </p>
                </div>
              </div>

              {/* Cabeçalho */}
              <div className="grid grid-cols-2 gap-3 px-1">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Campo da fonte (JSON)</p>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Campo no CRM</p>
              </div>

              {/* Linhas de mapeamento */}
              <div className="space-y-2">
                {mappingRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 items-center">
                    <input type="text" value={row.source}
                      onChange={e => updateMappingRow(i, 'source', e.target.value)}
                      placeholder="ex: lead_name" className={`${inp} font-mono text-xs`} />
                    <div className="flex items-center gap-2">
                      <select value={row.crm} onChange={e => updateMappingRow(i, 'crm', e.target.value)} className={inp}>
                        {CRM_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <button onClick={() => removeMappingRow(i)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-all flex-shrink-0">
                        <i className="ri-close-line text-sm"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addMappingRow}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 rounded-lg cursor-pointer transition-colors">
                <i className="ri-add-line text-sm"></i>Adicionar campo
              </button>

              {/* Preview do mapeamento gerado */}
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Preview do JSON esperado</p>
                <pre className="text-xs text-emerald-400 font-mono overflow-x-auto">
{JSON.stringify(
  Object.fromEntries(mappingRows.filter(r => r.source).map(r => [r.source, `<${r.crm}>`])),
  null, 2
)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</>
              : <><i className="ri-save-line"></i>{editingEndpoint ? 'Salvar alterações' : 'Criar Webhook'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

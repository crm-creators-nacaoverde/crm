import { useState, useEffect } from 'react';
import { useFunnels, type Funnel } from '../../../hooks/useFunnels';
import { supabase } from '../../../lib/supabase';
import { useActivityLog } from '../../../hooks/useActivityLog';
import FunnelConfigModal from './FunnelConfigModal';

interface FunnelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FunnelStats {
  stageCount: number;
  dealCount: number;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

// ─── Paleta de cores rápidas ───────────────────────────────────
const PALETTE = [
  '#3b82f6','#7c3aed','#059669','#dc2626','#d97706',
  '#0891b2','#db2777','#374151','#ea580c','#0d9488',
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador',
};
const ROLE_COLOR: Record<string, string> = {
  admin: 'text-amber-700 bg-amber-100',
  manager: 'text-sky-700 bg-sky-100',
  operator: 'text-emerald-700 bg-emerald-100',
  viewer: 'text-gray-600 bg-gray-100',
};

// ─── Sub-modal de edição avançada ─────────────────────────────
function FunnelEditModal({
  funnel,
  users,
  onClose,
  onSave,
}: {
  funnel: Funnel;
  users: UserProfile[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    color: string;
    manager_id: string | null;
    manager_name: string | null;
    allowed_user_ids: string[] | null;
  }) => Promise<void>;
}) {
  type Tab = 'info' | 'gestor' | 'usuarios';
  const [tab, setTab] = useState<Tab>('info');
  const [name, setName] = useState(funnel.name);
  const [description, setDescription] = useState(funnel.description || '');
  const [color, setColor] = useState(funnel.color);
  const [managerId, setManagerId] = useState<string | null>(funnel.manager_id ?? null);
  const [allowedAll, setAllowedAll] = useState<boolean>(!Array.isArray(funnel.allowed_user_ids));
  const [allowedIds, setAllowedIds] = useState<string[]>(funnel.allowed_user_ids ?? []);
  const [saving, setSaving] = useState(false);

  const selectedManagerName = users.find(u => u.id === managerId)?.full_name;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const managerUser = users.find(u => u.id === managerId);
    await onSave({
      name: name.trim(),
      description: description.trim(),
      color,
      manager_id: managerId,
      manager_name: managerUser?.full_name ?? null,
      allowed_user_ids: allowedAll ? null : allowedIds,
    });
    setSaving(false);
  };

  const toggleUser = (id: string) =>
    setAllowedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'info',     label: 'Informações', icon: 'ri-edit-line' },
    { id: 'gestor',   label: 'Gestor',      icon: 'ri-user-star-line' },
    { id: 'usuarios', label: 'Usuários',    icon: 'ri-group-line' },
  ];

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
              <i className="ri-stack-line" style={{ color }}></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 truncate max-w-[220px]">{funnel.name}</p>
              <p className="text-[11px] text-gray-400">Editar configurações do funil</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 mx-5 mt-4 mb-1 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer
                ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${t.icon} text-sm`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ─── ABA INFORMAÇÕES ─── */}
          {tab === 'info' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ex: Pipeline Principal" className={inp} maxLength={50} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descrição</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Breve descrição do funil" className={inp} maxLength={120} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cor</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PALETTE.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-lg cursor-pointer transition-all hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                    className="w-7 h-7 rounded-lg cursor-pointer border border-gray-200 p-0.5" title="Cor personalizada" />
                </div>
              </div>
            </>
          )}

          {/* ─── ABA GESTOR ─── */}
          {tab === 'gestor' && (
            <div className="space-y-3">
              {/* Info box */}
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <i className="ri-shield-star-line text-amber-500 mt-0.5"></i>
                <div>
                  <p className="text-xs font-semibold text-amber-800">Gestor do Funil</p>
                  <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">
                    Responsável principal pelo funil. Aparece como referência nos relatórios.
                  </p>
                </div>
              </div>

              {/* Sem gestor */}
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${!managerId ? 'border-gray-400 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${!managerId ? 'border-gray-600 bg-gray-600' : 'border-gray-300'}`}>
                  {!managerId && <span className="w-2 h-2 bg-white rounded-full"></span>}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Sem gestor definido</p>
                  <p className="text-[11px] text-gray-400">O funil não terá um responsável principal</p>
                </div>
                <input type="radio" className="sr-only" checked={!managerId} onChange={() => setManagerId(null)} />
              </label>

              {/* Lista de usuários */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {users.map(u => {
                  const sel = managerId === u.id;
                  return (
                    <label key={u.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all
                        ${sel ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                      {/* Radio */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                        ${sel ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>
                        {sel && <span className="w-2 h-2 bg-white rounded-full"></span>}
                      </div>
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[10px] font-bold">{u.full_name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{u.full_name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLOR[u.role] || 'text-gray-500 bg-gray-100'}`}>
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                      <input type="radio" className="sr-only" checked={sel} onChange={() => setManagerId(u.id)} />
                    </label>
                  );
                })}
              </div>

              {/* Resumo */}
              {selectedManagerName && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <i className="ri-checkbox-circle-fill text-emerald-500 text-sm"></i>
                  <p className="text-xs font-medium text-emerald-800">
                    Gestor selecionado: <strong>{selectedManagerName}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── ABA USUÁRIOS ─── */}
          {tab === 'usuarios' && (
            <div className="space-y-3">
              {/* Info box */}
              <div className="flex items-start gap-2.5 p-3 bg-[#5de0e6]/10 border border-[#5de0e6]/30 rounded-xl">
                <i className="ri-group-line text-[#004aad] mt-0.5"></i>
                <div>
                  <p className="text-xs font-semibold text-[#004aad]">Controle de Acesso</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Defina quem pode ver e trabalhar neste funil. Admins sempre têm acesso total.
                  </p>
                </div>
              </div>

              {/* Toggle "Todos" */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2.5">
                  <i className="ri-infinity-line text-emerald-500"></i>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Acesso para todos</p>
                    <p className="text-[11px] text-gray-400">Qualquer usuário ativo pode ver este funil</p>
                  </div>
                </div>
                <button type="button" onClick={() => setAllowedAll(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0
                    ${allowedAll ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                    ${allowedAll ? 'translate-x-5' : 'translate-x-0'}`}></span>
                </button>
              </div>

              {/* Lista de usuários */}
              {!allowedAll && (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Selecionar quem tem acesso</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {users.map(u => {
                      const isAdmin = u.role === 'admin';
                      const sel = isAdmin || allowedIds.includes(u.id);
                      return (
                        <label key={u.id}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all
                            ${isAdmin
                              ? 'border-amber-100 bg-amber-50/60 cursor-default'
                              : `cursor-pointer ${sel ? 'border-[#004aad]/30 bg-[#004aad]/5' : 'border-gray-100 bg-white hover:border-gray-200'}`}`}>
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                            ${isAdmin ? 'bg-amber-400 border-amber-400' : sel ? 'bg-[#004aad] border-[#004aad]' : 'border-gray-300'}`}>
                            {(isAdmin || sel) && <i className="ri-check-line text-white text-[10px]"></i>}
                          </div>
                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[10px] font-bold">{u.full_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{u.full_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isAdmin && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                Acesso total
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLOR[u.role] || 'text-gray-500 bg-gray-100'}`}>
                              {ROLE_LABEL[u.role] || u.role}
                            </span>
                          </div>
                          {!isAdmin && (
                            <input type="checkbox" className="sr-only" checked={sel} onChange={() => toggleUser(u.id)} />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {/* Resumo */}
                  <div className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium
                    ${allowedIds.length > 0 ? 'bg-[#004aad]/5 text-[#004aad]' : 'bg-rose-50 text-rose-600'}`}>
                    <i className={`text-sm ${allowedIds.length > 0 ? 'ri-user-check-line' : 'ri-error-warning-line'}`}></i>
                    {allowedIds.length > 0
                      ? `${allowedIds.length} usuário${allowedIds.length > 1 ? 's' : ''} com acesso (+ admins)`
                      : 'Nenhum usuário selecionado — apenas admins verão este funil'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {saving
              ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin"></i>Salvando...</span>
              : <span className="flex items-center justify-center gap-2"><i className="ri-save-line"></i>Salvar Alterações</span>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal principal ───────────────────────────────────────────
export default function FunnelManagerModal({ isOpen, onClose }: FunnelManagerModalProps) {
  const { funnels, createFunnel, updateFunnel, deleteFunnel, reloadFunnels } = useFunnels();
  const { logActivity } = useActivityLog();

  const [stats, setStats] = useState<Map<string, FunnelStats>>(new Map());
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [moveToFunnelId, setMoveToFunnelId] = useState('');
  const [formData, setFormData] = useState({ name: '', description: '', color: '#3b82f6' });
  const [configuringFunnelId, setConfiguringFunnelId] = useState<string | null>(null);
  const [configuringStages, setConfiguringStages] = useState<{ id: string; label: string; color: string; description?: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      loadUsers();
    }
  }, [isOpen, funnels]);

  const loadStats = async () => {
    const map = new Map<string, FunnelStats>();
    for (const f of funnels) {
      const [s, d] = await Promise.all([
        supabase.from('funnel_stages').select('id', { count: 'exact', head: true }).eq('funnel_id', f.id),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('funnel_id', f.id),
      ]);
      map.set(f.id, { stageCount: s.count || 0, dealCount: d.count || 0 });
    }
    setStats(map);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .order('full_name');
    setUsers(data || []);
  };

  const openStageConfig = async (funnelId: string) => {
    const { data } = await supabase
      .from('funnel_stages')
      .select('id, label, color, description, sort_order')
      .eq('funnel_id', funnelId)
      .order('sort_order');
    setConfiguringStages((data || []).map(s => ({ id: s.id, label: s.label, color: s.color, description: s.description || '' })));
    setConfiguringFunnelId(funnelId);
  };

  const saveStageConfig = async (newStages: { id: string; label: string; color: string; description?: string }[]) => {
    if (!configuringFunnelId) return;
    const { data: current } = await supabase.from('funnel_stages').select('id').eq('funnel_id', configuringFunnelId);
    const currentIds = new Set((current || []).map((s: any) => s.id));
    const newIds = new Set(newStages.map(s => s.id));
    const toDelete = [...currentIds].filter(id => !newIds.has(id));
    if (toDelete.length > 0) await supabase.from('funnel_stages').delete().in('id', toDelete);
    await supabase.from('funnel_stages').upsert(
      newStages.map((s, i) => ({
        id: s.id, label: s.label, color: s.color,
        description: s.description ?? null,
        sort_order: i,
        is_fixed: s.id === 'won' || s.id === 'lost',
        funnel_id: configuringFunnelId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
    await loadStats();
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    const result = await createFunnel({ name: formData.name, description: formData.description, color: formData.color, is_default: funnels.length === 0 });
    if (result.success && result.data) {
      const defaultStages = [
        { id: 'sem_contato',  label: 'Sem contato',   color: '#94a3b8', sort_order: 0, is_fixed: false },
        { id: 'contato_feito',label: 'Contato feito',  color: '#3b82f6', sort_order: 1, is_fixed: false },
        { id: 'won',          label: 'Ganho',          color: '#10b981', sort_order: 2, is_fixed: true },
        { id: 'lost',         label: 'Perdido',        color: '#ef4444', sort_order: 3, is_fixed: true },
      ];
      await supabase.from('funnel_stages').insert(defaultStages.map(s => ({ ...s, funnel_id: result.data.id })));
      await logActivity({ action: 'create', module: 'funnels', entityId: result.data.id, entityName: formData.name, details: { data: formData } });
      setFormData({ name: '', description: '', color: '#3b82f6' });
      setIsCreating(false);
      await reloadFunnels();
      await loadStats();
    }
  };

  const handleSaveEdit = async (data: {
    name: string; description: string; color: string;
    manager_id: string | null; manager_name: string | null;
    allowed_user_ids: string[] | null;
  }) => {
    if (!editingFunnel) return;
    await supabase.from('funnels').update({
      name: data.name, description: data.description, color: data.color,
      manager_id: data.manager_id, manager_name: data.manager_name,
      allowed_user_ids: data.allowed_user_ids,
      updated_at: new Date().toISOString(),
    }).eq('id', editingFunnel.id);
    await logActivity({ action: 'update', module: 'funnels', entityId: editingFunnel.id, entityName: data.name, details: { before: editingFunnel, after: data } });
    await reloadFunnels();
    setEditingFunnel(null);
  };

  const handleDuplicate = async (sourceFunnelId: string) => {
    const src = funnels.find(f => f.id === sourceFunnelId);
    if (!src) return;
    setDuplicatingId(sourceFunnelId);
    const result = await createFunnel({ name: `${src.name} (cópia)`, description: src.description, color: src.color, is_default: false });
    if (result.success && result.data) {
      const { data: stages } = await supabase.from('funnel_stages').select('*').eq('funnel_id', sourceFunnelId).order('sort_order');
      if (stages) await supabase.from('funnel_stages').insert(stages.map(s => ({ id: s.id, label: s.label, color: s.color, sort_order: s.sort_order, is_fixed: s.is_fixed, funnel_id: result.data.id })));
      await reloadFunnels(); await loadStats();
    }
    setDuplicatingId(null);
  };

  const handleSetDefault = async (id: string) => {
    await updateFunnel(id, { is_default: true });
    await reloadFunnels();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const toDelete = funnels.find(f => f.id === deletingId);
    const fStats = stats.get(deletingId);
    if (fStats && fStats.dealCount > 0 && moveToFunnelId) {
      await supabase.from('deals').update({ funnel_id: moveToFunnelId }).eq('funnel_id', deletingId);
    }
    await deleteFunnel(deletingId);
    if (toDelete) {
      await logActivity({ action: 'delete', module: 'funnels', entityId: deletingId, entityName: toDelete.name, details: { deletedData: toDelete, dealsMoved: fStats?.dealCount || 0, movedToFunnelId: moveToFunnelId || null } });
    }
    setDeletingId(null); setMoveToFunnelId('');
    await reloadFunnels(); await loadStats();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center">
                <i className="ri-stack-line text-[#004aad] text-xl"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gerenciar Funis</h2>
                <p className="text-xs text-gray-500">Organize seus processos de vendas</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
              <i className="ri-close-line text-gray-400 text-xl"></i>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* Criar novo funil */}
            {!isCreating ? (
              <button onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-[#5de0e6] hover:bg-[#5de0e6]/5 transition-all cursor-pointer text-gray-500 hover:text-[#004aad] mb-4">
                <i className="ri-add-line text-xl"></i>
                <span className="text-sm font-medium">Novo Funil</span>
              </button>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Nome do funil *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Vendas B2B, Parcerias, etc."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Descrição (opcional)</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o objetivo deste funil"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Cor</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PALETTE.map(c => (
                      <button key={c} type="button" onClick={() => setFormData({ ...formData, color: c })}
                        className={`w-7 h-7 rounded-lg cursor-pointer hover:scale-110 transition-all ${formData.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleCreate} disabled={!formData.name.trim()}
                    className="flex-1 px-4 py-2 bg-[#004aad] text-white text-sm font-medium rounded-lg hover:bg-[#003d91] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    Criar Funil
                  </button>
                  <button onClick={() => { setIsCreating(false); setFormData({ name: '', description: '', color: '#3b82f6' }); }}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de funis */}
            <div className="space-y-3">
              {funnels.map(funnel => {
                const fStats = stats.get(funnel.id);
                const managerUser = users.find(u => u.id === funnel.manager_id);
                const isRestricted = Array.isArray(funnel.allowed_user_ids);
                const allowedCount = funnel.allowed_user_ids?.length || 0;

                return (
                  <div key={funnel.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${funnel.color}20` }}>
                        <i className="ri-stack-line text-lg" style={{ color: funnel.color }}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-bold text-gray-900">{funnel.name}</h3>
                          {funnel.is_default && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded-full">Padrão</span>
                          )}
                        </div>
                        {funnel.description && <p className="text-xs text-gray-500 mb-1.5">{funnel.description}</p>}

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <i className="ri-list-check text-[10px]"></i>{fStats?.stageCount || 0} etapas
                          </span>
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <i className="ri-briefcase-line text-[10px]"></i>{fStats?.dealCount || 0} negociações
                          </span>

                          {/* Gestor */}
                          {managerUser ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              <i className="ri-user-star-line text-[10px]"></i>{managerUser.full_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                              <i className="ri-user-line text-[10px]"></i>Sem gestor
                            </span>
                          )}

                          {/* Acesso */}
                          {isRestricted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#004aad] bg-[#004aad]/10 px-2 py-0.5 rounded-full">
                              <i className="ri-lock-line text-[10px]"></i>{allowedCount} usuário{allowedCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <i className="ri-infinity-line text-[10px]"></i>Todos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 pt-3 border-t border-gray-100 flex-wrap">
                      {!funnel.is_default && (
                        <button onClick={() => handleSetDefault(funnel.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                          <i className="ri-star-line text-xs"></i>Definir como padrão
                        </button>
                      )}
                      <button onClick={() => setEditingFunnel(funnel)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#004aad] hover:bg-[#004aad]/5 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-edit-line text-xs"></i>Editar
                      </button>
                      <button onClick={() => openStageConfig(funnel.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#004aad] hover:bg-[#5de0e6]/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-flow-chart text-xs"></i>Etapas
                      </button>
                      <button onClick={() => handleDuplicate(funnel.id)} disabled={duplicatingId === funnel.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
                        <i className={`${duplicatingId === funnel.id ? 'ri-loader-4-line animate-spin' : 'ri-file-copy-line'} text-xs`}></i>Duplicar
                      </button>
                      {funnels.length > 1 && (
                        <button onClick={() => setDeletingId(funnel.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap ml-auto">
                          <i className="ri-delete-bin-line text-xs"></i>Excluir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal edição avançada */}
      {editingFunnel && (
        <FunnelEditModal
          funnel={editingFunnel}
          users={users}
          onClose={() => setEditingFunnel(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* FunnelConfigModal — configurar etapas */}
      {configuringFunnelId && (
        <FunnelConfigModal
          isOpen={true}
          onClose={() => { setConfiguringFunnelId(null); setConfiguringStages([]); }}
          stages={configuringStages}
          onSave={saveStageConfig}
          funnelId={configuringFunnelId}
        />
      )}

      {/* Confirmar exclusão */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <i className="ri-alert-line text-red-600 text-2xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Excluir Funil</h3>
                <p className="text-sm text-gray-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            {stats.get(deletingId)?.dealCount ? (
              <div className="mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-amber-800">
                    Este funil possui <strong>{stats.get(deletingId)?.dealCount} negociações</strong>. Escolha para onde movê-las:
                  </p>
                </div>
                <select value={moveToFunnelId} onChange={e => setMoveToFunnelId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none cursor-pointer">
                  <option value="">Selecione um funil</option>
                  {funnels.filter(f => f.id !== deletingId).map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mb-4">Tem certeza que deseja excluir este funil permanentemente?</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setDeletingId(null); setMoveToFunnelId(''); }}
                className="flex-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={!!stats.get(deletingId)?.dealCount && !moveToFunnelId}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap">
                Excluir Funil
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

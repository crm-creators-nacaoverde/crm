// src/pages/cadastros/components/modules/FuncoesModule.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { getDefaultPermissions, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../../../lib/rolePermissions';
import type { Permissions } from '../../../../lib/rolePermissions';

const PERMISSION_SECTIONS = [
  { key: 'clients',      label: 'Creators',       icon: 'ri-user-star-line',           actions: ['view','edit','delete'] },
  { key: 'deals',        label: 'Acompanhamento', icon: 'ri-kanban-view',              actions: ['view','edit','delete'] },
  { key: 'interactions', label: 'Interações',     icon: 'ri-chat-3-line',              actions: ['view','edit','delete'] },
  { key: 'financeiro',   label: 'Financeiro',     icon: 'ri-money-dollar-circle-line', actions: ['view','edit','delete'] },
  { key: 'logistica',    label: 'Logística',      icon: 'ri-truck-line',               actions: ['view','edit','delete'] },
  { key: 'forms',        label: 'Formulários',    icon: 'ri-survey-line',              actions: ['view','edit','delete'] },
  { key: 'webhooks',     label: 'Webhooks',       icon: 'ri-webhook-line',             actions: ['view','edit'] },
  { key: 'logs',         label: 'Logs',           icon: 'ri-history-line',             actions: ['view'] },
  { key: 'metrics',      label: 'Métricas',       icon: 'ri-pie-chart-line',           actions: ['view','edit'] },
  { key: 'settings',     label: 'Configurações',  icon: 'ri-settings-4-line',          actions: ['view','edit'] },
  { key: 'users',        label: 'Usuários',       icon: 'ri-group-line',               actions: ['view','edit'] },
];

const ACTION_LABELS: Record<string, string> = { view: 'Ver', edit: 'Editar', delete: 'Excluir' };
const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-amber-50 text-amber-700 border-amber-200',
  manager:  'bg-sky-50 text-sky-700 border-sky-200',
  operator: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  viewer:   'bg-gray-50 text-gray-600 border-gray-200',
};

interface RoleConfig {
  key: string;
  label: string;
  description: string;
  permissions: Permissions;
  isCustom?: boolean;
}

export default function FuncoesModule() {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [editing, setEditing] = useState<RoleConfig | null>(null);
  const [editPerms, setEditPerms] = useState<Permissions | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Carregar funções (padrão + customizadas do company_settings)
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    const { data } = await supabase.from('company_settings').select('custom_roles').single();
    const customRoles: RoleConfig[] = data?.custom_roles || [];
    const defaults: RoleConfig[] = ['admin','manager','operator','viewer'].map(key => ({
      key,
      label: ROLE_LABELS[key] || key,
      description: ROLE_DESCRIPTIONS[key] || '',
      permissions: getDefaultPermissions(key),
      isCustom: false,
    }));
    setRoles([...defaults, ...customRoles]);
  };

  const startEdit = (role: RoleConfig) => {
    setEditing(role);
    setEditPerms({ ...role.permissions });
    setEditLabel(role.label);
    setEditDesc(role.description);
    setShowNew(false);
  };

  const startNew = () => {
    const blank: Permissions = getDefaultPermissions('viewer');
    setEditing(null);
    setEditPerms(blank);
    setEditLabel('');
    setEditDesc('');
    setShowNew(true);
  };

  const reset = () => { setEditing(null); setEditPerms(null); setShowNew(false); };

  const handlePermChange = (section: string, action: string, value: boolean) => {
    if (!editPerms) return;
    setEditPerms(prev => ({ ...prev!, [section]: { ...(prev as any)[section], [action]: value } }));
  };

  const save = async () => {
    if (!editPerms) return;
    setSaving(true);

    if (showNew) {
      // Criar nova função customizada
      const key = `custom_${Date.now()}`;
      const newRole: RoleConfig = { key, label: editLabel || 'Nova Função', description: editDesc, permissions: editPerms, isCustom: true };
      const { data } = await supabase.from('company_settings').select('custom_roles').single();
      const current = data?.custom_roles || [];
      await supabase.from('company_settings').update({ custom_roles: [...current, newRole] });
    } else if (editing) {
      if (editing.isCustom) {
        // Atualizar função customizada
        const { data } = await supabase.from('company_settings').select('custom_roles').single();
        const current: RoleConfig[] = data?.custom_roles || [];
        const updated = current.map(r => r.key === editing.key ? { ...r, label: editLabel, description: editDesc, permissions: editPerms } : r);
        await supabase.from('company_settings').update({ custom_roles: updated });
      } else {
        // Atualizar permissões padrão de um cargo existente
        await supabase.from('user_profiles').select('id, permissions, role').eq('role', editing.key).then(async ({ data: users }) => {
          // Não atualiza usuários existentes, só salva o padrão nas company_settings
        });
        const { data } = await supabase.from('company_settings').select('default_role_permissions').single();
        const current = data?.default_role_permissions || {};
        await supabase.from('company_settings').update({ default_role_permissions: { ...current, [editing.key]: editPerms } });
      }
    }

    await loadRoles(); reset(); setSaving(false);
  };

  const deleteCustom = async (key: string) => {
    const { data } = await supabase.from('company_settings').select('custom_roles').single();
    const current: RoleConfig[] = data?.custom_roles || [];
    await supabase.from('company_settings').update({ custom_roles: current.filter(r => r.key !== key) });
    await loadRoles();
  };

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';

  return (
    <div className="p-5 space-y-5">
      {/* Lista de funções */}
      {!editing && !showNew && (
        <>
          <div className="space-y-3">
            {roles.map(role => (
              <div key={role.key} className={`flex items-start gap-3 p-4 rounded-xl border ${ROLE_COLORS[role.key] || 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{role.label}</p>
                    {role.isCustom && <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded-md">customizada</span>}
                  </div>
                  <p className="text-[11px] opacity-75 mt-0.5">{role.description}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(role)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/50 hover:bg-white cursor-pointer transition-all">
                    <i className="ri-edit-line text-xs"></i>
                  </button>
                  {role.isCustom && (
                    <button onClick={() => deleteCustom(role.key)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/50 hover:bg-rose-100 hover:text-rose-600 cursor-pointer transition-all">
                      <i className="ri-delete-bin-line text-xs"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={startNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#004aad] hover:text-[#004aad] cursor-pointer transition-all">
            <i className="ri-add-line"></i>Nova Função Customizada
          </button>
        </>
      )}

      {/* Editor de permissões */}
      {(editing || showNew) && editPerms && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={reset} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer transition-all">
              <i className="ri-arrow-left-line text-sm"></i>
            </button>
            <div>
              <p className="text-sm font-semibold text-gray-900">{showNew ? 'Nova Função' : `Editando: ${editing?.label}`}</p>
              <p className="text-xs text-gray-400">{showNew ? 'Configure as permissões da nova função' : 'Permissões padrão para novos usuários neste cargo'}</p>
            </div>
          </div>

          {(showNew || editing?.isCustom) && (
            <div className="space-y-3">
              <input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Nome da função *" className={inp} />
              <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição" className={inp} />
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissões</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditPerms(getDefaultPermissions('admin'))} className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer">Tudo ON</button>
                <button onClick={() => setEditPerms(getDefaultPermissions('viewer'))} className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer">Tudo OFF</button>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {PERMISSION_SECTIONS.map(section => {
                const perms = (editPerms as any)[section.key] || {};
                return (
                  <div key={section.key} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center">
                        <i className={`${section.icon} text-sm text-gray-400`}></i>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{section.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {section.actions.map(action => (
                        <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={perms[action] === true}
                            onChange={e => handlePermChange(section.key, action, e.target.checked)}
                            className={`w-3.5 h-3.5 rounded ${action === 'delete' ? 'text-rose-500' : 'text-[#004aad]'}`} />
                          <span className={`text-xs ${action === 'delete' ? 'text-rose-500' : 'text-gray-500'}`}>{ACTION_LABELS[action]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving || (showNew && !editLabel.trim())}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg cursor-pointer transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

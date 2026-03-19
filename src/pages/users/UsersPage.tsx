import { useState, useEffect } from 'react';
import { supabase, UserProfile, UserRole } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../hooks/useActivityLog';
import Button from '../../components/base/Button';
import Modal from '../../components/base/Modal';
import Input from '../../components/base/Input';
import AppLayout from '../../components/feature/AppLayout';
import { getDefaultPermissions, ROLE_DESCRIPTIONS, type Permissions } from '../../lib/rolePermissions';

interface FunnelOption { id: string; name: string; color: string; is_default: boolean; }

// ── Seções de permissão exibidas na aba Permissões ────────────────────────────
const PERMISSION_SECTIONS = [
  { key: 'clients',      label: 'Creators',         icon: 'ri-user-star-line',           actions: ['view', 'edit', 'delete'] },
  { key: 'deals',        label: 'Acompanhamento',   icon: 'ri-kanban-view',              actions: ['view', 'edit', 'delete'] },
  { key: 'interactions', label: 'Interações',       icon: 'ri-chat-3-line',              actions: ['view', 'edit', 'delete'] },
  { key: 'financeiro',   label: 'Financeiro',       icon: 'ri-money-dollar-circle-line', actions: ['view', 'edit', 'delete'] },
  { key: 'logistica',    label: 'Logística',        icon: 'ri-truck-line',               actions: ['view', 'edit', 'delete'] },
  { key: 'forms',        label: 'Formulários',      icon: 'ri-survey-line',              actions: ['view', 'edit', 'delete'] },
  { key: 'webhooks',     label: 'Webhooks',         icon: 'ri-webhook-line',             actions: ['view', 'edit'] },
  { key: 'metrics',      label: 'Métricas',         icon: 'ri-pie-chart-line',           actions: ['view'] },
  { key: 'settings',     label: 'Configurações',    icon: 'ri-settings-4-line',          actions: ['view', 'edit'] },
  { key: 'users',        label: 'Usuários',         icon: 'ri-group-line',               actions: ['view', 'edit'] },
];

const ACTION_LABELS: Record<string, string> = { view: 'Ver', edit: 'Editar', delete: 'Excluir' };

// Permissões em branco (base para merge com defaults)
const EMPTY_PERMISSIONS: Permissions = {
  clients:      { view: false, edit: false, delete: false },
  deals:        { view: false, edit: false, delete: false },
  interactions: { view: false, edit: false, delete: false },
  forms:        { view: false, edit: false, delete: false },
  financeiro:   { view: false, edit: false, delete: false },
  logistica:    { view: false, edit: false, delete: false },
  webhooks:     { view: false, edit: false               },
  metrics:      { view: false                             },
  settings:     { view: false, edit: false               },
  users:        { view: false, edit: false               },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const { profile, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();
  const canEdit = hasPermission('users', 'edit');

  useEffect(() => { loadUsers(); loadFunnels(); }, []);

  const loadFunnels = async () => {
    const { data } = await supabase.from('funnels').select('id, name, color, is_default').order('is_default', { ascending: false });
    setFunnels(data || []);
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchTerm ||
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleEditUser = (user: UserProfile) => { setSelectedUser(user); setShowModal(true); };

  const handleSaveUser = async (updatedUser: Partial<UserProfile>) => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase.from('user_profiles').update({
        role: updatedUser.role,
        permissions: updatedUser.permissions,
        is_active: updatedUser.is_active,
        allowed_funnels: updatedUser.allowed_funnels,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedUser.id);
      if (error) throw error;
      await logActivity({
        action: 'update', module: 'users',
        entityId: selectedUser.id, entityName: selectedUser.full_name,
        details: {
          before: { role: selectedUser.role, permissions: selectedUser.permissions, allowed_funnels: selectedUser.allowed_funnels },
          after: updatedUser,
        },
      });
      await loadUsers();
      setShowModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  };

  const handleCreateUser = async (userData: {
    full_name: string; email: string; password: string;
    role: UserRole; is_active: boolean; allowed_funnels: string[] | null;
  }) => {
    // Permissões padrão baseadas no cargo selecionado
    const perms = getDefaultPermissions(userData.role);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Sessão expirada');

    const response = await fetch(
      `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          full_name: userData.full_name, email: userData.email,
          password: userData.password, role: userData.role,
          permissions: perms, is_active: userData.is_active,
          allowed_funnels: userData.allowed_funnels,
        }),
      }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Erro ao criar usuário');
    await logActivity({
      action: 'create', module: 'users',
      entityId: result.user_id || 'unknown', entityName: userData.full_name,
      details: { email: userData.email, role: userData.role, allowed_funnels: userData.allowed_funnels },
    });
    await loadUsers();
    setShowCreateModal(false);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('user_profiles').delete().eq('id', userToDelete.id);
      if (error) throw error;
      await logActivity({ action: 'delete', module: 'users', entityId: userToDelete.id, entityName: userToDelete.full_name, details: { email: userToDelete.email, role: userToDelete.role } });
      await loadUsers();
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const config: Record<string, { bg: string; text: string; label: string; icon: string }> = {
      admin:    { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Administrador', icon: 'ri-shield-star-line' },
      manager:  { bg: 'bg-sky-50',     text: 'text-sky-700',     label: 'Gerente',       icon: 'ri-user-star-line' },
      operator: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Operador',      icon: 'ri-user-settings-line' },
      viewer:   { bg: 'bg-gray-50',    text: 'text-gray-600',    label: 'Visualizador',  icon: 'ri-eye-line' },
    };
    const c = config[role] || config.viewer;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${c.bg} ${c.text}`}>
        <i className={`${c.icon} text-[11px]`}></i>{c.label}
      </span>
    );
  };

  const getFunnelAccessBadge = (user: UserProfile) => {
    if (user.role === 'admin' || user.allowed_funnels === null) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
          <i className="ri-infinity-line text-xs"></i> Todos os funis
        </span>
      );
    }
    const allowed = user.allowed_funnels || [];
    if (allowed.length === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
          <i className="ri-lock-line text-xs"></i> Sem acesso
        </span>
      );
    }
    const names = allowed.map(id => funnels.find(f => f.id === id)?.name || '?').join(', ');
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#004aad] bg-[#004aad]/10 px-2 py-0.5 rounded-md" title={names}>
        <i className="ri-stack-line text-xs"></i>
        {allowed.length} {allowed.length === 1 ? 'funil' : 'funis'}
      </span>
    );
  };

  const activeCount = users.filter(u => u.is_active).length;
  const adminCount  = users.filter(u => u.role === 'admin').length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
              <i className="ri-group-line text-lg text-brand-600"></i>
            </div>
            <div><p className="text-xl font-bold text-gray-900">{users.length}</p><p className="text-xs text-gray-400">Total de usuários</p></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-lg text-emerald-600"></i>
            </div>
            <div><p className="text-xl font-bold text-gray-900">{activeCount}</p><p className="text-xs text-gray-400">Ativos</p></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <i className="ri-shield-star-line text-lg text-amber-600"></i>
            </div>
            <div><p className="text-xl font-bold text-gray-900">{adminCount}</p><p className="text-xs text-gray-400">Administradores</p></div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input type="text" placeholder="Buscar por nome ou email..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  className="w-full sm:w-auto pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-white cursor-pointer">
                  <option value="all">Todas as funções</option>
                  <option value="admin">Administrador</option>
                  <option value="manager">Gerente</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador</option>
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
              </div>
              {canEdit && (
                <Button onClick={() => setShowCreateModal(true)} size="md">
                  <i className="ri-user-add-line text-sm"></i>
                  <span className="hidden sm:inline">Novo Usuário</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Usuário</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Função</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Acesso a Funis</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cadastro</th>
                  {canEdit && <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center shadow-sm">
                          <span className="text-white font-semibold text-xs">{u.full_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{getRoleBadge(u.role)}</td>
                    <td className="px-5 py-3.5">{getFunnelAccessBadge(u)}</td>
                    <td className="px-5 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleEditUser(u)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all cursor-pointer" title="Editar">
                            <i className="ri-edit-line text-sm"></i>
                          </button>
                          {u.id !== profile?.id && (
                            <button onClick={() => { setUserToDelete(u); setShowDeleteModal(true); }}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer" title="Excluir">
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <i className="ri-user-search-line text-2xl text-gray-300"></i>
                    </div>
                    <p className="text-sm text-gray-400">Nenhum usuário encontrado</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        {showModal && selectedUser && (
          <EditUserModal user={selectedUser} funnels={funnels}
            onClose={() => { setShowModal(false); setSelectedUser(null); }}
            onSave={handleSaveUser} />
        )}
        {showCreateModal && (
          <CreateUserModal funnels={funnels}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateUser} />
        )}
        {showDeleteModal && userToDelete && (
          <Modal isOpen={true} onClose={() => { setShowDeleteModal(false); setUserToDelete(null); }}
            title="Excluir Usuário" subtitle="Esta ação não pode ser desfeita">
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl">
                <div className="w-11 h-11 bg-gradient-to-br from-rose-400 to-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                  <i className="ri-error-warning-line text-white text-lg"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{userToDelete.full_name}</p>
                  <p className="text-xs text-gray-500">{userToDelete.email}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">Tem certeza? Todos os dados associados serão removidos permanentemente.</p>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }} variant="outline" className="flex-1" disabled={deleting}>Cancelar</Button>
                <button onClick={handleDeleteUser} disabled={deleting}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap">
                  {deleting
                    ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin"></i>Excluindo...</span>
                    : <span className="flex items-center justify-center gap-2"><i className="ri-delete-bin-line"></i>Excluir Usuário</span>}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}

/* ─── FunnelAccessSelector ─── */
function FunnelAccessSelector({ funnels, allowedFunnels, onChange, role }: {
  funnels: FunnelOption[];
  allowedFunnels: string[] | null;
  onChange: (v: string[] | null) => void;
  role: UserRole;
}) {
  const isUnrestricted = allowedFunnels === null;
  if (role === 'admin') {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
        <i className="ri-shield-star-line text-amber-500"></i>
        <p className="text-xs text-amber-700 font-medium">Administradores têm acesso irrestrito a todos os funis.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2.5">
          <i className="ri-infinity-line text-emerald-500 text-base"></i>
          <div>
            <p className="text-sm font-medium text-gray-800">Acesso a todos os funis</p>
            <p className="text-[11px] text-gray-400">Remove qualquer restrição por funil</p>
          </div>
        </div>
        <button type="button" onClick={() => onChange(isUnrestricted ? [] : null)}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${isUnrestricted ? 'bg-emerald-500' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isUnrestricted ? 'translate-x-5' : 'translate-x-0'}`}></span>
        </button>
      </div>
      {!isUnrestricted && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 px-1">Selecione os funis liberados:</p>
          {funnels.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Nenhum funil cadastrado</p>}
          {funnels.map(funnel => {
            const checked = (allowedFunnels || []).includes(funnel.id);
            return (
              <label key={funnel.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-[#004aad]/30 bg-[#004aad]/5' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${funnel.color}25` }}>
                  <i className="ri-stack-line text-xs" style={{ color: funnel.color }}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800">{funnel.name}</span>
                  {funnel.is_default && <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">padrão</span>}
                </div>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-[#004aad] border-[#004aad]' : 'border-gray-300 bg-white'}`}>
                  {checked && <i className="ri-check-line text-white text-xs"></i>}
                </div>
                <input type="checkbox" className="sr-only" checked={checked}
                  onChange={e => {
                    const current = allowedFunnels || [];
                    onChange(e.target.checked ? [...current, funnel.id] : current.filter(id => id !== funnel.id));
                  }} />
              </label>
            );
          })}
          {!isUnrestricted && (allowedFunnels || []).length === 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-100 rounded-lg">
              <i className="ri-information-line text-rose-400 text-sm"></i>
              <p className="text-[11px] text-rose-600">Sem nenhum funil selecionado, o usuário não verá o Acompanhamento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── CreateUserModal ─── */
function CreateUserModal({ onClose, onCreate, funnels }: {
  onClose: () => void;
  funnels: FunnelOption[];
  onCreate: (data: { full_name: string; email: string; password: string; role: UserRole; is_active: boolean; allowed_funnels: string[] | null }) => Promise<void>;
}) {
  const [fullName, setFullName]             = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole]                     = useState<UserRole>('operator');
  const [isActive, setIsActive]             = useState(true);
  const [allowedFunnels, setAllowedFunnels] = useState<string[] | null>([]);
  const [showPassword, setShowPassword]     = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [activeTab, setActiveTab]           = useState<'dados' | 'funis'>('dados');

  useEffect(() => {
    if (role === 'admin') setAllowedFunnels(null);
    else if (allowedFunnels === null) setAllowedFunnels([]);
  }, [role]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.full_name = 'Nome é obrigatório';
    if (!email.trim()) e.email = 'Email é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido';
    if (!password) e.password = 'Senha é obrigatória';
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (password !== confirmPassword) e.confirmPassword = 'As senhas não coincidem';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true); setError('');
    try {
      await onCreate({ full_name: fullName.trim(), email: email.trim().toLowerCase(), password, role, is_active: isActive, allowed_funnels: allowedFunnels });
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500';

  return (
    <Modal isOpen={true} onClose={onClose} title="Novo Usuário" subtitle="Preencha os dados para criar um novo acesso" size="md">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm">
            <i className="ri-error-warning-line text-lg"></i>{error}
          </div>
        )}

        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          {[{ id: 'dados', label: 'Dados', icon: 'ri-user-line' }, { id: 'funis', label: 'Acesso a Funis', icon: 'ri-stack-line' }].map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${tab.icon} text-sm`}></i>{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'dados' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome completo <span className="text-rose-500">*</span></label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ex: João Silva" error={errors.full_name} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email <span className="text-rose-500">*</span></label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" error={errors.email} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" error={errors.password} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 cursor-pointer">
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirmar senha <span className="text-rose-500">*</span></label>
                <Input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" error={errors.confirmPassword} />
              </div>
            </div>

            {/* ── Seleção de cargo com preview de permissões ── */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
              <select value={role} onChange={e => setRole(e.target.value as UserRole)} className={`${inp} cursor-pointer`}>
                <option value="admin">Administrador</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </select>
              <p className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
                <i className="ri-information-line"></i>{ROLE_DESCRIPTIONS[role]}
              </p>
            </div>

            {/* Preview das permissões que serão aplicadas */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                <i className="ri-shield-check-line text-sm"></i>
                Permissões que serão aplicadas automaticamente
              </p>
              <div className="grid grid-cols-2 gap-1">
                {PERMISSION_SECTIONS.map(section => {
                  const perms = (getDefaultPermissions(role) as any)[section.key] || {};
                  const active = Object.values(perms).some(v => v === true);
                  return (
                    <div key={section.key} className={`flex items-center gap-1.5 text-[10px] ${active ? 'text-blue-700' : 'text-gray-400'}`}>
                      <i className={`${active ? 'ri-checkbox-circle-line text-blue-500' : 'ri-close-circle-line text-gray-300'} text-xs`}></i>
                      {section.label}
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <div className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-brand-500' : 'bg-gray-200'}`} onClick={() => setIsActive(!isActive)}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`}></span>
              </div>
              <span className="text-sm text-gray-700">Ativar usuário imediatamente</span>
            </label>
          </div>
        )}

        {activeTab === 'funis' && (
          <FunnelAccessSelector funnels={funnels} allowedFunnels={allowedFunnels} onChange={setAllowedFunnels} role={role} />
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={saving}>
            {saving
              ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin"></i>Criando...</span>
              : <span className="flex items-center justify-center gap-2"><i className="ri-user-add-line"></i>Criar Usuário</span>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── EditUserModal ─── */
function EditUserModal({ user, onClose, onSave, funnels }: {
  user: UserProfile; onClose: () => void;
  onSave: (user: Partial<UserProfile>) => void;
  funnels: FunnelOption[];
}) {
  const [role, setRole]           = useState<UserRole>(user.role);
  const [isActive, setIsActive]   = useState(user.is_active);
  const [allowedFunnels, setAllowedFunnels] = useState<string[] | null>(user.allowed_funnels ?? null);
  const [activeTab, setActiveTab] = useState<'dados' | 'permissoes' | 'funis'>('dados');

  // ── Mesclar permissões salvas com as keys novas (garante que novos módulos apareçam) ──
  const [permissions, setPermissions] = useState<Permissions>(() => ({
    ...EMPTY_PERMISSIONS,
    ...user.permissions,
  }));

  // ── Ao mudar o cargo, pergunta se quer aplicar as permissões padrão ────────
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);

  const handleRoleChange = (newRole: UserRole) => {
    if (newRole !== role) {
      setPendingRole(newRole);
      setShowRoleConfirm(true);
    }
  };

  const applyRoleDefaults = () => {
    if (!pendingRole) return;
    setRole(pendingRole);
    setPermissions(getDefaultPermissions(pendingRole));
    if (pendingRole === 'admin') setAllowedFunnels(null);
    else if (allowedFunnels === null) setAllowedFunnels([]);
    setShowRoleConfirm(false);
    setPendingRole(null);
  };

  const keepPermissions = () => {
    if (!pendingRole) return;
    setRole(pendingRole);
    if (pendingRole === 'admin') setAllowedFunnels(null);
    else if (allowedFunnels === null) setAllowedFunnels([]);
    setShowRoleConfirm(false);
    setPendingRole(null);
  };

  const handlePermissionChange = (section: string, action: string, value: boolean) => {
    setPermissions(prev => ({ ...prev, [section]: { ...(prev as any)[section], [action]: value } }));
  };

  const handleSubmit = () => onSave({ role, is_active: isActive, permissions, allowed_funnels: allowedFunnels });

  const tabs = [
    { id: 'dados',      label: 'Dados',       icon: 'ri-user-line' },
    { id: 'permissoes', label: 'Permissões',  icon: 'ri-shield-check-line' },
    { id: 'funis',      label: 'Funis',        icon: 'ri-stack-line' },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title="Editar Usuário" subtitle={user.email} size="md">
      <div className="space-y-4">
        {/* Header do usuário */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-sm">{user.full_name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        </div>

        {/* Confirmação ao mudar cargo */}
        {showRoleConfirm && pendingRole && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <i className="ri-question-line text-amber-500 text-lg mt-0.5"></i>
              <div>
                <p className="text-sm font-semibold text-amber-800">Mudar para {ROLE_DESCRIPTIONS[pendingRole] ? `"${['Administrador','Gerente','Operador','Visualizador'][['admin','manager','operator','viewer'].indexOf(pendingRole)]}"` : pendingRole}</p>
                <p className="text-xs text-amber-600 mt-1">Deseja aplicar as permissões padrão deste cargo ou manter as permissões atuais?</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={applyRoleDefaults}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer transition-colors">
                <i className="ri-refresh-line mr-1"></i>Aplicar padrões do cargo
              </button>
              <button onClick={keepPermissions}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                Manter permissões atuais
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          {tabs.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${tab.icon} text-sm`}></i>{tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Dados */}
        {activeTab === 'dados' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
              <select value={role} onChange={e => handleRoleChange(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
                <option value="admin">Administrador</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-400">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
              <div className="flex items-center gap-2.5 h-[38px]">
                <button onClick={() => setIsActive(!isActive)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-brand-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`}></span>
                </button>
                <span className="text-sm text-gray-700">{isActive ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Permissões — agora inclui todos os módulos */}
        {activeTab === 'permissoes' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">Ajuste as permissões individualmente</p>
              <button onClick={() => setPermissions(getDefaultPermissions(role))}
                className="text-[11px] text-[#004aad] hover:underline cursor-pointer flex items-center gap-1">
                <i className="ri-refresh-line text-xs"></i>Restaurar padrões do cargo
              </button>
            </div>
            {PERMISSION_SECTIONS.map(section => {
              const perms = (permissions as any)[section.key] || {};
              return (
                <div key={section.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white">
                      <i className={`${section.icon} text-sm text-gray-500`}></i>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{section.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {section.actions.map(action => (
                      <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={perms[action] === true}
                          onChange={e => handlePermissionChange(section.key, action, e.target.checked)}
                          className={`w-3.5 h-3.5 rounded ${action === 'delete' ? 'text-rose-500' : 'text-brand-500'}`} />
                        <span className={`text-xs ${action === 'delete' ? 'text-rose-500' : 'text-gray-500'}`}>{ACTION_LABELS[action]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab: Funis */}
        {activeTab === 'funis' && (
          <FunnelAccessSelector funnels={funnels} allowedFunnels={allowedFunnels} onChange={setAllowedFunnels} role={role} />
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} variant="outline" className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} className="flex-1">Salvar Alterações</Button>
        </div>
      </div>
    </Modal>
  );
}

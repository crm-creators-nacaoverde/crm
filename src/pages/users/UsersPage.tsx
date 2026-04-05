import { useState, useEffect, useCallback } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../hooks/useActivityLog';
import Button from '../../components/base/Button';
import Modal from '../../components/base/Modal';
import Input from '../../components/base/Input';
import AppLayout from '../../components/feature/AppLayout';

interface RoleOption {
  key: string;
  label: string;
}

const defaultRolePermissions: Record<string, any> = {
  admin: {
    clients: { view: true, edit: true, delete: true },
    interactions: { view: true, edit: true, delete: true },
    deals: { view: true, edit: true, delete: true },
    forms: { view: true, edit: true, delete: true },
    metrics: { view: true },
    settings: { view: true, edit: true },
    users: { view: true, edit: true },
    bible: { view: true, edit: true },
    whatsapp: { view: true, edit: true },
  },
  manager: {
    clients: { view: true, edit: true, delete: false },
    interactions: { view: true, edit: true, delete: false },
    deals: { view: true, edit: true, delete: false },
    forms: { view: true, edit: true, delete: false },
    metrics: { view: true },
    settings: { view: true, edit: false },
    users: { view: true, edit: false },
    bible: { view: true, edit: true },
    whatsapp: { view: true, edit: true },
  },
  operator: {
    clients: { view: true, edit: true, delete: false },
    interactions: { view: true, edit: true, delete: false },
    deals: { view: true, edit: true, delete: false },
    forms: { view: true, edit: false, delete: false },
    metrics: { view: true },
    settings: { view: false, edit: false },
    users: { view: false, edit: false },
    bible: { view: true, edit: false },
    whatsapp: { view: true, edit: false },
  },
  viewer: {
    clients: { view: true, edit: false, delete: false },
    interactions: { view: true, edit: false, delete: false },
    deals: { view: true, edit: false, delete: false },
    forms: { view: true, edit: false, delete: false },
    metrics: { view: true },
    settings: { view: false, edit: false },
    users: { view: false, edit: false },
    bible: { view: true, edit: false },
    whatsapp: { view: false, edit: false },
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
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
  const [dynamicRolePerms, setDynamicRolePerms] = useState<Record<string, any>>({});
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);

  const loadAvailableRoles = useCallback(async () => {
    const { data } = await supabase.from('company_settings').select('default_role_permissions, custom_roles').single();
    const customRoles = data?.custom_roles || [];
    const defaultPerms = data?.default_role_permissions || {};
    setDynamicRolePerms(defaultPerms);

    const defaultRoles: RoleOption[] = [
      { key: 'admin', label: 'Administrador' },
      { key: 'manager', label: 'Gerente' },
      { key: 'operator', label: 'Operador' },
      { key: 'viewer', label: 'Visualizador' },
    ];

    const combinedRoles = [...defaultRoles, ...customRoles.map((role: any) => ({ key: role.key, label: role.label }))];
    setAvailableRoles(combinedRoles);
  }, []);

  useEffect(() => {
    loadAvailableRoles();
  }, [loadAvailableRoles]);

  const getPermsForRole = (role: string) => {
    // Prioriza permissões customizadas do FuncoesModule, cai para hardcoded
    return dynamicRolePerms[role] || defaultRolePermissions[role as keyof typeof defaultRolePermissions] || defaultRolePermissions.viewer;
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

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

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleSaveUser = async (updatedUser: Partial<UserProfile>) => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          role: updatedUser.role,
          permissions: updatedUser.permissions,
          is_active: updatedUser.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id);

      if (error) throw error;
      
      await logActivity({
        action: 'update',
        module: 'users',
        entityId: selectedUser.id,
        entityName: selectedUser.full_name,
        details: { 
          before: { role: selectedUser.role, permissions: selectedUser.permissions, is_active: selectedUser.is_active },
          after: updatedUser
        }
      });
      
      await loadUsers();
      setShowModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  };

  const handleCreateUser = async (userData: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    is_active: boolean;
  }) => {
    try {
      const perms = getPermsForRole(userData.role);
      console.log('[handleCreateUser] Iniciando criação de usuário:', userData.email);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke('create-user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          full_name: userData.full_name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          permissions: perms,
          is_active: userData.is_active,
        },
      });

      if (error) {
        console.error('[handleCreateUser] Erro da API:', error);
        throw new Error(error.message);
      }

      const result = data;
      console.log('[handleCreateUser] Usuário criado com sucesso:', result);
      await logActivity({        action: 'create',
        module: 'users',
        entityId: result.user_id || 'unknown',
        entityName: userData.full_name,
        details: { email: userData.email, role: userData.role, is_active: userData.is_active }
      });

      await loadUsers();
      setShowCreateModal(false);
    } catch (error) {
      console.error('[handleCreateUser] Erro capturado:', error);
      throw error;
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;
      
      await logActivity({
        action: 'delete',
        module: 'users',
        entityId: userToDelete.id,
        entityName: userToDelete.full_name,
        details: { email: userToDelete.email, role: userToDelete.role }
      });
      
      await loadUsers();
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteUser = (user: UserProfile) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { bg: string; text: string; label: string; icon: string }> = {
      admin: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Administrador', icon: 'ri-shield-star-line' },
      manager: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Gerente', icon: 'ri-user-star-line' },
      operator: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Operador', icon: 'ri-user-settings-line' },
      viewer: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Visualizador', icon: 'ri-eye-line' },
    };
    const customRole = availableRoles.find(r => r.key === role);
    const c = customRole ? { bg: 'bg-violet-50', text: 'text-violet-700', label: customRole.label, icon: 'ri-user-star-line' } : config[role] || config.viewer;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${c.bg} ${c.text}`}>
        <i className={`${c.icon} text-[11px]`}></i>
        {c.label}
      </span>
    );
  };

  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => u.role === 'admin').length;

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
        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
              <i className="ri-group-line text-lg text-brand-600"></i>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{users.length}</p>
              <p className="text-xs text-gray-400">Total de usuários</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-lg text-emerald-600"></i>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-xs text-gray-400">Ativos</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <i className="ri-shield-star-line text-lg text-amber-600"></i>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{adminCount}</p>
              <p className="text-xs text-gray-400">Administradores</p>
            </div>
          </div>
        </div>

        {/* Header e filtros */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
            <p className="text-sm text-gray-400 mt-1">Gerencie os usuários do sistema e suas permissões</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} disabled={!canEdit}>Novo Usuário</Button>
        </div>

        <div className="flex items-center gap-3">
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="flex-1"
          />
          <div className="relative">
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer appearance-none pr-8"
            >
              <option value="all">Todas as funções</option>
              {availableRoles.map(r => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
          </div>
        </div>

        {/* Tabela de usuários */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-50">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">E-mail</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Função</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-4 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {user.is_active ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">Ativo</span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    {canEdit && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditUser(user)} className="text-brand-600 hover:text-brand-900 text-lg">
                          <i className="ri-edit-line"></i>
                        </button>
                        {profile?.id !== user.id && (
                          <button onClick={() => confirmDeleteUser(user)} className="text-red-600 hover:text-red-900 text-lg">
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateUserModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
          availableRoles={availableRoles}
        />
      )}

      {showModal && selectedUser && (
        <EditUserModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSaveUser}
          user={selectedUser}
          getPermsForRole={getPermsForRole}
          availableRoles={availableRoles}
        />
      )}

      {userToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Excluir Usuário"
          description={`Tem certeza que deseja excluir o usuário ${userToDelete.full_name}? Esta ação é irreversível.`}
          primaryButtonText="Excluir"
          primaryButtonAction={handleDeleteUser}
          primaryButtonColor="red"
          secondaryButtonText="Cancelar"
          secondaryButtonAction={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}
    </AppLayout>
  );
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    is_active: boolean;
  }) => Promise<void>;
  availableRoles: RoleOption[];
}

function CreateUserModal({ isOpen, onClose, onCreate, availableRoles }: CreateUserModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<string>('viewer');
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Todos os campos obrigatórios devem ser preenchidos.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        full_name: fullName,
        email,
        password,
        role,
        is_active: isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Usuário" description="Preencha os dados para criar um novo usuário no sistema.">
      <div className="space-y-4">
        <Input label="Nome Completo *" value={fullName} onChange={e => setFullName(e.target.value)} />
        <Input label="E-mail *" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Input
          label="Senha *"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          rightIcon={showPassword ? 'ri-eye-line' : 'ri-eye-off-line'}
          onRightIconClick={() => setShowPassword(!showPassword)}
        />
        <Input
          label="Confirmar Senha *"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          rightIcon={showPassword ? 'ri-eye-line' : 'ri-eye-off-line'}
          onRightIconClick={() => setShowPassword(!showPassword)}
        />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
          >
            {availableRoles.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 rounded text-brand-600" />
          Usuário Ativo
        </label>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} loading={saving}>Criar Usuário</Button>
      </div>
    </Modal>
  );
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserProfile>) => Promise<void>;
  user: UserProfile;
  availableRoles: RoleOption[];
}

function EditUserModal({ isOpen, onClose, onSave, user, getPermsForRole, availableRoles }: EditUserModalProps & { getPermsForRole: (role: string) => any }) {
  const [activeTab, setActiveTab] = useState<'dados' | 'permissoes' | 'funis'>('dados');
  const [role, setRole] = useState<string>(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [showApplyPerms, setShowApplyPerms] = useState(false);
  const [funnels, setFunnels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [allowedFunnels, setAllowedFunnels] = useState<string[]>((user as any).allowed_funnels || []);
  const [saving, setSaving] = useState(false);

  const [perms, setPerms] = useState<any>(user.permissions);

  useEffect(() => {
    setPerms(user.permissions);
    setRole(user.role);
    setIsActive(user.is_active);
    setAllowedFunnels((user as any).allowed_funnels || []);
  }, [user]);

  useEffect(() => {
    const loadFunnels = async () => {
      const { data, error } = await supabase.from('funnels').select('id, name, color').order('created_at');
      if (error) console.error('Erro ao carregar funis:', error);
      else setFunnels(data || []);
    };
    loadFunnels();
  }, []);

  const handlePermChange = (section: string, action: string, value: boolean) => {
    setPerms(prev => ({
      ...prev,
      [section]: { ...prev[section], [action]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        role,
        permissions: perms,
        is_active: isActive,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    const newPerms = getPermsForRole(newRole);
    setPerms(newPerms);
    setShowApplyPerms(false);
  };

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Editar Usuário: ${user.full_name}`} description="Altere os dados e permissões do usuário.">
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab('dados')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'dados' ? 'border-b-2 border-brand-500 text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>Dados</button>
        <button onClick={() => setActiveTab('permissoes')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'permissoes' ? 'border-b-2 border-brand-500 text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>Permissões</button>
        <button onClick={() => setActiveTab('funis')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'funis' ? 'border-b-2 border-brand-500 text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>Funis</button>
      </div>

      <div className="pt-4 space-y-4">
        {activeTab === 'dados' && (
          <div className="space-y-4">
            <Input label="Nome Completo" value={user.full_name} disabled />
            <Input label="E-mail" value={user.email} disabled />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
              <select
                value={role}
                onChange={(e) => { setRole(e.target.value); setShowApplyPerms(true); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
              >
                {availableRoles.map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              {showApplyPerms && (
                <p className="text-xs text-orange-500 mt-1">As permissões serão atualizadas para o padrão da nova função ao salvar.</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 rounded text-brand-600" />
              Usuário Ativo
            </label>
          </div>
        )}

        {activeTab === 'permissoes' && perms && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissões</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleRoleChange('admin')} className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer">Tudo ON</button>
                  <button onClick={() => handleRoleChange('viewer')} className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer">Tudo OFF</button>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {PERMISSION_SECTIONS.map(section => {
                  const sectionPerms = perms[section.key] || {};
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
                            <input type="checkbox" checked={sectionPerms[action] === true}
                              onChange={e => handlePermChange(section.key, action, e.target.checked)}
                              className={`w-3.5 h-3.5 rounded ${action === 'delete' ? 'text-rose-500' : 'text-brand-600'}`} />
                            <span className={`text-xs ${action === 'delete' ? 'text-rose-500' : 'text-gray-500'}`}>{ACTION_LABELS[action]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'funis' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Selecione os funis que este usuário terá acesso. Se nenhum for selecionado, terá acesso a todos.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {funnels.map(funnel => (
                <label key={funnel.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedFunnels.includes(funnel.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setAllowedFunnels(prev => [...prev, funnel.id]);
                      } else {
                        setAllowedFunnels(prev => prev.filter(id => id !== funnel.id));
                      }
                    }}
                    className="w-4 h-4 rounded text-brand-600"
                  />
                  <span className="text-sm font-medium text-gray-700">{funnel.name}</span>
                  <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: funnel.color }}></span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} loading={saving}>Salvar Alterações</Button>
      </div>
    </Modal>
  );
}

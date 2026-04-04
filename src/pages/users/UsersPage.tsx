import { useState, useEffect } from 'react';
import { supabase, UserProfile, UserRole } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../hooks/useActivityLog';
import Button from '../../components/base/Button';
import Modal from '../../components/base/Modal';
import Input from '../../components/base/Input';
import AppLayout from '../../components/feature/AppLayout';

const rolePermissions: Record<UserRole, any> = {
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

  useEffect(() => {
    supabase.from('company_settings').select('default_role_permissions').limit(1).single()
      .then(({ data }) => {
        if (data?.default_role_permissions) {
          setDynamicRolePerms(data.default_role_permissions);
        }
      });
  }, []);

  const getPermsForRole = (role: string) => {
    // Prioriza permissões customizadas do FuncoesModule, cai para hardcoded
    return dynamicRolePerms[role] || rolePermissions[role as keyof typeof rolePermissions] || rolePermissions.viewer;
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
    role: UserRole;
    is_active: boolean;
  }) => {
    try {
      const perms = getPermsForRole(userData.role);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/create-user`;
      
      console.log('[handleCreateUser] URL:', functionUrl);
      console.log('[handleCreateUser] Token presente:', !!token);
      console.log('[handleCreateUser] Dados:', userData);

      const response = await fetch(
        functionUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          full_name: userData.full_name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          permissions: perms,
          is_active: userData.is_active,
        }),
      }
    );

      console.log('[handleCreateUser] Response status:', response.status);
      console.log('[handleCreateUser] Response headers:', Object.fromEntries(response.headers));

      if (!response.ok) {
        let errorMsg = 'Erro ao criar usuário';
        try {
          const result = await response.json();
          errorMsg = result.error || errorMsg;
          console.error('[handleCreateUser] Erro da API:', result);
        } catch (e) {
          errorMsg = `Erro HTTP ${response.status}: ${response.statusText}`;
          console.error('[handleCreateUser] Erro ao parsear resposta:', e);
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log('[handleCreateUser] Sucesso:', result);

      await logActivity({
        action: 'create',
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

  const getRoleBadge = (role: UserRole) => {
    const config: Record<string, { bg: string; text: string; label: string; icon: string }> = {
      admin: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Administrador', icon: 'ri-shield-star-line' },
      manager: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Gerente', icon: 'ri-user-star-line' },
      operator: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Operador', icon: 'ri-user-settings-line' },
      viewer: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Visualizador', icon: 'ri-eye-line' },
    };
    const c = config[role] || config.viewer;
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

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full sm:w-auto pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-white cursor-pointer"
                >
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

        {/* Users list */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Usuário</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Função</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cadastro</th>
                  {canEdit && (
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center shadow-sm">
                          <span className="text-white font-semibold text-xs">
                            {u.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{getRoleBadge(u.role)}</td>
                    <td className="px-5 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleEditUser(u)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all cursor-pointer"
                            title="Editar"
                          >
                            <i className="ri-edit-line text-sm"></i>
                          </button>
                          {u.id !== profile?.id && (
                            <button
                              onClick={() => confirmDeleteUser(u)}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Excluir"
                            >
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <i className="ri-user-search-line text-2xl text-gray-300"></i>
                      </div>
                      <p className="text-sm text-gray-400">Nenhum usuário encontrado</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && selectedUser && (
          <EditUserModal
            user={selectedUser}
            onClose={() => { setShowModal(false); setSelectedUser(null); }}
            onSave={handleSaveUser}
          getPermsForRole={getPermsForRole}
          />
        )}

        {showCreateModal && (
          <CreateUserModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateUser}
          getPermsForRole={getPermsForRole}
          />
        )}

        {showDeleteModal && userToDelete && (
          <Modal isOpen={true} onClose={() => { setShowDeleteModal(false); setUserToDelete(null); }} title="Excluir Usuário" subtitle="Esta ação não pode ser desfeita">
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
              <p className="text-sm text-gray-600">
                Tem certeza que deseja excluir este usuário? Todos os dados associados a ele serão removidos permanentemente.
              </p>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }} variant="outline" className="flex-1" disabled={deleting}>
                  Cancelar
                </Button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-loader-4-line animate-spin"></i>
                      Excluindo...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-delete-bin-line"></i>
                      Excluir Usuário
                    </span>
                  )}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}

/* ─── Create User Modal ─── */

interface CreateUserModalProps {
  onClose: () => void;
  onCreate: (data: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    is_active: boolean;
  }) => Promise<void>;
}

function CreateUserModal({ onClose, onCreate, getPermsForRole }: CreateUserModalProps & { getPermsForRole: (role: string) => any }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.full_name = 'Nome é obrigatório';
    if (!email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }
    if (!password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      await onCreate({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        is_active: isActive,
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const roleDescriptions: Record<string, string> = {
    admin: 'Acesso total ao sistema',
    manager: 'Gerencia clientes, interações e visualiza configurações',
    operator: 'Edita clientes e interações',
    viewer: 'Apenas visualização de clientes e interações',
  };
  // Ao submeter, usa as permissões dinâmicas — garantido via getPermsForRole em handleCreateUser

  return (
    <Modal isOpen={true} onClose={onClose} title="Novo Usuário" subtitle="Preencha os dados para criar um novo acesso">
      <div className="space-y-5">
        {error && (
          <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm">
            <i className="ri-error-warning-line text-lg"></i>
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Nome completo <span className="text-rose-500">*</span>
          </label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: João Silva"
            error={errors.full_name}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Email <span className="text-rose-500">*</span>
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            error={errors.email}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Senha <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                error={errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Confirmar senha <span className="text-rose-500">*</span>
            </label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              error={errors.confirmPassword}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
          >
            <option value="admin">Administrador</option>
            <option value="manager">Gerente</option>
            <option value="operator">Operador</option>
            <option value="viewer">Visualizador</option>
          </select>
          <p className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
            <i className="ri-information-line"></i>
            {roleDescriptions[role]}
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-brand-500' : 'bg-gray-200'}`} onClick={() => setIsActive(!isActive)}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isActive ? 'translate-x-5' : 'translate-x-0'}`}></span>
            </div>
            <span className="text-sm text-gray-700">Ativar usuário imediatamente</span>
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={saving}>
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <i className="ri-loader-4-line animate-spin"></i>
                Criando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <i className="ri-user-add-line"></i>
                Criar Usuário
              </span>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Edit User Modal ─── */

interface EditUserModalProps {
  user: UserProfile;
  onClose: () => void;
  onSave: (user: Partial<UserProfile>) => void;
}

function EditUserModal({ user, onClose, onSave, getPermsForRole }: EditUserModalProps & { getPermsForRole: (role: string) => any }) {
  const [activeTab, setActiveTab] = useState<'dados' | 'permissoes' | 'funis'>('dados');
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [showApplyPerms, setShowApplyPerms] = useState(false);
  const [funnels, setFunnels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [allowedFunnels, setAllowedFunnels] = useState<string[]>((user as any).allowed_funnels || []);
  const [permissions, setPermissions] = useState(() => {
    const defaultPerms = {
      clients: { view: false, edit: false, delete: false },
      interactions: { view: false, edit: false, delete: false },
      deals: { view: false, edit: false, delete: false },
      forms: { view: false, edit: false, delete: false },
      metrics: { view: false },
      settings: { view: false, edit: false },
      users: { view: false, edit: false },
    };
    return { ...defaultPerms, ...user.permissions };
  });

  useEffect(() => {
    supabase.from('funnels').select('id, name, color').order('created_at')
      .then(({ data }) => { if (data) setFunnels(data); });
  }, []);

  const handlePermissionChange = (section: string, action: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [action]: value
      }
    }));
  };

  const handleSubmit = () => {
    onSave({ role, is_active: isActive, permissions, allowed_funnels: allowedFunnels } as any);
  };

  const permissionSections = [
    {
      key: 'clients',
      label: 'Creators',
      icon: 'ri-user-star-line',
      actions: ['view', 'edit', 'delete'],
    },
    {
      key: 'deals',
      label: 'Acompanhamento',
      icon: 'ri-kanban-view',
      actions: ['view', 'edit', 'delete'],
    },
    {
      key: 'interactions',
      label: 'Interações',
      icon: 'ri-chat-3-line',
      actions: ['view', 'edit', 'delete'],
    },
    {
      key: 'forms',
      label: 'Formulários',
      icon: 'ri-survey-line',
      actions: ['view', 'edit', 'delete'],
    },
    {
      key: 'metrics',
      label: 'Métricas',
      icon: 'ri-pie-chart-line',
      actions: ['view'],
    },
    {
      key: 'settings',
      label: 'Configurações',
      icon: 'ri-settings-4-line',
      actions: ['view', 'edit'],
    },
    {
      key: 'users',
      label: 'Usuários',
      icon: 'ri-group-line',
      actions: ['view', 'edit'],
    },
    {
      key: 'bible',
      label: 'Bíblia Comercial',
      icon: 'ri-book-open-line',
      actions: ['view', 'edit'],
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: 'ri-whatsapp-line',
      actions: ['view', 'edit'],
    },
  ];

  const actionLabels: Record<string, string> = {
    view: 'Ver',
    edit: 'Editar',
    delete: 'Excluir',
  };

  const tabs = [
    { id: 'dados',      label: 'Dados',         icon: 'ri-user-line' },
    { id: 'permissoes', label: 'Permissões',     icon: 'ri-shield-keyhole-line' },
    { id: 'funis',      label: 'Acesso a Funis', icon: 'ri-stack-line' },
  ] as const;

  return (
    <Modal isOpen={true} onClose={onClose} title="Editar Usuário" subtitle={user.email}>
      <div className="space-y-5">
        {/* Header do usuário */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
          <div className="w-11 h-11 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-sm">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={`${tab.icon} text-sm`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Aba Dados ── */}
        {activeTab === 'dados' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
                <select
                  value={role}
                  onChange={(e) => { setRole(e.target.value as UserRole); setShowApplyPerms(true); }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
                >
                  <option value="admin">Administrador</option>
                  <option value="manager">Gerente</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                <div className="flex items-center gap-2.5 h-[38px]">
                  <button
                    onClick={() => setIsActive(!isActive)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-brand-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isActive ? 'translate-x-5' : 'translate-x-0'}`}></span>
                  </button>
                  <span className="text-sm text-gray-700">{isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            </div>

            {showApplyPerms && (
              <div className="flex items-center gap-3 p-3 bg-[#5de0e6]/10 border border-[#5de0e6]/30 rounded-xl">
                <i className="ri-information-line text-[#004aad] text-sm flex-shrink-0"></i>
                <p className="text-xs text-[#004aad] flex-1">Cargo alterado. Aplicar permissões padrão do cargo?</p>
                <button type="button"
                  onClick={() => {
                    const perms = getPermsForRole(role);
                    setPermissions(prev => ({ ...prev, ...perms }));
                    setShowApplyPerms(false);
                  }}
                  className="text-xs font-semibold text-white bg-[#004aad] px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#003d91] transition-colors whitespace-nowrap">
                  Aplicar
                </button>
                <button type="button" onClick={() => setShowApplyPerms(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                  Manter
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Aba Permissões ── */}
        {activeTab === 'permissoes' && (
          <div>
            <div className="space-y-2">
              {permissionSections.map((section) => {
                const perms = permissions[section.key as keyof typeof permissions] || {};
                return (
                  <div key={section.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white">
                        <i className={`${section.icon} text-sm text-gray-500`}></i>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{section.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {section.actions.map((action) => (
                        <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(perms as any)[action] === true}
                            onChange={(e) => handlePermissionChange(section.key, action, e.target.checked)}
                            className={`w-3.5 h-3.5 rounded focus:ring-brand-500 ${action === 'delete' ? 'text-rose-500 focus:ring-rose-500' : 'text-brand-500'}`}
                          />
                          <span className={`text-xs ${action === 'delete' ? 'text-rose-500' : 'text-gray-500'}`}>{actionLabels[action]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Aba Acesso a Funis ── */}
        {activeTab === 'funis' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Selecione os funis que este usuário pode acessar. Deixe vazio para permitir acesso a todos.</p>
            <div className="space-y-2">
              {funnels.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>Carregando funis...
                </div>
              ) : (
                funnels.map(funnel => {
                  const isChecked = allowedFunnels.length === 0 || allowedFunnels.includes(funnel.id);
                  return (
                    <label key={funnel.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (allowedFunnels.length === 0) {
                            // Saindo do "todos" — marcar todos exceto este
                            setAllowedFunnels(funnels.map(f => f.id).filter(id => id !== funnel.id));
                          } else if (e.target.checked) {
                            const next = [...allowedFunnels, funnel.id];
                            // Se todos estão marcados, voltar para "todos" (array vazio)
                            setAllowedFunnels(next.length === funnels.length ? [] : next);
                          } else {
                            setAllowedFunnels(allowedFunnels.filter(id => id !== funnel.id));
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-brand-500 focus:ring-brand-500"
                      />
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: funnel.color }}></div>
                      <span className="text-sm font-medium text-gray-700">{funnel.name}</span>
                      {allowedFunnels.length === 0 && (
                        <span className="ml-auto text-[10px] text-gray-400">acesso total</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
            {allowedFunnels.length > 0 && allowedFunnels.length < funnels.length && (
              <button
                onClick={() => setAllowedFunnels([])}
                className="text-xs text-[#004aad] hover:underline cursor-pointer"
              >
                Permitir acesso a todos os funis
              </button>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            Salvar Alterações
          </Button>
        </div>
      </div>
    </Modal>
  );
}

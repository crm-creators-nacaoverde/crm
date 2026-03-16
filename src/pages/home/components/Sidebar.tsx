import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { profile, signOut, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'clients', label: 'Creators', icon: 'ri-user-line', permission: 'clients', route: '/' },
    { id: 'kanban', label: 'Acompanhamento', icon: 'ri-layout-board-line', permission: 'deals', route: '/' },
    { id: 'interactions', label: 'Interações', icon: 'ri-chat-3-line', permission: 'interactions', route: '/' },
    { id: 'metrics', label: 'Métricas', icon: 'ri-bar-chart-line', permission: 'metrics', route: '/' },
    { id: 'settings', label: 'Configurações', icon: 'ri-settings-3-line', permission: 'settings', route: '/' },
  ];

  if (hasPermission('users', 'view')) {
    menuItems.push({ id: 'users', label: 'Usuários', icon: 'ri-team-line', permission: 'users', route: '/users' });
  }

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const handleMenuClick = (item: typeof menuItems[0]) => {
    if (item.route === '/users') {
      navigate('/users');
    } else {
      if (location.pathname !== '/') {
        navigate('/');
      }
      onSectionChange(item.id);
    }
  };

  const isActive = (item: typeof menuItems[0]) => {
    if (item.route === '/users') {
      return location.pathname === '/users';
    }
    return location.pathname === '/' && activeSection === item.id;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#004aad] rounded-xl flex items-center justify-center">
            <i className="ri-dashboard-line text-xl text-white"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">CRM Creators</h1>
            <p className="text-xs text-gray-500">Sistema de Gestão</p>
          </div>
        </div>
      </div>

      {profile && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5de0e6]/20 rounded-full flex items-center justify-center">
              <span className="text-[#004aad] font-semibold text-sm">
                {profile.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">{profile.full_name}</div>
              <div className="text-xs text-gray-500 capitalize">{
                profile.role === 'admin' ? 'Administrador' :
                profile.role === 'manager' ? 'Gerente' :
                profile.role === 'operator' ? 'Operador' : 'Visualizador'
              }</div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          if (!hasPermission(item.permission, 'view')) return null;

          return (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item)}
              data-tour={`sidebar-${item.id}`}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                isActive(item)
                  ? 'bg-[#5de0e6]/10 text-[#004aad] font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className={`${item.icon} text-xl`}></i>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all whitespace-nowrap cursor-pointer"
        >
          <i className="ri-logout-box-line text-xl"></i>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
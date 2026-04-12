import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanySettings } from '../../contexts/CompanySettingsContext';
import { useSampleAlerts } from '../../hooks/useSampleAlerts';
import { CadastrosProvider } from '../../contexts/CadastrosContext';
import NotificationPanel from './NotificationPanel';
import SystemTour from './SystemTour';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [tourTrigger, setTourTrigger] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { user, profile, loading, signOut, hasPermission } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { alerts, unreadCount, markAsRead, markAllAsRead } = useSampleAlerts();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { id: 'metrics',     label: 'Métricas',       icon: 'ri-line-chart-line',          path: '/',               permission: 'metrics' },
    { id: 'clients',     label: 'Creators',        icon: 'ri-user-star-line',           path: '/creators',       permission: 'clients' },
    { id: 'kanban',      label: 'Acompanhamento',  icon: 'ri-kanban-view',              path: '/acompanhamento', permission: 'deals' },
    { id: 'interactions',label: 'Interações',      icon: 'ri-chat-3-line',              path: '/interacoes',     permission: 'interactions' },
    { id: 'logistica',   label: 'Logística',       icon: 'ri-truck-line',               path: '/logistica',      permission: 'logistica' },
    { id: 'financeiro',  label: 'Financeiro',      icon: 'ri-money-dollar-circle-line', path: '/financeiro',     permission: 'financeiro' },
    { id: 'biblia',      label: 'Bíblia Comercial', icon: 'ri-book-open-line',           path: '/biblia',         permission: 'bible' },
    { id: 'whatsapp',    label: 'WhatsApp',         icon: 'ri-whatsapp-line',            path: '/whatsapp',       permission: 'whatsapp' },
    { id: 'settings',    label: 'Configurações',   icon: 'ri-settings-3-line',          path: '/configuracoes',  permission: 'settings' },
  ];

  const isActive = (item: typeof menuItems[0]) => {
    return location.pathname === item.path;
  };

  const handleNavClick = (item: typeof menuItems[0]) => {
    navigate(item.path);
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Erro ao sair:', error);
      alert('Erro ao sair da conta. Tente novamente.');
    }
  };

  const getPageTitle = () => {
    const current = menuItems.find(item => location.pathname === item.path);
    return current?.label || 'Acompanhamento';
  };

  const getPageDescription = () => {
    const descriptions: Record<string, string> = {
      '/':              'Indicadores de desempenho',
      '/creators':      'Base de creators e influenciadores',
      '/acompanhamento':'Pipeline de vendas e oportunidades',
      '/interacoes':    'Histórico de comunicações',
      '/logistica':     'Controle de envios e rastreamento',
      '/financeiro':    'Pagamentos e histórico financeiro',
      '/biblia':         'Treinamento e desenvolvimento',
      '/whatsapp':       'Central de atendimento WhatsApp',
      '/formularios':   'Crie e gerencie formulários para creators',
      '/webhooks':      'Receba leads automaticamente de fontes externas',
      '/configuracoes': 'Preferências do sistema',
      '/users':         'Gerencie acessos e permissões da equipe',
      '/logs':          'Histórico de atividades do sistema',
    };
    return descriptions[location.pathname] || '';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin:    'Administrador',
      manager:  'Gerente',
      operator: 'Operador',
      viewer:   'Visualizador',
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500 text-sm">Redirecionando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500 text-sm">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <i className="ri-time-line text-3xl text-amber-500"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Conta Pendente</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            Sua conta está aguardando aprovação do administrador. Você receberá acesso em breve.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-[#004aad] text-white text-sm font-medium rounded-lg hover:bg-[#003d91] transition-colors cursor-pointer whitespace-nowrap"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  const mainMenuItems  = menuItems.filter(item => !['settings'].includes(item.id));
  const bottomMenuItems = menuItems.filter(item => ['settings'].includes(item.id));

  return (
    <CadastrosProvider>
    <div className="min-h-screen bg-[#f8fafb]">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-100 flex flex-col z-50 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo area */}
        <div className={`h-[64px] flex items-center border-b border-gray-50 ${sidebarCollapsed ? 'px-3 justify-center' : 'px-5'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 min-w-[36px] rounded-xl flex items-center justify-center bg-gray-100">
              {companySettings.logo_base64 ? (
                <img
                  src={companySettings.logo_base64}
                  alt={companySettings.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <img
                  src="https://static.readdy.ai/image/70e45d590e9f98e53f87ef3694a62a6d/0c4980ef84e25e6962183ed0f1e9a202.png"
                  alt="Logo padrão"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-[15px] font-bold text-gray-900 truncate leading-tight">{companySettings.name || 'CRM Creators'}</h1>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Gestão de Influenciadores</p>
              </div>
            )}
          </div>
        </div>

        {/* Main navigation */}
        <nav className={`flex-1 py-4 ${sidebarCollapsed ? 'px-2' : 'px-3'} overflow-y-auto`}>
          {!sidebarCollapsed && (
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Menu</p>
          )}
          <div className="space-y-0.5">
            {mainMenuItems.map((item) => {
              if (!hasPermission(item.permission, 'view')) return null;
              const active = isActive(item);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  data-tour={`menu-${item.id}`}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap group ${
                    sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
                  } ${
                    active
                      ? 'bg-[#5de0e6]/10 text-[#004aad]'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <div className={`flex items-center justify-center ${sidebarCollapsed ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg'} ${
                    active
                      ? 'bg-[#5de0e6]/20 text-[#004aad]'
                      : 'bg-transparent group-hover:bg-gray-100 text-gray-400 group-hover:text-gray-600'
                  } transition-all`}>
                    <i className={`${item.icon} ${sidebarCollapsed ? 'text-lg' : 'text-[17px]'}`}></i>
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0 text-left">
                      <span className={`text-[13px] block leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                        {item.label}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className={`border-t border-gray-50 ${sidebarCollapsed ? 'px-2' : 'px-3'} py-3`}>
          {bottomMenuItems.map((item) => {
            if (!hasPermission(item.permission, 'view')) return null;
            const active = isActive(item);

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap group ${
                  sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
                } ${
                  active
                    ? 'bg-[#5de0e6]/10 text-[#004aad]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <div className={`flex items-center justify-center ${sidebarCollapsed ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg'} ${
                  active
                    ? 'bg-[#5de0e6]/20 text-[#004aad]'
                    : 'bg-transparent group-hover:bg-gray-100 text-gray-400 group-hover:text-gray-600'
                } transition-all`}>
                  <i className={`${item.icon} ${sidebarCollapsed ? 'text-lg' : 'text-[17px]'}`}></i>
                </div>
                {!sidebarCollapsed && (
                  <span className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                )}
              </button>
            );
          })}

          {/* Collapse button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-3 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all duration-200 cursor-pointer whitespace-nowrap mt-1 ${
              sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
            }`}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <div className={`flex items-center justify-center ${sidebarCollapsed ? 'w-10 h-10' : 'w-8 h-8'}`}>
              <i className={`${sidebarCollapsed ? 'ri-arrow-right-double-line' : 'ri-arrow-left-double-line'} text-[17px]`}></i>
            </div>
            {!sidebarCollapsed && <span className="text-[13px] font-medium">Recolher</span>}
          </button>
        </div>
      </aside>

      {/* Top Header */}
      <header
        className={`fixed top-0 right-0 h-[64px] bg-white/80 backdrop-blur-md border-b border-gray-100 z-30 flex items-center justify-between px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'left-0 lg:left-[68px]' : 'left-0 lg:left-[240px]'
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500"
          >
            <i className="ri-menu-2-line text-xl"></i>
          </button>

          <div>
            <h2 className="text-[15px] font-semibold text-gray-900 leading-tight">{getPageTitle()}</h2>
            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{getPageDescription()}</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTourTrigger(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all cursor-pointer"
            title="Ajuda / Tour Guiado"
          >
            <i className="ri-question-line text-lg"></i>
          </button>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              data-tour="notifications"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all cursor-pointer relative"
            >
              <i className="ri-notification-3-line text-lg"></i>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[9px] font-bold rounded-full px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel
              isOpen={notifOpen}
              onClose={() => setNotifOpen(false)}
              alerts={alerts}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />
          </div>

          <div className="w-px h-8 bg-gray-100 mx-1"></div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-semibold text-xs">
                  {profile.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[13px] font-medium text-gray-800 leading-tight">{profile.full_name}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{getRoleLabel(profile.role)}</p>
              </div>
              <i className={`ri-arrow-down-s-line text-gray-400 text-sm transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{profile.email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { navigate('/configuracoes'); setProfileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    <i className="ri-settings-4-line text-base text-gray-400"></i>
                    Configurações
                  </button>
                </div>
                <div className="border-t border-gray-50 pt-1">
                  {hasPermission('users', 'view') && (
                    <button
                      onClick={() => { navigate('/users'); setProfileMenuOpen(false); }}
                      data-tour="menu-users"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                    >
                      <i className="ri-group-line text-base text-gray-400"></i>
                      Gestão de Equipe
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <i className="ri-logout-box-r-line text-base"></i>
                    Sair da conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        className={`pt-[64px] min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        }`}
      >
        <div className="p-5 lg:p-6">{children}</div>
      </main>

      <SystemTour 
        startTrigger={tourTrigger} 
        onTourStart={() => setTourTrigger(false)} 
      />
    </div>
    </CadastrosProvider>
  );
}

import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/feature/AppLayout';
import { useAuth } from '../../contexts/AuthContext';

interface SettingsCard {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  path: string;
  permission?: string;
  permissionAction?: 'view' | 'edit';
}

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const cards: SettingsCard[] = [
    {
      icon: 'ri-user-settings-line',
      iconBg: 'bg-[#5de0e6]/15',
      iconColor: 'text-[#004aad]',
      title: 'Meu Perfil',
      description: 'Foto, nome, senha e preferências de notificação',
      path: '/configuracoes/usuario',
    },
    {
      icon: 'ri-building-4-line',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      title: 'Configurações da Empresa',
      description: 'Logo, cor, alertas globais e aparência do sistema',
      path: '/configuracoes/empresa',
      permission: 'settings',
      permissionAction: 'edit',
    },
    {
      icon: 'ri-list-settings-line',
      iconBg: 'bg-gray-50',
      iconColor: 'text-gray-600',
      title: 'Cadastros do Sistema',
      description: 'Categorias, plataformas, fontes, produtos, transportadoras e mais',
      path: '/configuracoes/cadastros',
      permission: 'settings',
      permissionAction: 'view',
    },
    {
      icon: 'ri-team-line',
      iconBg: 'bg-[#5de0e6]/15',
      iconColor: 'text-[#004aad]',
      title: 'Usuários',
      description: 'Gerencie acessos e permissões da equipe',
      path: '/users',
      permission: 'users',
      permissionAction: 'view',
    },
    {
      icon: 'ri-survey-line',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      title: 'Formulários',
      description: 'Crie e gerencie formulários para enviar aos creators',
      path: '/formularios',
      permission: 'forms',
      permissionAction: 'view',
    },
    {
      icon: 'ri-webhook-line',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      title: 'Webhooks',
      description: 'Receba leads automaticamente de fontes externas',
      path: '/webhooks',
      permission: 'webhooks',
      permissionAction: 'view',
    },
    {
      icon: 'ri-history-line',
      iconBg: 'bg-[#5de0e6]/15',
      iconColor: 'text-[#004aad]',
      title: 'Logs do Sistema',
      description: 'Histórico de atividades e ações realizadas no CRM',
      path: '/logs',
      permission: 'users',
      permissionAction: 'view',
    },
  ];

  const visibleCards = cards.filter(card => {
    if (!card.permission) return true;
    return hasPermission(card.permission, card.permissionAction || 'view');
  });

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie seu perfil e as preferências do sistema</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="flex items-center justify-between p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-sm hover:border-gray-200 transition-all cursor-pointer text-left group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${card.iconBg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                  <i className={`${card.icon} text-xl ${card.iconColor}`}></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{card.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{card.description}</p>
                </div>
              </div>
              <i className="ri-arrow-right-s-line text-gray-300 text-xl group-hover:text-gray-400 transition-colors flex-shrink-0 ml-3"></i>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

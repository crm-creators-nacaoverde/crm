import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/feature/AppLayout';
import { useAuth } from '../../contexts/AuthContext';

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const canViewLogs     = hasPermission('logs', 'view');
  const canViewWebhooks = hasPermission('webhooks', 'view');

  const cards = [
    {
      title:       'Meu Perfil',
      description: 'Foto, nome, senha e preferências de notificação',
      icon:        'ri-user-settings-line',
      iconBg:      'bg-[#5de0e6]/10',
      iconColor:   'text-[#004aad]',
      route:       '/configuracoes/usuario',
      available:   true,
    },
    {
      title:       'Configurações da Empresa',
      description: 'Logo, cor, alertas globais e aparência do sistema',
      icon:        'ri-building-4-line',
      iconBg:      'bg-amber-50',
      iconColor:   'text-amber-600',
      route:       '/configuracoes/empresa',
      available:   isAdmin,
    },
    {
      title:       'Logs do Sistema',
      description: 'Histórico de atividades e ações realizadas no CRM',
      icon:        'ri-history-line',
      iconBg:      'bg-slate-50',
      iconColor:   'text-slate-600',
      route:       '/logs',
      available:   canViewLogs,
    },
    {
      title:       'Webhooks',
      description: 'Receba leads automaticamente de fontes externas',
      icon:        'ri-webhook-line',
      iconBg:      'bg-violet-50',
      iconColor:   'text-violet-600',
      route:       '/webhooks',
      available:   canViewWebhooks,
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-400 mt-1">Gerencie seu perfil e as preferências do sistema</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.filter(card => card.available).map((card) => (
            <button
              key={card.route}
              onClick={() => navigate(card.route)}
              className="text-left bg-white rounded-2xl border border-gray-100 p-6 shadow-sm transition-all group hover:shadow-md hover:border-gray-200 cursor-pointer"
            >
              <div className={`w-12 h-12 ${card.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
                <i className={`${card.icon} text-2xl ${card.iconColor}`}></i>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{card.description}</p>
                </div>
                <i className="ri-arrow-right-s-line text-gray-300 group-hover:text-gray-500 text-xl mt-0.5 transition-colors flex-shrink-0"></i>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

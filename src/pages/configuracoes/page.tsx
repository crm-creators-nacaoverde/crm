import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/feature/AppLayout';
import { useAuth } from '../../contexts/AuthContext';

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const cards = [
    {
      title: 'Meu Perfil',
      description: 'Foto, nome, senha e preferências de notificação',
      icon: 'ri-user-settings-line',
      iconBg: 'bg-[#5de0e6]/10',
      iconColor: 'text-[#004aad]',
      route: '/configuracoes/usuario',
      available: true,
    },
    {
      title: 'Configurações da Empresa',
      description: 'Logo, cor, alertas globais e aparência do sistema',
      icon: 'ri-building-4-line',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      route: '/configuracoes/empresa',
      available: isAdmin,
      adminOnly: true,
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
          {cards.map((card) => (
            <button
              key={card.route}
              onClick={() => card.available && navigate(card.route)}
              disabled={!card.available}
              className={`text-left bg-white rounded-2xl border border-gray-100 p-6 shadow-sm transition-all group
                ${card.available
                  ? 'hover:shadow-md hover:border-gray-200 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'}`}
            >
              <div className={`w-12 h-12 ${card.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
                <i className={`${card.icon} text-2xl ${card.iconColor}`}></i>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{card.description}</p>
                </div>
                {card.available && (
                  <i className="ri-arrow-right-s-line text-gray-300 group-hover:text-gray-500 text-xl mt-0.5 transition-colors flex-shrink-0"></i>
                )}
              </div>
              {card.adminOnly && !isAdmin && (
                <span className="inline-flex items-center gap-1 mt-3 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  <i className="ri-lock-line text-xs"></i> Apenas admins
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

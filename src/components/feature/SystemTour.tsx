import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  path?: string; // Caminho para onde o tour deve navegar antes de mostrar o passo
  action?: () => void; // Ação opcional a ser executada antes do passo
}

const TOUR_COMPLETED_KEY = 'crm_tour_completed';

export default function SystemTour() {
  const { profile, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Define os passos dinamicamente com base nas permissões
  const tourSteps = useMemo(() => {
    const steps: TourStep[] = [
      {
        target: 'body',
        title: '👋 Bem-vindo ao CRM Creators!',
        content: 'Este é o seu novo sistema de gestão. Vamos fazer um tour completo para você aprender a usar todas as funcionalidades disponíveis para o seu perfil.',
        placement: 'bottom'
      }
    ];

    // 1. Menu Lateral e Navegação Geral
    steps.push({
      target: '[data-tour^="menu-"]',
      title: '📂 Menu de Navegação',
      content: 'Aqui no lado esquerdo você encontra todos os módulos que tem acesso. O menu se adapta automaticamente às suas permissões.',
      placement: 'right'
    });

    // 2. Módulo de Métricas (Dashboard)
    if (hasPermission('metrics', 'view')) {
      steps.push({
        target: '[data-tour="menu-metrics"]',
        title: '📈 Métricas e Performance',
        content: 'Acompanhe em tempo real o desempenho geral, GMV, taxa de atividade e ranking dos melhores creators.',
        placement: 'right',
        path: '/'
      });
    }

    // 3. Módulo de Creators
    if (hasPermission('clients', 'view')) {
      steps.push({
        target: '[data-tour="menu-clients"]',
        title: '👥 Gestão de Creators',
        content: 'Aqui você gerencia sua base de contatos. Pode filtrar por plataforma, categoria e status de atividade.',
        placement: 'right',
        path: '/creators'
      });
      
      if (hasPermission('clients', 'edit')) {
        steps.push({
          target: '[data-tour="add-client"]',
          title: '➕ Novo Cadastro',
          content: 'Adicione novos creators rapidamente informando redes sociais, dados de contato e informações de pagamento.',
          placement: 'bottom',
          path: '/creators'
        });
      }
    }

    // 4. Módulo de Acompanhamento (Kanban)
    if (hasPermission('deals', 'view')) {
      steps.push({
        target: '[data-tour="menu-kanban"]',
        title: '📊 Fluxo de Acompanhamento',
        content: 'O coração da sua operação. Organize o processo de negociação e envio de amostras em um quadro visual (Kanban).',
        placement: 'right',
        path: '/acompanhamento'
      });

      steps.push({
        target: '[data-tour="view-toggle"]',
        title: '🔄 Modos de Visualização',
        content: 'Prefere listas? Você pode alternar entre o quadro Kanban e uma visualização em tabela a qualquer momento.',
        placement: 'bottom',
        path: '/acompanhamento'
      });

      if (hasPermission('deals', 'edit')) {
        steps.push({
          target: '[data-tour="add-deal"]',
          title: '🎯 Iniciar Negociação',
          content: 'Crie novos cards de acompanhamento para creators específicos e defina a prioridade da negociação.',
          placement: 'bottom',
          path: '/acompanhamento'
        });
      }
    }

    // 5. Módulo de Interações
    if (hasPermission('interactions', 'view')) {
      steps.push({
        target: '[data-tour="menu-interactions"]',
        title: '💬 Histórico de Interações',
        content: 'Nunca perca o fio da meada. Veja todas as conversas e registros de contato feitos com os creators.',
        placement: 'right',
        path: '/interacoes'
      });
    }

    // 6. Módulos Operacionais (Logística e Financeiro)
    if (hasPermission('logistica', 'view')) {
      steps.push({
        target: '[data-tour="menu-logistica"]',
        title: '🚚 Logística e Envios',
        content: 'Controle o envio de amostras, códigos de rastreio e garanta que o produto chegue na mão do creator.',
        placement: 'right',
        path: '/logistica'
      });
    }

    if (hasPermission('financeiro', 'view')) {
      steps.push({
        target: '[data-tour="menu-financeiro"]',
        title: '💰 Financeiro',
        content: 'Gerencie pagamentos, comissões e histórico financeiro de toda a operação de forma centralizada.',
        placement: 'right',
        path: '/financeiro'
      });
    }

    // 7. Treinamento (Bíblia Comercial)
    if (hasPermission('bible', 'view')) {
      steps.push({
        target: '[data-tour="menu-biblia"]',
        title: '📖 Bíblia Comercial',
        content: 'Acesse materiais de treinamento, playbooks e vídeos para aprimorar suas técnicas de abordagem e fechamento.',
        placement: 'right',
        path: '/biblia'
      });
    }

    // 8. Ferramentas (WhatsApp)
    if (hasPermission('whatsapp', 'view')) {
      steps.push({
        target: '[data-tour="menu-whatsapp"]',
        title: '📱 Central WhatsApp',
        content: 'Integre sua comunicação. Envie mensagens e formulários diretamente pelo sistema usando o WhatsApp.',
        placement: 'right',
        path: '/whatsapp'
      });
    }

    // 9. Configurações e Usuários (Admin/Manager)
    if (hasPermission('settings', 'view')) {
      steps.push({
        target: '[data-tour="menu-settings"]',
        title: '⚙️ Configurações',
        content: 'Personalize o sistema: mude cores, logotipos e configure os parâmetros globais da sua empresa.',
        placement: 'right',
        path: '/configuracoes'
      });
    }

    if (hasPermission('users', 'view')) {
      steps.push({
        target: 'a[href="/users"], button[data-tour="menu-users"]',
        title: '👥 Equipe e Permissões',
        content: 'Gerencie sua equipe, crie novos usuários e defina exatamente o que cada um pode ver ou editar no sistema.',
        placement: 'right',
        path: '/users'
      });
    }

    // 10. Notificações
    steps.push({
      target: '[data-tour="notifications"]',
      title: '🔔 Alertas Inteligentes',
      content: 'Fique atento! O sistema avisa automaticamente sobre amostras atrasadas ou informações pendentes dos creators.',
      placement: 'left'
    });

    // Conclusão
    steps.push({
      target: 'body',
      title: '🚀 Tudo pronto!',
      content: 'Você concluiu o treinamento básico. O sistema está configurado para o seu nível de acesso. Precisa de ajuda? Clique no ícone de interrogação a qualquer momento.',
      placement: 'bottom'
    });

    return steps;
  }, [profile, hasPermission]);

  useEffect(() => {
    const tourCompleted = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!tourCompleted && profile) {
      setTimeout(() => {
        startTour();
      }, 1500);
    }
  }, [profile]);

  // Lógica de navegação automática entre passos
  useEffect(() => {
    if (isActive) {
      const step = tourSteps[currentStep];
      if (step?.path && location.pathname !== step.path) {
        navigate(step.path);
      }
      
      // Pequeno delay para garantir que o DOM renderizou após navegação
      const timer = setTimeout(updatePosition, 300);
      
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [isActive, currentStep, location.pathname, tourSteps]);

  const updatePosition = () => {
    const step = tourSteps[currentStep];
    if (!step) return;

    const target = document.querySelector(step.target);
    
    if (step.target !== 'body' && !target) {
      // Se o alvo não existe na tela atual, tenta re-posicionar o tooltip no centro
      setPosition({ 
        top: window.innerHeight / 2 - 100, 
        left: window.innerWidth / 2 - 200 
      });
      return;
    }

    if (step.target === 'body') {
      setPosition({ 
        top: window.innerHeight / 2 - 100, 
        left: window.innerWidth / 2 - 200 
      });
      // Remove highlights anteriores
      document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
      return;
    }

    const targetRect = target!.getBoundingClientRect();
    const tooltipWidth = 400; // max-w-md
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
    const placement = step.placement || 'bottom';

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipHeight - 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - 20;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + 20;
        break;
    }

    // Ajustar para não sair da tela
    const padding = 20;
    if (left < padding) left = padding;
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipHeight > window.innerHeight - padding) {
      top = window.innerHeight - tooltipHeight - padding;
    }

    setPosition({ top, left });

    // Highlight do elemento
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    target!.classList.add('tour-highlight');
    target!.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    completeTour();
  };

  const completeTour = () => {
    setIsActive(false);
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  };

  const currentStepData = tourSteps[currentStep];

  if (!profile) return null;

  return (
    <>
      {/* Botão de Ajuda Flutuante */}
      <button
        onClick={startTour}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#004aad] hover:bg-[#003d91] text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 group"
        title="Ajuda / Tour Guiado"
      >
        <i className="ri-question-line text-xl"></i>
        <span className="absolute right-full mr-3 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
          Treinamento do Sistema
        </span>
      </button>

      {/* Overlay e Tooltip do Tour */}
      {isActive && currentStepData && (
        <>
          {/* Overlay escuro com furo (via box-shadow no highlight) */}
          <div className="fixed inset-0 bg-black/40 z-[9998] transition-opacity duration-300" onClick={skipTour} />

          {/* Tooltip */}
          <div
            ref={tooltipRef}
            className="fixed z-[9999] bg-white rounded-2xl shadow-2xl max-w-md w-[calc(100%-40px)] transition-all duration-300 ease-out border border-gray-100 overflow-hidden"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            {/* Progress bar top */}
            <div className="h-1.5 w-full bg-gray-100">
              <div 
                className="h-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] transition-all duration-500"
                style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
              />
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-[#004aad] uppercase tracking-widest mb-1 block">
                    Passo {currentStep + 1} de {tourSteps.length}
                  </span>
                  <h3 className="text-xl font-bold text-gray-900">
                    {currentStepData.title}
                  </h3>
                </div>
                <button
                  onClick={skipTour}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              
              <p className="text-gray-600 leading-relaxed mb-8">
                {currentStepData.content}
              </p>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={skipTour}
                  className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Sair do tour
                </button>
                
                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <button
                      onClick={prevStep}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Anterior
                    </button>
                  )}
                  
                  <button
                    onClick={nextStep}
                    className="px-6 py-2.5 bg-[#004aad] hover:bg-[#003d91] text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-[#004aad]/20 active:scale-95"
                  >
                    {currentStep === tourSteps.length - 1 ? 'Começar a usar!' : 'Próximo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CSS para highlight */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 9999 !important;
          box-shadow: 0 0 0 4px rgba(93, 224, 230, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.4) !important;
          pointer-events: none !important;
          border-radius: 12px !important;
          background-color: white !important;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

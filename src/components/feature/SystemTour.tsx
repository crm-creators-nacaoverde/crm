import { useState, useEffect, useRef } from 'react';

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'body',
    title: '👋 Bem-vindo ao Sistema de CRM!',
    content: 'Vamos fazer um tour rápido para você conhecer as principais funcionalidades. Clique em "Próximo" para começar.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="kanban"]',
    title: '📊 Kanban de Acompanhamento',
    content: 'Aqui você visualiza todos os creators organizados por etapas do funil. Arraste os cards entre as colunas para mudar o status.',
    placement: 'top'
  },
  {
    target: '[data-tour="add-deal"]',
    title: '➕ Adicionar Novo Acompanhamento',
    content: 'Clique aqui para cadastrar um novo creator no sistema. Preencha os dados de contato, endereço, PIX e informações de amostra.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="deal-card"]',
    title: '📇 Cards dos Creators',
    content: 'Cada card mostra informações resumidas do creator. Clique no card para ver detalhes completos, editar informações ou acompanhar resultados.',
    placement: 'top'
  },
  {
    target: '[data-tour="view-toggle"]',
    title: '🔄 Alternância de Visualização',
    content: 'Alterne entre visualização em Kanban (colunas) ou Lista (tabela) conforme sua preferência.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="funnel-selector"]',
    title: '🎯 Seletor de Funil',
    content: 'Gerencie múltiplos funis de vendas. Selecione o funil ativo e configure as etapas personalizadas para cada um.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="menu-creators"]',
    title: '👥 Menu Creators',
    content: 'Acesse a lista completa de creators cadastrados, com filtros avançados e opções de envio de formulários via WhatsApp.',
    placement: 'right'
  },
  {
    target: '[data-tour="menu-forms"]',
    title: '📝 Menu Formulários',
    content: 'Crie e gerencie formulários personalizados para coletar informações dos creators. Gere links públicos para compartilhar.',
    placement: 'right'
  },
  {
    target: '[data-tour="menu-metrics"]',
    title: '📈 Menu Métricas',
    content: 'Visualize dashboards com métricas de desempenho, conversão de funil, GMV e análises detalhadas do seu negócio.',
    placement: 'right'
  },
  {
    target: '[data-tour="notifications"]',
    title: '🔔 Notificações',
    content: 'Receba alertas importantes sobre amostras pendentes, prazos e atualizações do sistema.',
    placement: 'left'
  },
  {
    target: 'body',
    title: '✅ Tour Concluído!',
    content: 'Agora você conhece as principais funcionalidades do sistema. Clique no botão de ajuda (?) no canto inferior direito sempre que precisar rever este tour.',
    placement: 'bottom'
  }
];

const TOUR_COMPLETED_KEY = 'crm_tour_completed';

export default function SystemTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tourCompleted = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!tourCompleted) {
      setTimeout(() => {
        startTour();
      }, 1000);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [isActive, currentStep]);

  const updatePosition = () => {
    const step = TOUR_STEPS[currentStep];
    const target = document.querySelector(step.target);
    
    if (!target || !tooltipRef.current) return;

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const placement = step.placement || 'bottom';

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipRect.height - 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left - tooltipRect.width - 20;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + 20;
        break;
    }

    // Ajustar para não sair da tela
    const padding = 10;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }

    setPosition({ top, left });

    // Highlight do elemento
    const allHighlights = document.querySelectorAll('.tour-highlight');
    allHighlights.forEach(el => el.classList.remove('tour-highlight'));
    
    if (step.target !== 'body') {
      target.classList.add('tour-highlight');
    }
  };

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
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
    
    // Remove highlights
    const allHighlights = document.querySelectorAll('.tour-highlight');
    allHighlights.forEach(el => el.classList.remove('tour-highlight'));
  };

  const currentStepData = TOUR_STEPS[currentStep];

  return (
    <>
      {/* Botão de Ajuda Flutuante */}
      <button
        onClick={startTour}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#004aad] hover:bg-[#003d91] text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
        title="Iniciar tour guiado"
      >
        <i className="ri-question-line text-2xl"></i>
      </button>

      {/* Overlay e Tooltip do Tour */}
      {isActive && (
        <>
          {/* Overlay escuro */}
          <div className="fixed inset-0 bg-black/50 z-[9998] pointer-events-none" />

          {/* Tooltip */}
          <div
            ref={tooltipRef}
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl max-w-md w-full animate-[fadeIn_0.3s_ease-out]"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900 flex-1">
                  {currentStepData.title}
                </h3>
                <button
                  onClick={skipTour}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3 flex items-center gap-1.5">
                {TOUR_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      index <= currentStep ? 'bg-[#5de0e6]' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-gray-600 leading-relaxed">
                {currentStepData.content}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {currentStep + 1} de {TOUR_STEPS.length}
              </div>
              
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    Voltar
                  </button>
                )}
                
                {currentStep < TOUR_STEPS.length - 1 ? (
                  <>
                    <button
                      onClick={skipTour}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                    >
                      Pular
                    </button>
                    <button
                      onClick={nextStep}
                      className="px-5 py-2 bg-[#004aad] hover:bg-[#003d91] text-white font-medium rounded-lg transition-colors"
                    >
                      Próximo
                    </button>
                  </>
                ) : (
                  <button
                    onClick={completeTour}
                    className="px-5 py-2 bg-[#004aad] hover:bg-[#003d91] text-white font-medium rounded-lg transition-colors"
                  >
                    Concluir
                  </button>
                )}
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
          box-shadow: 0 0 0 4px rgba(93, 224, 230, 0.4), 0 0 0 9999px rgba(0, 0, 0, 0.5) !important;
          border-radius: 8px;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}

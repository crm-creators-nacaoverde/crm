// src/pages/cadastros/page.tsx
import { useState } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import CadastroDrawer from './components/CadastroDrawer';
import CategoriasModule      from './components/modules/CategoriasModule';
import PlataformasModule     from './components/modules/PlataformasModule';
import FontesModule          from './components/modules/FontesModule';
import ProdutosModule        from './components/modules/ProdutosModule';
import PagamentosModule      from './components/modules/PagamentosModule';
import MotivosModule         from './components/modules/MotivosModule';
import InteracoesModule      from './components/modules/InteracoesModule';
import TransportadorasModule from './components/modules/TransportadorasModule';
import FuncoesModule         from './components/modules/FuncoesModule';

type ModuleId =
  | 'categorias' | 'plataformas' | 'fontes' | 'produtos'
  | 'pagamentos' | 'motivos' | 'interacoes' | 'transportadoras' | 'funcoes';

const CARDS = [
  { id: 'categorias'      as ModuleId, title: 'Categorias de Creator',    description: 'Creators, Embaixadores, Influenciadores e mais',         icon: 'ri-medal-line',               iconBg: 'bg-[#004aad]/10',  iconColor: 'text-[#004aad]' },
  { id: 'plataformas'     as ModuleId, title: 'Canais / Plataformas',     description: 'TikTok, Instagram, YouTube e demais canais',             icon: 'ri-broadcast-line',           iconBg: 'bg-sky-50',        iconColor: 'text-sky-600' },
  { id: 'fontes'          as ModuleId, title: 'Fontes de Captura',        description: 'Hunter, Campanha, Live, Formulário e outras origens',    icon: 'ri-focus-3-line',             iconBg: 'bg-teal-50',       iconColor: 'text-teal-600' },
  { id: 'produtos'        as ModuleId, title: 'Produtos para Amostra',    description: 'Catálogo de produtos com SKU e integração Bling',        icon: 'ri-gift-line',                iconBg: 'bg-violet-50',     iconColor: 'text-violet-600' },
  { id: 'pagamentos'      as ModuleId, title: 'Tipos de Pagamento',       description: 'Cachê, Premiação, Comissão e outros tipos',              icon: 'ri-money-dollar-circle-line', iconBg: 'bg-emerald-50',    iconColor: 'text-emerald-600' },
  { id: 'motivos'         as ModuleId, title: 'Motivos de Ganho / Perda', description: 'Motivos ao mover deals para Ganho ou Perdido',           icon: 'ri-kanban-view',              iconBg: 'bg-amber-50',      iconColor: 'text-amber-600' },
  { id: 'interacoes'      as ModuleId, title: 'Tarefas e Interações',     description: 'Tipos de interação e tarefas com vínculo de metas',      icon: 'ri-chat-3-line',              iconBg: 'bg-rose-50',       iconColor: 'text-rose-600' },
  { id: 'transportadoras' as ModuleId, title: 'Transportadoras',          description: 'Correios, JadLog, TikTok Shop e demais transportadoras', icon: 'ri-truck-line',               iconBg: 'bg-orange-50',     iconColor: 'text-orange-600' },
  { id: 'funcoes'         as ModuleId, title: 'Funções e Permissões',     description: 'Cargos de usuário e permissões padrão de cada função',   icon: 'ri-shield-keyhole-line',      iconBg: 'bg-slate-50',      iconColor: 'text-slate-600' },
];

const DRAWER_CONFIG: Record<ModuleId, { title: string; subtitle: string; icon: string; iconBg: string; iconColor: string }> = {
  categorias:      { title: 'Categorias de Creator',    subtitle: 'Gerencie as categorias disponíveis no sistema',        icon: 'ri-medal-line',               iconBg: 'bg-[#004aad]/10', iconColor: 'text-[#004aad]' },
  plataformas:     { title: 'Canais / Plataformas',     subtitle: 'Gerencie os canais e plataformas disponíveis',         icon: 'ri-broadcast-line',           iconBg: 'bg-sky-50',       iconColor: 'text-sky-600' },
  fontes:          { title: 'Fontes de Captura',        subtitle: 'Gerencie as fontes de captura de leads',               icon: 'ri-focus-3-line',             iconBg: 'bg-teal-50',      iconColor: 'text-teal-600' },
  produtos:        { title: 'Produtos para Amostra',    subtitle: 'Catálogo de produtos com SKU e integração Bling',      icon: 'ri-gift-line',                iconBg: 'bg-violet-50',    iconColor: 'text-violet-600' },
  pagamentos:      { title: 'Tipos de Pagamento',       subtitle: 'Gerencie os tipos de pagamento disponíveis',           icon: 'ri-money-dollar-circle-line', iconBg: 'bg-emerald-50',   iconColor: 'text-emerald-600' },
  motivos:         { title: 'Motivos de Ganho / Perda', subtitle: 'Motivos registrados ao fechar ou perder um deal',      icon: 'ri-kanban-view',              iconBg: 'bg-amber-50',     iconColor: 'text-amber-600' },
  interacoes:      { title: 'Tarefas e Interações',     subtitle: 'Tipos de interação e tarefas com vínculo de metas',    icon: 'ri-chat-3-line',              iconBg: 'bg-rose-50',      iconColor: 'text-rose-600' },
  transportadoras: { title: 'Transportadoras',          subtitle: 'Transportadoras com links de rastreio automáticos',    icon: 'ri-truck-line',               iconBg: 'bg-orange-50',    iconColor: 'text-orange-600' },
  funcoes:         { title: 'Funções e Permissões',     subtitle: 'Cargos de usuário e permissões padrão',                icon: 'ri-shield-keyhole-line',      iconBg: 'bg-slate-50',     iconColor: 'text-slate-600' },
};

function ModuleContent({ id }: { id: ModuleId }) {
  switch (id) {
    case 'categorias':      return <CategoriasModule />;
    case 'plataformas':     return <PlataformasModule />;
    case 'fontes':          return <FontesModule />;
    case 'produtos':        return <ProdutosModule />;
    case 'pagamentos':      return <PagamentosModule />;
    case 'motivos':         return <MotivosModule />;
    case 'interacoes':      return <InteracoesModule />;
    case 'transportadoras': return <TransportadorasModule />;
    case 'funcoes':         return <FuncoesModule />;
  }
}

export default function CadastrosPage() {
  const [openModule, setOpenModule] = useState<ModuleId | null>(null);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cadastros do Sistema</h1>
          <p className="text-sm text-gray-400 mt-1">Gerencie as listas e opções utilizadas em todo o CRM</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map(card => (
            <button
              key={card.id}
              onClick={() => setOpenModule(card.id)}
              className="text-left bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-gray-200 cursor-pointer transition-all group"
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

      {openModule && (
        <CadastroDrawer
          key={openModule}
          isOpen={!!openModule}
          onClose={() => setOpenModule(null)}
          title={DRAWER_CONFIG[openModule].title}
          subtitle={DRAWER_CONFIG[openModule].subtitle}
          icon={DRAWER_CONFIG[openModule].icon}
          iconBg={DRAWER_CONFIG[openModule].iconBg}
          iconColor={DRAWER_CONFIG[openModule].iconColor}
        >
          <ModuleContent id={openModule} />
        </CadastroDrawer>
      )}
    </AppLayout>
  );
}

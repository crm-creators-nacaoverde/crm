import { useState, useEffect } from 'react';
import { Deal } from './KanbanSection';
import KanbanCardTasks from './KanbanCardTasks';
import SendFormFromDealModal from './SendFormFromDealModal';
import { supabase } from '../../../lib/supabase';

interface KanbanCardProps {
  deal: Deal;
  stageColor: string;
  funnelName?: string;
  funnelColor?: string;
  showFunnelBadge?: boolean;
  onDragStart: (deal: Deal) => void;
  onDragEnd: () => void;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  canDelete?: boolean;
}

interface ClientInfo {
  phone: string;
  amostra_enviada: boolean;
  codigo_rastreio: string;
  endereco_cidade: string;
  endereco_estado: string;
  chave_pix: string;
}

const tagColors = [
  'bg-teal-50 text-teal-600 border-teal-100',
  'bg-amber-50 text-amber-600 border-amber-100',
  'bg-rose-50 text-rose-600 border-rose-100',
  'bg-sky-50 text-sky-600 border-sky-100',
  'bg-violet-50 text-violet-600 border-violet-100',
  'bg-emerald-50 text-emerald-600 border-emerald-100',
  'bg-orange-50 text-orange-600 border-orange-100',
  'bg-pink-50 text-pink-600 border-pink-100',
];

export default function KanbanCard({
  deal,
  stageColor,
  funnelName,
  funnelColor,
  showFunnelBadge = false,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  canDelete = true
}: KanbanCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [clientPhone, setClientPhone] = useState('');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);

  useEffect(() => {
    if (deal.client_id) {
      supabase
        .from('clients')
        .select('phone, amostra_enviada, codigo_rastreio, endereco_cidade, endereco_estado, endereco_rua, endereco_numero, endereco_bairro, endereco_cep, chave_pix')
        .eq('id', deal.client_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const info = data as ClientInfo;
            setClientPhone(info.phone || '');
            setClientInfo(info);
          }
        });
    }
  }, [deal.client_id]);

  const priorityConfig = {
    high: { label: 'Alta', color: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' },
    medium: { label: 'Média', color: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
    low: { label: 'Baixa', color: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' }
  };

  const priority = priorityConfig[deal.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const tags = deal.tags || [];

  // Formatar endereço completo
  const getAddressDisplay = () => {
    if (!clientInfo) return null;
    
    const parts = [];
    if (clientInfo.endereco_rua) parts.push(clientInfo.endereco_rua);
    if (clientInfo.endereco_numero) parts.push(clientInfo.endereco_numero);
    if (clientInfo.endereco_bairro) parts.push(clientInfo.endereco_bairro);
    
    if (parts.length > 0) {
      return parts.join(', ');
    }
    
    if (clientInfo.endereco_cidade) {
      return `${clientInfo.endereco_cidade}${clientInfo.endereco_estado ? `/${clientInfo.endereco_estado}` : ''}`;
    }
    
    return null;
  };

  const addressDisplay = getAddressDisplay();

  return (
    <>
      <div
        draggable
        onDragStart={() => onDragStart(deal)}
        onDragEnd={onDragEnd}
        onClick={() => onEdit(deal)}
        data-tour="kanban-card"
        className="bg-white rounded-xl border border-gray-100 p-3.5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all duration-200 group relative"
      >
        {/* Color indicator */}
        <div className="absolute top-0 left-3 right-3 h-[2px] rounded-b-full" style={{ backgroundColor: stageColor }}></div>

        {/* Top row */}
        <div className="flex items-start justify-between mb-2.5 mt-0.5">
          <h4 className="text-[13px] font-medium text-gray-900 leading-snug pr-2 line-clamp-2">{deal.title}</h4>
          <div className="relative flex items-center gap-0.5">
            {/* Send form button */}
            {deal.client_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFormModal(true);
                }}
                className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-[#004aad] rounded-md hover:bg-[#5de0e6]/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                title="Enviar formulário"
              >
                <i className="ri-survey-line text-sm"></i>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-md hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              <i className="ri-more-2-fill text-sm"></i>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20 w-44">
                  {deal.client_id && (
                    <button
                      onClick={(e) => { 
                        e.stopPropagation();
                        setShowFormModal(true); 
                        setShowMenu(false); 
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#004aad] hover:bg-[#5de0e6]/10 cursor-pointer"
                    >
                      <i className="ri-survey-line text-sm"></i>
                      Enviar Formulário
                    </button>
                  )}
                  <button
                    onClick={(e) => { 
                      e.stopPropagation();
                      onEdit(deal); 
                      setShowMenu(false); 
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    <i className="ri-edit-line text-sm text-gray-400"></i>
                    Editar
                  </button>
                  {canDelete && (
                    <button
                      onClick={(e) => { 
                        e.stopPropagation();
                        onDelete(deal.id); 
                        setShowMenu(false); 
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                      Excluir
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Funnel badge (only when multiple funnels exist) */}
        {showFunnelBadge && funnelName && funnelColor && (
          <div className="mb-2.5">
            <span 
              className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md border"
              style={{ 
                backgroundColor: `${funnelColor}15`,
                color: funnelColor,
                borderColor: `${funnelColor}30`
              }}
            >
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: funnelColor }}></span>
              {funnelName}
            </span>
          </div>
        )}

        {/* Client */}
        {deal.client_name && (
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-md flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">
                {deal.client_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-gray-500 truncate">{deal.client_name}</span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {tags.slice(0, 3).map((tag, idx) => (
              <span
                key={tag}
                className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md border ${tagColors[idx % tagColors.length]}`}
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-400 border border-gray-100">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Atenção (Priority) */}
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${priority.color}`}>
            <span className={`w-1 h-1 rounded-full ${priority.dot}`}></span>
            Atenção: {priority.label}
          </span>
        </div>

        {/* Endereço / PIX / Amostra indicators */}
        {clientInfo && (addressDisplay || clientInfo.chave_pix || clientInfo.amostra_enviada || clientInfo.codigo_rastreio) && (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <i className="ri-information-line text-xs text-gray-400"></i>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Informações</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Endereço */}
              {addressDisplay && (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100" title={addressDisplay}>
                  <i className="ri-map-pin-line text-[9px]"></i>
                  <span className="truncate max-w-[120px]">{addressDisplay}</span>
                </span>
              )}
              
              {/* PIX */}
              {clientInfo.chave_pix && (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <i className="ri-bank-card-line text-[9px]"></i>
                  PIX
                </span>
              )}
              
              {/* Amostra */}
              {clientInfo.amostra_enviada ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <i className="ri-gift-line text-[9px]"></i>
                  Amostra enviada
                </span>
              ) : clientInfo.codigo_rastreio ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                  <i className="ri-truck-line text-[9px]"></i>
                  Em trânsito
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Responsável + Supervisor */}
        <div className="flex items-center gap-3 mb-2.5">
          {deal.assigned_name ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                <i className="ri-user-line text-[10px] text-gray-500"></i>
              </div>
              <span className="text-[11px] text-gray-500 truncate">{deal.assigned_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-gray-50 rounded-md flex items-center justify-center flex-shrink-0">
                <i className="ri-user-line text-[10px] text-gray-300"></i>
              </div>
              <span className="text-[11px] text-gray-300 italic">Sem responsável</span>
            </div>
          )}
        </div>

        {deal.supervisor_name && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-5 h-5 bg-amber-50 rounded-md flex items-center justify-center flex-shrink-0">
              <i className="ri-shield-user-line text-[10px] text-amber-500"></i>
            </div>
            <span className="text-[11px] text-amber-600 truncate">{deal.supervisor_name}</span>
            <span className="text-[9px] text-amber-400 font-medium bg-amber-50 px-1 rounded">ADM</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2.5 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <KanbanCardTasks dealId={deal.id} />
            {deal.expected_close_date && (
              <div className="flex items-center gap-1 text-gray-400">
                <i className="ri-calendar-line text-[11px]"></i>
                <span className="text-[11px]">
                  {new Date(deal.expected_close_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de envio de formulário */}
      <SendFormFromDealModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        dealTitle={deal.title}
        clientId={deal.client_id}
        clientName={deal.client_name || ''}
        clientPhone={clientPhone}
      />
    </>
  );
}

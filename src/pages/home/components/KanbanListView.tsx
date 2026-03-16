import { Deal } from './KanbanSection';
import { useState } from 'react';

interface FunnelStage {
  id: string;
  label: string;
  color: string;
}

interface Funnel {
  id: string;
  name: string;
  color: string;
}

interface KanbanListViewProps {
  deals: Deal[];
  stages: FunnelStage[];
  funnels: Funnel[];
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  canDelete?: boolean;
}

const tagColors = [
  'bg-[#5de0e6]/10 text-[#004aad]',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-sky-50 text-sky-700',
  'bg-violet-50 text-violet-700',
  'bg-emerald-50 text-emerald-700',
];

export default function KanbanListView({ deals, stages, funnels, onEdit, onDelete, canDelete = true }: KanbanListViewProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const getStageInfo = (stageId: string) => {
    return stages.find(s => s.id === stageId) || { label: stageId, color: '#94a3b8' };
  };

  const priorityConfig: Record<string, { label: string; color: string }> = {
    high: { label: 'Alta', color: 'bg-red-100 text-red-700' },
    medium: { label: 'Média', color: 'bg-amber-100 text-amber-700' },
    low: { label: 'Baixa', color: 'bg-green-100 text-green-700' }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Negociação</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Funil</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Etapa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Responsável</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Prioridade</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Previsão</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Amostra</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {deals.map((deal) => {
              const stage = stages.find(s => s.id === deal.stage);
              const funnel = funnels.find(f => f.id === deal.funnel_id);
              const priority = priorityConfig[deal.priority as keyof typeof priorityConfig] || priorityConfig.medium;

              return (
                <tr key={deal.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onEdit(deal)}>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">{deal.title}</span>
                      {deal.tags && deal.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {deal.tags.slice(0, 2).map((tag, idx) => (
                            <span key={tag} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md border ${tagColors[idx % tagColors.length]}`}>
                              {tag}
                            </span>
                          ))}
                          {deal.tags.length > 2 && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-400 border border-gray-100">
                              +{deal.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {deal.client_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-md flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[10px] font-bold">
                            {deal.client_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-gray-700">{deal.client_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Sem cliente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {funnel ? (
                      <span 
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border"
                        style={{ 
                          backgroundColor: `${funnel.color}15`,
                          color: funnel.color,
                          borderColor: `${funnel.color}30`
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: funnel.color }}></span>
                        {funnel.name}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Sem funil</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {stage ? (
                      <span 
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: `${stage.color}15`, color: stage.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }}></span>
                        {stage.label}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Sem etapa</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-gray-900">
                      R$ {Number(deal.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {deal.assigned_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                          <i className="ri-user-line text-xs text-gray-500"></i>
                        </div>
                        <span className="text-sm text-gray-700">{deal.assigned_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Sem responsável</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${priority.color}`}>
                      {priority.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {deal.expected_close_date ? (
                      <span className="text-sm text-gray-700">
                        {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Sem previsão</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {deal.client_amostra_enviada ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <i className="ri-gift-line text-xs"></i>
                        Enviada
                      </span>
                    ) : deal.client_codigo_rastreio ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                        <i className="ri-truck-line text-xs"></i>
                        Em trânsito
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-100">
                        <i className="ri-close-circle-line text-xs"></i>
                        Não enviada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(deal); }}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(deal.id); }}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deals.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-inbox-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-sm text-gray-400">Nenhuma negociação encontrada</p>
        </div>
      )}
    </div>
  );
}

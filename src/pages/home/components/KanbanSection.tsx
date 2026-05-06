import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import { useClientHistory, historyEvent } from '../../../hooks/useClientHistory';
import KanbanToolbar from './KanbanToolbar';
import KanbanColumn from './KanbanColumn';
import KanbanDealModal from './KanbanDealModal';
import DealDetailModal from './DealDetailModal';
import KanbanListView from './KanbanListView';
import FunnelConfigModal from './FunnelConfigModal';
import FunnelManagerModal from './FunnelManagerModal';
import { useFunnelStages } from '../../../hooks/useFunnelStages';
import { useFunnels } from '../../../hooks/useFunnels';
import { useStageAutomations } from '../../../hooks/useStageAutomations';
import StageAutomationsModal from './StageAutomationsModal';
import StageMandatoryTaskModal from './StageMandatoryTaskModal';
import MandatoryTaskExecutionModal from './MandatoryTaskExecutionModal';

export interface Deal {
  id: string;
  title: string;
  client_id: string | null;
  assigned_to: string | null;
  supervisor_id: string | null;
  stage: string;
  value: number;
  description: string | null;
  priority: string;
  tags: string[];
  expected_close_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  funnel_id?: string | null;
  client_name?: string;
  assigned_name?: string;
  supervisor_name?: string;
  client_amostra_enviada?: boolean;
  client_codigo_rastreio?: string;
}

export interface ClientOption {
  id: string;
  name: string;
}

export interface UserOption {
  id: string;
  full_name: string;
}

const HIDE_CLOSED_KEY = 'crm_kanban_hide_closed';

function loadHideClosed(): boolean {
  try {
    const saved = localStorage.getItem(HIDE_CLOSED_KEY);
    if (saved === null) return false;
    return saved === 'true';
  } catch {
    return false;
  }
}

export default function KanbanSection() {
  const [searchParams] = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAmostra, setFilterAmostra] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState(false);
  const [isFunnelManagerOpen, setIsFunnelManagerOpen] = useState(false);
  const [automationsStage, setAutomationsStage] = useState<{ id: string; label: string; color: string } | null>(null);
  const [mandatoryTaskStage, setMandatoryTaskStage] = useState<{ id: string; label: string; color: string; mandatory_task_title?: string; mandatory_task_description?: string } | null>(null);
  const [pendingMandatoryTask, setPendingMandatoryTask] = useState<{ deal: Deal; stage: any } | null>(null);
  const [exportToast, setExportToast] = useState(false);
  const [hideClosedStages, setHideClosedStages] = useState(loadHideClosed);
  const [pendingDrop, setPendingDrop] = useState<{ dealId: string; stageId: string; dealTitle: string } | null>(null);
  const [outcomeReasons, setOutcomeReasons] = useState<{ id: string; name: string; type: string }[]>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // ✅ FIX: também desestruturar `profile` para acessar allowed_funnels
  const { user, profile } = useAuth();
  const { logActivity } = useActivityLog();
  const { logClientEvent } = useClientHistory();

  useEffect(() => {
    supabase.from('deal_outcome_reasons').select('id, name, type')
      .eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data) setOutcomeReasons(data); });
  }, []);

  const { executeAutomations } = useStageAutomations();
  const canDeleteDeals = useAuth().hasPermission('deals', 'delete');

  // Hooks de funis — carrega TODOS os funis do banco
  const {
    funnels,
    loading: funnelsLoading,
    selectedFunnelId,
    selectFunnel
  } = useFunnels();

  // ✅ FIX: Filtrar funis pelo allowed_funnels do perfil do usuário.
  // Regra: array vazio = acesso a todos (padrão para admins e usuários sem restrição).
  const allowedFunnelIds: string[] = (profile as any)?.allowed_funnels ?? [];
  const accessibleFunnels = allowedFunnelIds.length > 0
    ? funnels.filter(f => allowedFunnelIds.includes(f.id))
    : funnels;

  // ✅ FIX: Se o funil selecionado não está na lista de acessíveis, selecionar o primeiro disponível.
  useEffect(() => {
    if (funnelsLoading || accessibleFunnels.length === 0) return;
    const hasAccess = accessibleFunnels.some(f => f.id === selectedFunnelId);
    if (!hasAccess) {
      selectFunnel(accessibleFunnels[0].id);
    }
  }, [accessibleFunnels.map(f => f.id).join(','), selectedFunnelId, funnelsLoading]);

  const { stages, loading: stagesLoading, saveStages, reloadStages } = useFunnelStages(selectedFunnelId || undefined);

  const loadData = useCallback(async () => {
    try {
      const [dealsRes, clientsRes, usersRes] = await Promise.all([
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name, amostra_enviada, codigo_rastreio').order('name'),
        supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('is_active', true)
          .order('full_name')
      ]);

      if (dealsRes.error) throw dealsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (usersRes.error) throw usersRes.error;

      const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]));
      const clientAmostraMap = new Map((clientsRes.data || []).map(c => [c.id, { amostra_enviada: c.amostra_enviada, codigo_rastreio: c.codigo_rastreio }]));
      const userMap = new Map((usersRes.data || []).map(u => [u.id, u.full_name]));

      const enrichedDeals = (dealsRes.data || []).map(deal => {
        const amostraInfo = deal.client_id ? clientAmostraMap.get(deal.client_id) : null;
        return {
          ...deal,
          tags: deal.tags || [],
          client_name: deal.client_id ? clientMap.get(deal.client_id) ?? '' : '',
          assigned_name: deal.assigned_to ? userMap.get(deal.assigned_to) ?? '' : '',
          supervisor_name: deal.supervisor_id ? userMap.get(deal.supervisor_id) ?? '' : '',
          client_amostra_enviada: amostraInfo?.amostra_enviada ?? false,
          client_codigo_rastreio: amostraInfo?.codigo_rastreio ?? '',
        };
      });

      setDeals(enrichedDeals);
      setClients(clientsRes.data?.map(c => ({ id: c.id, name: c.name })) ?? []);
      setUsers(usersRes.data ?? []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincronizar funil e abrir modal de detalhes se houver parâmetros na URL
  useEffect(() => {
    const funnelId = searchParams.get('funnelId');
    const dealId = searchParams.get('dealId');

    if (funnelId && funnelId !== selectedFunnelId) {
      // Só navegar para o funil da URL se o usuário tiver acesso a ele
      const hasAccess = accessibleFunnels.some(f => f.id === funnelId);
      if (hasAccess) {
        selectFunnel(funnelId);
      }
    }

    if (dealId && deals.length > 0) {
      const deal = deals.find(d => d.id === dealId);
      if (deal) {
        setDetailDeal(deal);
        setIsDetailOpen(true);
      }
    }
  }, [searchParams, deals, selectedFunnelId, selectFunnel, accessibleFunnels]);

  // Filtrar deals pelo funil selecionado
  const filteredDealsByFunnel = deals.filter(deal => deal.funnel_id === selectedFunnelId);

  const filteredDeals = filteredDealsByFunnel.filter(deal => {
    const matchesSearch =
      !searchTerm ||
      deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deal.client_name ?? '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAssigned =
      filterAssigned === 'all' ||
      (filterAssigned === 'mine' && deal.assigned_to === user?.id) ||
      deal.assigned_to === filterAssigned;

    const matchesStatus = filterStatus === 'all' || deal.stage === filterStatus;

    let matchesAmostra = true;
    if (filterAmostra === 'pendente') {
      matchesAmostra = !deal.client_amostra_enviada && !deal.client_codigo_rastreio;
    } else if (filterAmostra === 'em_transito') {
      matchesAmostra = !deal.client_amostra_enviada && !!deal.client_codigo_rastreio;
    } else if (filterAmostra === 'enviada') {
      matchesAmostra = !!deal.client_amostra_enviada;
    }

    return matchesSearch && matchesAssigned && matchesStatus && matchesAmostra;
  });

  const sortedDeals = [...filteredDeals].sort((a, b) => {
    if (sortBy === 'value') return b.value - a.value;
    if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleCreateDeal = () => {
    setSelectedDeal(null);
    setIsModalOpen(true);
  };

  const handleViewDeal = (deal: Deal) => {
    setDetailDeal(deal);
    setIsDetailOpen(true);
  };

  const handleEditFromDetail = (deal: Deal) => {
    setDetailDeal(null);
    setIsDetailOpen(false);
    setSelectedDeal(deal);
    setIsModalOpen(true);
  };

  const handleEditDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsModalOpen(true);
  };

  const handleSaveDeal = async (data: Partial<Deal>) => {
    try {
      if (selectedDeal) {
        const { error } = await supabase
          .from('deals')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', selectedDeal.id);
        if (error) throw error;

        await logActivity({
          action: 'update',
          module: 'deals',
          entityId: selectedDeal.id,
          entityName: selectedDeal.title,
          details: { before: selectedDeal, after: { ...selectedDeal, ...data } }
        });
      } else {
        const { data: newDeal, error } = await supabase
          .from('deals')
          .insert([{
            ...data,
            created_by: user?.id,
            funnel_id: selectedFunnelId
          }])
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          action: 'create',
          module: 'deals',
          entityId: newDeal.id,
          entityName: (data.title as string) || 'Nova negociação',
          details: { data }
        });
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar negociação:', error);
    }
  };

  const handleDeleteDeal = async (id: string) => {
    try {
      const dealToDelete = deals.find(d => d.id === id);
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw error;

      if (dealToDelete) {
        await logActivity({
          action: 'delete',
          module: 'deals',
          entityId: id,
          entityName: dealToDelete.title,
          details: { deletedData: dealToDelete }
        });
      }

      await loadData();
    } catch (error) {
      console.error('Erro ao excluir negociação:', error);
    }
  };

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (stageId: string) => {
    setDragOverStage(stageId);
  };

  const executeDrop = async (stageId: string, deal: typeof draggedDeal, reason?: string) => {
    if (!deal) return;
    try {
      const { error } = await supabase
        .from('deals')
        .update({ stage: stageId, updated_at: new Date().toISOString() })
        .eq('id', draggedDeal.id);
      if (error) throw error;

      const oldStage = stages.find(s => s.id === draggedDeal.stage);
      const newStage = stages.find(s => s.id === stageId);

      const fromStage = oldStage?.label || draggedDeal.stage;
      const toStage = newStage?.label || stageId;

      await logActivity({
        action: 'update',
        module: 'deals',
        entityId: draggedDeal.id,
        entityName: draggedDeal.title,
        details: {
          action: 'move_stage',
          from: fromStage,
          to: toStage,
          message: `Etapa alterada de "${fromStage}" para "${toStage}"`
        }
      });

      if (draggedDeal.client_id) {
        await logClientEvent({
          client_id: draggedDeal.client_id,
          ...historyEvent.movimentacao(
            oldStage?.label || draggedDeal.stage,
            newStage?.label || stageId,
            draggedDeal.title
          )
        });
      }

      await executeAutomations(
        stageId,
        draggedDeal.id,
        draggedDeal.client_id || null,
        draggedDeal.title,
        draggedDeal.client_name || '',
        newStage?.label || stageId
      );

      await loadData();
    } catch (error) {
      console.error('Erro ao mover negociação:', error);
    }
  };

  const handleDrop = async (stageId: string) => {
    if (draggedDeal && draggedDeal.stage !== stageId) {
      const targetStage = stages.find(s => s.id === stageId);

      if (targetStage?.mandatory_task_title) {
        setPendingMandatoryTask({ deal: draggedDeal, stage: targetStage });
        setDraggedDeal(null);
        setDragOverStage(null);
        return;
      }

      const isOutcome = stageId === 'won' || stageId === 'lost' || stageId.startsWith('won_') || stageId.startsWith('lost_');
      const outcomeType = (stageId === 'won' || stageId.startsWith('won_')) ? 'won' : 'lost';
      if (isOutcome && outcomeReasons.filter(r => r.type === outcomeType).length > 0) {
        setPendingDrop({ dealId: draggedDeal.id, stageId, dealTitle: draggedDeal.title });
        setSelectedReason('');
        setCustomReason('');
        setDraggedDeal(null);
        setDragOverStage(null);
        return;
      }
      await executeDrop(stageId, draggedDeal);
    }
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  const handleExport = () => {
    const selectedFunnel = accessibleFunnels.find(f => f.id === selectedFunnelId);
    const csvData = filteredDeals.map(deal => {
      const stage = stages.find(s => s.id === deal.stage);
      const funnel = accessibleFunnels.find(f => f.id === deal.funnel_id);
      return {
        'Negociação': deal.title,
        'Cliente': deal.client_name || '',
        'Funil': funnel?.name || '',
        'Etapa': stage?.label || '',
        'Valor': `R$ ${Number(deal.value || 0).toLocaleString('pt-BR')}`,
        'Responsável': deal.assigned_name || '',
        'Prioridade': deal.priority === 'high' ? 'Alta' : deal.priority === 'low' ? 'Baixa' : 'Média',
        'Previsão de Fechamento': deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString('pt-BR') : '',
        'Tags': deal.tags?.join(', ') || '',
        'Criado em': new Date(deal.created_at).toLocaleDateString('pt-BR')
      };
    });

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `negociacoes_${selectedFunnel?.name || 'funil'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleReload = async () => {
    setIsReloading(true);
    await Promise.all([loadData(), reloadStages()]);
    setTimeout(() => setIsReloading(false), 600);
  };

  const handleSaveFunnel = async (newStages: { id: string; label: string; color: string }[]) => {
    const mapped = newStages.map((s, i) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      description: s.description ?? null,
      sort_order: i,
      is_fixed: s.id === 'won' || s.id === 'lost',
      funnel_id: selectedFunnelId,
    }));
    await saveStages(mapped);
  };

  const handleToggleClosedStages = () => {
    setHideClosedStages(prev => {
      const next = !prev;
      localStorage.setItem(HIDE_CLOSED_KEY, String(next));
      return next;
    });
  };

  const visibleStages = hideClosedStages
    ? stages.filter(s => s.id !== 'won' && s.id !== 'lost')
    : stages;

  const getStageDeals = (stageId: string) => sortedDeals.filter(d => d.stage === stageId);
  const getStageValue = (stageId: string) =>
    getStageDeals(stageId).reduce((sum, d) => sum + Number(d.value ?? 0), 0);

  const totalDealsCount = filteredDealsByFunnel.filter(d => d.stage !== 'won' && d.stage !== 'lost').length;
  const wonDealsCount = filteredDealsByFunnel.filter(d => d.stage === 'won').length;
  const lostDealsCount = filteredDealsByFunnel.filter(d => d.stage === 'lost').length;

  if (loading || stagesLoading || funnelsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="ri-loader-4-line text-4xl text-[#5de0e6] animate-spin"></i>
      </div>
    );
  }

  // ✅ FIX: Mensagem amigável se usuário não tem acesso a nenhum funil
  if (accessibleFunnels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
          <i className="ri-lock-line text-3xl text-amber-400"></i>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Nenhum funil disponível</p>
          <p className="text-xs text-gray-400 mt-1">Você não possui acesso a nenhum funil. Contate o administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative" data-tour="kanban">
      <div data-tour="kanban-toolbar">
        <KanbanToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterAssigned={filterAssigned}
          onFilterAssignedChange={setFilterAssigned}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterAmostra={filterAmostra}
          onFilterAmostraChange={setFilterAmostra}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          users={users}
          totalDeals={totalDealsCount}
          wonDeals={wonDealsCount}
          lostDeals={lostDealsCount}
          filterCategory={'all'}
          onFilterCategoryChange={() => {}}
          categoryOptions={[]}
          onCreateDeal={handleCreateDeal}
          onExport={handleExport}
          onReload={handleReload}
          onConfigureFunnel={() => setIsFunnelModalOpen(true)}
          onManageFunnels={() => setIsFunnelManagerOpen(true)}
          isReloading={isReloading}
          stages={stages}
          hideClosedStages={hideClosedStages}
          onToggleClosedStages={handleToggleClosedStages}
          selectedFunnelId={selectedFunnelId}
          // ✅ FIX: passar apenas os funis acessíveis ao usuário
          funnels={accessibleFunnels.map(f => ({ id: f.id, name: f.name, color: f.color }))}
          currentUserId={user?.id}
          onFunnelChange={selectFunnel}
        />
      </div>

      {viewMode === 'board' ? (
        <div data-tour="kanban-board" className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 240px)' }}>
          {visibleStages.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={getStageDeals(stage.id)}
              stageValue={getStageValue(stage.id)}
              isDragOver={dragOverStage === stage.id}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onEditDeal={handleViewDeal}
              onDeleteDeal={handleDeleteDeal}
              canDelete={canDeleteDeals}
              onOpenAutomations={(stage) => setAutomationsStage(stage)}
              onOpenMandatoryTask={(stage) => setMandatoryTaskStage(stage)}
            />
          ))}
        </div>
      ) : (
        <KanbanListView
          deals={sortedDeals}
          stages={stages}
          // ✅ FIX: também filtrar na lista
          funnels={accessibleFunnels.map(f => ({ id: f.id, name: f.name, color: f.color }))}
          onEdit={handleViewDeal}
          onDelete={handleDeleteDeal}
          canDelete={canDeleteDeals}
        />
      )}

      <DealDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        deal={detailDeal}
        stages={stages}
        onEdit={handleEditFromDetail}
        onClientUpdated={loadData}
      />

      <KanbanDealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        deal={selectedDeal}
        clients={clients}
        users={users}
        stages={stages}
        onSave={handleSaveDeal}
        onClientsUpdated={loadData}
        currentFunnelId={selectedFunnelId || ''}
      />

      <FunnelConfigModal
        isOpen={isFunnelModalOpen}
        onClose={() => setIsFunnelModalOpen(false)}
        stages={stages}
        onSave={handleSaveFunnel}
        funnelId={selectedFunnelId || ''}
      />

      <FunnelManagerModal
        isOpen={isFunnelManagerOpen}
        onClose={() => setIsFunnelManagerOpen(false)}
      />

      {mandatoryTaskStage && (
        <StageMandatoryTaskModal
          isOpen={!!mandatoryTaskStage}
          onClose={() => setMandatoryTaskStage(null)}
          stage={mandatoryTaskStage}
          onSave={loadData}
        />
      )}

      {pendingMandatoryTask && (
        <MandatoryTaskExecutionModal
          isOpen={!!pendingMandatoryTask}
          onClose={() => setPendingMandatoryTask(null)}
          onConfirm={() => {
            const { deal, stage } = pendingMandatoryTask;
            setPendingMandatoryTask(null);
            executeDrop(stage.id, deal);
          }}
          deal={pendingMandatoryTask.deal}
          stage={pendingMandatoryTask.stage}
        />
      )}

      {/* Modal de Motivo — Ganho / Perdido */}
      {pendingDrop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${(pendingDrop.stageId === 'won' || pendingDrop.stageId.startsWith('won_')) ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                <i className={`${(pendingDrop.stageId === 'won' || pendingDrop.stageId.startsWith('won_')) ? 'ri-checkbox-circle-line text-emerald-600' : 'ri-close-circle-line text-rose-600'} text-lg`}></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {(pendingDrop.stageId === 'won' || pendingDrop.stageId.startsWith('won_')) ? 'Marcar como Ganho' : 'Marcar como Perdido'}
                </p>
                <p className="text-[11px] text-gray-400 truncate max-w-xs">{pendingDrop.dealTitle}</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Motivo</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {outcomeReasons.filter(r => r.type === ((pendingDrop.stageId === 'won' || pendingDrop.stageId.startsWith('won_')) ? 'won' : 'lost')).map(r => (
                  <label key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedReason === r.id ? (pendingDrop.stageId === 'won' ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50') : 'border-gray-100 hover:border-gray-200'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedReason === r.id ? (pendingDrop.stageId === 'won' ? 'border-emerald-500 bg-emerald-500' : 'border-rose-500 bg-rose-500') : 'border-gray-300'}`}>
                      {selectedReason === r.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                    </div>
                    <span className="text-sm text-gray-700">{r.name}</span>
                    <input type="radio" className="sr-only" checked={selectedReason === r.id} onChange={() => { setSelectedReason(r.id); setCustomReason(''); }} />
                  </label>
                ))}
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedReason === '__outro' ? (pendingDrop.stageId === 'won' ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50') : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedReason === '__outro' ? (pendingDrop.stageId === 'won' ? 'border-emerald-500 bg-emerald-500' : 'border-rose-500 bg-rose-500') : 'border-gray-300'}`}>
                    {selectedReason === '__outro' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <span className="text-sm text-gray-700">Outro motivo</span>
                  <input type="radio" className="sr-only" checked={selectedReason === '__outro'} onChange={() => setSelectedReason('__outro')} />
                </label>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <span>Justificativa Obrigatória</span>
                  <span className="text-rose-500">*</span>
                </p>
                <textarea
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Descreva detalhadamente o motivo da perda/ganho..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] min-h-[80px] resize-none"
                />
                {!customReason.trim() && selectedReason && (
                  <p className="text-xs text-rose-500 flex items-center gap-1">
                    <i className="ri-error-warning-line"></i>
                    Campo obrigatório
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => { setPendingDrop(null); setSelectedReason(''); setCustomReason(''); }}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
                Cancelar
              </button>
              <button
                disabled={!selectedReason || !customReason.trim()}
                onClick={async () => {
                  const baseReason = outcomeReasons.find(r => r.id === selectedReason)?.name || (selectedReason === '__outro' ? 'Outro' : '');
                  const additionalJustification = customReason.trim();
                  const finalReason = selectedReason === '__outro'
                    ? additionalJustification
                    : `${baseReason} - ${additionalJustification}`;

                  const isLost = !(pendingDrop.stageId === 'won' || pendingDrop.stageId.startsWith('won_'));

                  await supabase.from('deals').update({
                    stage: pendingDrop.stageId,
                    outcome_reason: finalReason,
                    updated_at: new Date().toISOString(),
                  }).eq('id', pendingDrop.dealId);

                  await logActivity({
                    action: 'update', module: 'deals',
                    entityId: pendingDrop.dealId, entityName: pendingDrop.dealTitle,
                    details: {
                      action: 'move_stage',
                      to: pendingDrop.stageId,
                      reason: finalReason,
                      is_outcome: true,
                      outcome_type: isLost ? 'lost' : 'won'
                    },
                  });

                  if (pendingDrop.dealId) {
                    const { data: dealData } = await supabase
                      .from('deals')
                      .select('client_id, stage')
                      .eq('id', pendingDrop.dealId)
                      .single();

                    if (dealData?.client_id) {
                      const fromStageLabel = stages.find(s => s.id === (deals.find(d => d.id === pendingDrop.dealId)?.stage))?.label || 'Etapa anterior';
                      const toStageLabel = stages.find(s => s.id === pendingDrop.stageId)?.label || (isLost ? 'Perdido' : 'Ganho');

                      await logClientEvent({
                        client_id: dealData.client_id,
                        ...historyEvent.movimentacao(fromStageLabel, toStageLabel, pendingDrop.dealTitle)
                      });

                      await logClientEvent({
                        client_id: dealData.client_id,
                        event_type: 'resultado',
                        title: isLost ? 'Negociação Perdida' : 'Negociação Ganha',
                        description: `Motivo/Justificativa: ${finalReason}`,
                        metadata: {
                          deal_id: pendingDrop.dealId,
                          deal_title: pendingDrop.dealTitle,
                          reason: finalReason,
                          outcome: isLost ? 'lost' : 'won'
                        }
                      });
                    }
                  }

                  setPendingDrop(null); setSelectedReason(''); setCustomReason('');
                  await loadData();
                }}
                className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${(pendingDrop.stageId === 'won' || pendingDrop.stageId.startsWith('won_')) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {(pendingDrop.stageId === 'won' || pendingDrop.stageId.startsWith('won_')) ? 'Confirmar Ganho' : 'Confirmar Perda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {automationsStage && (
        <StageAutomationsModal
          isOpen={!!automationsStage}
          onClose={() => setAutomationsStage(null)}
          stageId={automationsStage.id}
          stageLabel={automationsStage.label}
          stageColor={automationsStage.color}
          funnelId={selectedFunnelId || ''}
        />
      )}

      {exportToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-3 bg-gray-900 text-white px-5 py-3.5 rounded-xl shadow-2xl">
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-500/20 rounded-lg">
              <i className="ri-check-line text-emerald-400 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-medium">Exportação concluída</p>
              <p className="text-xs text-gray-400">Arquivo CSV baixado com sucesso</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

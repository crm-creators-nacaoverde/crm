import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
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
    return saved === 'true';
  } catch {
    return false;
  }
}

export default function KanbanSection() {
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
  const [exportToast, setExportToast] = useState(false);
  const [hideClosedStages, setHideClosedStages] = useState(loadHideClosed);
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const { executeAutomations } = useStageAutomations();
  
  const canDeleteDeals = useAuth().hasPermission('deals', 'delete');
  
  // Hooks de funis
  const { 
    funnels, 
    loading: funnelsLoading, 
    selectedFunnelId, 
    selectFunnel 
  } = useFunnels();
  
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

  const handleDrop = async (stageId: string) => {
    if (draggedDeal && draggedDeal.stage !== stageId) {
      try {
        const { error } = await supabase
          .from('deals')
          .update({ stage: stageId, updated_at: new Date().toISOString() })
          .eq('id', draggedDeal.id);
        if (error) throw error;
        
        const oldStage = stages.find(s => s.id === draggedDeal.stage);
        const newStage = stages.find(s => s.id === stageId);
        
        await logActivity({
          action: 'update',
          module: 'deals',
          entityId: draggedDeal.id,
          entityName: draggedDeal.title,
          details: { 
            action: 'move_stage',
            from: oldStage?.label || draggedDeal.stage,
            to: newStage?.label || stageId
          }
        });

        // 🤖 Disparar automações configuradas para esta etapa
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
    }
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  // --- Export CSV ---
  const handleExport = () => {
    const selectedFunnel = funnels.find(f => f.id === selectedFunnelId);
    const csvData = filteredDeals.map(deal => {
      const stage = stages.find(s => s.id === deal.stage);
      const funnel = funnels.find(f => f.id === deal.funnel_id);
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

  // --- Reload ---
  const handleReload = async () => {
    setIsReloading(true);
    await Promise.all([loadData(), reloadStages()]);
    setTimeout(() => setIsReloading(false), 600);
  };

  // --- Funnel Config ---
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

  const getTotalValue = () => deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
  const getStageValue = (stageId: string) =>
    getStageDeals(stageId).reduce((sum, d) => sum + Number(d.value ?? 0), 0);

  if (loading || stagesLoading || funnelsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="ri-loader-4-line text-4xl text-[#5de0e6] animate-spin"></i>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative" data-tour="kanban">
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
        totalDeals={filteredDeals.length}
        totalValue={getTotalValue()}
        avgTicket={filteredDeals.length > 0 ? Math.round(getTotalValue() / filteredDeals.length) : 0}
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
        funnels={funnels.map(f => ({ id: f.id, name: f.name, color: f.color }))}
        onFunnelChange={selectFunnel}
      />

      {viewMode === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 240px)' }}>
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
            />
          ))}
        </div>
      ) : (
        <KanbanListView
          deals={sortedDeals}
          stages={stages}
          funnels={funnels.map(f => ({ id: f.id, name: f.name, color: f.color }))}
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

      {/* Export toast */}
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

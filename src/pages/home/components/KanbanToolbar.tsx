import { UserOption } from './KanbanSection';
import KanbanOptionsMenu from './KanbanOptionsMenu';

interface KanbanToolbarProps {
  viewMode: 'board' | 'list';
  onViewModeChange: (mode: 'board' | 'list') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterAssigned: string;
  onFilterAssignedChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterAmostra: string;
  onFilterAmostraChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  users: UserOption[];
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  onCreateDeal: () => void;
  onExport: () => void;
  onReload: () => void;
  onConfigureFunnel: () => void;
  onManageFunnels: () => void;
  isReloading: boolean;
  stages: { id: string; label: string; color: string }[];
  hideClosedStages: boolean;
  onToggleClosedStages: () => void;
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  categoryOptions: string[];
  selectedFunnelId: string | null;
  funnels: Array<{ id: string; name: string; color: string }>;
  onFunnelChange: (funnelId: string) => void;
  currentUserId?: string;
}

export default function KanbanToolbar({
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  filterAssigned,
  onFilterAssignedChange,
  filterStatus,
  onFilterStatusChange,
  filterAmostra,
  onFilterAmostraChange,
  sortBy,
  onSortByChange,
  users,
  totalDeals,
  wonDeals,
  lostDeals,
  onCreateDeal,
  onExport,
  onReload,
  onConfigureFunnel,
  onManageFunnels,
  isReloading,
  stages,
  hideClosedStages,
  onToggleClosedStages,
  filterCategory,
  onFilterCategoryChange,
  categoryOptions,
  selectedFunnelId,
  funnels,
  onFunnelChange,
  currentUserId,
}: KanbanToolbarProps) {
  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
              <i className="ri-kanban-view text-brand-600 text-base"></i>
            </div>

            <div>
              <p className="text-lg font-bold text-gray-900">{totalDeals}</p>
              <p className="text-[11px] text-gray-400">Negociações</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-emerald-600 text-base"></i>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{wonDeals}</p>
              <p className="text-[11px] text-gray-400">Ganhos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center">
              <i className="ri-close-circle-line text-rose-600 text-base"></i>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{lostDeals}</p>
              <p className="text-[11px] text-gray-400">Perdidos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-center gap-2">
          <button
            onClick={onCreateDeal}
            data-tour="add-deal"
            className="flex-1 flex items-center gap-2 justify-center px-4 py-2.5 bg-[#004aad] text-white text-sm font-medium rounded-xl hover:bg-[#003d91] transition-colors cursor-pointer whitespace-nowrap shadow-sm shadow-[#004aad]/20"
          >
            <i className="ri-add-line text-lg"></i>
            Novo Acompanhamento
          </button>
          <KanbanOptionsMenu
            onExport={onExport}
            onReload={onReload}
            onConfigureFunnel={onConfigureFunnel}
            onManageFunnels={onManageFunnels}
            isReloading={isReloading}
            hideClosedStages={hideClosedStages}
            onToggleClosedStages={onToggleClosedStages}
          />
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5" data-tour="view-toggle">
            <button
              onClick={() => onViewModeChange('board')}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-white shadow-sm text-brand-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Kanban"
            >
              <i className="ri-layout-column-line text-base"></i>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white shadow-sm text-brand-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Lista"
            >
              <i className="ri-list-unordered text-base"></i>
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-100"></div>

          {/* Funnel selector */}
          {funnels.length > 1 && (
            <>
              <div className="relative" data-tour="funnel-select">
                <select
                  value={selectedFunnelId || ''}
                  onChange={(e) => onFunnelChange(e.target.value)}
                  className="pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-gray-50/50 cursor-pointer font-medium"
                >
                  {funnels.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
              </div>
              <div className="w-px h-6 bg-gray-100"></div>
            </>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Buscar negociação..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-gray-50/50"
            />
          </div>

          {/* Filter: Assigned */}
          <div className="relative">
            <select
              value={filterAssigned}
              onChange={(e) => onFilterAssignedChange(e.target.value)}
              className="pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-gray-50/50 cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="mine">Minhas</option>
              {users.filter(u => u.id !== currentUserId).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
          </div>

          {/* Filter: Status */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-gray-50/50 cursor-pointer"
            >
              <option value="all">Todas etapas</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
          </div>

          {/* Filter: Amostra */}
          <div className="relative">
            <select
              value={filterAmostra}
              onChange={(e) => onFilterAmostraChange(e.target.value)}
              className="pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-gray-50/50 cursor-pointer"
            >
              <option value="all">Todas amostras</option>
              <option value="pendente">📦 Pendente de envio</option>
              <option value="em_transito">🚚 Em trânsito</option>
              <option value="enviada">✅ Enviada</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
          </div>

          {/* Filter: Categoria */}
          {categoryOptions.length > 1 && (
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => onFilterCategoryChange(e.target.value)}
                className="pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-gray-50/50 cursor-pointer"
              >
                <option value="all">Todas categorias</option>
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          )}

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none bg-gray-50/50 cursor-pointer"
            >
              <option value="created_at">Recentes</option>
              <option value="value">Maior valor</option>
              <option value="priority">Prioridade</option>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Client, UserProfile } from '../../../lib/supabase';

interface FilterState {
  dateRange: { start: string; end: string };
  responsible: string;
  creator: string;
  type: string;
  searchTerm: string;
}

interface InteractionsFilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  clients: Client[];
  users: UserProfile[];
  interactionTypes: { id: string; name: string; icon: string; color: string }[];
}

export default function InteractionsFilterBar({
  filters,
  onFilterChange,
  clients,
  users,
  interactionTypes,
}: InteractionsFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleDateRangeChange = (start: string, end: string) => {
    handleFilterChange('dateRange', { start, end });
  };

  const activeFiltersCount = [
    filters.responsible,
    filters.creator,
    filters.type !== 'all',
    filters.dateRange.start || filters.dateRange.end,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Main Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg"></i>
            <input
              type="text"
              placeholder="Buscar por título, descrição ou cliente..."
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                isExpanded || activeFiltersCount > 0
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <i className="ri-filter-3-line text-lg"></i>
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-white/20 rounded-full text-xs font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Type Filter Quick Access */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-gray-200">
              <button
                onClick={() => handleFilterChange('type', 'all')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                  filters.type === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Todos
              </button>
              {interactionTypes.slice(0, 3).map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleFilterChange('type', type.name)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                    filters.type === type.name
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                  title={type.name}
                >
                  <i className={`${type.icon} text-sm`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expanded Filter Panel */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                <i className="ri-calendar-line mr-1"></i>Data
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) =>
                    handleDateRangeChange(e.target.value, filters.dateRange.end)
                  }
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <span className="text-gray-400">até</span>
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) =>
                    handleDateRangeChange(filters.dateRange.start, e.target.value)
                  }
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            </div>

            {/* Responsible Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                <i className="ri-user-line mr-1"></i>Responsável
              </label>
              <select
                value={filters.responsible}
                onChange={(e) => handleFilterChange('responsible', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
              >
                <option value="">Todos os responsáveis</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Creator Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                <i className="ri-user-star-line mr-1"></i>Creator
              </label>
              <select
                value={filters.creator}
                onChange={(e) => handleFilterChange('creator', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
              >
                <option value="">Todos os creators</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                <i className="ri-chat-1-line mr-1"></i>Tipo de Interação
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
              >
                <option value="all">Todos os tipos</option>
                {interactionTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Filtros ativos:
          </span>
          {filters.dateRange.start && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
              <i className="ri-calendar-line"></i>
              {new Date(filters.dateRange.start).toLocaleDateString('pt-BR')}
              {filters.dateRange.end &&
                ` até ${new Date(filters.dateRange.end).toLocaleDateString('pt-BR')}`}
              <button
                onClick={() => handleDateRangeChange('', '')}
                className="ml-1 hover:text-blue-900"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}
          {filters.responsible && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
              <i className="ri-user-line"></i>
              {users.find((u) => u.id === filters.responsible)?.full_name}
              <button
                onClick={() => handleFilterChange('responsible', '')}
                className="ml-1 hover:text-purple-900"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}
          {filters.creator && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
              <i className="ri-user-star-line"></i>
              {clients.find((c) => c.id === filters.creator)?.name}
              <button
                onClick={() => handleFilterChange('creator', '')}
                className="ml-1 hover:text-green-900"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}
          {filters.type !== 'all' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium">
              <i className="ri-chat-1-line"></i>
              {interactionTypes.find((t) => t.name === filters.type)?.name}
              <button
                onClick={() => handleFilterChange('type', 'all')}
                className="ml-1 hover:text-orange-900"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}
          <button
            onClick={() =>
              onFilterChange({
                dateRange: { start: '', end: '' },
                responsible: '',
                creator: '',
                type: 'all',
                searchTerm: '',
              })
            }
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 ml-2"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}

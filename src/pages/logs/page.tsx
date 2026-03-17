import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/feature/AppLayout';
import LogDetailModal from './components/LogDetailModal';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: 'create' | 'update' | 'delete';
  module: 'creators' | 'deals' | 'interactions' | 'forms' | 'users' | 'settings' | 'funnels' | 'logistics' | 'tasks' | 'financeiro' | 'metrics' | 'imports';
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

interface LogStats {
  todayCount: number;
  weekCount: number;
  mostActiveUser: { name: string; count: number };
  mostUsedModule: { name: string; count: number };
}

const LogsPage = () => {
  const { user, userProfile } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<LogStats>({
    todayCount: 0,
    weekCount: 0,
    mostActiveUser: { name: '-', count: 0 },
    mostUsedModule: { name: '-', count: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  
  // Filtros
  const [searchText, setSearchText] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('30');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const moduleLabels: Record<string, string> = {
    creators: 'Creators',
    deals: 'Acompanhamento',
    interactions: 'Interações',
    forms: 'Formulários',
    users: 'Usuários',
    settings: 'Configurações',
    funnels: 'Funis',
    logistics: 'Logística',
    tasks: 'Tarefas',
    financeiro: 'Financeiro',
    metrics: 'Métricas',
    imports: 'Importações',
  };

  const actionLabels: Record<string, string> = {
    create: 'Criar',
    update: 'Editar',
    delete: 'Excluir',
  };

  const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchText, moduleFilter, actionFilter, periodFilter, userFilter, customDateStart, customDateEnd]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      setLogs(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logsData: ActivityLog[]) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayCount = logsData.filter(log => new Date(log.created_at) >= todayStart).length;
    const weekCount = logsData.filter(log => new Date(log.created_at) >= weekStart).length;

    // Usuário mais ativo
    const userCounts: Record<string, { name: string; count: number }> = {};
    logsData.forEach(log => {
      if (!userCounts[log.user_id]) {
        userCounts[log.user_id] = { name: log.user_name, count: 0 };
      }
      userCounts[log.user_id].count++;
    });
    const mostActiveUser = Object.values(userCounts).sort((a, b) => b.count - a.count)[0] || { name: '-', count: 0 };

    // Módulo mais usado
    const moduleCounts: Record<string, number> = {};
    logsData.forEach(log => {
      moduleCounts[log.module] = (moduleCounts[log.module] || 0) + 1;
    });
    const mostUsedModuleKey = Object.keys(moduleCounts).sort((a, b) => moduleCounts[b] - moduleCounts[a])[0];
    const mostUsedModule = mostUsedModuleKey
      ? { name: moduleLabels[mostUsedModuleKey], count: moduleCounts[mostUsedModuleKey] }
      : { name: '-', count: 0 };

    setStats({ todayCount, weekCount, mostActiveUser, mostUsedModule });
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Filtro de texto
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(log =>
        log.user_name.toLowerCase().includes(search) ||
        log.user_email.toLowerCase().includes(search) ||
        log.entity_name?.toLowerCase().includes(search) ||
        moduleLabels[log.module].toLowerCase().includes(search)
      );
    }

    // Filtro de módulo
    if (moduleFilter !== 'all') {
      filtered = filtered.filter(log => log.module === moduleFilter);
    }

    // Filtro de ação
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Filtro de usuário
    if (userFilter !== 'all') {
      filtered = filtered.filter(log => log.user_id === userFilter);
    }

    // Filtro de período
    if (periodFilter !== 'custom') {
      const days = parseInt(periodFilter);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      filtered = filtered.filter(log => new Date(log.created_at) >= startDate);
    } else if (customDateStart && customDateEnd) {
      const start = new Date(customDateStart);
      const end = new Date(customDateEnd);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= start && logDate <= end;
      });
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const getUniqueUsers = () => {
    const users = new Map<string, { id: string; name: string }>();
    logs.forEach(log => {
      if (!users.has(log.user_id)) {
        users.set(log.user_id, { id: log.user_id, name: log.user_name });
      }
    });
    return Array.from(users.values());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionDescription = (log: ActivityLog) => {
    const action = actionLabels[log.action];
    const module = moduleLabels[log.module];
    const entity = log.entity_name || 'item';
    return `${action} ${entity} em ${module}`;
  };

  // Paginação
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const clearFilters = () => {
    setSearchText('');
    setModuleFilter('all');
    setActionFilter('all');
    setPeriodFilter('30');
    setUserFilter('all');
    setCustomDateStart('');
    setCustomDateEnd('');
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Logs de Atividades</h1>
            <p className="text-sm text-gray-600 mt-1">Histórico completo de todas as ações realizadas no sistema</p>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ações Hoje</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.todayCount}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="ri-calendar-check-line text-xl text-blue-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ações na Semana</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.weekCount}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="ri-calendar-line text-xl text-green-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Usuário Mais Ativo</p>
                  <p className="text-base font-semibold text-gray-900 mt-1 truncate">{stats.mostActiveUser.name}</p>
                  <p className="text-xs text-gray-500">{stats.mostActiveUser.count} ações</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="ri-user-star-line text-xl text-purple-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Módulo Mais Usado</p>
                  <p className="text-base font-semibold text-gray-900 mt-1 truncate">{stats.mostUsedModule.name}</p>
                  <p className="text-xs text-gray-500">{stats.mostUsedModule.count} ações</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <i className="ri-apps-line text-xl text-orange-600"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Busca */}
              <div className="xl:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Buscar</label>
                <div className="relative">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Usuário, entidade, descrição..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Módulo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Módulo</label>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  <option value="creators">Creators</option>
                  <option value="deals">Acompanhamento</option>
                  <option value="interactions">Interações</option>
                  <option value="forms">Formulários</option>
                  <option value="users">Usuários</option>
                  <option value="settings">Configurações</option>
                  <option value="funnels">Funis</option>
                  <option value="logistics">Logística</option>
                  <option value="tasks">Tarefas</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="metrics">Métricas</option>
                  <option value="imports">Importações</option>
                </select>
              </div>

              {/* Ação */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ação</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todas</option>
                  <option value="create">Criar</option>
                  <option value="update">Editar</option>
                  <option value="delete">Excluir</option>
                </select>
              </div>

              {/* Período */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Período</label>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1">Hoje</option>
                  <option value="7">7 dias</option>
                  <option value="30">30 dias</option>
                  <option value="90">90 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {/* Usuário */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Usuário</label>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  {getUniqueUsers().map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Período Personalizado */}
            {periodFilter === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Botão Limpar Filtros */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                <i className="ri-refresh-line mr-2"></i>
                Limpar Filtros
              </button>
            </div>
          </div>

          {/* Tabela de Logs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Data/Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Ação</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Descrição</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        <i className="ri-loader-4-line animate-spin text-xl mb-2"></i>
                        <p>Carregando logs...</p>
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        <i className="ri-file-list-line text-3xl mb-2"></i>
                        <p>Nenhum log encontrado</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {log.user_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{log.user_name}</p>
                              <p className="text-xs text-gray-500">{log.user_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${actionColors[log.action]}`}>
                            {actionLabels[log.action]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {moduleLabels[log.module]}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {getActionDescription(log)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalhes"
                          >
                            <i className="ri-eye-line text-base"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredLogs.length)} de {filteredLogs.length} registros
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                    Anterior
                  </button>
                  <span className="text-sm text-gray-700">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Próxima
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </AppLayout>
  );
};

export default LogsPage;

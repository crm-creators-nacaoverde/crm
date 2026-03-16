import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/feature/AppLayout';
import Modal from '../../components/base/Modal';

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string;
  action: string;
  module: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

// ─── Config visual ────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  create:  { label: 'Criação',      color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: 'ri-add-circle-line' },
  update:  { label: 'Edição',       color: 'text-sky-700',     bg: 'bg-sky-50',      icon: 'ri-edit-line' },
  delete:  { label: 'Exclusão',     color: 'text-rose-700',    bg: 'bg-rose-50',     icon: 'ri-delete-bin-line' },
  login:   { label: 'Login',        color: 'text-violet-700',  bg: 'bg-violet-50',   icon: 'ri-login-circle-line' },
  logout:  { label: 'Logout',       color: 'text-gray-700',    bg: 'bg-gray-100',    icon: 'ri-logout-circle-line' },
  view:    { label: 'Visualização', color: 'text-gray-600',    bg: 'bg-gray-100',    icon: 'ri-eye-line' },
  export:  { label: 'Exportação',   color: 'text-amber-700',   bg: 'bg-amber-50',    icon: 'ri-download-line' },
  move:    { label: 'Movimentação', color: 'text-indigo-700',  bg: 'bg-indigo-50',   icon: 'ri-drag-move-line' },
  send:    { label: 'Envio',        color: 'text-teal-700',    bg: 'bg-teal-50',     icon: 'ri-send-plane-line' },
};

const MODULE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  creators:         { label: 'Creators',       icon: 'ri-user-star-line',      color: 'text-[#004aad]' },
  deals:            { label: 'Acompanhamento', icon: 'ri-kanban-view',          color: 'text-teal-600' },
  interactions:     { label: 'Interações',     icon: 'ri-chat-3-line',          color: 'text-sky-600' },
  forms:            { label: 'Formulários',    icon: 'ri-survey-line',          color: 'text-violet-600' },
  form_submissions: { label: 'Respostas',      icon: 'ri-file-list-3-line',     color: 'text-purple-600' },
  users:            { label: 'Usuários',       icon: 'ri-team-line',            color: 'text-amber-600' },
  settings:         { label: 'Configurações',  icon: 'ri-settings-3-line',      color: 'text-gray-600' },
  funnels:          { label: 'Funis',          icon: 'ri-flow-chart',           color: 'text-orange-600' },
  logistics:        { label: 'Logística',      icon: 'ri-truck-line',           color: 'text-emerald-600' },
  auth:             { label: 'Autenticação',   icon: 'ri-shield-keyhole-line',  color: 'text-rose-600' },
};

function getActionCfg(action: string) {
  return ACTION_CONFIG[action] || { label: action, color: 'text-gray-600', bg: 'bg-gray-100', icon: 'ri-question-line' };
}
function getModuleCfg(module: string) {
  return MODULE_CONFIG[module] || { label: module, icon: 'ri-apps-line', color: 'text-gray-500' };
}

function buildDescription(log: ActivityLog): string {
  const mod = getModuleCfg(log.module).label;
  const entity = log.entity_name ? `"${log.entity_name}"` : 'registro';
  const details = log.details || {};

  switch (log.action) {
    case 'create':  return `Criou ${entity} em ${mod}`;
    case 'delete':  return `Excluiu ${entity} de ${mod}`;
    case 'login':   return `Entrou no sistema`;
    case 'logout':  return `Saiu do sistema`;
    case 'export':  return `Exportou dados de ${mod}`;
    case 'send':    return `Enviou formulário para ${entity}`;
    case 'move': {
      const from = details?.from || '?';
      const to   = details?.to   || '?';
      return `Moveu ${entity} de "${from}" para "${to}"`;
    }
    case 'update': {
      if (details?.action === 'toggle_status') {
        return `${details.to ? 'Ativou' : 'Desativou'} ${entity} em ${mod}`;
      }
      if (details?.action === 'move_stage') {
        return `Moveu ${entity} de "${details.from}" para "${details.to}"`;
      }
      return `Editou ${entity} em ${mod}`;
    }
    default: return `${log.action} em ${mod}`;
  }
}

// ─── Diff viewer ──────────────────────────────────────────────
function DiffView({ before, after }: { before: any; after: any }) {
  if (!before && !after) return null;

  const fields = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after  || {}),
  ]);

  // Campos que não vale mostrar no diff
  const skip = new Set(['updated_at', 'created_at', 'id', 'password']);
  const changed: { key: string; before: any; after: any }[] = [];

  fields.forEach(k => {
    if (skip.has(k)) return;
    const bv = before?.[k];
    const av = after?.[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      changed.push({ key: k, before: bv, after: av });
    }
  });

  if (changed.length === 0) return <p className="text-xs text-gray-400 italic">Nenhuma alteração detectada nos campos monitorados.</p>;

  const fmt = (v: any) => {
    if (v === null || v === undefined) return <span className="text-gray-400 italic">vazio</span>;
    if (typeof v === 'boolean') return <span className={v ? 'text-emerald-600' : 'text-rose-500'}>{v ? 'Sim' : 'Não'}</span>;
    if (typeof v === 'object') return <span className="font-mono text-xs break-all">{JSON.stringify(v)}</span>;
    return <span className="break-all">{String(v)}</span>;
  };

  return (
    <div className="space-y-2">
      {changed.map(({ key, before: bv, after: av }) => (
        <div key={key} className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs items-start">
          <span className="font-semibold text-gray-500 truncate" title={key}>{key}</span>
          <div className="bg-rose-50 border border-rose-100 rounded px-2 py-1 text-rose-700">{fmt(bv)}</div>
          <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-emerald-700">{fmt(av)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Modal de detalhe ─────────────────────────────────────────
function LogDetailModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const actionCfg = getActionCfg(log.action);
  const moduleCfg = getModuleCfg(log.module);
  const details = log.details || {};

  const fmt = (d: string) =>
    new Date(d).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <Modal isOpen={true} onClose={onClose} title="Detalhes do Log" size="lg">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4 bg-gray-50 rounded-xl p-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${actionCfg.bg}`}>
            <i className={`${actionCfg.icon} text-xl ${actionCfg.color}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{buildDescription(log)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmt(log.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${actionCfg.bg} ${actionCfg.color}`}>
              <i className={`${actionCfg.icon} text-[11px]`}></i>
              {actionCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 ${moduleCfg.color}`}>
              <i className={`${moduleCfg.icon} text-[11px]`}></i>
              {moduleCfg.label}
            </span>
          </div>
        </div>

        {/* Usuário */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Usuário</p>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3.5 border border-gray-100">
            <div className="w-9 h-9 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">{log.user_name?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{log.user_name}</p>
              <p className="text-xs text-gray-400">{log.user_email}</p>
            </div>
          </div>
        </div>

        {/* Entidade */}
        {(log.entity_name || log.entity_id) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Registro afetado</p>
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 space-y-1">
              {log.entity_name && <p className="text-sm font-medium text-gray-900">{log.entity_name}</p>}
              {log.entity_id && <p className="text-[11px] text-gray-400 font-mono">{log.entity_id}</p>}
            </div>
          </div>
        )}

        {/* Diff antes/depois */}
        {(details.before || details.after) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Campos alterados</p>
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <div className="grid grid-cols-[140px_1fr_1fr] gap-2 mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Campo</span>
                <span className="text-[10px] font-bold text-rose-400 uppercase">Antes</span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase">Depois</span>
              </div>
              <DiffView before={details.before} after={details.after} />
            </div>
          </div>
        )}

        {/* Outros detalhes */}
        {Object.keys(details).some(k => !['before', 'after', 'data'].includes(k)) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Informações adicionais</p>
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-auto max-h-48">
                {JSON.stringify(
                  Object.fromEntries(Object.entries(details).filter(([k]) => !['before', 'after'].includes(k))),
                  null, 2
                )}
              </pre>
            </div>
          </div>
        )}

        {/* Data criação (quando é um create, mostra os dados) */}
        {details.data && !details.before && !details.after && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dados criados</p>
            <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-100">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-auto max-h-48">
                {JSON.stringify(details.data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg transition-colors cursor-pointer whitespace-nowrap">
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function LogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filtered, setFiltered] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('30');
  const [userFilter, setUserFilter] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Paginação
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error('Erro ao carregar logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Aplicar filtros
  useEffect(() => {
    let result = [...logs];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l =>
        l.user_name?.toLowerCase().includes(s) ||
        l.user_email?.toLowerCase().includes(s) ||
        l.entity_name?.toLowerCase().includes(s) ||
        buildDescription(l).toLowerCase().includes(s)
      );
    }
    if (moduleFilter !== 'all') result = result.filter(l => l.module === moduleFilter);
    if (actionFilter !== 'all') result = result.filter(l => l.action === actionFilter);
    if (userFilter !== 'all') result = result.filter(l => l.user_id === userFilter);

    if (periodFilter === 'custom') {
      if (dateStart && dateEnd) {
        const start = new Date(dateStart);
        const end = new Date(dateEnd); end.setHours(23, 59, 59);
        result = result.filter(l => {
          const d = new Date(l.created_at);
          return d >= start && d <= end;
        });
      }
    } else {
      const days = parseInt(periodFilter);
      const cutoff = new Date(Date.now() - days * 86400000);
      result = result.filter(l => new Date(l.created_at) >= cutoff);
    }

    setFiltered(result);
    setPage(1);
  }, [logs, search, moduleFilter, actionFilter, periodFilter, userFilter, dateStart, dateEnd]);

  const uniqueUsers = [...new Map(logs.map(l => [l.user_id, { id: l.user_id, name: l.user_name }])).values()].filter(u => u.id);

  // Stats
  const todayLogs = logs.filter(l => new Date(l.created_at) >= new Date(new Date().setHours(0,0,0,0)));
  const weekLogs  = logs.filter(l => new Date(l.created_at) >= new Date(Date.now() - 7 * 86400000));
  const topUser   = uniqueUsers.reduce((best, u) => {
    const count = logs.filter(l => l.user_id === u.id).length;
    return count > (best.count || 0) ? { ...u, count } : best;
  }, {} as any);
  const topModule = Object.entries(
    logs.reduce((acc, l) => { acc[l.module] = (acc[l.module] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0];

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const clearFilters = () => {
    setSearch(''); setModuleFilter('all'); setActionFilter('all');
    setPeriodFilter('30'); setUserFilter('all'); setDateStart(''); setDateEnd('');
  };

  const activeFilters = [search, moduleFilter !== 'all', actionFilter !== 'all', userFilter !== 'all', periodFilter !== '30'].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Hoje', value: todayLogs.length, icon: 'ri-calendar-check-line', color: 'text-[#004aad]', bg: 'bg-[#5de0e6]/10' },
            { label: 'Últimos 7 dias', value: weekLogs.length, icon: 'ri-calendar-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Usuário mais ativo', value: topUser.name || '—', icon: 'ri-user-star-line', color: 'text-violet-600', bg: 'bg-violet-50', small: true },
            { label: 'Módulo mais usado', value: topModule ? getModuleCfg(topModule[0]).label : '—', icon: 'ri-apps-line', color: 'text-amber-600', bg: 'bg-amber-50', small: true },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <i className={`${s.icon} text-lg ${s.color}`}></i>
              </div>
              <div className="min-w-0">
                <p className={`font-bold text-gray-900 truncate ${s.small ? 'text-sm' : 'text-xl'}`}>{s.value}</p>
                <p className="text-[11px] text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="xl:col-span-2 relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por usuário, entidade..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]"
              />
            </div>
            {/* Módulo */}
            <div className="relative">
              <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] appearance-none bg-white cursor-pointer">
                <option value="all">Todos os módulos</option>
                {Object.entries(MODULE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
            {/* Ação */}
            <div className="relative">
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] appearance-none bg-white cursor-pointer">
                <option value="all">Todas as ações</option>
                {Object.entries(ACTION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
            {/* Período */}
            <div className="relative">
              <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] appearance-none bg-white cursor-pointer">
                <option value="1">Hoje</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="custom">Personalizado</option>
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
            {/* Usuário */}
            <div className="relative">
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] appearance-none bg-white cursor-pointer">
                <option value="all">Todos os usuários</option>
                {uniqueUsers.map(u => <option key={u.id} value={u.id!}>{u.name}</option>)}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
          </div>

          {/* Datas personalizadas */}
          {periodFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Data inicial</label>
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Data final</label>
                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30" />
              </div>
            </div>
          )}

          {/* Linha de resumo */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              <span className="font-semibold text-gray-700">{filtered.length}</span> registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
              {activeFilters > 0 && <span className="ml-1.5 text-[#004aad]">({activeFilters} filtro{activeFilters > 1 ? 's' : ''} ativo{activeFilters > 1 ? 's' : ''})</span>}
            </p>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 cursor-pointer">
                <i className="ri-refresh-line text-sm"></i> Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Data / Hora</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Usuário</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ação</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Módulo</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Descrição</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm text-gray-400 mt-3">Carregando logs...</p>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <i className="ri-file-list-3-line text-3xl text-gray-300"></i>
                      </div>
                      <p className="text-sm text-gray-400">Nenhum log encontrado</p>
                      {logs.length === 0 && <p className="text-xs text-gray-300 mt-1">As ações realizadas no sistema aparecerão aqui</p>}
                    </td>
                  </tr>
                ) : (
                  paginated.map(log => {
                    const actionCfg = getActionCfg(log.action);
                    const moduleCfg = getModuleCfg(log.module);
                    const hasDetails = Object.keys(log.details || {}).length > 0;
                    return (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <p className="text-[13px] text-gray-700">{fmtDate(log.created_at)}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[10px] font-bold">{log.user_name?.charAt(0)?.toUpperCase() || '?'}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-gray-800 truncate max-w-[120px]">{log.user_name}</p>
                              <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{log.user_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${actionCfg.bg} ${actionCfg.color}`}>
                            <i className={`${actionCfg.icon} text-[10px]`}></i>
                            {actionCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${moduleCfg.color}`}>
                            <i className={`${moduleCfg.icon} text-xs`}></i>
                            {moduleCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-[280px]">
                          <p className="text-[13px] text-gray-700 truncate" title={buildDescription(log)}>
                            {buildDescription(log)}
                          </p>
                          {log.entity_name && (
                            <p className="text-[10px] text-gray-400 truncate">{log.entity_name}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer mx-auto ${
                              hasDetails
                                ? 'text-[#004aad] hover:bg-[#5de0e6]/10'
                                : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50'
                            }`}
                            title={hasDetails ? 'Ver detalhes' : 'Sem detalhes adicionais'}
                          >
                            <i className={`ri-eye-line text-sm`}></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Mostrando {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  ← Anterior
                </button>
                <span className="text-xs text-gray-500">Pág. {page}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </AppLayout>
  );
}

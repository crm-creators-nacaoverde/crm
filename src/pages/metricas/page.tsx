// src/pages/metricas/page.tsx
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useGoals, resolvePeriodDates, PERIOD_LABELS, GOAL_CATEGORY_LABELS, GOAL_TYPE_LABELS } from '../../hooks/useGoals';
import type { Goal, GoalProgress, RankingEntry } from '../../hooks/useGoals';
import GoalCard from './components/GoalCard';
import GoalFormModal from './components/GoalFormModal';
import RankingTable from './components/RankingTable';

// ── Tipos de tab por visão ────────────────────────────────────────────────────
type AdminTab   = 'metas' | 'painel' | 'ranking';
type UserTab    = 'minhas' | 'ranking' | 'desempenho';

// ── Períodos predefinidos para o ranking ─────────────────────────────────────
const RANKING_PERIODS = [
  { label: 'Este mês',       getDates: () => { const n = new Date(); return { s: new Date(n.getFullYear(), n.getMonth(), 1).toISOString(), e: new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString() }; } },
  { label: 'Últimos 30 dias',getDates: () => { const n = new Date(); const s = new Date(n); s.setDate(s.getDate() - 30); return { s: s.toISOString(), e: n.toISOString() }; } },
  { label: 'Este trimestre', getDates: () => { const n = new Date(); const q = Math.floor(n.getMonth() / 3); return { s: new Date(n.getFullYear(), q * 3, 1).toISOString(), e: new Date(n.getFullYear(), q * 3 + 3, 0).toISOString() }; } },
  { label: 'Este ano',       getDates: () => { const n = new Date(); return { s: new Date(n.getFullYear(), 0, 1).toISOString(), e: new Date(n.getFullYear(), 11, 31).toISOString() }; } },
  { label: 'Histórico',      getDates: () => ({ s: '2020-01-01', e: new Date().toISOString() }) },
];

function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function MetricasPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const {
    goals, loading: goalsLoading,
    loadGoals, buildProgress, buildRanking,
    createGoal, updateGoal, deleteGoal, toggleGoal,
  } = useGoals();

  // ── Estado de tabs ─────────────────────────────────────────────────────────
  const [adminTab, setAdminTab]   = useState<AdminTab>('painel');
  const [userTab, setUserTab]     = useState<UserTab>('minhas');

  // ── Estado de metas ────────────────────────────────────────────────────────
  const [allGoals, setAllGoals]       = useState<Goal[]>([]);
  const [progresses, setProgresses]   = useState<GoalProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // ── Estado de ranking ──────────────────────────────────────────────────────
  const [rankingPeriodIdx, setRankingPeriodIdx] = useState(0);
  const [rankingEntries, setRankingEntries]       = useState<RankingEntry[]>([]);
  const [loadingRanking, setLoadingRanking]       = useState(false);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [showModal, setShowModal]         = useState(false);
  const [editingGoal, setEditingGoal]     = useState<Goal | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus]     = useState<string>('active');
  const [deleteConfirm, setDeleteConfirm]   = useState<Goal | null>(null);

  // ── Desempenho pessoal ─────────────────────────────────────────────────────
  const [myStats, setMyStats] = useState({ creators: 0, gmv: 0, amostras: 0, interacoes: 0 });

  // ── Carregar metas ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadGoals(false).then(() => {});
  }, [loadGoals]);

  // Sincronizar goals do hook com allGoals local
  useEffect(() => { setAllGoals(goals); }, [goals]);

  // ── Calcular progressos das metas ativas ──────────────────────────────────
  const calcAllProgresses = useCallback(async (goalsList: Goal[]) => {
    setLoadingProgress(true);
    const active = goalsList.filter(g => g.is_active);
    // Para cada meta, calcula o progresso do usuário atual
    const results = await Promise.all(active.map(g => buildProgress(g, profile?.id)));
    setProgresses(results);
    setLoadingProgress(false);
  }, [buildProgress, profile]);

  useEffect(() => {
    if (allGoals.length > 0) calcAllProgresses(allGoals);
  }, [allGoals, calcAllProgresses]);

  // ── Notificações de meta ───────────────────────────────────────────────────
  useEffect(() => {
    progresses.forEach(p => {
      if (!p.achieved && p.percent >= p.goal.notify_at_percent) {
        // Dispara notificação visual (integra com o sistema existente de notificações)
        console.info(`[Meta] ${p.goal.title} — ${p.percent}% atingido`);
      }
    });
  }, [progresses]);

  // ── Carregar ranking ───────────────────────────────────────────────────────
  const loadRanking = useCallback(async () => {
    setLoadingRanking(true);
    const { s, e } = RANKING_PERIODS[rankingPeriodIdx].getDates();
    const entries = await buildRanking(s, e);
    setRankingEntries(entries);
    setLoadingRanking(false);
  }, [buildRanking, rankingPeriodIdx]);

  useEffect(() => {
    if (isAdmin && adminTab === 'ranking') loadRanking();
    if (!isAdmin && userTab === 'ranking')  loadRanking();
  }, [adminTab, userTab, isAdmin, loadRanking]);

  // ── Desempenho pessoal do usuário ─────────────────────────────────────────
  const loadMyStats = useCallback(async () => {
    if (!profile) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end   = now.toISOString();

    const { supabase: _sb } = await import('../../lib/supabase');
    const { supabase } = await import('../../lib/supabase');

    const [{ count: creators }, { count: amostras }, { count: interacoes }, { data: deals }] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', profile.id).gte('created_at', start),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', profile.id).eq('amostra_enviada', true),
      supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('created_by', profile.id).gte('created_at', start),
      supabase.from('deals').select('client_id').eq('assigned_to', profile.id),
    ]);

    let gmv = 0;
    const clientIds = (deals || []).map(d => d.client_id).filter(Boolean);
    if (clientIds.length > 0) {
      const { data: gmvClients } = await supabase.from('clients').select('gmv_geral').in('id', clientIds);
      gmv = (gmvClients || []).reduce((s, c) => s + (Number(c.gmv_geral) || 0), 0);
    }

    setMyStats({ creators: creators || 0, gmv, amostras: amostras || 0, interacoes: interacoes || 0 });
  }, [profile]);

  useEffect(() => {
    if (!isAdmin && userTab === 'desempenho') loadMyStats();
  }, [userTab, isAdmin, loadMyStats]);

  // ── Handlers CRUD ─────────────────────────────────────────────────────────
  const handleCreate = async (data: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
    await createGoal(data);
  };
  const handleUpdate = async (data: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editingGoal) return;
    await updateGoal(editingGoal.id, data);
    setEditingGoal(null);
  };
  const handleDelete = async (goal: Goal) => {
    await deleteGoal(goal.id);
    setDeleteConfirm(null);
  };
  const handleToggle = async (goal: Goal) => {
    await toggleGoal(goal.id, !goal.is_active);
  };

  // ── Metas filtradas (aba admin "metas") ───────────────────────────────────
  const filteredGoals = allGoals.filter(g => {
    const matchCat    = filterCategory === 'all' || g.category === filterCategory;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? g.is_active : !g.is_active);
    return matchCat && matchStatus;
  });

  // ── Metas do usuário atual ─────────────────────────────────────────────────
  const myProgresses = progresses.filter(p =>
    p.goal.scope === 'global' ||
    (p.goal.scope === 'individual' && p.goal.assigned_to === profile?.id)
  );

  // ── Resumo admin ──────────────────────────────────────────────────────────
  const totalActive   = allGoals.filter(g => g.is_active).length;
  const totalAchieved = progresses.filter(p => p.achieved).length;
  const avgPercent    = progresses.length
    ? Math.round(progresses.reduce((s, p) => s + p.percent, 0) / progresses.length)
    : 0;

  const tabBtn = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`;

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* ── VISÃO ADMIN ─────────────────────────────────────────────────── */}
        {isAdmin && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center">
                  <i className="ri-target-line text-lg text-[#004aad]"></i>
                </div>
                <div><p className="text-xl font-bold text-gray-900">{totalActive}</p><p className="text-xs text-gray-400">Metas ativas</p></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <i className="ri-checkbox-circle-line text-lg text-emerald-600"></i>
                </div>
                <div><p className="text-xl font-bold text-gray-900">{totalAchieved}</p><p className="text-xs text-gray-400">Metas atingidas</p></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <i className="ri-percent-line text-lg text-amber-600"></i>
                </div>
                <div><p className="text-xl font-bold text-gray-900">{avgPercent}%</p><p className="text-xs text-gray-400">Média geral</p></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                  <i className="ri-group-line text-lg text-violet-600"></i>
                </div>
                <div><p className="text-xl font-bold text-gray-900">{rankingEntries.length}</p><p className="text-xs text-gray-400">Usuários no ranking</p></div>
              </div>
            </div>

            {/* Tabs admin */}
            <div className="bg-white rounded-xl border border-gray-100 p-1 flex items-center">
              {[
                { id: 'painel',  label: 'Painel Geral',      icon: 'ri-dashboard-line' },
                { id: 'metas',   label: 'Gestão de Metas',   icon: 'ri-settings-4-line' },
                { id: 'ranking', label: 'Ranking da Equipe',  icon: 'ri-trophy-line' },
              ].map(t => (
                <button key={t.id} onClick={() => setAdminTab(t.id as AdminTab)}
                  className={tabBtn(adminTab === t.id)}>
                  <i className={`${t.icon} text-sm`}></i>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── Painel Geral ── */}
            {adminTab === 'painel' && (
              <div className="space-y-4">
                {loadingProgress ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : progresses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                      <i className="ri-target-line text-3xl text-gray-300"></i>
                    </div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Nenhuma meta ativa</p>
                    <p className="text-xs text-gray-400 mb-5">Crie metas na aba "Gestão de Metas" para acompanhar o progresso</p>
                    <button onClick={() => setAdminTab('metas')}
                      className="flex items-center gap-2 px-4 py-2 bg-[#004aad] text-white text-sm font-medium rounded-xl hover:bg-[#003d91] transition-colors cursor-pointer">
                      <i className="ri-add-line"></i>Criar Primeira Meta
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {progresses.map(p => (
                      <GoalCard key={p.goal.id} progress={p} isAdmin={true}
                        onEdit={() => { setEditingGoal(p.goal); setShowModal(true); }}
                        onDelete={() => setDeleteConfirm(p.goal)}
                        onToggle={() => handleToggle(p.goal)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Gestão de Metas ── */}
            {adminTab === 'metas' && (
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        {['all', 'active', 'inactive'].map(s => (
                          <button key={s} onClick={() => setFilterStatus(s)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${filterStatus === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                            {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Pausadas'}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button onClick={() => setFilterCategory('all')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all ${filterCategory === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                          Todas
                        </button>
                        {Object.entries(GOAL_CATEGORY_LABELS).map(([k, v]) => (
                          <button key={k} onClick={() => setFilterCategory(k)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${filterCategory === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { setEditingGoal(null); setShowModal(true); }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#004aad] text-white text-sm font-medium rounded-xl hover:bg-[#003d91] transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-add-line"></i>Nova Meta
                    </button>
                  </div>
                </div>

                {/* Tabela de metas */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Meta</th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Período</th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Alvo</th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Progresso</th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGoals.length === 0 ? (
                        <tr><td colSpan={7} className="px-5 py-16 text-center">
                          <p className="text-sm text-gray-400">Nenhuma meta encontrada</p>
                        </td></tr>
                      ) : filteredGoals.map(g => {
                        const p = progresses.find(pr => pr.goal.id === g.id);
                        const pct = p?.percent ?? 0;
                        return (
                          <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                            <td className="px-5 py-3.5">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{g.title}</p>
                                <p className="text-xs text-gray-400">{GOAL_CATEGORY_LABELS[g.category]}{g.assigned_name ? ` → ${g.assigned_name}` : ' (Global)'}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-gray-600">{GOAL_TYPE_LABELS[g.type]}</td>
                            <td className="px-5 py-3.5 text-xs text-gray-600">{PERIOD_LABELS[g.period_type]}</td>
                            <td className="px-5 py-3.5 text-sm font-semibold text-gray-800">{g.target_value.toLocaleString('pt-BR')}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                  <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-[#004aad]'}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-medium text-gray-700">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {g.is_active ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Ativa
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>Pausada
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleToggle(g)} title={g.is_active ? 'Pausar' : 'Ativar'}
                                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer">
                                  <i className={`${g.is_active ? 'ri-pause-line' : 'ri-play-line'} text-sm`}></i>
                                </button>
                                <button onClick={() => { setEditingGoal(g); setShowModal(true); }}
                                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all cursor-pointer">
                                  <i className="ri-edit-line text-sm"></i>
                                </button>
                                <button onClick={() => setDeleteConfirm(g)}
                                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer">
                                  <i className="ri-delete-bin-line text-sm"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Ranking Geral (admin) ── */}
            {adminTab === 'ranking' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {RANKING_PERIODS.map((p, i) => (
                    <button key={i} onClick={() => setRankingPeriodIdx(i)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-all ${rankingPeriodIdx === i ? 'border-[#004aad] bg-[#004aad]/5 text-[#004aad]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <RankingTable entries={rankingEntries} currentUserId={profile?.id} loading={loadingRanking} />
              </div>
            )}
          </>
        )}

        {/* ── VISÃO USUÁRIO ────────────────────────────────────────────────── */}
        {!isAdmin && (
          <>
            {/* Tabs usuário */}
            <div className="bg-white rounded-xl border border-gray-100 p-1 flex items-center">
              {[
                { id: 'minhas',     label: 'Minhas Metas',   icon: 'ri-target-line' },
                { id: 'ranking',    label: 'Ranking',         icon: 'ri-trophy-line' },
                { id: 'desempenho', label: 'Meu Desempenho', icon: 'ri-bar-chart-line' },
              ].map(t => (
                <button key={t.id} onClick={() => setUserTab(t.id as UserTab)}
                  className={tabBtn(userTab === t.id)}>
                  <i className={`${t.icon} text-sm`}></i>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── Minhas Metas ── */}
            {userTab === 'minhas' && (
              <div className="space-y-4">
                {loadingProgress ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : myProgresses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                      <i className="ri-target-line text-3xl text-gray-300"></i>
                    </div>
                    <p className="text-sm font-medium text-gray-500">Nenhuma meta atribuída</p>
                    <p className="text-xs text-gray-400 mt-1">Aguarde o administrador criar metas para você</p>
                  </div>
                ) : (
                  <>
                    {/* Resumo rápido */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{myProgresses.length}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Metas ativas</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{myProgresses.filter(p => p.achieved).length}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Atingidas</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <p className="text-2xl font-bold text-[#004aad]">
                          {myProgresses.length ? Math.round(myProgresses.reduce((s, p) => s + p.percent, 0) / myProgresses.length) : 0}%
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Média</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {myProgresses.map(p => (
                        <GoalCard key={p.goal.id} progress={p} isAdmin={false} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Ranking (usuário) ── */}
            {userTab === 'ranking' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {RANKING_PERIODS.map((p, i) => (
                    <button key={i} onClick={() => setRankingPeriodIdx(i)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-all ${rankingPeriodIdx === i ? 'border-[#004aad] bg-[#004aad]/5 text-[#004aad]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <RankingTable entries={rankingEntries} currentUserId={profile?.id} loading={loadingRanking} />
              </div>
            )}

            {/* ── Meu Desempenho ── */}
            {userTab === 'desempenho' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <i className="ri-calendar-line text-sm"></i>
                  Dados do mês atual
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                    <div className="w-10 h-10 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <i className="ri-user-star-line text-lg text-[#004aad]"></i>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{myStats.creators}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Creators cadastrados</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <i className="ri-money-dollar-circle-line text-lg text-emerald-600"></i>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(myStats.gmv)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">GMV Total</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <i className="ri-gift-line text-lg text-amber-600"></i>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{myStats.amostras}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Amostras enviadas</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                    <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <i className="ri-chat-3-line text-lg text-violet-600"></i>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{myStats.interacoes}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Interações</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Modal criar/editar meta ─────────────────────────────────────── */}
        {showModal && (
          <GoalFormModal
            goal={editingGoal}
            onClose={() => { setShowModal(false); setEditingGoal(null); }}
            onSave={editingGoal ? handleUpdate : handleCreate} />
        )}

        {/* ── Confirmar exclusão ──────────────────────────────────────────── */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-delete-bin-line text-2xl text-rose-500"></i>
              </div>
              <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Excluir Meta</h3>
              <p className="text-sm text-gray-500 text-center mb-2">"{deleteConfirm.title}"</p>
              <p className="text-sm text-gray-400 text-center mb-5">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 cursor-pointer">
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

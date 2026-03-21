import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import { supabase, Client, Interaction } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../hooks/useActivityLog';
import { useGoals, resolvePeriodDates, PERIOD_LABELS, GOAL_CATEGORY_LABELS, GOAL_TYPE_LABELS } from '../../hooks/useGoals';
import type { Goal, GoalProgress, RankingEntry } from '../../hooks/useGoals';
import MetricCards from './components/MetricCards';
import ActivityBars from './components/ActivityBars';
import DistributionCharts from './components/DistributionCharts';
import TopCreatorsAndInteractions from './components/TopCreatorsAndInteractions';
import MonthlyEvolution from './components/MonthlyEvolution';
import GoalCard from './components/GoalCard';
import GoalFormModal from './components/GoalFormModal';
import RankingTable from './components/RankingTable';

export type GmvPeriod = '7d' | '14d' | '28d' | '30d';

export function getGmvField(period: GmvPeriod): string {
  const map: Record<GmvPeriod, string> = {
    '7d': 'gmv_interno_7d',
    '14d': 'gmv_interno_14d',
    '28d': 'gmv_interno_28d',
    '30d': 'gmv_interno_30d',
  };
  return map[period];
}

const periodOptions: { value: GmvPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '14d', label: '14 dias' },
  { value: '28d', label: '28 dias' },
  { value: '30d', label: '30 dias' },
];

interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'full' | 'half' | 'third';
  config: Record<string, any>;
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  widgets: Widget[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

const WIDGET_CATALOG = [
  { type: 'metric_cards',         label: 'Cards de Métricas',       icon: 'ri-bar-chart-box-line',      desc: 'Total de creators, GMV, comissões' },
  { type: 'activity_bars',        label: 'Taxa de Atividade',        icon: 'ri-pulse-line',              desc: 'Taxa de atividade e média de interações' },
  { type: 'distribution_charts',  label: 'Distribuição',             icon: 'ri-pie-chart-2-line',        desc: 'Por plataforma e categoria' },
  { type: 'top_creators',         label: 'Top Creators',             icon: 'ri-trophy-line',             desc: 'Ranking por GMV interno' },
  { type: 'recent_interactions',  label: 'Interações Recentes',      icon: 'ri-chat-3-line',             desc: 'Últimas interações registradas' },
  { type: 'monthly_evolution',    label: 'Evolução Mensal',          icon: 'ri-line-chart-line',         desc: 'Evolução de creators e GMV por mês' },
  { type: 'gmv_overview',         label: 'Visão Geral de GMV',       icon: 'ri-money-dollar-circle-line',desc: 'GMV detalhado por período' },
  { type: 'rfm_summary',          label: 'Análise RFM',              icon: 'ri-user-star-line',          desc: 'Segmentação de creators por atividade, conteúdo e GMV' },
  { type: 'goal_progress',        label: 'Progresso de Metas',       icon: 'ri-target-line',             desc: 'Metas ativas com barra de progresso em tempo real' },
];

const DASHBOARD_COLORS = [
  { value: '#004aad', label: 'Azul' },
  { value: '#7c3aed', label: 'Roxo' },
  { value: '#059669', label: 'Verde' },
  { value: '#dc2626', label: 'Vermelho' },
  { value: '#d97706', label: 'Âmbar' },
  { value: '#0891b2', label: 'Ciano' },
  { value: '#db2777', label: 'Rosa' },
  { value: '#374151', label: 'Cinza' },
];

const DASHBOARD_ICONS = [
  'ri-dashboard-3-line', 'ri-bar-chart-2-line', 'ri-line-chart-line',
  'ri-pie-chart-2-line', 'ri-user-star-line', 'ri-money-dollar-circle-line',
  'ri-trophy-line', 'ri-heart-pulse-line', 'ri-megaphone-line', 'ri-group-line',
  'ri-store-line', 'ri-rocket-line',
];

// ─── Períodos do Ranking ─────────────────────────────────────────
const RANKING_PERIODS = [
  { label: 'Este mês',        getDates: () => { const n = new Date(); return { s: new Date(n.getFullYear(), n.getMonth(), 1).toISOString(), e: new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString() }; } },
  { label: 'Últimos 30 dias', getDates: () => { const n = new Date(); const s = new Date(n); s.setDate(s.getDate() - 30); return { s: s.toISOString(), e: n.toISOString() }; } },
  { label: 'Este trimestre',  getDates: () => { const n = new Date(); const q = Math.floor(n.getMonth() / 3); return { s: new Date(n.getFullYear(), q * 3, 1).toISOString(), e: new Date(n.getFullYear(), q * 3 + 3, 0).toISOString() }; } },
  { label: 'Este ano',        getDates: () => { const n = new Date(); return { s: new Date(n.getFullYear(), 0, 1).toISOString(), e: new Date(n.getFullYear(), 11, 31).toISOString() }; } },
  { label: 'Histórico',       getDates: () => ({ s: '2020-01-01', e: new Date().toISOString() }) },
];

// ─── Widget Renderer ─────────────────────────────────────────────
function WidgetRenderer({
  widget, clients, interactions, gmvPeriod,
}: {
  widget: Widget;
  clients: Client[];
  interactions: (Interaction & { client?: Client })[];
  gmvPeriod: GmvPeriod;
}) {
  switch (widget.type) {
    case 'metric_cards':       return <MetricCards clients={clients} gmvPeriod={gmvPeriod} />;
    case 'activity_bars':      return <ActivityBars clients={clients} totalInteractions={interactions.length} />;
    case 'distribution_charts':return <DistributionCharts clients={clients} />;
    case 'top_creators':       return (
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Creators por GMV</h3>
        <TopCreatorsOnly clients={clients} gmvPeriod={gmvPeriod} />
      </div>
    );
    case 'recent_interactions':return (
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Interações Recentes</h3>
        <RecentInteractionsOnly interactions={interactions} />
      </div>
    );
    case 'monthly_evolution':  return <MonthlyEvolution clients={clients} gmvPeriod={gmvPeriod} />;
    case 'gmv_overview':       return <GmvOverview clients={clients} gmvPeriod={gmvPeriod} />;
    case 'rfm_summary':        return <RfmSummary clients={clients} gmvPeriod={gmvPeriod} />;
    case 'goal_progress':      return <GoalProgressWidget />;
    default:
      return (
        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <i className="ri-question-line text-2xl text-gray-300 mb-2 block"></i>
          <p className="text-sm text-gray-400">Widget "{widget.type}" desconhecido</p>
        </div>
      );
  }
}

// ─── Widget de Progresso de Metas ────────────────────────────────
function GoalProgressWidget() {
  const { profile, hasPermission } = useAuth();
  const { goals, loadGoals, buildProgress } = useGoals();
  const canSeeAll = profile?.role === 'admin' || hasPermission('metrics', 'edit');

  const [progresses, setProgresses] = useState<GoalProgress[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    loadGoals(true);
  }, [loadGoals]);

  useEffect(() => {
    if (!goals.length) { setLoading(false); return; }
    const run = async () => {
      setLoading(true);
      // Admin/gerente: todas as metas ativas | Usuário: só as suas (global + individual)
      const relevant = goals.filter(g =>
        g.is_active && (
          canSeeAll ||
          g.scope === 'global' ||
          (g.scope === 'individual' && g.assigned_to === profile?.id)
        )
      );
      const results = await Promise.all(relevant.map(g => buildProgress(g, profile?.id)));
      setProgresses(results);
      setLoading(false);
    };
    run();
  }, [goals, canSeeAll, profile, buildProgress]);

  const CATEGORY_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
    hunter:    { bar: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700',      text: 'Hunter' },
    closer:    { bar: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700', text: 'Closer' },
    cs:        { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', text: 'CS' },
    marketing: { bar: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700',   text: 'Marketing' },
  };

  const formatValue = (p: GoalProgress) => {
    if (p.goal.type.startsWith('gmv')) {
      return `R$ ${p.current_value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} / R$ ${p.goal.target_value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
    }
    return `${p.current_value.toLocaleString('pt-BR')} / ${p.goal.target_value.toLocaleString('pt-BR')}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#5de0e6]/10 rounded-lg flex items-center justify-center">
            <i className="ri-target-line text-base text-[#004aad]"></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Progresso de Metas</h3>
            <p className="text-[10px] text-gray-400">Metas ativas no período</p>
          </div>
        </div>
        {progresses.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              {progresses.filter(p => p.achieved).length} atingidas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-200 rounded-full"></span>
              {progresses.filter(p => !p.achieved).length} em andamento
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : progresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <i className="ri-target-line text-2xl text-gray-200 mb-2"></i>
          <p className="text-xs text-gray-400">Nenhuma meta ativa no momento</p>
        </div>
      ) : (
        <div className="space-y-4">
          {progresses.map(p => {
            const colors = CATEGORY_COLORS[p.goal.category] || CATEGORY_COLORS.hunter;
            const barColor = p.achieved ? 'bg-emerald-500' : colors.bar;
            const pctDisplay = p.percent;

            return (
              <div key={p.goal.id} className="space-y-1.5">
                {/* Linha topo: título + badge categoria + % */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${colors.badge}`}>
                      {colors.text}
                    </span>
                    <p className="text-xs font-medium text-gray-800 truncate">{p.goal.title}</p>
                    {p.goal.scope === 'individual' && p.goal.assigned_name && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap hidden sm:block">→ {p.goal.assigned_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.achieved && <span className="text-[10px] font-bold text-emerald-600">🎯</span>}
                    <span className={`text-xs font-bold ${p.achieved ? 'text-emerald-600' : pctDisplay >= p.goal.notify_at_percent ? 'text-amber-600' : 'text-gray-700'}`}>
                      {pctDisplay}%
                    </span>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                    style={{ width: `${pctDisplay}%` }}
                  />
                </div>

                {/* Linha inferior: valor atual / alvo + dias restantes */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{formatValue(p)}</span>
                  {p.days_remaining !== null && (
                    <span className={`text-[10px] font-medium ${p.days_remaining === 0 ? 'text-rose-500' : p.days_remaining <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {p.days_remaining === 0 ? 'Encerrado' : p.days_remaining === 1 ? '1 dia restante' : `${p.days_remaining} dias`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes originais ────────────────────────────────────
function TopCreatorsOnly({ clients, gmvPeriod }: { clients: Client[]; gmvPeriod: GmvPeriod }) {
  const gmvField = getGmvField(gmvPeriod);
  const top = [...clients].sort((a, b) => Number((b as any)[gmvField] ?? 0) - Number((a as any)[gmvField] ?? 0)).slice(0, 8);
  const rankColors = ['bg-amber-400', 'bg-gray-400', 'bg-orange-400'];
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (!top.length) return <p className="text-sm text-gray-400 text-center py-8">Sem dados</p>;
  return (
    <div className="space-y-1">
      {top.map((c, i) => (
        <div key={c.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${i < 3 ? rankColors[i] : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
            <p className="text-[11px] text-gray-400">{c.platform || 'TikTok'}</p>
          </div>
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{fmt(Number((c as any)[gmvField] ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

function RecentInteractionsOnly({ interactions }: { interactions: (Interaction & { client?: Client })[] }) {
  const recent = [...interactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  const cfg: Record<string, { icon: string; bg: string; text: string; label: string }> = {
    meeting:  { icon: 'ri-calendar-event-line', bg: 'bg-sky-50',    text: 'text-sky-600',    label: 'Reunião' },
    email:    { icon: 'ri-mail-line',           bg: 'bg-violet-50', text: 'text-violet-600', label: 'Email' },
    call:     { icon: 'ri-phone-line',          bg: 'bg-emerald-50',text: 'text-emerald-600',label: 'Ligação' },
    whatsapp: { icon: 'ri-whatsapp-line',       bg: 'bg-green-50',  text: 'text-green-600',  label: 'WhatsApp' },
    other:    { icon: 'ri-chat-1-line',         bg: 'bg-gray-50',   text: 'text-gray-600',   label: 'Outro' },
  };
  if (!recent.length) return <p className="text-sm text-gray-400 text-center py-8">Sem interações</p>;
  return (
    <div className="space-y-1">
      {recent.map(i => {
        const c = cfg[i.type] ?? cfg.other;
        return (
          <div key={i.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <i className={`${c.icon} text-sm ${c.text}`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{i.title}</p>
              <p className="text-[11px] text-gray-400 truncate">{i.client?.name || '—'} · {c.label}</p>
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {new Date(i.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GmvOverview({ clients, gmvPeriod }: { clients: Client[]; gmvPeriod: GmvPeriod }) {
  const gmvField = getGmvField(gmvPeriod);
  const periods = [
    { label: '7 dias',  field: 'gmv_interno_7d' },
    { label: '14 dias', field: 'gmv_interno_14d' },
    { label: '28 dias', field: 'gmv_interno_28d' },
    { label: '30 dias', field: 'gmv_interno_30d' },
  ];
  const total = (field: string) => clients.reduce((s, c) => s + Number((c as any)[field] ?? 0), 0);
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const max = Math.max(...periods.map(p => total(p.field)), 1);
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">GMV por Período</h3>
      <div className="space-y-3">
        {periods.map(p => {
          const v = total(p.field);
          const pct = (v / max) * 100;
          const active = p.field === gmvField;
          return (
            <div key={p.field}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-medium ${active ? 'text-[#004aad]' : 'text-gray-700'}`}>{p.label}</span>
                <span className={`text-sm font-bold ${active ? 'text-[#004aad]' : 'text-gray-700'}`}>{fmt(v)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className={`h-full rounded-full transition-all duration-500 ${active ? 'bg-[#004aad]' : 'bg-[#5de0e6]'}`} style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-600 mb-1">Comissão Orgânica Média</p>
          <p className="text-2xl font-bold text-emerald-700">
            {clients.length > 0 ? (clients.reduce((s, c) => s + Number(c.comissao_organica ?? 0), 0) / clients.length).toFixed(1) : '0'}%
          </p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <p className="text-xs text-amber-600 mb-1">Comissão Tráfego Média</p>
          <p className="text-2xl font-bold text-amber-700">
            {clients.length > 0 ? (clients.reduce((s, c) => s + Number(c.comissao_trafego ?? 0), 0) / clients.length).toFixed(1) : '0'}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── RFM (mantido original completo) ─────────────────────────────
const RFM_SEGMENTS = [
  { key: 'campeoes',         label: 'Embaixadores Elite',  icon: 'ri-trophy-line',         desc: 'Creators ativos, com alta produção de conteúdo e excelente GMV. Seu ativo mais valioso — priorize atenção e benefícios exclusivos.', rMin: 4, rMax: 5, fMin: 4, fMax: 5, mMin: 4, mMax: 5, bg: '#10b981', text: '#fff', col: 2, row: 1 },
  { key: 'clientes_fieis',   label: 'Creators Fiéis',      icon: 'ri-heart-line',          desc: 'Alta produção de conteúdo e bom GMV. Engajam consistentemente com a marca. Ótimos candidatos a contratos de longo prazo.', rMin: 2, rMax: 5, fMin: 3, fMax: 5, mMin: 3, mMax: 5, bg: '#6366f1', text: '#fff', col: 2, row: 1 },
  { key: 'fiel_potencial',   label: 'Alto Potencial',      icon: 'ri-thumb-up-line',       desc: 'Creators recentes com frequência de conteúdo crescente. Invista em capacitação e acompanhamento para acelerar o GMV.', rMin: 3, rMax: 5, fMin: 1, fMax: 3, mMin: 1, mMax: 3, bg: '#06b6d4', text: '#fff', col: 1, row: 2 },
  { key: 'novos',            label: 'Novos Creators',      icon: 'ri-user-add-line',       desc: 'Recém-cadastrados com primeiros conteúdos. Fase de onboarding — envie amostras, brief e acompanhe de perto.', rMin: 4, rMax: 5, fMin: 1, fMax: 1, mMin: 1, mMax: 1, bg: '#14b8a6', text: '#fff', col: 1, row: 2 },
  { key: 'promessas',        label: 'Promessas',           icon: 'ri-line-chart-line',     desc: 'Ativos recentemente e com bom crescimento. Ainda não atingiram o pico — crie desafios e metas para destravar o potencial.', rMin: 3, rMax: 5, fMin: 1, fMax: 2, mMin: 1, mMax: 2, bg: '#0ea5e9', text: '#fff', col: 1, row: 2 },
  { key: 'precisam_atencao', label: 'Precisam de Atenção', icon: 'ri-error-warning-line',  desc: 'Performance abaixo do esperado mas ainda ativos. Entenda as dificuldades: falta de brief? Produto errado? Incentivos insuficientes?', rMin: 2, rMax: 3, fMin: 2, fMax: 3, mMin: 2, mMax: 3, bg: '#8b5cf6', text: '#fff', col: 1, row: 2 },
  { key: 'dormentes',        label: 'Quase Inativos',      icon: 'ri-time-line',           desc: 'Pouco conteúdo e GMV fraco nos últimos períodos. Reative com nova campanha, brindes ou contato direto antes que se percam.', rMin: 2, rMax: 3, fMin: 1, fMax: 2, mMin: 1, mMax: 2, bg: '#7c3aed', text: '#fff', col: 1, row: 3 },
  { key: 'em_risco',         label: 'Em Risco de Saída',   icon: 'ri-alert-line',          desc: 'Já geraram bom GMV mas estão sumindo. Ação urgente: ligue, entenda o motivo e ofereça condições especiais de reativação.', rMin: 1, rMax: 2, fMin: 2, fMax: 5, mMin: 2, mMax: 5, bg: '#4f46e5', text: '#fff', col: 1, row: 3 },
  { key: 'nao_pode_perder',  label: 'Não Pode Perder',     icon: 'ri-shield-star-line',    desc: 'Creators de alto valor histórico sem atividade recente. Resgate imediato — ofereça contratos exclusivos, produtos premium ou visibilidade.', rMin: 1, rMax: 1, fMin: 4, fMax: 5, mMin: 4, mMax: 5, bg: '#3730a3', text: '#fff', col: 1, row: 3 },
  { key: 'hibernando',       label: 'Hibernando',          icon: 'ri-moon-line',           desc: 'Sem conteúdo e GMV muito baixo há bastante tempo. Avalie se vale investir numa reativação ou redirecionar recursos.', rMin: 1, rMax: 2, fMin: 1, fMax: 2, mMin: 1, mMax: 2, bg: '#4338ca', text: '#fff', col: 1, row: 3 },
  { key: 'perdidos',         label: 'Desengajados',        icon: 'ri-user-unfollow-line',  desc: 'Sem atividade significativa em todos os indicadores. Considere arquivar o perfil ou fazer uma última tentativa de contato.', rMin: 1, rMax: 2, fMin: 1, fMax: 2, mMin: 1, mMax: 2, bg: '#312e81', text: '#fff', col: 1, row: 3 },
];

function calcRfmScore(client: Client, gmvField: string): { r: number; f: number; m: number } {
  const now = new Date();
  const daysSince = (now.getTime() - new Date(client.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const r = daysSince <= 7 ? 5 : daysSince <= 14 ? 4 : daysSince <= 30 ? 3 : daysSince <= 60 ? 2 : 1;
  const videos = Number((client as any).videos_30d ?? 0);
  const f = videos >= 20 ? 5 : videos >= 12 ? 4 : videos >= 6 ? 3 : videos >= 2 ? 2 : 1;
  const gmv = Number((client as any)[gmvField] ?? 0);
  const m = gmv > 50000 ? 5 : gmv > 20000 ? 4 : gmv > 10000 ? 3 : gmv > 5000 ? 2 : 1;
  return { r, f, m };
}

function classifyRfm(r: number, f: number, m: number): string {
  if (r >= 4 && f >= 4 && m >= 4) return 'campeoes';
  if (r >= 4 && f >= 3 && m >= 3) return 'clientes_fieis';
  if (r >= 2 && f >= 3 && m >= 3) return 'clientes_fieis';
  if (r >= 4 && f === 1 && m === 1) return 'novos';
  if (r >= 3 && f <= 2 && m <= 2) return 'promessas';
  if (r >= 3 && f <= 3 && m <= 3) return 'fiel_potencial';
  if (r >= 2 && r <= 3 && f >= 2 && f <= 3 && m >= 2 && m <= 3) return 'precisam_atencao';
  if (r >= 2 && r <= 3 && f <= 2 && m <= 2) return 'dormentes';
  if (r <= 2 && f >= 2 && m >= 2) return 'em_risco';
  if (r === 1 && f >= 4 && m >= 4) return 'nao_pode_perder';
  if (r <= 2 && f <= 2 && m <= 2 && (f + m) >= 3) return 'hibernando';
  return 'perdidos';
}

function SegmentTooltip({ seg }: { seg: typeof RFM_SEGMENTS[0] }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
      <p className="font-semibold mb-0.5">{seg.label}</p>
      <p className="text-gray-300 leading-snug">{seg.desc}</p>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
    </div>
  );
}

function RfmSummary({ clients, gmvPeriod }: { clients: Client[]; gmvPeriod: GmvPeriod }) {
  const gmvField = getGmvField(gmvPeriod);
  const total = clients.length;
  const classified = clients.map(c => { const { r, f, m } = calcRfmScore(c, gmvField); return { ...c, r, f, m, segKey: classifyRfm(r, f, m) }; });
  const counts: Record<string, number> = {};
  RFM_SEGMENTS.forEach(s => { counts[s.key] = 0; });
  classified.forEach(c => { counts[c.segKey] = (counts[c.segKey] || 0) + 1; });
  const getSeg = (key: string) => RFM_SEGMENTS.find(s => s.key === key)!;
  const pct = (key: string) => total > 0 ? ((counts[key] || 0) / total * 100).toFixed(2) : '0.00';

  const Cell = ({ segKey, extraClass = '' }: { segKey: string; extraClass?: string }) => {
    const seg = getSeg(segKey);
    const count = counts[segKey] || 0;
    return (
      <div className={`relative group rounded-xl p-3 flex flex-col justify-between overflow-visible ${extraClass}`} style={{ backgroundColor: seg.bg, color: seg.text, minHeight: 80 }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5"><i className={`${seg.icon} text-sm opacity-90`}></i><span className="text-xs font-semibold leading-tight">{seg.label}</span></div>
          <button className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 flex-shrink-0 cursor-default"><i className="ri-information-line text-[10px]"></i></button>
          <SegmentTooltip seg={seg} />
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-1 text-sm font-bold"><i className="ri-group-line text-xs opacity-80"></i><span>{count}</span></div>
          <p className="text-[11px] opacity-75">({pct(segKey)}%)</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2" style={{ gridTemplateRows: 'auto' }}>
        <div className="flex flex-col gap-2">
          <Cell segKey="nao_pode_perder" /><Cell segKey="em_risco" />
          <div className="grid grid-cols-2 gap-2"><Cell segKey="perdidos" /><Cell segKey="hibernando" /></div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative group rounded-xl p-3 flex flex-col justify-between" style={{ backgroundColor: getSeg('clientes_fieis').bg, color: '#fff', flex: '1.5' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5"><i className="ri-heart-line text-sm opacity-90"></i><span className="text-xs font-semibold">Creators Fiéis</span></div>
              <button className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 cursor-default"><i className="ri-information-line text-[10px]"></i></button>
              <SegmentTooltip seg={getSeg('clientes_fieis')} />
            </div>
            <div className="mt-3"><div className="flex items-center gap-1 text-lg font-bold"><i className="ri-group-line text-sm opacity-80"></i><span>{counts['clientes_fieis'] || 0}</span></div><p className="text-xs opacity-75">({pct('clientes_fieis')}%)</p></div>
          </div>
          <Cell segKey="precisam_atencao" /><Cell segKey="dormentes" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative group rounded-xl p-3 flex flex-col justify-between" style={{ backgroundColor: getSeg('campeoes').bg, color: '#fff', flex: '1.2' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5"><i className="ri-trophy-line text-sm opacity-90"></i><span className="text-xs font-semibold">Embaixadores Elite</span></div>
              <button className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 cursor-default"><i className="ri-information-line text-[10px]"></i></button>
              <SegmentTooltip seg={getSeg('campeoes')} />
            </div>
            <div className="mt-3"><div className="flex items-center gap-1 text-lg font-bold"><i className="ri-group-line text-sm opacity-80"></i><span>{counts['campeoes'] || 0}</span></div><p className="text-xs opacity-75">({pct('campeoes')}%)</p></div>
          </div>
          <Cell segKey="fiel_potencial" />
          <div className="grid grid-cols-2 gap-2"><Cell segKey="promessas" /><Cell segKey="novos" /></div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Distribuição de Creators por Segmento</h4>
          <span className="text-xs text-gray-400">{total} creators</span>
        </div>
        <div className="w-full h-4 rounded-full overflow-hidden flex mb-3">
          {RFM_SEGMENTS.map(seg => { const w = total > 0 ? (counts[seg.key] || 0) / total * 100 : 0; if (w === 0) return null; return <div key={seg.key} className="h-full transition-all" style={{ width: `${w}%`, backgroundColor: seg.bg }} title={`${seg.label}: ${counts[seg.key] || 0}`}></div>; })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {RFM_SEGMENTS.map(seg => { const count = counts[seg.key] || 0; if (count === 0) return null; return (<div key={seg.key} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.bg }}></span><span className="text-[11px] text-gray-600">{seg.label}</span><span className="text-[11px] font-semibold text-gray-400">{count}</span></div>); })}
        </div>
        <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1"><i className="ri-information-line text-xs"></i>R = Recência de atividade · F = Frequência de conteúdo (vídeos 30d) · M = GMV gerado no período</p>
      </div>
    </div>
  );
}

// ─── Modal Criar/Editar Dashboard (original) ─────────────────────
function DashboardModal({ dashboard, onClose, onSave }: { dashboard: Dashboard | null; onClose: () => void; onSave: (data: Partial<Dashboard>) => Promise<void>; }) {
  const [name, setName] = useState(dashboard?.name || '');
  const [description, setDescription] = useState(dashboard?.description || '');
  const [icon, setIcon] = useState(dashboard?.icon || DASHBOARD_ICONS[0]);
  const [color, setColor] = useState(dashboard?.color || DASHBOARD_COLORS[0].value);
  const [widgets, setWidgets] = useState<Widget[]>(dashboard?.widgets || []);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'widgets'>('info');

  const addWidget = (type: string) => {
    const cat = WIDGET_CATALOG.find(w => w.type === type)!;
    setWidgets(prev => [...prev, { id: `w${Date.now()}`, type, title: cat.label, size: type === 'metric_cards' || type === 'monthly_evolution' || type === 'distribution_charts' ? 'full' : 'half', config: {} }]);
  };
  const removeWidget = (id: string) => setWidgets(prev => prev.filter(w => w.id !== id));
  const moveWidget = (id: string, dir: 'up' | 'down') => {
    const idx = widgets.findIndex(w => w.id === id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === widgets.length - 1)) return;
    const next = [...widgets]; const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]]; setWidgets(next);
  };
  const toggleSize = (id: string) => setWidgets(prev => prev.map(w => w.id === id ? { ...w, size: w.size === 'full' ? 'half' : 'full' } : w));
  const handleSave = async () => { if (!name.trim()) return; setSaving(true); await onSave({ name: name.trim(), description: description.trim(), icon, color, widgets }); setSaving(false); };
  const addedTypes = widgets.map(w => w.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}><i className={`${icon} text-xl`} style={{ color }}></i></div>
            <div><h3 className="text-base font-semibold text-gray-900">{dashboard ? 'Editar Dashboard' : 'Novo Dashboard'}</h3><p className="text-xs text-gray-400">Personalize o painel de métricas</p></div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"><i className="ri-close-line text-lg"></i></button>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 m-4 mb-0 rounded-xl p-1">
          {[{ id: 'info', label: 'Informações', icon: 'ri-edit-line' }, { id: 'widgets', label: 'Widgets', icon: 'ri-layout-grid-line' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer ${activeTab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${t.icon} text-sm`}></i>{t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'info' && (
            <>
              <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Nome do dashboard *</label><input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder="Ex: Análise de Vendas" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} maxLength={100} placeholder="Breve descrição do dashboard" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-2">Cor</label><div className="flex items-center gap-2 flex-wrap">{DASHBOARD_COLORS.map(c => (<button key={c.value} onClick={() => setColor(c.value)} title={c.label} className={`w-8 h-8 rounded-lg cursor-pointer transition-all hover:scale-110 ${color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} style={{ backgroundColor: c.value }}></button>))}</div></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-2">Ícone</label><div className="flex items-center gap-2 flex-wrap">{DASHBOARD_ICONS.map(ic => (<button key={ic} onClick={() => setIcon(ic)} className={`w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all ${icon === ic ? 'ring-2 ring-offset-1' : 'bg-gray-100 hover:bg-gray-200'}`} style={icon === ic ? { backgroundColor: `${color}20`, color, outlineColor: color } : {}}><i className={`${ic} text-base`}></i></button>))}</div></div>
            </>
          )}
          {activeTab === 'widgets' && (
            <div className="space-y-4">
              {widgets.length > 0 && (
                <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Widgets ativos ({widgets.length})</p>
                  <div className="space-y-2">
                    {widgets.map((w, idx) => {
                      const cat = WIDGET_CATALOG.find(c => c.type === w.type);
                      return (<div key={w.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm"><i className={`${cat?.icon || 'ri-question-line'} text-sm text-gray-500`}></i></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{w.title}</p><button onClick={() => toggleSize(w.id)} className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 cursor-pointer transition-all ${w.size === 'full' ? 'bg-[#004aad]/10 text-[#004aad]' : 'bg-gray-200 text-gray-500'}`}>{w.size === 'full' ? 'Largura total' : 'Meia largura'}</button></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveWidget(w.id, 'up')} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 cursor-pointer rounded"><i className="ri-arrow-up-s-line text-sm"></i></button>
                          <button onClick={() => moveWidget(w.id, 'down')} disabled={idx === widgets.length - 1} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 cursor-pointer rounded"><i className="ri-arrow-down-s-line text-sm"></i></button>
                          <button onClick={() => removeWidget(w.id)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 cursor-pointer rounded transition-colors"><i className="ri-close-line text-sm"></i></button>
                        </div>
                      </div>);
                    })}
                  </div>
                </div>
              )}
              <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adicionar widgets</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WIDGET_CATALOG.map(cat => {
                    const alreadyAdded = addedTypes.includes(cat.type);
                    return (<button key={cat.type} onClick={() => addWidget(cat.type)} className={`flex items-center gap-3 p-3 text-left rounded-xl border-2 transition-all cursor-pointer ${alreadyAdded ? 'border-[#5de0e6]/40 bg-[#5de0e6]/5 opacity-70' : 'border-gray-100 hover:border-[#5de0e6]/50 hover:bg-[#5de0e6]/5'}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${alreadyAdded ? 'bg-[#5de0e6]/20' : 'bg-gray-100'}`}><i className={`${cat.icon} text-base ${alreadyAdded ? 'text-[#004aad]' : 'text-gray-500'}`}></i></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800">{cat.label}</p><p className="text-[11px] text-gray-400 truncate">{cat.desc}</p></div>
                      {alreadyAdded ? <i className="ri-check-double-line text-[#004aad] text-sm flex-shrink-0"></i> : <i className="ri-add-line text-gray-400 text-sm flex-shrink-0"></i>}
                    </button>);
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50" style={{ backgroundColor: color }}>
            {saving ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin"></i>Salvando...</span> : <span className="flex items-center justify-center gap-2"><i className="ri-save-line"></i>{dashboard ? 'Salvar Alterações' : 'Criar Dashboard'}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────
export default function MetricasPage() {
  const { user, profile, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();
  const isAdmin       = profile?.role === 'admin';
  const canEditMeta   = isAdmin || hasPermission('metrics', 'edit'); // admin + gerente com permissão

  // ── Estado original ────────────────────────────────────────────
  const [clients, setClients]           = useState<Client[]>([]);
  const [interactions, setInteractions] = useState<(Interaction & { client?: Client })[]>([]);
  const [dashboards, setDashboards]     = useState<Dashboard[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [gmvPeriod, setGmvPeriod]       = useState<GmvPeriod>('30d');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal]   = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [deleteConfirm, setDeleteConfirm]       = useState<string | null>(null);
  const [deleting, setDeleting]                 = useState(false);

  // ── Nova aba Metas & Ranking ───────────────────────────────────
  const [mainTab, setMainTab] = useState<'dashboards' | 'metas'>('dashboards');

  // ── Estado de metas ────────────────────────────────────────────
  const {
    goals, loading: goalsLoading,
    loadGoals, buildProgress, buildRanking,
    createGoal, updateGoal, deleteGoal, toggleGoal,
  } = useGoals();

  const [progresses, setProgresses]         = useState<GoalProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [rankingEntries, setRankingEntries] = useState<RankingEntry[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingPeriodIdx, setRankingPeriodIdx] = useState(0);
  const [goalTab, setGoalTab]               = useState<'painel' | 'gestao' | 'ranking'>('painel');
  const [userGoalTab, setUserGoalTab]       = useState<'metas' | 'ranking' | 'desempenho'>('metas');
  const [showGoalModal, setShowGoalModal]   = useState(false);
  const [editingGoal, setEditingGoal]       = useState<Goal | null>(null);
  const [deleteGoalConfirm, setDeleteGoalConfirm] = useState<Goal | null>(null);
  const [filterGoalCat, setFilterGoalCat]   = useState('all');
  const [filterGoalStatus, setFilterGoalStatus] = useState('active');
  const [myStats, setMyStats]               = useState({ creators: 0, gmv: 0, amostras: 0, interacoes: 0 });

  // ── Carregar dados (filtrados por usuário se não for admin/gerente com metrics.edit) ────
  const loadData = useCallback(async () => {
    try {
      const uid      = profile?.id;
      const seeAll   = isAdmin || hasPermission('metrics', 'edit'); // admin e gerentes veem tudo

      // Clients
      let clientsQuery = supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (!seeAll && uid) clientsQuery = clientsQuery.eq('created_by', uid);

      // Para não-admin/gerente: também pega clients dos deals atribuídos
      let extraClientIds: string[] = [];
      if (!seeAll && uid) {
        const { data: myDeals } = await supabase.from('deals').select('client_id').eq('assigned_to', uid);
        extraClientIds = (myDeals || []).map((d: any) => d.client_id).filter(Boolean);
      }

      // Interações
      let interactionsQuery = supabase.from('interactions').select('*, clients(*)').order('date', { ascending: false });
      if (!seeAll && uid) interactionsQuery = interactionsQuery.eq('created_by', uid);

      const [clientsRes, interactionsRes, dashboardsRes] = await Promise.all([
        clientsQuery,
        interactionsQuery,
        supabase.from('metric_dashboards').select('*').order('sort_order', { ascending: true }),
      ]);

      if (clientsRes.data) {
        // Mesclar com clients dos deals atribuídos (sem duplicatas)
        if (!seeAll && extraClientIds.length > 0) {
          const existing = new Set(clientsRes.data.map((c: any) => c.id));
          const missing  = extraClientIds.filter(id => !existing.has(id));
          if (missing.length > 0) {
            const { data: extra } = await supabase.from('clients').select('*').in('id', missing);
            setClients([...clientsRes.data, ...(extra || [])]);
          } else {
            setClients(clientsRes.data);
          }
        } else {
          setClients(clientsRes.data);
        }
      }

      if (interactionsRes.data) setInteractions(interactionsRes.data.map((i: any) => ({ ...i, client: i.clients })));
      if (dashboardsRes.data && dashboardsRes.data.length > 0) {
        setDashboards(dashboardsRes.data);
        setSelectedDashboardId(prev => prev || dashboardsRes.data.find((d: Dashboard) => d.is_default)?.id || dashboardsRes.data[0].id);
      }
    } catch (error) { console.error('Erro ao carregar dados:', error); }
    finally { setLoading(false); }
  }, [profile, isAdmin, hasPermission]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Carregar metas ─────────────────────────────────────────────
  useEffect(() => {
    if (mainTab === 'metas') loadGoals(false);
  }, [mainTab, loadGoals]);

  // ── Calcular progressos ────────────────────────────────────────
  const calcAllProgresses = useCallback(async () => {
    setLoadingProgress(true);
    const active = goals.filter(g => g.is_active);
    const results = await Promise.all(active.map(g => buildProgress(g, profile?.id)));
    setProgresses(results);
    setLoadingProgress(false);
  }, [goals, buildProgress, profile]);

  useEffect(() => {
    if (goals.length > 0) calcAllProgresses();
  }, [goals, calcAllProgresses]);

  // ── Carregar ranking ───────────────────────────────────────────
  const loadRanking = useCallback(async () => {
    setLoadingRanking(true);
    const { s, e } = RANKING_PERIODS[rankingPeriodIdx].getDates();
    const entries = await buildRanking(s, e);
    setRankingEntries(entries);
    setLoadingRanking(false);
  }, [buildRanking, rankingPeriodIdx]);

  useEffect(() => {
    const needsRanking = mainTab === 'metas' && (
      (canEditMeta && goalTab === 'ranking') || (!canEditMeta && userGoalTab === 'ranking')
    );
    if (needsRanking) loadRanking();
  }, [mainTab, goalTab, userGoalTab, canEditMeta, loadRanking]);

  // ── Meu Desempenho ─────────────────────────────────────────────
  const loadMyStats = useCallback(async () => {
    if (!profile) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [{ count: creators }, { count: amostras }, { count: interacoesCount }, { data: deals }] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', profile.id).gte('created_at', start),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', profile.id).eq('amostra_enviada', true),
      supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('created_by', profile.id).gte('created_at', start),
      supabase.from('deals').select('client_id').eq('assigned_to', profile.id),
    ]);
    let gmv = 0;
    const clientIds = (deals || []).map((d: any) => d.client_id).filter(Boolean);
    if (clientIds.length > 0) {
      const { data: gmvClients } = await supabase.from('clients').select('gmv_geral').in('id', clientIds);
      gmv = (gmvClients || []).reduce((s: number, c: any) => s + (Number(c.gmv_geral) || 0), 0);
    }
    setMyStats({ creators: creators || 0, gmv, amostras: amostras || 0, interacoes: interacoesCount || 0 });
  }, [profile]);

  useEffect(() => {
    if (mainTab === 'metas' && !canEditMeta && userGoalTab === 'desempenho') loadMyStats();
  }, [mainTab, userGoalTab, canEditMeta, loadMyStats]);

  // ── Handlers CRUD metas ────────────────────────────────────────
  const handleCreateGoal  = async (data: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => { await createGoal(data); };
  const handleUpdateGoal  = async (data: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => { if (!editingGoal) return; await updateGoal(editingGoal.id, data); setEditingGoal(null); };
  const handleDeleteGoal  = async (goal: Goal) => { await deleteGoal(goal.id); setDeleteGoalConfirm(null); };
  const handleToggleGoal  = async (goal: Goal) => { await toggleGoal(goal.id, !goal.is_active); };

  // ── Handlers CRUD dashboards (originais) ──────────────────────
  const selectedDashboard = dashboards.find(d => d.id === selectedDashboardId);

  const handleCreateDashboard = async (data: Partial<Dashboard>) => {
    const { error } = await supabase.from('metric_dashboards').insert({ ...data, created_by: user?.id || null, sort_order: dashboards.length, is_default: false });
    if (!error) { await logActivity({ action: 'create', module: 'metrics', entityName: String(data.name || 'Dashboard'), details: { name: data.name } }); await loadData(); setShowCreateModal(false); }
  };
  const handleUpdateDashboard = async (data: Partial<Dashboard>) => {
    if (!editingDashboard) return;
    const { error } = await supabase.from('metric_dashboards').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingDashboard.id);
    if (!error) { await logActivity({ action: 'update', module: 'metrics', entityId: editingDashboard.id, entityName: String(data.name || editingDashboard.name), details: { fields: Object.keys(data) } }); await loadData(); setEditingDashboard(null); }
  };
  const handleDeleteDashboard = async (id: string) => {
    setDeleting(true);
    const deletingDash = dashboards.find(d => d.id === id);
    await supabase.from('metric_dashboards').delete().eq('id', id);
    if (deletingDash) await logActivity({ action: 'delete', module: 'metrics', entityId: id, entityName: String(deletingDash.name) });
    const remaining = dashboards.filter(d => d.id !== id);
    if (selectedDashboardId === id && remaining.length > 0) setSelectedDashboardId(remaining[0].id);
    await loadData(); setDeleteConfirm(null); setDeleting(false);
  };
  const handleSetDefault = async (id: string) => {
    await supabase.from('metric_dashboards').update({ is_default: false }).neq('id', id);
    await supabase.from('metric_dashboards').update({ is_default: true }).eq('id', id);
    await loadData();
  };

  // ── Metas filtradas ────────────────────────────────────────────
  const filteredGoals = goals.filter(g => {
    const matchCat    = filterGoalCat    === 'all' || g.category === filterGoalCat;
    const matchStatus = filterGoalStatus === 'all' || (filterGoalStatus === 'active' ? g.is_active : !g.is_active);
    return matchCat && matchStatus;
  });
  const myProgresses = progresses.filter(p => p.goal.scope === 'global' || (p.goal.scope === 'individual' && p.goal.assigned_to === profile?.id));
  const avgPercent   = progresses.length ? Math.round(progresses.reduce((s, p) => s + p.percent, 0) / progresses.length) : 0;
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const tabBtn = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* ── TOGGLE PRINCIPAL: Dashboards | Metas & Ranking ── */}
        <div className="flex items-center bg-white border border-gray-100 rounded-2xl p-1 w-fit shadow-sm">
          <button onClick={() => setMainTab('dashboards')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${mainTab === 'dashboards' ? 'bg-[#004aad] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className="ri-dashboard-line text-base"></i>
            <span className="hidden sm:inline">Dashboards</span>
          </button>
          <button onClick={() => setMainTab('metas')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${mainTab === 'metas' ? 'bg-[#004aad] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className="ri-target-line text-base"></i>
            <span className="hidden sm:inline">Metas & Ranking</span>
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════
            ABA DASHBOARDS — conteúdo 100% original
        ════════════════════════════════════════════════════════ */}
        {mainTab === 'dashboards' && (
          <>
            {/* Header original */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2.5 pl-4 pr-3 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all cursor-pointer"
                    style={{ backgroundColor: selectedDashboard?.color || '#004aad' }}>
                    {selectedDashboard && <i className={`${selectedDashboard.icon} text-base`}></i>}
                    <span className="max-w-[160px] truncate">{selectedDashboard?.name || 'Selecione'}</span>
                    <i className={`ri-arrow-down-s-line text-base transition-transform ${showDropdown ? 'rotate-180' : ''}`}></i>
                  </button>
                  {showDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>
                      <div className="absolute left-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20 w-72 animate-[fadeIn_0.15s_ease-out]">
                        <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dashboards</p>
                        {dashboards.map(d => (
                          <div key={d.id} className={`flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors group ${selectedDashboardId === d.id ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                            onClick={() => { setSelectedDashboardId(d.id); setShowDropdown(false); }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${d.color}20` }}><i className={`${d.icon} text-sm`} style={{ color: d.color }}></i></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5"><p className={`text-sm font-medium truncate ${selectedDashboardId === d.id ? 'text-gray-900' : 'text-gray-700'}`}>{d.name}</p>{d.is_default && (<span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">padrão</span>)}</div>
                              {d.description && <p className="text-[11px] text-gray-400 truncate">{d.description}</p>}
                            </div>
                            {selectedDashboardId === d.id && <i className="ri-check-line text-[#004aad] flex-shrink-0"></i>}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setEditingDashboard(d); setShowDropdown(false); }} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#004aad] rounded cursor-pointer"><i className="ri-edit-line text-xs"></i></button>
                              {!d.is_default && <button onClick={() => handleSetDefault(d.id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-amber-500 rounded cursor-pointer" title="Definir como padrão"><i className="ri-star-line text-xs"></i></button>}
                              {dashboards.length > 1 && <button onClick={() => { setDeleteConfirm(d.id); setShowDropdown(false); }} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-rose-500 rounded cursor-pointer"><i className="ri-delete-bin-line text-xs"></i></button>}
                            </div>
                          </div>
                        ))}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button onClick={() => { setShowCreateModal(true); setShowDropdown(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#004aad] hover:bg-[#5de0e6]/5 cursor-pointer transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-[#5de0e6]/10 flex items-center justify-center"><i className="ri-add-line text-sm text-[#004aad]"></i></div>
                            <span className="font-medium">Novo dashboard</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#004aad] hover:bg-[#5de0e6]/10 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                  <i className="ri-dashboard-line text-base"></i>novo dashboard
                </button>
                {selectedDashboard && (
                  <button onClick={() => setEditingDashboard(selectedDashboard)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer" title="Editar dashboard">
                    <i className="ri-settings-3-line text-base"></i>
                  </button>
                )}
              </div>
              <div className="flex items-center bg-gray-100 rounded-full p-1 gap-0.5">
                {periodOptions.map(opt => (
                  <button key={opt.value} onClick={() => setGmvPeriod(opt.value)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${gmvPeriod === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedDashboard?.description && <p className="text-sm text-gray-400 -mt-2">{selectedDashboard.description}</p>}

            {selectedDashboard && selectedDashboard.widgets.length > 0 ? (
              <div className="space-y-5">
                {(() => {
                  const rows: Widget[][] = [];
                  let currentRow: Widget[] = [];
                  selectedDashboard.widgets.forEach(w => {
                    if (w.size === 'full') { if (currentRow.length > 0) { rows.push([...currentRow]); currentRow = []; } rows.push([w]); }
                    else { currentRow.push(w); if (currentRow.length === 2) { rows.push([...currentRow]); currentRow = []; } }
                  });
                  if (currentRow.length > 0) rows.push([...currentRow]);
                  return rows.map((row, ri) => (
                    <div key={ri} className={`grid gap-5 ${row.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {row.map(widget => (<WidgetRenderer key={widget.id} widget={widget} clients={clients} interactions={interactions} gmvPeriod={gmvPeriod} />))}
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${selectedDashboard?.color || '#004aad'}15` }}>
                  <i className={`${selectedDashboard?.icon || 'ri-dashboard-line'} text-3xl`} style={{ color: selectedDashboard?.color || '#004aad' }}></i>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Dashboard vazio</p>
                <p className="text-xs text-gray-400 mb-4">Adicione widgets para visualizar seus dados</p>
                <button onClick={() => setEditingDashboard(selectedDashboard!)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer" style={{ backgroundColor: selectedDashboard?.color || '#004aad' }}>
                  <i className="ri-add-line"></i>Adicionar widgets
                </button>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            ABA METAS & RANKING
        ════════════════════════════════════════════════════════ */}
        {mainTab === 'metas' && (
          <>
            {/* ── VISÃO ADMIN / GERENTE COM PERMISSÃO ── */}
            {canEditMeta && (
              <>
                {/* Stats de metas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center"><i className="ri-target-line text-lg text-[#004aad]"></i></div>
                    <div><p className="text-xl font-bold text-gray-900">{goals.filter(g => g.is_active).length}</p><p className="text-xs text-gray-400">Metas ativas</p></div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><i className="ri-checkbox-circle-line text-lg text-emerald-600"></i></div>
                    <div><p className="text-xl font-bold text-gray-900">{progresses.filter(p => p.achieved).length}</p><p className="text-xs text-gray-400">Atingidas</p></div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><i className="ri-percent-line text-lg text-amber-600"></i></div>
                    <div><p className="text-xl font-bold text-gray-900">{avgPercent}%</p><p className="text-xs text-gray-400">Média geral</p></div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center"><i className="ri-group-line text-lg text-violet-600"></i></div>
                    <div><p className="text-xl font-bold text-gray-900">{rankingEntries.length}</p><p className="text-xs text-gray-400">No ranking</p></div>
                  </div>
                </div>

                {/* Tabs admin metas */}
                <div className="bg-white rounded-xl border border-gray-100 p-1 flex items-center">
                  {[{ id: 'painel', label: 'Painel', icon: 'ri-dashboard-line' }, { id: 'gestao', label: 'Gestão de Metas', icon: 'ri-settings-4-line' }, { id: 'ranking', label: 'Ranking', icon: 'ri-trophy-line' }].map(t => (
                    <button key={t.id} onClick={() => setGoalTab(t.id as any)} className={tabBtn(goalTab === t.id)}>
                      <i className={`${t.icon} text-sm`}></i><span className="hidden sm:inline">{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Painel */}
                {goalTab === 'painel' && (
                  loadingProgress
                    ? <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div></div>
                    : progresses.length === 0
                    ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4"><i className="ri-target-line text-3xl text-gray-300"></i></div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Nenhuma meta ativa</p>
                        <p className="text-xs text-gray-400 mb-5">Crie metas em "Gestão de Metas"</p>
                        <button onClick={() => setGoalTab('gestao')} className="flex items-center gap-2 px-4 py-2 bg-[#004aad] text-white text-sm font-medium rounded-xl cursor-pointer">
                          <i className="ri-add-line"></i>Criar Primeira Meta
                        </button>
                      </div>
                    )
                    : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{progresses.map(p => (<GoalCard key={p.goal.id} progress={p} isAdmin onEdit={() => { setEditingGoal(p.goal); setShowGoalModal(true); }} onDelete={() => setDeleteGoalConfirm(p.goal)} onToggle={() => handleToggleGoal(p.goal)} />))}</div>
                )}

                {/* Gestão */}
                {goalTab === 'gestao' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                            {['all','active','inactive'].map(s => (<button key={s} onClick={() => setFilterGoalStatus(s)} className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${filterGoalStatus === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Pausadas'}</button>))}
                          </div>
                          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                            <button onClick={() => setFilterGoalCat('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all ${filterGoalCat === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Todas</button>
                            {Object.entries(GOAL_CATEGORY_LABELS).map(([k, v]) => (<button key={k} onClick={() => setFilterGoalCat(k)} className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${filterGoalCat === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{v}</button>))}
                          </div>
                        </div>
                        <button onClick={() => { setEditingGoal(null); setShowGoalModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#004aad] text-white text-sm font-medium rounded-xl cursor-pointer whitespace-nowrap">
                          <i className="ri-add-line"></i>Nova Meta
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full">
                        <thead><tr className="border-b border-gray-100">
                          <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Meta</th>
                          <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                          <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Período</th>
                          <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Alvo</th>
                          <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Progresso</th>
                          <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                        </tr></thead>
                        <tbody>
                          {filteredGoals.length === 0
                            ? <tr><td colSpan={7} className="px-5 py-16 text-center"><p className="text-sm text-gray-400">Nenhuma meta encontrada</p></td></tr>
                            : filteredGoals.map(g => {
                              const p = progresses.find(pr => pr.goal.id === g.id);
                              const pct = p?.percent ?? 0;
                              return (
                                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                                  <td className="px-5 py-3.5"><div><p className="text-sm font-medium text-gray-900">{g.title}</p><p className="text-xs text-gray-400">{GOAL_CATEGORY_LABELS[g.category]}{g.assigned_name ? ` → ${g.assigned_name}` : ' (Global)'}</p></div></td>
                                  <td className="px-5 py-3.5 text-xs text-gray-600">{GOAL_TYPE_LABELS[g.type]}</td>
                                  <td className="px-5 py-3.5 text-xs text-gray-600">{PERIOD_LABELS[g.period_type]}</td>
                                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-800">{g.target_value.toLocaleString('pt-BR')}</td>
                                  <td className="px-5 py-3.5"><div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-[#004aad]'}`} style={{ width: `${pct}%` }} /></div><span className="text-xs font-medium text-gray-700">{pct}%</span></div></td>
                                  <td className="px-5 py-3.5">{g.is_active ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Ativa</span> : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400"><span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>Pausada</span>}</td>
                                  <td className="px-5 py-3.5"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleToggleGoal(g)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"><i className={`${g.is_active ? 'ri-pause-line' : 'ri-play-line'} text-sm`}></i></button>
                                    <button onClick={() => { setEditingGoal(g); setShowGoalModal(true); }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg cursor-pointer"><i className="ri-edit-line text-sm"></i></button>
                                    <button onClick={() => setDeleteGoalConfirm(g)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"><i className="ri-delete-bin-line text-sm"></i></button>
                                  </div></td>
                                </tr>
                              );
                            })
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ranking admin */}
                {goalTab === 'ranking' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {RANKING_PERIODS.map((p, i) => (<button key={i} onClick={() => setRankingPeriodIdx(i)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-all ${rankingPeriodIdx === i ? 'border-[#004aad] bg-[#004aad]/5 text-[#004aad]' : 'border-gray-200 text-gray-500'}`}>{p.label}</button>))}
                    </div>
                    <RankingTable entries={rankingEntries} currentUserId={profile?.id} loading={loadingRanking} />
                  </div>
                )}
              </>
            )}

            {/* ── VISÃO USUÁRIO ── */}
            {!canEditMeta && (
              <>
                <div className="bg-white rounded-xl border border-gray-100 p-1 flex items-center">
                  {[{ id: 'metas', label: 'Minhas Metas', icon: 'ri-target-line' }, { id: 'ranking', label: 'Ranking', icon: 'ri-trophy-line' }, { id: 'desempenho', label: 'Meu Desempenho', icon: 'ri-bar-chart-line' }].map(t => (
                    <button key={t.id} onClick={() => setUserGoalTab(t.id as any)} className={tabBtn(userGoalTab === t.id)}>
                      <i className={`${t.icon} text-sm`}></i><span className="hidden sm:inline">{t.label}</span>
                    </button>
                  ))}
                </div>

                {userGoalTab === 'metas' && (
                  loadingProgress
                    ? <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div></div>
                    : myProgresses.length === 0
                    ? <div className="flex flex-col items-center justify-center py-20 text-center"><div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4"><i className="ri-target-line text-3xl text-gray-300"></i></div><p className="text-sm font-medium text-gray-500">Nenhuma meta atribuída</p><p className="text-xs text-gray-400 mt-1">Aguarde o administrador criar metas</p></div>
                    : (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-gray-900">{myProgresses.length}</p><p className="text-xs text-gray-400 mt-0.5">Metas ativas</p></div>
                          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{myProgresses.filter(p => p.achieved).length}</p><p className="text-xs text-gray-400 mt-0.5">Atingidas</p></div>
                          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-[#004aad]">{myProgresses.length ? Math.round(myProgresses.reduce((s, p) => s + p.percent, 0) / myProgresses.length) : 0}%</p><p className="text-xs text-gray-400 mt-0.5">Média</p></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{myProgresses.map(p => (<GoalCard key={p.goal.id} progress={p} isAdmin={false} />))}</div>
                      </>
                    )
                )}

                {userGoalTab === 'ranking' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {RANKING_PERIODS.map((p, i) => (<button key={i} onClick={() => setRankingPeriodIdx(i)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-all ${rankingPeriodIdx === i ? 'border-[#004aad] bg-[#004aad]/5 text-[#004aad]' : 'border-gray-200 text-gray-500'}`}>{p.label}</button>))}
                    </div>
                    <RankingTable entries={rankingEntries} currentUserId={profile?.id} loading={loadingRanking} />
                  </div>
                )}

                {userGoalTab === 'desempenho' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400 flex items-center gap-1.5"><i className="ri-calendar-line text-sm"></i>Dados do mês atual</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl border border-gray-100 p-5 text-center"><div className="w-10 h-10 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center mx-auto mb-3"><i className="ri-user-star-line text-lg text-[#004aad]"></i></div><p className="text-2xl font-bold text-gray-900">{myStats.creators}</p><p className="text-xs text-gray-400 mt-0.5">Creators cadastrados</p></div>
                      <div className="bg-white rounded-xl border border-gray-100 p-5 text-center"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3"><i className="ri-money-dollar-circle-line text-lg text-emerald-600"></i></div><p className="text-xl font-bold text-gray-900">{fmt(myStats.gmv)}</p><p className="text-xs text-gray-400 mt-0.5">GMV Total</p></div>
                      <div className="bg-white rounded-xl border border-gray-100 p-5 text-center"><div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-3"><i className="ri-gift-line text-lg text-amber-600"></i></div><p className="text-2xl font-bold text-gray-900">{myStats.amostras}</p><p className="text-xs text-gray-400 mt-0.5">Amostras enviadas</p></div>
                      <div className="bg-white rounded-xl border border-gray-100 p-5 text-center"><div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3"><i className="ri-chat-3-line text-lg text-violet-600"></i></div><p className="text-2xl font-bold text-gray-900">{myStats.interacoes}</p><p className="text-xs text-gray-400 mt-0.5">Interações</p></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modais dashboards (originais) ── */}
      {(showCreateModal || editingDashboard) && (
        <DashboardModal dashboard={editingDashboard} onClose={() => { setShowCreateModal(false); setEditingDashboard(null); }} onSave={editingDashboard ? handleUpdateDashboard : handleCreateDashboard} />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4"><i className="ri-delete-bin-line text-2xl text-rose-500"></i></div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Excluir Dashboard</h3>
            <p className="text-sm text-gray-500 text-center mb-5">"{dashboards.find(d => d.id === deleteConfirm)?.name}" será excluído permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 cursor-pointer">Cancelar</button>
              <button onClick={() => handleDeleteDashboard(deleteConfirm)} disabled={deleting} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 cursor-pointer disabled:opacity-50">{deleting ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modais metas ── */}
      {showGoalModal && (
        <GoalFormModal goal={editingGoal} onClose={() => { setShowGoalModal(false); setEditingGoal(null); }} onSave={editingGoal ? handleUpdateGoal : handleCreateGoal} />
      )}
      {deleteGoalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteGoalConfirm(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4"><i className="ri-delete-bin-line text-2xl text-rose-500"></i></div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Excluir Meta</h3>
            <p className="text-sm text-gray-500 text-center mb-2">"{deleteGoalConfirm.title}"</p>
            <p className="text-sm text-gray-400 text-center mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteGoalConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">Cancelar</button>
              <button onClick={() => handleDeleteGoal(deleteGoalConfirm)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 cursor-pointer">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

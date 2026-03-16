import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import { supabase, Client, Interaction } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import MetricCards from './components/MetricCards';
import ActivityBars from './components/ActivityBars';
import DistributionCharts from './components/DistributionCharts';
import TopCreatorsAndInteractions from './components/TopCreatorsAndInteractions';
import MonthlyEvolution from './components/MonthlyEvolution';

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

// ─── Widget Renderer ────────────────────────────────────────────
function WidgetRenderer({
  widget,
  clients,
  interactions,
  gmvPeriod,
}: {
  widget: Widget;
  clients: Client[];
  interactions: (Interaction & { client?: Client })[];
  gmvPeriod: GmvPeriod;
}) {
  switch (widget.type) {
    case 'metric_cards':
      return <MetricCards clients={clients} gmvPeriod={gmvPeriod} />;
    case 'activity_bars':
      return <ActivityBars clients={clients} totalInteractions={interactions.length} />;
    case 'distribution_charts':
      return <DistributionCharts clients={clients} />;
    case 'top_creators':
      return (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Creators por GMV</h3>
          <TopCreatorsOnly clients={clients} gmvPeriod={gmvPeriod} />
        </div>
      );
    case 'recent_interactions':
      return (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Interações Recentes</h3>
          <RecentInteractionsOnly interactions={interactions} />
        </div>
      );
    case 'monthly_evolution':
      return <MonthlyEvolution clients={clients} gmvPeriod={gmvPeriod} />;
    case 'gmv_overview':
      return <GmvOverview clients={clients} gmvPeriod={gmvPeriod} />;
    case 'rfm_summary':
      return <RfmSummary clients={clients} gmvPeriod={gmvPeriod} />;
    default:
      return (
        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <i className="ri-question-line text-2xl text-gray-300 mb-2 block"></i>
          <p className="text-sm text-gray-400">Widget "{widget.type}" desconhecido</p>
        </div>
      );
  }
}

// ─── Sub-componentes de widget ───────────────────────────────────
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
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${i < 3 ? rankColors[i] : 'bg-gray-200 text-gray-500'}`}>
            {i + 1}
          </div>
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
  const periods: { label: string; field: string }[] = [
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
                <div
                  className={`h-full rounded-full transition-all duration-500 ${active ? 'bg-[#004aad]' : 'bg-[#5de0e6]'}`}
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-600 mb-1">Comissão Orgânica Média</p>
          <p className="text-2xl font-bold text-emerald-700">
            {clients.length > 0
              ? (clients.reduce((s, c) => s + Number(c.comissao_organica ?? 0), 0) / clients.length).toFixed(1)
              : '0'}%
          </p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <p className="text-xs text-amber-600 mb-1">Comissão Tráfego Média</p>
          <p className="text-2xl font-bold text-amber-700">
            {clients.length > 0
              ? (clients.reduce((s, c) => s + Number(c.comissao_trafego ?? 0), 0) / clients.length).toFixed(1)
              : '0'}%
          </p>
        </div>
      </div>
    </div>
  );
}

// Definição dos 11 segmentos RFM clássicos com lógica de score R×F×M
// ─── Segmentos RFM adaptados para o universo de Creators ────────
// R = Recência de atividade (engajamento recente com a plataforma)
// F = Frequência de conteúdo (vídeos/lives nos últimos 30 dias)
// M = Monetário / GMV gerado no período selecionado
const RFM_SEGMENTS = [
  {
    key: 'campeoes',
    label: 'Embaixadores Elite',
    icon: 'ri-trophy-line',
    desc: 'Creators ativos, com alta produção de conteúdo e excelente GMV. Seu ativo mais valioso — priorize atenção e benefícios exclusivos.',
    rMin: 4, rMax: 5, fMin: 4, fMax: 5, mMin: 4, mMax: 5,
    bg: '#10b981', text: '#fff',
    col: 2, row: 1,
  },
  {
    key: 'clientes_fieis',
    label: 'Creators Fiéis',
    icon: 'ri-heart-line',
    desc: 'Alta produção de conteúdo e bom GMV. Engajam consistentemente com a marca. Ótimos candidatos a contratos de longo prazo.',
    rMin: 2, rMax: 5, fMin: 3, fMax: 5, mMin: 3, mMax: 5,
    bg: '#6366f1', text: '#fff',
    col: 2, row: 1,
  },
  {
    key: 'fiel_potencial',
    label: 'Alto Potencial',
    icon: 'ri-thumb-up-line',
    desc: 'Creators recentes com frequência de conteúdo crescente. Invista em capacitação e acompanhamento para acelerar o GMV.',
    rMin: 3, rMax: 5, fMin: 1, fMax: 3, mMin: 1, mMax: 3,
    bg: '#06b6d4', text: '#fff',
    col: 1, row: 2,
  },
  {
    key: 'novos',
    label: 'Novos Creators',
    icon: 'ri-user-add-line',
    desc: 'Recém-cadastrados com primeiros conteúdos. Fase de onboarding — envie amostras, brief e acompanhe de perto.',
    rMin: 4, rMax: 5, fMin: 1, fMax: 1, mMin: 1, mMax: 1,
    bg: '#14b8a6', text: '#fff',
    col: 1, row: 2,
  },
  {
    key: 'promessas',
    label: 'Promessas',
    icon: 'ri-line-chart-line',
    desc: 'Ativos recentemente e com bom crescimento. Ainda não atingiram o pico — crie desafios e metas para destravar o potencial.',
    rMin: 3, rMax: 5, fMin: 1, fMax: 2, mMin: 1, mMax: 2,
    bg: '#0ea5e9', text: '#fff',
    col: 1, row: 2,
  },
  {
    key: 'precisam_atencao',
    label: 'Precisam de Atenção',
    icon: 'ri-error-warning-line',
    desc: 'Performance abaixo do esperado mas ainda ativos. Entenda as dificuldades: falta de brief? Produto errado? Incentivos insuficientes?',
    rMin: 2, rMax: 3, fMin: 2, fMax: 3, mMin: 2, mMax: 3,
    bg: '#8b5cf6', text: '#fff',
    col: 1, row: 2,
  },
  {
    key: 'dormentes',
    label: 'Quase Inativos',
    icon: 'ri-time-line',
    desc: 'Pouco conteúdo e GMV fraco nos últimos períodos. Reative com nova campanha, brindes ou contato direto antes que se percam.',
    rMin: 2, rMax: 3, fMin: 1, fMax: 2, mMin: 1, mMax: 2,
    bg: '#7c3aed', text: '#fff',
    col: 1, row: 3,
  },
  {
    key: 'em_risco',
    label: 'Em Risco de Saída',
    icon: 'ri-alert-line',
    desc: 'Já geraram bom GMV mas estão sumindo. Ação urgente: ligue, entenda o motivo e ofereça condições especiais de reativação.',
    rMin: 1, rMax: 2, fMin: 2, fMax: 5, mMin: 2, mMax: 5,
    bg: '#4f46e5', text: '#fff',
    col: 1, row: 3,
  },
  {
    key: 'nao_pode_perder',
    label: 'Não Pode Perder',
    icon: 'ri-shield-star-line',
    desc: 'Creators de alto valor histórico sem atividade recente. Resgate imediato — ofereça contratos exclusivos, produtos premium ou visibilidade.',
    rMin: 1, rMax: 1, fMin: 4, fMax: 5, mMin: 4, mMax: 5,
    bg: '#3730a3', text: '#fff',
    col: 1, row: 3,
  },
  {
    key: 'hibernando',
    label: 'Hibernando',
    icon: 'ri-moon-line',
    desc: 'Sem conteúdo e GMV muito baixo há bastante tempo. Avalie se vale investir numa reativação ou redirecionar recursos.',
    rMin: 1, rMax: 2, fMin: 1, fMax: 2, mMin: 1, mMax: 2,
    bg: '#4338ca', text: '#fff',
    col: 1, row: 3,
  },
  {
    key: 'perdidos',
    label: 'Desengajados',
    icon: 'ri-user-unfollow-line',
    desc: 'Sem atividade significativa em todos os indicadores. Considere arquivar o perfil ou fazer uma última tentativa de contato.',
    rMin: 1, rMax: 2, fMin: 1, fMax: 2, mMin: 1, mMax: 2,
    bg: '#312e81', text: '#fff',
    col: 1, row: 3,
  },
];

// ─── Score RFM adaptado para creators ───────────────────────────
// R — Recência: dias desde a última atualização do perfil/acompanhamento
// F — Frequência: vídeos publicados nos últimos 30 dias
// M — Monetário: GMV gerado no período selecionado
function calcRfmScore(client: Client, gmvField: string): { r: number; f: number; m: number } {
  const now = new Date();
  const daysSince = (now.getTime() - new Date(client.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const r = daysSince <= 7 ? 5 : daysSince <= 14 ? 4 : daysSince <= 30 ? 3 : daysSince <= 60 ? 2 : 1;
  // F = frequência de conteúdo (vídeos 30d)
  const videos = Number((client as any).videos_30d ?? 0);
  const f = videos >= 20 ? 5 : videos >= 12 ? 4 : videos >= 6 ? 3 : videos >= 2 ? 2 : 1;
  // M = GMV gerado no período
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

// Tooltip do segmento
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

  // Classificar cada creator
  const classified = clients.map(c => {
    const { r, f, m } = calcRfmScore(c, gmvField);
    return { ...c, r, f, m, segKey: classifyRfm(r, f, m) };
  });

  // Contar por segmento
  const counts: Record<string, number> = {};
  RFM_SEGMENTS.forEach(s => { counts[s.key] = 0; });
  classified.forEach(c => { counts[c.segKey] = (counts[c.segKey] || 0) + 1; });

  // Layout treemap — colunas definidas manualmente para reproduzir a imagem
  // Coluna esquerda: Não pode perder, Em risco, Perdidos, Hibernando
  // Coluna central: Creators Fiéis (grande), Precisam de Atenção, Quase Inativos
  // Coluna direita: Embaixadores Elite, Alto Potencial, Promessas, Novos Creators
  const leftCol  = ['nao_pode_perder', 'em_risco', 'perdidos', 'hibernando'];
  const midCol   = ['clientes_fieis', 'precisam_atencao', 'dormentes'];
  const rightCol = ['campeoes', 'fiel_potencial', 'promessas', 'novos'];

  const getSeg = (key: string) => RFM_SEGMENTS.find(s => s.key === key)!;
  const pct = (key: string) => total > 0 ? ((counts[key] || 0) / total * 100).toFixed(2) : '0.00';

  const Cell = ({ segKey, extraClass = '' }: { segKey: string; extraClass?: string }) => {
    const seg = getSeg(segKey);
    const count = counts[segKey] || 0;
    return (
      <div
        className={`relative group rounded-xl p-3 flex flex-col justify-between overflow-visible ${extraClass}`}
        style={{ backgroundColor: seg.bg, color: seg.text, minHeight: 80 }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <i className={`${seg.icon} text-sm opacity-90`}></i>
            <span className="text-xs font-semibold leading-tight">{seg.label}</span>
          </div>
          <button className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 flex-shrink-0 cursor-default">
            <i className="ri-information-line text-[10px]"></i>
          </button>
          <SegmentTooltip seg={seg} />
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-1 text-sm font-bold">
            <i className="ri-group-line text-xs opacity-80"></i>
            <span>{count}</span>
          </div>
          <p className="text-[11px] opacity-75">({pct(segKey)}%)</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Treemap grid */}
      <div className="grid grid-cols-3 gap-2" style={{ gridTemplateRows: 'auto' }}>
        {/* Coluna esquerda */}
        <div className="flex flex-col gap-2">
          <Cell segKey="nao_pode_perder" />
          <Cell segKey="em_risco" />
          <div className="grid grid-cols-2 gap-2">
            <Cell segKey="perdidos" />
            <Cell segKey="hibernando" />
          </div>
        </div>

        {/* Coluna central */}
        <div className="flex flex-col gap-2">
          {/* Creators Fiéis — célula grande */}
          <div
            className="relative group rounded-xl p-3 flex flex-col justify-between"
            style={{ backgroundColor: getSeg('clientes_fieis').bg, color: '#fff', flex: '1.5' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <i className="ri-heart-line text-sm opacity-90"></i>
                <span className="text-xs font-semibold">Creators Fiéis</span>
              </div>
              <button className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 cursor-default">
                <i className="ri-information-line text-[10px]"></i>
              </button>
              <SegmentTooltip seg={getSeg('clientes_fieis')} />
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-1 text-lg font-bold">
                <i className="ri-group-line text-sm opacity-80"></i>
                <span>{counts['clientes_fieis'] || 0}</span>
              </div>
              <p className="text-xs opacity-75">({pct('clientes_fieis')}%)</p>
            </div>
          </div>
          <Cell segKey="precisam_atencao" />
          <Cell segKey="dormentes" />
        </div>

        {/* Coluna direita */}
        <div className="flex flex-col gap-2">
          {/* Campeões — célula grande */}
          <div
            className="relative group rounded-xl p-3 flex flex-col justify-between"
            style={{ backgroundColor: getSeg('campeoes').bg, color: '#fff', flex: '1.2' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <i className="ri-trophy-line text-sm opacity-90"></i>
                <span className="text-xs font-semibold">Embaixadores Elite</span>
              </div>
              <button className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 cursor-default">
                <i className="ri-information-line text-[10px]"></i>
              </button>
              <SegmentTooltip seg={getSeg('campeoes')} />
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-1 text-lg font-bold">
                <i className="ri-group-line text-sm opacity-80"></i>
                <span>{counts['campeoes'] || 0}</span>
              </div>
              <p className="text-xs opacity-75">({pct('campeoes')}%)</p>
            </div>
          </div>
          <Cell segKey="fiel_potencial" />
          <div className="grid grid-cols-2 gap-2">
            <Cell segKey="promessas" />
            <Cell segKey="novos" />
          </div>
        </div>
      </div>

      {/* Legenda / barra de distribuição */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Distribuição de Creators por Segmento</h4>
          <span className="text-xs text-gray-400">{total} creators</span>
        </div>
        {/* Barra empilhada */}
        <div className="w-full h-4 rounded-full overflow-hidden flex mb-3">
          {RFM_SEGMENTS.map(seg => {
            const w = total > 0 ? (counts[seg.key] || 0) / total * 100 : 0;
            if (w === 0) return null;
            return (
              <div key={seg.key} className="h-full transition-all" style={{ width: `${w}%`, backgroundColor: seg.bg }} title={`${seg.label}: ${counts[seg.key] || 0}`}></div>
            );
          })}
        </div>
        {/* Legenda */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {RFM_SEGMENTS.map(seg => {
            const count = counts[seg.key] || 0;
            if (count === 0) return null;
            return (
              <div key={seg.key} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.bg }}></span>
                <span className="text-[11px] text-gray-600">{seg.label}</span>
                <span className="text-[11px] font-semibold text-gray-400">{count}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
          <i className="ri-information-line text-xs"></i>
          R = Recência de atividade · F = Frequência de conteúdo (vídeos 30d) · M = GMV gerado no período
        </p>
      </div>
    </div>
  );
}

// ─── Modal Criar/Editar Dashboard ───────────────────────────────
function DashboardModal({
  dashboard,
  onClose,
  onSave,
}: {
  dashboard: Dashboard | null;
  onClose: () => void;
  onSave: (data: Partial<Dashboard>) => Promise<void>;
}) {
  const [name, setName] = useState(dashboard?.name || '');
  const [description, setDescription] = useState(dashboard?.description || '');
  const [icon, setIcon] = useState(dashboard?.icon || DASHBOARD_ICONS[0]);
  const [color, setColor] = useState(dashboard?.color || DASHBOARD_COLORS[0].value);
  const [widgets, setWidgets] = useState<Widget[]>(dashboard?.widgets || []);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'widgets'>('info');

  const addWidget = (type: string) => {
    const cat = WIDGET_CATALOG.find(w => w.type === type)!;
    const newWidget: Widget = {
      id: `w${Date.now()}`,
      type,
      title: cat.label,
      size: type === 'metric_cards' || type === 'monthly_evolution' || type === 'distribution_charts' ? 'full' : 'half',
      config: {},
    };
    setWidgets(prev => [...prev, newWidget]);
  };

  const removeWidget = (id: string) => setWidgets(prev => prev.filter(w => w.id !== id));

  const moveWidget = (id: string, dir: 'up' | 'down') => {
    const idx = widgets.findIndex(w => w.id === id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === widgets.length - 1)) return;
    const next = [...widgets];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setWidgets(next);
  };

  const toggleSize = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id
      ? { ...w, size: w.size === 'full' ? 'half' : 'full' }
      : w
    ));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description: description.trim(), icon, color, widgets });
    setSaving(false);
  };

  const addedTypes = widgets.map(w => w.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              <i className={`${icon} text-xl`} style={{ color }}></i>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{dashboard ? 'Editar Dashboard' : 'Novo Dashboard'}</h3>
              <p className="text-xs text-gray-400">Personalize o painel de métricas</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 m-4 mb-0 rounded-xl p-1">
          {[{ id: 'info', label: 'Informações', icon: 'ri-edit-line' }, { id: 'widgets', label: 'Widgets', icon: 'ri-layout-grid-line' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer ${activeTab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${t.icon} text-sm`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'info' && (
            <>
              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome do dashboard *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={50}
                  placeholder="Ex: Análise de Vendas"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]" />
              </div>
              {/* Descrição */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} maxLength={100}
                  placeholder="Breve descrição do dashboard"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]" />
              </div>
              {/* Cor */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Cor</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DASHBOARD_COLORS.map(c => (
                    <button key={c.value} onClick={() => setColor(c.value)}
                      title={c.label}
                      className={`w-8 h-8 rounded-lg cursor-pointer transition-all hover:scale-110 ${color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c.value }}>
                    </button>
                  ))}
                </div>
              </div>
              {/* Ícone */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Ícone</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DASHBOARD_ICONS.map(ic => (
                    <button key={ic} onClick={() => setIcon(ic)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all ${icon === ic ? 'ring-2 ring-offset-1' : 'bg-gray-100 hover:bg-gray-200'}`}
                      style={icon === ic ? { backgroundColor: `${color}20`, color, outlineColor: color } : {}}>
                      <i className={`${ic} text-base`}></i>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'widgets' && (
            <div className="space-y-4">
              {/* Widgets adicionados */}
              {widgets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Widgets ativos ({widgets.length})</p>
                  <div className="space-y-2">
                    {widgets.map((w, idx) => {
                      const cat = WIDGET_CATALOG.find(c => c.type === w.type);
                      return (
                        <div key={w.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <i className={`${cat?.icon || 'ri-question-line'} text-sm text-gray-500`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{w.title}</p>
                            <button onClick={() => toggleSize(w.id)}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 cursor-pointer transition-all ${w.size === 'full' ? 'bg-[#004aad]/10 text-[#004aad]' : 'bg-gray-200 text-gray-500'}`}>
                              {w.size === 'full' ? 'Largura total' : 'Meia largura'}
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveWidget(w.id, 'up')} disabled={idx === 0}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 cursor-pointer rounded">
                              <i className="ri-arrow-up-s-line text-sm"></i>
                            </button>
                            <button onClick={() => moveWidget(w.id, 'down')} disabled={idx === widgets.length - 1}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 cursor-pointer rounded">
                              <i className="ri-arrow-down-s-line text-sm"></i>
                            </button>
                            <button onClick={() => removeWidget(w.id)}
                              className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 cursor-pointer rounded transition-colors">
                              <i className="ri-close-line text-sm"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Catálogo */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adicionar widgets</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WIDGET_CATALOG.map(cat => {
                    const alreadyAdded = addedTypes.includes(cat.type);
                    return (
                      <button key={cat.type} onClick={() => addWidget(cat.type)}
                        className={`flex items-center gap-3 p-3 text-left rounded-xl border-2 transition-all cursor-pointer ${alreadyAdded ? 'border-[#5de0e6]/40 bg-[#5de0e6]/5 opacity-70' : 'border-gray-100 hover:border-[#5de0e6]/50 hover:bg-[#5de0e6]/5'}`}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${alreadyAdded ? 'bg-[#5de0e6]/20' : 'bg-gray-100'}`}>
                          <i className={`${cat.icon} text-base ${alreadyAdded ? 'text-[#004aad]' : 'text-gray-500'}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{cat.label}</p>
                          <p className="text-[11px] text-gray-400 truncate">{cat.desc}</p>
                        </div>
                        {alreadyAdded
                          ? <i className="ri-check-double-line text-[#004aad] text-sm flex-shrink-0"></i>
                          : <i className="ri-add-line text-gray-400 text-sm flex-shrink-0"></i>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            style={{ backgroundColor: color }}>
            {saving ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin"></i>Salvando...</span>
              : <span className="flex items-center justify-center gap-2"><i className="ri-save-line"></i>{dashboard ? 'Salvar Alterações' : 'Criar Dashboard'}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────
export default function MetricasPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [interactions, setInteractions] = useState<(Interaction & { client?: Client })[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gmvPeriod, setGmvPeriod] = useState<GmvPeriod>('30d');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [clientsRes, interactionsRes, dashboardsRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('interactions').select('*, clients(*)').order('date', { ascending: false }),
        supabase.from('metric_dashboards').select('*').order('sort_order', { ascending: true }),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (interactionsRes.data) {
        setInteractions(interactionsRes.data.map((i: any) => ({ ...i, client: i.clients })));
      }
      if (dashboardsRes.data && dashboardsRes.data.length > 0) {
        setDashboards(dashboardsRes.data);
        setSelectedDashboardId(prev => prev || dashboardsRes.data.find((d: Dashboard) => d.is_default)?.id || dashboardsRes.data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedDashboard = dashboards.find(d => d.id === selectedDashboardId);

  const handleCreateDashboard = async (data: Partial<Dashboard>) => {
    const { error } = await supabase.from('metric_dashboards').insert({
      ...data,
      created_by: user?.id || null,
      sort_order: dashboards.length,
      is_default: false,
    });
    if (!error) { await loadData(); setShowCreateModal(false); }
  };

  const handleUpdateDashboard = async (data: Partial<Dashboard>) => {
    if (!editingDashboard) return;
    const { error } = await supabase.from('metric_dashboards').update({
      ...data,
      updated_at: new Date().toISOString(),
    }).eq('id', editingDashboard.id);
    if (!error) { await loadData(); setEditingDashboard(null); }
  };

  const handleDeleteDashboard = async (id: string) => {
    setDeleting(true);
    await supabase.from('metric_dashboards').delete().eq('id', id);
    const remaining = dashboards.filter(d => d.id !== id);
    if (selectedDashboardId === id && remaining.length > 0) {
      setSelectedDashboardId(remaining[0].id);
    }
    await loadData();
    setDeleteConfirm(null);
    setDeleting(false);
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from('metric_dashboards').update({ is_default: false }).neq('id', id);
    await supabase.from('metric_dashboards').update({ is_default: true }).eq('id', id);
    await loadData();
  };

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
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Seletor de dashboard */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2.5 pl-4 pr-3 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all cursor-pointer"
                style={{ backgroundColor: selectedDashboard?.color || '#004aad' }}
              >
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
                      <div key={d.id}
                        className={`flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors group ${selectedDashboardId === d.id ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                        onClick={() => { setSelectedDashboardId(d.id); setShowDropdown(false); }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${d.color}20` }}>
                          <i className={`${d.icon} text-sm`} style={{ color: d.color }}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium truncate ${selectedDashboardId === d.id ? 'text-gray-900' : 'text-gray-700'}`}>{d.name}</p>
                            {d.is_default && (
                              <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">padrão</span>
                            )}
                          </div>
                          {d.description && <p className="text-[11px] text-gray-400 truncate">{d.description}</p>}
                        </div>
                        {selectedDashboardId === d.id && (
                          <i className="ri-check-line text-[#004aad] flex-shrink-0"></i>
                        )}
                        {/* Ações rápidas (hover) */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingDashboard(d); setShowDropdown(false); }}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#004aad] rounded cursor-pointer">
                            <i className="ri-edit-line text-xs"></i>
                          </button>
                          {!d.is_default && (
                            <button onClick={() => handleSetDefault(d.id)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-amber-500 rounded cursor-pointer" title="Definir como padrão">
                              <i className="ri-star-line text-xs"></i>
                            </button>
                          )}
                          {dashboards.length > 1 && (
                            <button onClick={() => { setDeleteConfirm(d.id); setShowDropdown(false); }}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-rose-500 rounded cursor-pointer">
                              <i className="ri-delete-bin-line text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button onClick={() => { setShowCreateModal(true); setShowDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#004aad] hover:bg-[#5de0e6]/5 cursor-pointer transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-[#5de0e6]/10 flex items-center justify-center">
                          <i className="ri-add-line text-sm text-[#004aad]"></i>
                        </div>
                        <span className="font-medium">Novo dashboard</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Botão novo dashboard (visível também fora do dropdown) */}
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#004aad] hover:bg-[#5de0e6]/10 rounded-xl transition-all cursor-pointer whitespace-nowrap">
              <i className="ri-dashboard-line text-base"></i>
              novo dashboard
            </button>

            {/* Editar dashboard atual */}
            {selectedDashboard && (
              <button onClick={() => setEditingDashboard(selectedDashboard)}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer" title="Editar dashboard">
                <i className="ri-settings-3-line text-base"></i>
              </button>
            )}
          </div>

          {/* Período GMV */}
          <div className="flex items-center bg-gray-100 rounded-full p-1 gap-0.5">
            {periodOptions.map(opt => (
              <button key={opt.value} onClick={() => setGmvPeriod(opt.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${gmvPeriod === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Descrição do dashboard */}
        {selectedDashboard?.description && (
          <p className="text-sm text-gray-400 -mt-2">{selectedDashboard.description}</p>
        )}

        {/* ── WIDGETS ── */}
        {selectedDashboard && selectedDashboard.widgets.length > 0 ? (
          <div className="space-y-5">
            {(() => {
              // Agrupar widgets: full = linha inteira, half = 2 por linha
              const rows: Widget[][] = [];
              let currentRow: Widget[] = [];
              selectedDashboard.widgets.forEach(w => {
                if (w.size === 'full') {
                  if (currentRow.length > 0) { rows.push([...currentRow]); currentRow = []; }
                  rows.push([w]);
                } else {
                  currentRow.push(w);
                  if (currentRow.length === 2) { rows.push([...currentRow]); currentRow = []; }
                }
              });
              if (currentRow.length > 0) rows.push([...currentRow]);

              return rows.map((row, ri) => (
                <div key={ri} className={`grid gap-5 ${row.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {row.map(widget => (
                    <WidgetRenderer key={widget.id} widget={widget} clients={clients} interactions={interactions} gmvPeriod={gmvPeriod} />
                  ))}
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
            <button onClick={() => setEditingDashboard(selectedDashboard!)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer"
              style={{ backgroundColor: selectedDashboard?.color || '#004aad' }}>
              <i className="ri-add-line"></i>Adicionar widgets
            </button>
          </div>
        )}
      </div>

      {/* ── MODAIS ── */}
      {(showCreateModal || editingDashboard) && (
        <DashboardModal
          dashboard={editingDashboard}
          onClose={() => { setShowCreateModal(false); setEditingDashboard(null); }}
          onSave={editingDashboard ? handleUpdateDashboard : handleCreateDashboard}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-delete-bin-line text-2xl text-rose-500"></i>
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Excluir Dashboard</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              "{dashboards.find(d => d.id === deleteConfirm)?.name}" será excluído permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={() => handleDeleteDashboard(deleteConfirm)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

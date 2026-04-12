// src/hooks/useGoals.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type GoalCategory = 'hunter' | 'closer' | 'cs' | 'marketing';

export type GoalType =
  | 'leads_prospectados' | 'cadastros_mornos' | 'reunioes_agendadas' | 'grupos_criados'
  | 'reunioes_fechadas' | 'grupos_whatsapp' | 'contratos_emitidos' | 'contratos_assinados'
  | 'gmv_7d' | 'gmv_14d' | 'gmv_28d' | 'gmv_30d'
  | 'cadastros_por_fonte';

export type PeriodType =
  | 'fixed_7' | 'fixed_14' | 'fixed_28' | 'fixed_30'
  | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
  | 'semiannual' | 'annual' | 'custom';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  type: GoalType;
  target_value: number;
  period_type: PeriodType;
  period_month: number | null;
  period_year: number | null;
  period_start: string | null;
  period_end: string | null;
  scope: 'global' | 'individual';
  assigned_to: string[] | null;
  assigned_name: string[] | null;
  reward_description: string | null;
  funnel_id: string | null;
  filter_channel: string | null;
  filter_category: string | null;
  filter_source: string | null;
  notify_at_percent: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal: Goal;
  current_value: number;
  percent: number;
  achieved: boolean;
  days_remaining: number | null;
  // Para ranking: progresso por usuário
  user_breakdown?: { user_id: string; user_name: string; value: number; percent: number }[];
}

export interface RankingEntry {
  user_id: string;
  user_name: string;
  avatar_initial: string;
  total_creators: number;
  total_gmv: number;
  total_amostras: number;
  total_interacoes: number;
  goals_achieved: number;
}

// ── Calcula as datas de início/fim de um período ──────────────────────────────
export function resolvePeriodDates(goal: Goal): { start: Date; end: Date } {
  const now = new Date();

  if (goal.period_start && goal.period_end) {
    return { start: new Date(goal.period_start), end: new Date(goal.period_end) };
  }

  switch (goal.period_type) {
    case 'fixed_7': {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      return { start: s, end: now };
    }
    case 'fixed_14': {
      const s = new Date(now); s.setDate(s.getDate() - 14);
      return { start: s, end: now };
    }
    case 'fixed_28': {
      const s = new Date(now); s.setDate(s.getDate() - 28);
      return { start: s, end: now };
    }
    case 'fixed_30': {
      const s = new Date(now); s.setDate(s.getDate() - 30);
      return { start: s, end: now };
    }
    case 'weekly': {
      const day = now.getDay();
      const s = new Date(now); s.setDate(s.getDate() - day);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return { start: s, end: e };
    }
    case 'biweekly': {
      const s = new Date(now); s.setDate(s.getDate() - 14);
      return { start: s, end: now };
    }
    case 'monthly': {
      const month = (goal.period_month ?? now.getMonth() + 1) - 1;
      const year  = goal.period_year ?? now.getFullYear();
      const s = new Date(year, month, 1);
      const e = new Date(year, month + 1, 0);
      return { start: s, end: e };
    }
    case 'quarterly': {
      const q = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), q * 3, 1);
      const e = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { start: s, end: e };
    }
    case 'semiannual': {
      const half = now.getMonth() < 6 ? 0 : 6;
      const s = new Date(now.getFullYear(), half, 1);
      const e = new Date(now.getFullYear(), half + 6, 0);
      return { start: s, end: e };
    }
    case 'annual': {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear(), 11, 31);
      return { start: s, end: e };
    }
    default:
      return { start: now, end: now };
  }
}

// ── Calcula dias restantes ────────────────────────────────────────────────────
function daysRemaining(end: Date): number | null {
  const now = new Date();
  if (end < now) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  leads_prospectados:   'Leads Prospectados',
  cadastros_mornos:     'Cadastros Mornos',
  reunioes_agendadas:   'Reuniões Agendadas',
  grupos_criados:       'Grupos Criados',
  reunioes_fechadas:    'Reuniões Fechadas',
  grupos_whatsapp:      'Grupos de WhatsApp',
  contratos_emitidos:   'Contratos Emitidos',
  contratos_assinados:  'Contratos Assinados',
  gmv_7d:               'GMV 7 dias',
  gmv_14d:              'GMV 14 dias',
  gmv_28d:              'GMV 28 dias',
  gmv_30d:              'GMV 30 dias',
  cadastros_por_fonte:  'Cadastros por Fonte',
};

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  hunter:    'Hunter',
  closer:    'Closer',
  cs:        'Customer Success',
  marketing: 'Marketing',
};

export const GOAL_TYPES_BY_CATEGORY: Record<GoalCategory, GoalType[]> = {
  hunter:    ['leads_prospectados', 'cadastros_mornos', 'reunioes_agendadas', 'grupos_criados'],
  closer:    ['reunioes_fechadas', 'grupos_whatsapp', 'contratos_emitidos', 'contratos_assinados'],
  cs:        ['gmv_7d', 'gmv_14d', 'gmv_28d', 'gmv_30d'],
  marketing: ['cadastros_por_fonte'],
};

export const PERIOD_LABELS: Record<PeriodType, string> = {
  fixed_7:    'Últimos 7 dias',
  fixed_14:   'Últimos 14 dias',
  fixed_28:   'Últimos 28 dias',
  fixed_30:   'Últimos 30 dias',
  weekly:     'Semanal',
  biweekly:   'Quinzenal',
  monthly:    'Mensal',
  quarterly:  'Trimestral',
  semiannual: 'Semestral',
  annual:     'Anual',
  custom:     'Personalizado',
};

export const CAPTURE_SOURCES = [
  'Hunter', 'Campanha', 'Formulario', 'Indicacao',
  'Facebook', 'Live', 'Instagram', 'WhatsApp', 'Outro',
];

// ── Hook principal ────────────────────────────────────────────────────────────
export function useGoals() {
  const { profile } = useAuth();
  const [goals, setGoals]     = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Buscar metas ──────────────────────────────────────────────────────────
  const loadGoals = useCallback(async (onlyActive = true) => {
    setLoading(true);
    try {
      let q = supabase.from('goals').select('*').order('created_at', { ascending: false });
      if (onlyActive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      setGoals(data || []);
    } catch (e) {
      console.error('Erro ao carregar metas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Calcular progresso de uma meta para um usuário específico ─────────────
  const calcProgress = useCallback(async (
    goal: Goal,
    userId?: string,
  ): Promise<number> => {
    const { start, end } = resolvePeriodDates(goal);
    const startIso = start.toISOString();
    const endIso   = end.toISOString();
    const uid      = userId || profile?.id;

    try {
      switch (goal.type) {

        // ── Hunter: leads prospectados e cadastros mornos ─────────────────
        case 'leads_prospectados':
        case 'cadastros_mornos': {
          let q = supabase.from('clients').select('id', { count: 'exact', head: true })
            .gte('created_at', startIso).lte('created_at', endIso);
          if (goal.scope === 'individual') {
            const uids = goal.assigned_to || (uid ? [uid] : []);
            if (uids.length > 0) q = q.in('created_by', uids);
          }
          if (goal.filter_channel)  q = q.eq('platform', goal.filter_channel);
          if (goal.filter_category) q = q.eq('category', goal.filter_category);
          if (goal.type === 'leads_prospectados' && goal.filter_source)
            q = q.eq('capture_source', goal.filter_source);
          const { count } = await q;
          return count || 0;
        }

        // ── Hunter / Closer: interações tipadas ───────────────────────────
        case 'reunioes_agendadas':
        case 'reunioes_fechadas':
        case 'contratos_emitidos':
        case 'contratos_assinados': {
          const typeMap: Record<string, string> = {
            reunioes_agendadas:  'reuniao_agendada',
            reunioes_fechadas:   'reuniao_fechada',
            contratos_emitidos:  'contrato_emitido',
            contratos_assinados: 'contrato_assinado',
          };
          let q = supabase.from('interactions').select('id', { count: 'exact', head: true })
            .eq('type', typeMap[goal.type])
            .gte('created_at', startIso).lte('created_at', endIso);
          if (goal.scope === 'individual') {
            const uids = goal.assigned_to || (uid ? [uid] : []);
            if (uids.length > 0) q = q.in('created_by', uids);
          }
          const { count } = await q;
          return count || 0;
        }

        // ── Hunter / Closer: grupos WhatsApp ──────────────────────────────
        case 'grupos_criados':
        case 'grupos_whatsapp': {
          let q = supabase.from('clients').select('id', { count: 'exact', head: true })
            .not('whatsapp_group_link', 'is', null)
            .gte('created_at', startIso).lte('created_at', endIso);
          if (goal.scope === 'individual') {
            const uids = goal.assigned_to || (uid ? [uid] : []);
            if (uids.length > 0) q = q.in('created_by', uids);
          }
          const { count } = await q;
          return count || 0;
        }

        // ── CS: GMV por período ───────────────────────────────────────────
        case 'gmv_7d':
        case 'gmv_14d':
        case 'gmv_28d':
        case 'gmv_30d': {
          const gmvField: Record<string, string> = {
            gmv_7d: 'gmv_interno_7d', gmv_14d: 'gmv_interno_14d',
            gmv_28d: 'gmv_interno_28d', gmv_30d: 'gmv_interno_30d',
          };
          const field = gmvField[goal.type];
          // Busca clients via deals.assigned_to
          let dealsQ = supabase.from('deals').select('client_id');
          if (goal.scope === 'individual') {
            const uids = goal.assigned_to || (uid ? [uid] : []);
            if (uids.length > 0) dealsQ = dealsQ.in('assigned_to', uids);
          }
          const { data: dealRows } = await dealsQ;
          const clientIds = (dealRows || []).map(d => d.client_id).filter(Boolean);
          if (clientIds.length === 0) return 0;
          const { data: clients } = await supabase
            .from('clients').select(field).in('id', clientIds);
          const total = (clients || []).reduce((s, c) => s + (Number((c as any)[field]) || 0), 0);
          return total;
        }

        // ── Marketing: cadastros por fonte ────────────────────────────────
        case 'cadastros_por_fonte': {
          let q = supabase.from('clients').select('id', { count: 'exact', head: true })
            .gte('created_at', startIso).lte('created_at', endIso);
          if (goal.filter_source)   q = q.eq('capture_source', goal.filter_source);
          if (goal.filter_channel)  q = q.eq('platform', goal.filter_channel);
          if (goal.filter_category) q = q.eq('category', goal.filter_category);
          const { count } = await q;
          return count || 0;
        }

        default: return 0;
      }
    } catch (e) {
      console.error('Erro ao calcular progresso:', e);
      return 0;
    }
  }, [profile]);

  // ── Montar GoalProgress completo ──────────────────────────────────────────
  const buildProgress = useCallback(async (
    goal: Goal,
    userId?: string,
  ): Promise<GoalProgress> => {
    const { end } = resolvePeriodDates(goal);
    const current = await calcProgress(goal, userId);
    const percent = goal.target_value > 0
      ? Math.min(Math.round((current / goal.target_value) * 100), 100)
      : 0;
    return {
      goal,
      current_value: current,
      percent,
      achieved: percent >= 100,
      days_remaining: daysRemaining(end),
    };
  }, [calcProgress]);

  // ── Ranking geral ─────────────────────────────────────────────────────────
  const buildRanking = useCallback(async (
    periodStart: string,
    periodEnd: string,
  ): Promise<RankingEntry[]> => {
    // Busca todos usuários não-admin ativos
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .neq('role', 'admin');

    if (!users || users.length === 0) return [];

    const entries: RankingEntry[] = await Promise.all(users.map(async (u) => {
      // Creators cadastrados no período
      const { count: totalCreators } = await supabase
        .from('clients').select('id', { count: 'exact', head: true })
        .eq('created_by', u.id)
        .gte('created_at', periodStart).lte('created_at', periodEnd);

      // GMV via deals.assigned_to
      const { data: myDeals } = await supabase
        .from('deals').select('client_id').eq('assigned_to', u.id);
      const clientIds = (myDeals || []).map(d => d.client_id).filter(Boolean);
      let totalGmv = 0;
      if (clientIds.length > 0) {
        const { data: gmvClients } = await supabase
          .from('clients').select('gmv_geral').in('id', clientIds);
        totalGmv = (gmvClients || []).reduce((s, c) => s + (Number(c.gmv_geral) || 0), 0);
      }

      // Amostras enviadas
      const { count: totalAmostras } = await supabase
        .from('clients').select('id', { count: 'exact', head: true })
        .eq('created_by', u.id).eq('amostra_enviada', true);

      // Interações
      const { count: totalInteracoes } = await supabase
        .from('interactions').select('id', { count: 'exact', head: true })
        .eq('created_by', u.id)
        .gte('created_at', periodStart).lte('created_at', periodEnd);

      return {
        user_id:          u.id,
        user_name:        u.full_name,
        avatar_initial:   u.full_name.charAt(0).toUpperCase(),
        total_creators:   totalCreators || 0,
        total_gmv:        totalGmv,
        total_amostras:   totalAmostras || 0,
        total_interacoes: totalInteracoes || 0,
        goals_achieved:   0, // calculado separado se necessário
      };
    }));

    // Ordenar por GMV desc por padrão
    return entries.sort((a, b) => b.total_gmv - a.total_gmv);
  }, []);

  // ── CRUD de metas ─────────────────────────────────────────────────────────
  const createGoal = useCallback(async (data: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('goals').insert({
      ...data, created_by: profile?.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    await loadGoals(false);
  }, [profile, loadGoals]);

  const updateGoal = useCallback(async (id: string, data: Partial<Goal>) => {
    const { error } = await supabase.from('goals').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await loadGoals(false);
  }, [loadGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) throw error;
    await loadGoals(false);
  }, [loadGoals]);

  const toggleGoal = useCallback(async (id: string, is_active: boolean) => {
    await updateGoal(id, { is_active });
  }, [updateGoal]);

  return {
    goals, loading,
    loadGoals, calcProgress, buildProgress, buildRanking,
    createGoal, updateGoal, deleteGoal, toggleGoal,
    resolvePeriodDates,
  };
}

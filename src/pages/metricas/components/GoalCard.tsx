// src/pages/metricas/components/GoalCard.tsx
import { useEffect, useState } from 'react';
import type { GoalProgress } from '../../../hooks/useGoals';
import { PERIOD_LABELS, GOAL_CATEGORY_LABELS, GOAL_TYPE_LABELS } from '../../../hooks/useGoals';

interface GoalCardProps {
  progress: GoalProgress;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
  isAdmin?: boolean;
}

const CATEGORY_COLORS = {
  hunter:    { bg: 'bg-sky-50',    bar: 'bg-sky-500',    text: 'text-sky-700',    border: 'border-sky-100' },
  closer:    { bg: 'bg-violet-50', bar: 'bg-violet-500', text: 'text-violet-700', border: 'border-violet-100' },
  cs:        { bg: 'bg-emerald-50',bar: 'bg-emerald-500',text: 'text-emerald-700',border: 'border-emerald-100' },
  marketing: { bg: 'bg-amber-50',  bar: 'bg-amber-500',  text: 'text-amber-700',  border: 'border-amber-100' },
};

export default function GoalCard({ progress, onEdit, onDelete, onToggle, isAdmin }: GoalCardProps) {
  const { goal, current_value, percent, achieved, days_remaining } = progress;
  const colors = CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.hunter;
  const [animPercent, setAnimPercent] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimPercent(percent), 100);
    return () => clearTimeout(t);
  }, [percent]);

  const formatValue = (v: number) => {
    if (goal.type.startsWith('gmv')) {
      return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return v.toLocaleString('pt-BR');
  };

  const statusColor = achieved
    ? 'text-emerald-600 bg-emerald-50'
    : percent >= (goal.notify_at_percent || 80)
    ? 'text-amber-600 bg-amber-50'
    : 'text-gray-500 bg-gray-50';

  const statusLabel = achieved
    ? '🎯 Meta atingida!'
    : percent >= (goal.notify_at_percent || 80)
    ? `⚡ Quase lá — ${percent}%`
    : `${percent}% concluído`;

  return (
    <div className={`bg-white rounded-2xl border ${colors.border} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className={`${colors.bg} px-5 py-4 flex items-start justify-between gap-3`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
              {GOAL_CATEGORY_LABELS[goal.category]}
            </span>
            {goal.scope === 'individual' && goal.assigned_name && (
              <span className="text-[10px] text-gray-400 truncate">→ {goal.assigned_name}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 truncate">{goal.title}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{GOAL_TYPE_LABELS[goal.type]}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onToggle} title={goal.is_active ? 'Pausar' : 'Ativar'}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white/60 hover:text-gray-600 cursor-pointer transition-all">
              <i className={`${goal.is_active ? 'ri-pause-line' : 'ri-play-line'} text-sm`}></i>
            </button>
            <button onClick={onEdit}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white/60 hover:text-brand-600 cursor-pointer transition-all">
              <i className="ri-edit-line text-sm"></i>
            </button>
            <button onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition-all">
              <i className="ri-delete-bin-line text-sm"></i>
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Números */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatValue(current_value)}</p>
            <p className="text-xs text-gray-400">de {formatValue(goal.target_value)} ({PERIOD_LABELS[goal.period_type]})</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Barra de progresso */}
        <div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ease-out ${achieved ? 'bg-emerald-500' : colors.bar}`}
              style={{ width: `${animPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-400">
              {PERIOD_LABELS[goal.period_type]}
              {goal.period_month && goal.period_year
                ? ` — ${new Date(goal.period_year, goal.period_month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`
                : ''}
            </span>
            {days_remaining !== null && days_remaining > 0 && (
              <span className="text-[10px] text-gray-400">
                {days_remaining === 1 ? '1 dia restante' : `${days_remaining} dias restantes`}
              </span>
            )}
            {days_remaining === 0 && (
              <span className="text-[10px] text-rose-500 font-medium">Encerrado</span>
            )}
          </div>
        </div>

        {/* Filtros aplicados */}
        {(goal.filter_channel || goal.filter_category || goal.filter_source) && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
            {goal.filter_channel && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                <i className="ri-broadcast-line text-xs"></i>{goal.filter_channel}
              </span>
            )}
            {goal.filter_category && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                <i className="ri-medal-line text-xs"></i>{goal.filter_category}
              </span>
            )}
            {goal.filter_source && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                <i className="ri-focus-3-line text-xs"></i>{goal.filter_source}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

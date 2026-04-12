import type { GoalProgress } from '../../../hooks/useGoals';
import { PERIOD_LABELS, GOAL_CATEGORY_LABELS, GOAL_TYPE_LABELS } from '../../../hooks/useGoals';
import { Gift, Star, Coins, Zap, Target, Award } from 'lucide-react';

interface PerformanceTableProps {
  progresses: GoalProgress[];
  onEdit?: (goal: any) => void;
  onDelete?: (id: string) => void;
  onToggle?: (goal: any) => void;
  isAdmin?: boolean;
}

const REWARDS = [
  { icon: <Coins size={16} className="text-yellow-500" />, label: 'Moedas' },
  { icon: <Star size={16} className="text-blue-500" />, label: 'Estrela' },
  { icon: <Gift size={16} className="text-rose-500" />, label: 'Presente' },
  { icon: <Zap size={16} className="text-amber-500" />, label: 'Energia' },
];

function getReward(goalId: string) {
  // Determinístico baseado no ID para manter consistência
  const idx = goalId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % REWARDS.length;
  return REWARDS[idx];
}

function getXPColor(percent: number) {
  if (percent < 30) return 'bg-rose-500 shadow-rose-500/20';
  if (percent < 70) return 'bg-amber-500 shadow-amber-500/20';
  return 'bg-emerald-500 shadow-emerald-500/20';
}

function formatValue(v: number, type: string) {
  if (type.startsWith('gmv')) {
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return v.toLocaleString('pt-BR');
}

export default function PerformanceTable({ progresses, onEdit, onDelete, onToggle, isAdmin }: PerformanceTableProps) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Missão</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoria</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Progresso / XP</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Loot / Recompensa</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Período</th>
              {isAdmin && <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {progresses.map((p) => {
              const { goal, current_value, percent, days_remaining } = p;
              const reward = getReward(goal.id);
              const xpColor = getXPColor(percent);
              const isUrgent = days_remaining !== null && days_remaining < 3 && days_remaining > 0;

              return (
                <tr key={goal.id} className="group hover:bg-gray-50/80 transition-all duration-200">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-900 text-white shadow-lg group-hover:scale-110 transition-transform`}>
                        <Target size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 truncate max-w-[200px]">{goal.title}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{GOAL_TYPE_LABELS[goal.type]}</p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-5">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full border uppercase tracking-widest
                      ${goal.category === 'hunter' ? 'bg-sky-50 text-sky-600 border-sky-100' : 
                        goal.category === 'closer' ? 'bg-violet-50 text-violet-600 border-violet-100' : 
                        goal.category === 'cs' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {GOAL_CATEGORY_LABELS[goal.category]}
                    </span>
                  </td>

                  <td className="px-6 py-5 min-w-[200px]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black text-gray-900">{percent}% XP</span>
                      <span className="text-[10px] font-bold text-gray-400">{formatValue(current_value, goal.type)} / {formatValue(goal.target_value, goal.type)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 p-0.5 border border-gray-50 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${xpColor} shadow-sm`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 group/reward">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 group-hover/reward:bg-white group-hover/reward:shadow-md transition-all">
                        {reward.icon}
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-0 group-hover/reward:opacity-100 transition-opacity">
                        {reward.label}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{PERIOD_LABELS[goal.period_type]}</span>
                      <span className={`text-[10px] font-black mt-0.5 ${isUrgent ? 'text-rose-500 animate-pulse' : 'text-gray-500'}`}>
                        {days_remaining === 0 ? 'ENCERRADO' : 
                         days_remaining === 1 ? 'ÚLTIMO DIA!' : 
                         `${days_remaining} DIAS RESTANTES`}
                      </span>
                    </div>
                  </td>

                  {isAdmin && (
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onToggle?.(goal)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all">
                          <i className={`${goal.is_active ? 'ri-pause-line' : 'ri-play-line'} text-sm`}></i>
                        </button>
                        <button onClick={() => onEdit?.(goal)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all">
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        <button onClick={() => onDelete?.(goal.id)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all">
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

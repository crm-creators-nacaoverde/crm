import { useEffect, useState } from 'react';
import type { GoalProgress } from '../../../hooks/useGoals';
import { PERIOD_LABELS, GOAL_CATEGORY_LABELS, GOAL_TYPE_LABELS } from '../../../hooks/useGoals';
import confetti from 'canvas-confetti';
import { Flame, Trophy, Target, Award, Star } from 'lucide-react';

interface MissionCardProps {
  progress: GoalProgress;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
  isAdmin?: boolean;
}

const CATEGORY_THEMES = {
  hunter:    { color: '#0ea5e9', shadow: 'shadow-sky-500/20', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100' },
  closer:    { color: '#8b5cf6', shadow: 'shadow-violet-500/20', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
  cs:        { color: '#10b981', shadow: 'shadow-emerald-500/20', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  marketing: { color: '#f59e0b', shadow: 'shadow-amber-500/20', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
};

export default function MissionCard({ progress, onEdit, onDelete, onToggle, isAdmin }: MissionCardProps) {
  const { goal, current_value, percent, achieved, days_remaining } = progress;
  const theme = CATEGORY_THEMES[goal.category] || CATEGORY_THEMES.hunter;
  const [animPercent, setAnimPercent] = useState(0);
  const [isOnFire, setIsOnFire] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimPercent(percent), 100);
    // Simulação de "On Fire": se o percentual for alto ou atingido recentemente
    if (percent > 80) setIsOnFire(true);
    
    if (percent >= 100) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [theme.color, '#ffffff', '#ffd700']
      });
    }
    
    return () => clearTimeout(t);
  }, [percent, theme.color]);

  const formatValue = (v: number) => {
    if (goal.type.startsWith('gmv')) {
      return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return v.toLocaleString('pt-BR');
  };

  const badges = [
    { threshold: 25, icon: <Target size={14} /> },
    { threshold: 50, icon: <Award size={14} /> },
    { threshold: 75, icon: <Star size={14} /> },
    { threshold: 100, icon: <Trophy size={14} /> },
  ];

  return (
    <div className={`group relative bg-white rounded-2xl border ${theme.border} ${theme.shadow} hover:-translate-y-1 transition-all duration-300 overflow-hidden`}>
      {/* Estado On Fire */}
      {isOnFire && (
        <div className="absolute top-3 right-3 z-10 animate-bounce">
          <Flame className="text-orange-500 fill-orange-500" size={20} />
        </div>
      )}

      {/* Header */}
      <div className={`${theme.bg} px-5 py-4`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 ${theme.text} border ${theme.border}`}>
            MISSÃO: {GOAL_CATEGORY_LABELS[goal.category]}
          </span>
        </div>
        <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-gray-700 transition-colors">{goal.title}</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">{GOAL_TYPE_LABELS[goal.type]}</p>
        {goal.reward_description && (
          <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg text-yellow-700">
            <Trophy size={12} className="text-yellow-500 fill-yellow-500" />
            <p className="text-[9px] font-black uppercase tracking-wider leading-tight">{goal.reward_description}</p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-black text-gray-900 tracking-tight">{formatValue(current_value)}</p>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Alvo: {formatValue(goal.target_value)}</p>
          </div>
          <div className="flex gap-1">
            {badges.map((badge, i) => (
              <div 
                key={i}
                title={`${badge.threshold}%`}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ${
                  percent >= badge.threshold 
                    ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200 scale-110' 
                    : 'bg-gray-100 text-gray-300 opacity-40'
                }`}
              >
                {badge.icon}
              </div>
            ))}
          </div>
        </div>

        {/* Barra de XP */}
        <div className="relative">
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden p-1 border border-gray-50">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out relative`}
              style={{ 
                width: `${Math.min(animPercent, 100)}%`,
                backgroundColor: theme.color,
                boxShadow: `0 0 ${Math.min(animPercent / 5, 15)}px ${theme.color}`
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              {PERIOD_LABELS[goal.period_type]}
            </span>
            <span className={`text-[10px] font-black ${days_remaining !== null && days_remaining < 3 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
              {days_remaining === 0 ? 'ENCERRADO' : `${days_remaining} DIAS RESTANTES`}
            </span>
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onToggle} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <i className={`${goal.is_active ? 'ri-pause-line' : 'ri-play-line'} text-sm`}></i>
            </button>
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
              <i className="ri-edit-line text-sm"></i>
            </button>
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
              <i className="ri-delete-bin-line text-sm"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

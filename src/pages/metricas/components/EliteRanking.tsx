import type { RankingEntry } from '../../../hooks/useGoals';
import { TrendingUp, TrendingDown, Minus, Trophy, Medal, Award } from 'lucide-react';

interface EliteRankingProps {
  entries: RankingEntry[];
  currentUserId?: string;
  loading?: boolean;
}

const PATENTES = [
  { threshold: 1000000, label: 'Diamante', color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  { threshold: 500000, label: 'Ouro', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  { threshold: 100000, label: 'Prata', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
  { threshold: 0, label: 'Bronze', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
];

function getPatente(gmv: number) {
  return PATENTES.find(p => gmv >= p.threshold) || PATENTES[3];
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

export default function EliteRanking({ entries, currentUserId, loading }: EliteRankingProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
        <Trophy className="text-gray-300 mb-4" size={48} />
        <p className="text-lg font-bold text-gray-400">Arena Vazia</p>
        <p className="text-sm text-gray-300 mt-1">Aguardando os primeiros guerreiros entrarem na disputa...</p>
      </div>
    );
  }

  const top3 = [entries[1], entries[0], entries[2]].filter(Boolean); // Ordem: 2º, 1º, 3º para o pódio visual
  const others = entries.slice(3);

  return (
    <div className="space-y-12">
      {/* Pódio de Elite */}
      <div className="flex flex-col sm:flex-row items-end justify-center gap-4 sm:gap-8 pt-10">
        {top3.map((entry, idx) => {
          const realPos = entry === entries[0] ? 1 : entry === entries[1] ? 2 : 3;
          const isFirst = realPos === 1;
          const isSecond = realPos === 2;
          const isThird = realPos === 3;
          const isMe = entry.user_id === currentUserId;
          const patente = getPatente(entry.total_gmv);

          return (
            <div 
              key={entry.user_id}
              className={`relative flex flex-col items-center transition-all duration-500 hover:scale-105 ${
                isFirst ? 'order-2 z-20' : isSecond ? 'order-1 z-10' : 'order-3 z-10'
              }`}
            >
              {/* Avatar e Coroa/Medalha */}
              <div className="relative mb-4">
                <div className={`
                  rounded-full flex items-center justify-center shadow-2xl
                  ${isFirst ? 'w-28 h-28 border-4 border-yellow-400 ring-8 ring-yellow-400/10' : 'w-20 h-20 border-4 border-gray-200'}
                  ${isMe ? 'ring-4 ring-blue-500/30' : ''}
                  bg-gradient-to-br from-gray-800 to-black
                `}>
                  <span className={`font-black text-white ${isFirst ? 'text-3xl' : 'text-xl'}`}>{entry.avatar_initial}</span>
                </div>
                <div className={`absolute -top-6 left-1/2 -translate-x-1/2 ${isFirst ? 'scale-150' : 'scale-110'}`}>
                  {isFirst ? <Trophy className="text-yellow-400 fill-yellow-400" size={32} /> : 
                   isSecond ? <Medal className="text-slate-300 fill-slate-300" size={24} /> : 
                   <Award className="text-orange-400 fill-orange-400" size={24} />}
                </div>
                {isMe && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg">
                    VOCÊ
                  </div>
                )}
              </div>

              {/* Info Card */}
              <div className={`
                text-center p-4 rounded-2xl border bg-white shadow-xl min-w-[160px]
                ${isFirst ? 'border-yellow-200 ring-2 ring-yellow-100' : 'border-gray-100'}
              `}>
                <p className="text-sm font-black text-gray-900 truncate max-w-[140px]">{entry.user_name}</p>
                <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${patente.bg} ${patente.color} border ${patente.border}`}>
                  {patente.label}
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">GMV TOTAL</p>
                  <p className={`font-black ${isFirst ? 'text-xl text-yellow-600' : 'text-lg text-gray-800'}`}>
                    {formatCurrency(entry.total_gmv)}
                  </p>
                </div>
              </div>

              {/* Base do Pódio */}
              <div className={`
                mt-4 w-full rounded-t-xl bg-gradient-to-b from-gray-100 to-gray-50 border-x border-t border-gray-200
                ${isFirst ? 'h-24' : isSecond ? 'h-16' : 'h-12'}
              `}>
                <div className="flex items-center justify-center h-full">
                  <span className="text-2xl font-black text-gray-300">{realPos}º</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista de Seguidores */}
      {others.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Guerreiros em Ascensão</h4>
            <span className="text-[10px] font-bold text-gray-400">{others.length} competidores</span>
          </div>
          <div className="divide-y divide-gray-50">
            {others.map((entry, i) => {
              const pos = i + 4;
              const isMe = entry.user_id === currentUserId;
              const patente = getPatente(entry.total_gmv);
              // Simulação de tendência (poderia vir do backend)
              const trend = Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable';

              return (
                <div key={entry.user_id} className={`flex items-center gap-4 px-6 py-4 transition-all hover:bg-gray-50/50 ${isMe ? 'bg-blue-50/30' : ''}`}>
                  <div className="w-8 text-center">
                    <span className="text-sm font-black text-gray-300">{pos}º</span>
                  </div>
                  
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white'}`}>
                      <span className="font-bold text-sm">{entry.avatar_initial}</span>
                    </div>
                    <div className="absolute -top-1 -right-1">
                      {trend === 'up' ? <TrendingUp size={14} className="text-emerald-500" /> : 
                       trend === 'down' ? <TrendingDown size={14} className="text-rose-500" /> : 
                       <Minus size={14} className="text-gray-300" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold truncate ${isMe ? 'text-blue-700' : 'text-gray-900'}`}>{entry.user_name}</p>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${patente.bg} ${patente.color} ${patente.border}`}>
                        {patente.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">{entry.total_creators} Creators • {entry.total_interacoes} Interações</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{formatCurrency(entry.total_gmv)}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">GMV ACUMULADO</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

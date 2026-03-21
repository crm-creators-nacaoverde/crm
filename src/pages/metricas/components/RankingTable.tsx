// src/pages/metricas/components/RankingTable.tsx
import type { RankingEntry } from '../../../hooks/useGoals';

interface RankingTableProps {
  entries: RankingEntry[];
  currentUserId?: string;
  loading?: boolean;
}

const PODIUM_COLORS = [
  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',  icon: '🥇', label: '1º' },
  { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-600',   icon: '🥈', label: '2º' },
  { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700', icon: '🥉', label: '3º' },
];

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

export default function RankingTable({ entries, currentUserId, loading }: RankingTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
          <i className="ri-trophy-line text-2xl text-gray-300"></i>
        </div>
        <p className="text-sm font-medium text-gray-400">Nenhum dado de ranking disponível</p>
        <p className="text-xs text-gray-300 mt-1">Os dados aparecerão conforme os usuários realizarem ações no sistema</p>
      </div>
    );
  }

  const top3   = entries.slice(0, 3);
  const others = entries.slice(3);

  return (
    <div className="space-y-6">
      {/* Pódio */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {top3.map((entry, i) => {
            const c = PODIUM_COLORS[i];
            const isMe = entry.user_id === currentUserId;
            return (
              <div key={entry.user_id}
                className={`relative rounded-2xl border-2 p-5 text-center ${c.bg} ${c.border} ${isMe ? 'ring-2 ring-[#004aad]/30' : ''}`}>
                {isMe && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#004aad] bg-white border border-[#004aad]/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Você
                  </span>
                )}
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="w-12 h-12 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <span className="text-white font-bold text-lg">{entry.avatar_initial}</span>
                </div>
                <p className={`text-sm font-bold ${c.text} truncate`}>{entry.user_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.label} lugar</p>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">GMV</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(entry.total_gmv)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Creators</span>
                    <span className="font-semibold text-gray-800">{entry.total_creators}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Amostras</span>
                    <span className="font-semibold text-gray-800">{entry.total_amostras}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabela restante */}
      {others.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Usuário</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Creators</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">GMV</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amostras</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Interações</th>
              </tr>
            </thead>
            <tbody>
              {others.map((entry, i) => {
                const pos = i + 4;
                const isMe = entry.user_id === currentUserId;
                return (
                  <tr key={entry.user_id}
                    className={`border-b border-gray-50 transition-colors ${isMe ? 'bg-[#004aad]/5' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-gray-400">{pos}º</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${isMe ? 'bg-gradient-to-br from-[#5de0e6] to-[#004aad]' : 'bg-gray-100'}`}>
                          <span className={`font-semibold text-xs ${isMe ? 'text-white' : 'text-gray-600'}`}>{entry.avatar_initial}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isMe ? 'text-[#004aad]' : 'text-gray-800'}`}>{entry.user_name}</p>
                          {isMe && <p className="text-[10px] text-[#004aad]/60">Você</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-700">{entry.total_creators}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-700">{formatCurrency(entry.total_gmv)}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-700">{entry.total_amostras}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-700">{entry.total_interacoes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

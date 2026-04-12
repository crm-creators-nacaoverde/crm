import { Client } from '../../../lib/supabase';

interface ActivityBarsProps {
  clients: Client[];
  totalInteractions: number;
}

export default function ActivityBars({ clients, totalInteractions }: ActivityBarsProps) {
  const activeCount = clients.filter(c => c.status === 'active').length;
  const inactiveCount = clients.filter(c => c.status === 'inactive').length;
  const activityRate = clients.length > 0 ? (activeCount / clients.length) * 100 : 0;
  const avgInteractions = clients.length > 0 ? totalInteractions / clients.length : 0;
  const avgInteractionsPercentage = totalInteractions > 0 && clients.length > 0 ? ((totalInteractions / (clients.length * 10)) * 100) : 0; // Assuming 10 is max interactions for percentage calculation

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Taxa de Atividade */}
      <div className="bg-gradient-to-r from-[#004aad] to-[#003d91] rounded-xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm font-medium text-white/70">Taxa de Atividade</p>
            <p className="text-2xl font-bold mt-1">{activeCount}</p>
            <p className="text-xs text-white/50 mt-0.5">{activityRate.toFixed(1)}%</p>
            <p className="text-xs text-white/50 mt-1">Creators ativos no sistema</p>
          </div>
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
            <i className="ri-pulse-line text-2xl text-white"></i>
          </div>
        </div>
      </div>

      {/* Creators Inativos */}
      <div className="bg-gradient-to-r from-rose-500 to-rose-600 rounded-xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm font-medium text-rose-100">Creators Inativos</p>
            <p className="text-2xl font-bold mt-1">{inactiveCount}</p>
            <p className="text-xs text-rose-200 mt-0.5">{clients.length > 0 ? ((inactiveCount / clients.length) * 100).toFixed(1) : 0}%</p>
            <p className="text-xs text-rose-200 mt-1">Total de inativos</p>
          </div>
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
            <i className="ri-user-unfollow-line text-2xl text-white"></i>
          </div>
        </div>
      </div>

      {/* Média de Interações */}
      <div className="bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm font-medium text-orange-100">Média de Interações</p>
            <p className="text-2xl font-bold mt-1">{totalInteractions}</p>
            <p className="text-xs text-orange-200 mt-0.5">{avgInteractions.toFixed(1)} por creator</p>
            <p className="text-xs text-orange-200 mt-1">Total de interações</p>
          </div>
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
            <i className="ri-chat-3-line text-2xl text-white"></i>
          </div>
        </div>
      </div>
    </div>
  );
}

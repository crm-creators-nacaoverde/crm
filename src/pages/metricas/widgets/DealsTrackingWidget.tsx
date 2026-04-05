import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface DealsStats {
  total: number;
  won: number;
  lost: number;
  byFunnel: { name: string; count: number }[];
  byChannel: { name: string; count: number }[];
  bySource: { name: string; count: number }[];
  byPlatform: { name: string; count: number }[];
  byUser: { name: string; count: number }[];
}

interface Props {
  period?: string;
}

export default function DealsTrackingWidget({ period = '30d' }: Props) {
  const [stats, setStats] = useState<DealsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDealsStats = async () => {
      setLoading(true);
      
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateIso = startDate.toISOString();

      // 1. Buscar todos os negócios no período
      const { data: deals } = await supabase
        .from('deals')
        .select('*, clients(*), funnels(*)')
        .gte('created_at', startDateIso);

      if (deals) {
        const statsObj: DealsStats = {
          total: deals.length,
          won: deals.filter(d => d.stage === 'won').length,
          lost: deals.filter(d => d.stage === 'lost').length,
          byFunnel: [],
          byChannel: [],
          bySource: [],
          byPlatform: [],
          byUser: [],
        };

        const funnelMap: Record<string, number> = {};
        const channelMap: Record<string, number> = {};
        const sourceMap: Record<string, number> = {};
        const platformMap: Record<string, number> = {};
        const userMap: Record<string, number> = {};

        deals.forEach(deal => {
          // Por Funil
          const funnelName = deal.funnels?.name || 'Sem Funil';
          funnelMap[funnelName] = (funnelMap[funnelName] || 0) + 1;

          // Por Usuário (Assigned To)
          const userName = deal.assigned_name || 'Não Atribuído';
          userMap[userName] = (userMap[userName] || 0) + 1;

          // Dados do Cliente (Canal, Fonte, Plataforma)
          if (deal.clients) {
            const channel = deal.clients.whatsapp_group_link ? 'WhatsApp' : 'Outro';
            channelMap[channel] = (channelMap[channel] || 0) + 1;

            const source = deal.clients.capture_source || 'Direto / Outros';
            sourceMap[source] = (sourceMap[source] || 0) + 1;

            const platform = deal.clients.platform || 'Não Informada';
            platformMap[platform] = (platformMap[platform] || 0) + 1;
          } else {
            channelMap['Sem Cliente'] = (channelMap['Sem Cliente'] || 0) + 1;
            sourceMap['Sem Cliente'] = (sourceMap['Sem Cliente'] || 0) + 1;
            platformMap['Sem Cliente'] = (platformMap['Sem Cliente'] || 0) + 1;
          }
        });

        statsObj.byFunnel = Object.entries(funnelMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        statsObj.byChannel = Object.entries(channelMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        statsObj.bySource = Object.entries(sourceMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        statsObj.byPlatform = Object.entries(platformMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        statsObj.byUser = Object.entries(userMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

        setStats(statsObj);
      }
      setLoading(false);
    };

    fetchDealsStats();
  }, [period]);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-[400px] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#004aad] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!stats) return null;

  const MetricRow = ({ label, value, total }: { label: string; value: number; total: number }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-600 truncate pr-2">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-gray-900">{value}</span>
        <span className="text-[10px] text-gray-400 w-8 text-right">
          {total > 0 ? Math.round((value / total) * 100) : 0}%
        </span>
      </div>
    </div>
  );

  const Section = ({ title, data, total }: { title: string; data: { name: string; count: number }[]; total: number }) => (
    <div className="space-y-1">
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
      {data.length > 0 ? (
        data.slice(0, 4).map((item, i) => (
          <MetricRow key={i} label={item.name} value={item.count} total={total} />
        ))
      ) : (
        <p className="text-[10px] text-gray-300 italic">Sem dados</p>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <i className="ri-shake-hands-line text-base text-blue-600"></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Acompanhamento de Negócios</h3>
            <p className="text-[10px] text-gray-400">Métricas de conversão e distribuição</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-[10px] text-gray-400 uppercase font-bold">Total Geral</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Ganhos</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-emerald-900">{stats.won}</span>
            <span className="text-[10px] text-emerald-600 font-medium">
              {stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0}%
            </span>
          </div>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
          <p className="text-[10px] font-bold text-rose-700 uppercase mb-1">Perdidos</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-rose-900">{stats.lost}</span>
            <span className="text-[10px] text-rose-600 font-medium">
              {stats.total > 0 ? Math.round((stats.lost / stats.total) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6 overflow-y-auto pr-1 custom-scrollbar">
        <Section title="Por Funil" data={stats.byFunnel} total={stats.total} />
        <Section title="Por Usuário" data={stats.byUser} total={stats.total} />
        <Section title="Por Canal" data={stats.byChannel} total={stats.total} />
        <Section title="Por Fonte" data={stats.bySource} total={stats.total} />
        <Section title="Por Plataforma" data={stats.byPlatform} total={stats.total} />
      </div>
    </div>
  );
}

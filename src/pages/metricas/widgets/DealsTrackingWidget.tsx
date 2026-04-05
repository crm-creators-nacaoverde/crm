import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface DealsStats {
  total: number;
  won: number;
  lost: number;
  byFunnel: { id: string; name: string; count: number }[];
  byCategory: { name: string; count: number }[];
  bySource: { name: string; count: number }[];
  byPlatform: { name: string; count: number }[];
  byUser: { name: string; count: number }[];
}

interface FunnelStage {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  funnel_id: string;
}

interface Props {
  period?: string;
}

export default function DealsTrackingWidget({ period = '30d' }: Props) {
  const [view, setView] = useState<'general' | 'funnel'>('general');
  const [stats, setStats] = useState<DealsStats | null>(null);
  const [funnels, setFunnels] = useState<{ id: string; name: string }[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [dealsByStage, setDealsByStage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(false);

  // Carregar dados gerais
  useEffect(() => {
    const fetchDealsStats = async () => {
      setLoading(true);
      
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateIso = startDate.toISOString();

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
          byCategory: [],
          bySource: [],
          byPlatform: [],
          byUser: [],
        };

        const funnelMap: Record<string, { id: string; count: number }> = {};
        const categoryMap: Record<string, number> = {};
        const sourceMap: Record<string, number> = {};
        const platformMap: Record<string, number> = {};
        const userMap: Record<string, number> = {};

        deals.forEach(deal => {
          if (deal.funnels) {
            const f = deal.funnels;
            if (!funnelMap[f.name]) funnelMap[f.name] = { id: f.id, count: 0 };
            funnelMap[f.name].count++;
          }

          const userName = deal.assigned_name || 'Não Atribuído';
          userMap[userName] = (userMap[userName] || 0) + 1;

          if (deal.clients) {
            const category = deal.clients.category || 'Sem Categoria';
            categoryMap[category] = (categoryMap[category] || 0) + 1;
            const source = deal.clients.capture_source || 'Direto / Outros';
            sourceMap[source] = (sourceMap[source] || 0) + 1;
            const platform = deal.clients.platform || 'Não Informada';
            platformMap[platform] = (platformMap[platform] || 0) + 1;
          }
        });

        statsObj.byFunnel = Object.entries(funnelMap).map(([name, data]) => ({ id: data.id, name, count: data.count })).sort((a, b) => b.count - a.count);
        statsObj.byCategory = Object.entries(categoryMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        statsObj.bySource = Object.entries(sourceMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        statsObj.byPlatform = Object.entries(platformMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        statsObj.byUser = Object.entries(userMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

        setStats(statsObj);
        setFunnels(statsObj.byFunnel.map(f => ({ id: f.id, name: f.name })));
        if (statsObj.byFunnel.length > 0 && !selectedFunnelId) {
          setSelectedFunnelId(statsObj.byFunnel[0].id);
        }
      }
      setLoading(false);
    };

    fetchDealsStats();
  }, [period]);

  // Carregar etapas e negócios do funil selecionado
  useEffect(() => {
    if (view === 'funnel' && selectedFunnelId) {
      const fetchFunnelData = async () => {
        setLoadingFunnel(true);
        
        const days = parseInt(period.replace('d', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateIso = startDate.toISOString();

        const [stagesRes, dealsRes] = await Promise.all([
          supabase.from('funnel_stages').select('*').eq('funnel_id', selectedFunnelId).order('sort_order', { ascending: true }),
          supabase.from('deals').select('stage').eq('funnel_id', selectedFunnelId).gte('created_at', startDateIso)
        ]);

        if (stagesRes.data) setStages(stagesRes.data);
        
        if (dealsRes.data) {
          const counts: Record<string, number> = {};
          dealsRes.data.forEach(d => {
            counts[d.stage] = (counts[d.stage] || 0) + 1;
          });
          setDealsByStage(counts);
        }
        setLoadingFunnel(false);
      };
      fetchFunnelData();
    }
  }, [view, selectedFunnelId, period]);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-[420px] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#004aad] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

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
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full overflow-hidden flex flex-col min-h-[420px]">
      {/* Header com Toggle de Dobra */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <i className={`ri-${view === 'general' ? 'shake-hands-line' : 'filter-3-line'} text-base text-blue-600`}></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Acompanhamento de Negócios</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <button 
                onClick={() => setView('general')}
                className={`text-[10px] uppercase font-bold tracking-wider transition-colors ${view === 'general' ? 'text-[#004aad]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Geral
              </button>
              <span className="text-gray-300 text-[10px]">|</span>
              <button 
                onClick={() => setView('funnel')}
                className={`text-[10px] uppercase font-bold tracking-wider transition-colors ${view === 'funnel' ? 'text-[#004aad]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Por Etapas
              </button>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{stats?.total || 0}</p>
          <p className="text-[10px] text-gray-400 uppercase font-bold">Total Geral</p>
        </div>
      </div>

      {view === 'general' ? (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Ganhos</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-emerald-900">{stats?.won || 0}</span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {stats && stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
              <p className="text-[10px] font-bold text-rose-700 uppercase mb-1">Perdidos</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-rose-900">{stats?.lost || 0}</span>
                <span className="text-[10px] text-rose-600 font-medium">
                  {stats && stats.total > 0 ? Math.round((stats.lost / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6 overflow-y-auto pr-1 custom-scrollbar flex-1">
            <Section title="Por Funil" data={stats?.byFunnel || []} total={stats?.total || 0} />
            <Section title="Por Usuário" data={stats?.byUser || []} total={stats?.total || 0} />
            <Section title="Por Categoria" data={stats?.byCategory || []} total={stats?.total || 0} />
            <Section title="Por Fonte" data={stats?.bySource || []} total={stats?.total || 0} />
            <Section title="Por Plataforma" data={stats?.byPlatform || []} total={stats?.total || 0} />
          </div>
        </>
      ) : (
        <div className="flex flex-col flex-1">
          {/* Seletor de Funil */}
          <div className="mb-4">
            <select 
              value={selectedFunnelId}
              onChange={(e) => setSelectedFunnelId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004aad]/20 focus:border-[#004aad] transition-all"
            >
              {funnels.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {loadingFunnel ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[#004aad] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
              {stages.length > 0 ? (
                stages.map((stage) => {
                  const count = dealsByStage[stage.id] || 0;
                  const totalInFunnel = Object.values(dealsByStage).reduce((a, b) => a + b, 0);
                  const pct = totalInFunnel > 0 ? Math.round((count / totalInFunnel) * 100) : 0;

                  return (
                    <div key={stage.id} className="group">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }}></div>
                          <span className="text-xs font-semibold text-gray-700 truncate">{stage.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-gray-900">{count}</span>
                          <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%`, backgroundColor: stage.color }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <i className="ri-inbox-line text-2xl text-gray-200 mb-2"></i>
                  <p className="text-xs text-gray-400">Nenhuma etapa encontrada para este funil.</p>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-4 pt-3 border-t border-gray-50">
            <p className="text-[10px] text-gray-400 italic text-center">
              As etapas são carregadas dinamicamente conforme configuradas no funil.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

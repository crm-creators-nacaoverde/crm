import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useFunnels } from '../../../hooks/useFunnels';
import { useFunnelStages } from '../../../hooks/useFunnelStages';

interface Deal {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  funnel_id: string;
  created_at: string;
  expected_close_date: string | null;
  assigned_to: string | null;
  priority: string;
}

interface Funnel {
  id: string;
  name: string;
  color: string;
}

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  funnel_id: string;
}

export default function MetricsSection() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('all');
  const { funnels } = useFunnels();
  const { stages: allStages } = useFunnelStages();

  useEffect(() => {
    loadDeals();
  }, []);

  useEffect(() => {
    // Carregar funil selecionado do localStorage
    const saved = localStorage.getItem('selectedFunnelId');
    if (saved && funnels.some(f => f.id === saved)) {
      setSelectedFunnelId(saved);
    } else if (funnels.length > 0) {
      const defaultFunnel = funnels.find(f => f.is_default) || funnels[0];
      setSelectedFunnelId(defaultFunnel.id);
    }
  }, [funnels]);

  const loadDeals = async () => {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setDeals(data);
    }
  };

  // Filtrar deals por funil
  const filteredDeals = selectedFunnelId === 'all' 
    ? deals 
    : deals.filter(d => d.funnel_id === selectedFunnelId);

  // Filtrar stages por funil
  const stages = selectedFunnelId === 'all'
    ? allStages
    : allStages.filter(s => s.funnel_id === selectedFunnelId);

  // Métricas gerais
  const totalDeals = filteredDeals.length;
  const totalValue = filteredDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const avgTicket = totalDeals > 0 ? totalValue / totalDeals : 0;

  // Deals por etapa
  const dealsByStage = stages.map(stage => ({
    stage,
    deals: filteredDeals.filter(d => d.stage_id === stage.id),
    value: filteredDeals
      .filter(d => d.stage_id === stage.id)
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0)
  }));

  // Deals por prioridade
  const dealsByPriority = [
    { priority: 'high', label: 'Alta', color: 'rose', deals: filteredDeals.filter(d => d.priority === 'high') },
    { priority: 'medium', label: 'Média', color: 'amber', deals: filteredDeals.filter(d => d.priority === 'medium') },
    { priority: 'low', label: 'Baixa', color: 'emerald', deals: filteredDeals.filter(d => d.priority === 'low') }
  ];

  // Deals por mês (últimos 6 meses)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      deals: filteredDeals.filter(d => {
        const dealDate = new Date(d.created_at);
        return dealDate.getMonth() === date.getMonth() && dealDate.getFullYear() === date.getFullYear();
      }).length,
      value: filteredDeals
        .filter(d => {
          const dealDate = new Date(d.created_at);
          return dealDate.getMonth() === date.getMonth() && dealDate.getFullYear() === date.getFullYear();
        })
        .reduce((sum, deal) => sum + Number(deal.value || 0), 0)
    };
  }).reverse();

  const maxDealsInMonth = Math.max(...last6Months.map(m => m.deals), 1);
  const maxValueInMonth = Math.max(...last6Months.map(m => m.value), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header com seletor de funil */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Métricas</h1>
          <p className="text-sm text-gray-500 mt-1">Análise de desempenho e estatísticas</p>
        </div>

        {funnels.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Funil:</span>
            <select
              value={selectedFunnelId}
              onChange={(e) => setSelectedFunnelId(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-transparent cursor-pointer"
            >
              <option value="all">Todos os funis</option>
              {funnels.map(funnel => (
                <option key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#5de0e6]/20 to-[#5de0e6]/10 rounded-xl p-6 border border-[#5de0e6]/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#004aad]">Total de Negociações</span>
            <div className="w-10 h-10 bg-[#004aad] rounded-xl flex items-center justify-center">
              <i className="ri-briefcase-line text-lg text-white"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-[#004aad]">{totalDeals}</p>
          <p className="text-xs text-[#004aad]/60 mt-1">
            {selectedFunnelId === 'all' ? 'Em todos os funis' : funnels.find(f => f.id === selectedFunnelId)?.name}
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-6 border border-emerald-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-emerald-600">Valor Total</span>
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <i className="ri-money-dollar-circle-line text-lg text-white"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-700">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-emerald-600 mt-1">Soma de todas as negociações</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-6 border border-amber-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-amber-600">Ticket Médio</span>
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <i className="ri-line-chart-line text-lg text-white"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-700">
            R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-amber-600 mt-1">Valor médio por negociação</p>
        </div>
      </div>

      {/* Negociações por etapa */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Negociações por Etapa</h2>
        <div className="space-y-3">
          {dealsByStage.map(({ stage, deals, value }) => (
            <div key={stage.id} className="flex items-center gap-4">
              <div className="flex items-center gap-2 min-w-[180px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }}></span>
                <span className="text-sm font-medium text-gray-700">{stage.name}</span>
              </div>
              <div className="flex-1 bg-gray-50 rounded-full h-8 relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${totalDeals > 0 ? (deals.length / totalDeals) * 100 : 0}%`,
                    backgroundColor: stage.color
                  }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="text-xs font-semibold text-gray-700">{deals.length} negociações</span>
                  <span className="text-xs font-semibold text-gray-700">
                    R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <span className="text-sm font-bold text-gray-900 min-w-[50px] text-right">
                {totalDeals > 0 ? Math.round((deals.length / totalDeals) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid com 2 colunas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Negociações por prioridade */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Por Prioridade</h2>
          <div className="space-y-3">
            {dealsByPriority.map(({ priority, label, color, deals }) => (
              <div key={priority} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full bg-${color}-500`}></span>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-50 rounded-full h-2 w-32">
                    <div
                      className={`h-full rounded-full bg-${color}-500 transition-all duration-500`}
                      style={{ width: `${totalDeals > 0 ? (deals.length / totalDeals) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 min-w-[40px] text-right">
                    {deals.length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolução mensal (quantidade) */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolução Mensal (Quantidade)</h2>
          <div className="flex items-end justify-between gap-2 h-48">
            {last6Months.map((month, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gray-50 rounded-t-lg relative" style={{ height: '100%' }}>
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-[#004aad] to-[#5de0e6] rounded-t-lg transition-all duration-500"
                    style={{ height: `${(month.deals / maxDealsInMonth) * 100}%` }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-700">{month.deals}</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">{month.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evolução mensal (valor) */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolução Mensal (Valor)</h2>
        <div className="flex items-end justify-between gap-2 h-48">
          {last6Months.map((month, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-gray-50 rounded-t-lg relative" style={{ height: '100%' }}>
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg transition-all duration-500"
                  style={{ height: `${(month.value / maxValueInMonth) * 100}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center px-1">
                  <span className="text-[10px] font-bold text-gray-700 text-center">
                    R$ {(month.value / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{month.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
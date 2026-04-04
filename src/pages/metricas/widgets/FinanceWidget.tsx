import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface FinanceStats {
  total: number;
  totalAmount: number;
  byType: Record<string, { count: number; amount: number }>;
  byStatus: Record<string, number>;
  topCreators: { name: string; amount: number }[];
  topPixTypes: { type: string; count: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  premiacao: 'Premiação',
  cache: 'Cachê',
  bonus: 'Bônus',
  reembolso: 'Reembolso',
  outro: 'Outro',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Aleatória',
};

export default function FinanceWidget() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinance = async () => {
      setLoading(true);
      const { data: payments } = await supabase
        .from('creator_payments')
        .select('type, amount, status, client_name, pix_key_type');

      if (payments) {
        const byType: Record<string, { count: number; amount: number }> = {};
        const byStatus: Record<string, number> = {};
        const creatorAmounts: Record<string, number> = {};
        const pixTypeCounts: Record<string, number> = {};
        let totalAmount = 0;

        payments.forEach(p => {
          // Type stats
          if (!byType[p.type]) byType[p.type] = { count: 0, amount: 0 };
          byType[p.type].count++;
          byType[p.type].amount += Number(p.amount);
          
          // Status stats
          byStatus[p.status] = (byStatus[p.status] || 0) + 1;
          
          // Creator stats (only paid)
          if (p.status === 'pago') {
            creatorAmounts[p.client_name] = (creatorAmounts[p.client_name] || 0) + Number(p.amount);
            totalAmount += Number(p.amount);
          }
          
          // PIX type stats
          if (p.pix_key_type) {
            pixTypeCounts[p.pix_key_type] = (pixTypeCounts[p.pix_key_type] || 0) + 1;
          }
        });

        const topCreators = Object.entries(creatorAmounts)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        const topPixTypes = Object.entries(pixTypeCounts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);

        setStats({
          total: payments.length,
          totalAmount,
          byType,
          byStatus,
          topCreators,
          topPixTypes
        });
      }
      setLoading(false);
    };

    fetchFinance();
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!stats) return null;

  const fmtMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
          <i className="ri-money-dollar-circle-line text-base text-emerald-600"></i>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Financeiro</h3>
          <p className="text-[10px] text-gray-400">{fmtMoney(stats.totalAmount)} pagos no total</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Status & Types Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</h4>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-xs font-bold text-gray-900">{stats.byStatus[key] || 0}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tipos de Chave</h4>
            {stats.topPixTypes.slice(0, 3).map(pt => (
              <div key={pt.type} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{PIX_TYPE_LABELS[pt.type] || pt.type}</span>
                <span className="text-xs font-bold text-gray-900">{pt.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Creators */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Maiores Pagamentos (Creators)</h4>
          <div className="space-y-2.5">
            {stats.topCreators.map((c, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-gray-700 truncate max-w-[150px]">{c.name}</span>
                <span className="text-xs font-semibold text-emerald-600">{fmtMoney(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Types Distribution */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Distribuição por Tipo</h4>
          <div className="space-y-2">
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const data = stats.byType[key] || { count: 0, amount: 0 };
              const pct = stats.totalAmount > 0 ? (data.amount / stats.totalAmount) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-600">{label}</span>
                    <span className="text-[11px] font-bold text-gray-900">{fmtMoney(data.amount)}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

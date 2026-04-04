import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface LogisticsStats {
  total: number;
  byStatus: Record<string, number>;
  topProducts: { name: string; count: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  preparing: 'Preparando',
  shipped: 'Enviado',
  in_transit: 'Em Trânsito',
  delivered: 'Entregue',
  returned: 'Devolvido',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500',
  preparing: 'bg-sky-500',
  shipped: 'bg-indigo-500',
  in_transit: 'bg-violet-500',
  delivered: 'bg-emerald-500',
  returned: 'bg-rose-500',
};

export default function LogisticsWidget() {
  const [stats, setStats] = useState<LogisticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogistics = async () => {
      setLoading(true);
      const { data: items } = await supabase
        .from('logistics')
        .select('shipping_status, notes');

      if (items) {
        const byStatus: Record<string, number> = {};
        const productCounts: Record<string, number> = {};

        items.forEach(item => {
          // Status count
          byStatus[item.shipping_status] = (byStatus[item.shipping_status] || 0) + 1;
          
          // Try to extract products from notes (simple heuristic for now)
          if (item.notes) {
            const lines = item.notes.split('\n');
            lines.forEach(line => {
              if (line.toLowerCase().includes('produto:') || line.toLowerCase().includes('item:')) {
                const prod = line.split(':')[1]?.trim();
                if (prod) productCounts[prod] = (productCounts[prod] || 0) + 1;
              }
            });
          }
        });

        const topProducts = Object.entries(productCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setStats({
          total: items.length,
          byStatus,
          topProducts
        });
      }
      setLoading(false);
    };

    fetchLogistics();
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 h-full">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
          <i className="ri-truck-line text-base text-indigo-600"></i>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Logística</h3>
          <p className="text-[10px] text-gray-400">{stats.total} envios registrados</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Status Distribution */}
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const count = stats.byStatus[key] || 0;
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={key} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</span>
                  <span className="text-xs font-bold text-gray-900">{count}</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${STATUS_COLORS[key]}`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Products */}
        {stats.topProducts.length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Produtos mais enviados</h4>
            <div className="space-y-2.5">
              {stats.topProducts.map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-gray-400">{idx + 1}</span>
                    </div>
                    <span className="text-xs text-gray-700 truncate">{prod.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{prod.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

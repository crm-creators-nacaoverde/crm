import { Client } from '../../../lib/supabase';
import { GmvPeriod, getGmvField } from '../page';

interface MetricCardsProps {
  clients: Client[];
  gmvPeriod: GmvPeriod;
}

/**
 * Utility to safely access a numeric field on a client.
 * Returns 0 when the field is missing, null or not a valid number.
 */
const getNumericField = (client: Record<string, unknown>, field: string): number => {
  const raw = client[field];
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

export default function MetricCards({ clients, gmvPeriod }: MetricCardsProps) {
  // Defensive programming – ensure we always have an array
  const safeClients = Array.isArray(clients) ? clients : [];

  const totalCreators = safeClients.length;

  // Guard against an unexpected gmvPeriod value
  const gmvField = getGmvField(gmvPeriod) ?? '';
  const totalGmvInterno = safeClients.reduce(
    (sum, c) => sum + getNumericField(c as Record<string, unknown>, gmvField),
    0
  );

  const avgComissaoOrganica =
    safeClients.length > 0
      ? safeClients.reduce((sum, c) => sum + getNumericField(c as Record<string, unknown>, 'comissao_organica'), 0) /
        safeClients.length
      : 0;

  const avgComissaoTrafego =
    safeClients.length > 0
      ? safeClients.reduce((sum, c) => sum + getNumericField(c as Record<string, unknown>, 'comissao_trafego'), 0) /
        safeClients.length
      : 0;

  const periodLabel: Record<GmvPeriod, string> = {
    '7d': '7 dias',
    '14d': '14 dias',
    '28d': '28 dias',
    '30d': '30 dias',
  };

  const formatCurrency = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const cards = [
    {
      icon: 'ri-user-star-line',
      iconBg: 'bg-[#5de0e6]/10',
      iconColor: 'text-[#004aad]',
      value: totalCreators.toString(),
      label: 'Creators',
      badge: `+ ${safeClients.filter((c) => {
        const createdAt = (c as Record<string, unknown>).created_at;
        if (!createdAt) return false;
        const d = new Date(createdAt as string);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length} mês`,
      badgeBg: 'bg-[#5de0e6]/10 text-[#004aad]',
    },
    {
      icon: 'ri-money-dollar-circle-line',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      value: formatCurrency(totalGmvInterno),
      label: `GMV Interno (${periodLabel[gmvPeriod] ?? gmvPeriod})`,
      badge: null,
      badgeBg: '',
    },
    {
      icon: 'ri-percent-line',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      value: `${avgComissaoOrganica.toFixed(1)}%`,
      label: 'Comissão Média Orgânica',
      badge: null,
      badgeBg: '',
    },
    {
      icon: 'ri-line-chart-line',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      value: `${avgComissaoTrafego.toFixed(1)}%`,
      label: 'Comissão Média Tráfego',
      badge: null,
      badgeBg: '',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4"
        >
          <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <i className={`${card.icon} text-xl ${card.iconColor}`}></i>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              {card.badge && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${card.badgeBg}`}
                >
                  {card.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

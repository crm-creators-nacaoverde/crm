import { Client } from '../../../lib/supabase';
import { GmvPeriod, getGmvField } from '../page';

interface MonthlyEvolutionProps {
  clients: Client[];
  gmvPeriod: GmvPeriod;
}

/**
 * Component that shows the monthly evolution of creators (new vs old)
 * and the internal GMV for the selected period.
 */
export default function MonthlyEvolution({
  clients,
  gmvPeriod,
}: MonthlyEvolutionProps) {
  const gmvField = getGmvField(gmvPeriod);

  // Labels for the period selector
  const periodLabel: Record<GmvPeriod, string> = {
    '7d': '7d',
    '14d': '14d',
    '28d': '28d',
    '30d': '30d',
  };

  /**
   * Build an array with the last 6 months, calculating:
   * - number of new creators (created in the month)
   * - number of old creators (created before the month)
   * - GMV for new creators
   * - GMV for old creators
   */
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();

    const isCreatedInMonth = (c: Client) => {
      const d = new Date(c.created_at);
      return d.getMonth() === month && d.getFullYear() === year;
    };

    const isCreatedBeforeMonth = (c: Client) => {
      const d = new Date(c.created_at);
      return d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() < month);
    };

    const newCreators = clients.filter(isCreatedInMonth).length;
    const oldCreators = clients.filter(isCreatedBeforeMonth).length;

    const sumGmv = (list: Client[]) =>
      list.reduce((sum, c) => sum + Number((c as any)[gmvField] ?? 0), 0);

    const newGmv = sumGmv(clients.filter(isCreatedInMonth));
    const oldGmv = sumGmv(clients.filter(isCreatedBeforeMonth));

    return {
      label: date.toLocaleDateString('pt-BR', {
        month: 'short',
      }).replace('.', ''),
      newCreators,
      oldCreators,
      newGmv,
      oldGmv,
    };
  }).reverse();

  // Guard against division by zero
  const maxCreators = Math.max(...last6Months.map(m => m.newCreators + m.oldCreators), 1);
  const maxGmv = Math.max(...last6Months.map(m => m.newGmv + m.oldGmv), 1);

  // Helper to format currency values
  const formatCurrency = (val: number) => {
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)}k`;
    return `R$ ${val}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Evolução Mensal - Quantidade de Creators */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-900">
            Evolução Mensal (Creators)
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#004aad]"></span>
              <span className="text-[11px] text-gray-500">Novos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5de0e6]"></span>
              <span className="text-[11px] text-gray-500">Antigos</span>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 h-44">
          {last6Months.map((month, idx) => {
            const newH = (month.newCreators / maxCreators) * 100;
            const oldH = (month.oldCreators / maxCreators) * 100;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-2 h-full"
              >
                <div className="w-full flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] font-semibold text-gray-500 mb-1">
                    {month.newCreators + month.oldCreators}
                  </span>
                  <div className="w-full max-w-[40px] flex flex-col rounded-t-md overflow-hidden">
                    <div
                      className="w-full bg-[#004aad] transition-all duration-500"
                      style={{
                        height: `${newH}px`,
                        minHeight: month.newCreators > 0 ? '4px' : '0px',
                      }}
                    ></div>
                    <div
                      className="w-full bg-[#5de0e6] transition-all duration-500"
                      style={{
                        height: `${oldH}px`,
                        minHeight: month.oldCreators > 0 ? '4px' : '0px',
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 font-medium capitalize">
                  {month.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evolução Mensal - GMV Interno */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-900">
            Evolução de GMV Interno ({periodLabel[gmvPeriod]})
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
              <span className="text-[11px] text-gray-500">Novos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-200"></span>
              <span className="text-[11px] text-gray-500">Antigos</span>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 h-44">
          {last6Months.map((month, idx) => {
            const newH = (month.newGmv / maxGmv) * 100;
            const oldH = (month.oldGmv / maxGmv) * 100;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-2 h-full"
              >
                <div className="w-full flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] font-semibold text-gray-500 mb-1">
                    {formatCurrency(month.newGmv + month.oldGmv)}
                  </span>
                  <div className="w-full max-w-[40px] flex flex-col rounded-t-md overflow-hidden">
                    <div
                      className="w-full bg-orange-400 transition-all duration-500"
                      style={{
                        height: `${newH}px`,
                        minHeight: month.newGmv > 0 ? '4px' : '0px',
                      }}
                    ></div>
                    <div
                      className="w-full bg-orange-200 transition-all duration-500"
                      style={{
                        height: `${oldH}px`,
                        minHeight: month.oldGmv > 0 ? '4px' : '0px',
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 font-medium capitalize">
                  {month.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

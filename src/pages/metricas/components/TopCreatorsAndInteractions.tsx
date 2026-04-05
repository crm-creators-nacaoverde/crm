import { Client, Interaction } from '../../../lib/supabase';
import { GmvPeriod, getGmvField } from '../page';

interface TopCreatorsAndInteractionsProps {
  clients: Client[];
  interactions: (Interaction & { client?: Client })[];
  gmvPeriod: GmvPeriod;
}

export default function TopCreatorsAndInteractions({
  clients,
  interactions,
  gmvPeriod,
}: TopCreatorsAndInteractionsProps) {
  const formatCurrency = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const gmvField = getGmvField(gmvPeriod);
  const videosField = `videos_${gmvPeriod}`;
  const livesField = `lives_${gmvPeriod}`;

  const periodLabel: Record<GmvPeriod, string> = {
    '7d': '7d',
    '14d': '14d',
    '28d': '28d',
    '30d': '30d',
  };

  // Safely sort clients by the dynamic GMV field
  const topCreators = [...clients]
    .sort((a, b) => {
      const bVal = Number((b as any)[gmvField] ?? 0);
      const aVal = Number((a as any)[gmvField] ?? 0);
      return bVal - aVal;
    })
    .slice(0, 6);

  // Safely sort interactions by date
  const recentInteractions = [...interactions]
    .sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return bTime - aTime;
    })
    .slice(0, 6);

  const getTypeConfig = (type: string) => {
    const config: Record<
      string,
      { icon: string; bg: string; text: string; label: string }
    > = {
      meeting: {
        icon: 'ri-calendar-event-line',
        bg: 'bg-sky-50',
        text: 'text-sky-600',
        label: 'Reunião',
      },
      email: {
        icon: 'ri-mail-line',
        bg: 'bg-violet-50',
        text: 'text-violet-600',
        label: 'Email',
      },
      call: {
        icon: 'ri-phone-line',
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        label: 'Ligação',
      },
      whatsapp: {
        icon: 'ri-whatsapp-line',
        bg: 'bg-green-50',
        text: 'text-green-600',
        label: 'WhatsApp',
      },
      other: {
        icon: 'ri-chat-1-line',
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        label: 'Outro',
      },
    };
    return config[type] ?? config.other;
  };

  const rankColors = ['bg-amber-400', 'bg-gray-400', 'bg-orange-400'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top 6 Creators por GMV Interno */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Top 6 Creators ({periodLabel[gmvPeriod]})
          </h3>
          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span className="w-8 text-center">Vid</span>
            <span className="w-8 text-center">Live</span>
            <span className="w-20 text-right">GMV</span>
          </div>
        </div>
        
        <div className="space-y-1">
          {topCreators.map((client, idx) => {
            const videos = Number((client as any)[videosField] ?? 0);
            const lives = Number((client as any)[livesField] ?? 0);
            const gmv = Number((client as any)[gmvField] ?? 0);
            
            return (
              <div
                key={client.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ${
                    idx < 3 ? rankColors[idx] : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {idx + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {client.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {client.platform || 'TikTok'}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-8 flex justify-center">
                    <span className={`text-[11px] font-bold ${videos > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                      {videos}
                    </span>
                  </div>
                  <div className="w-8 flex justify-center">
                    <span className={`text-[11px] font-bold ${lives > 0 ? 'text-rose-600' : 'text-gray-300'}`}>
                      {lives}
                    </span>
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-sm font-bold text-gray-700">
                      {formatCurrency(gmv)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {topCreators.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              Sem dados
            </p>
          )}
        </div>
      </div>

      {/* Interações Recentes */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Interações Recentes
        </h3>
        <div className="space-y-1">
          {recentInteractions.map((interaction) => {
            const cfg = getTypeConfig(interaction.type);
            return (
              <div
                key={interaction.id}
                className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-8 h-8 ${cfg.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                >
                  <i className={`${cfg.icon} text-sm ${cfg.text}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {interaction.title}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {interaction.client?.name || 'Creator'} • {cfg.label}
                  </p>
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {new Date(interaction.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              </div>
            );
          })}
          {recentInteractions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              Sem dados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

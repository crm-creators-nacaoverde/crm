// src/components/feature/ClientHistoryTimeline.tsx
import { useEffect, useState } from 'react';
import { useClientHistory, type ClientHistoryEntry, type ClientHistoryEventType } from '../../hooks/useClientHistory';

interface Props {
  clientId: string;
}

// ─── CONFIG VISUAL POR TIPO DE EVENTO ────────────────────────────────────────
const EVENT_CONFIG: Record<ClientHistoryEventType, { icon: string; color: string; bg: string }> = {
  cadastro:       { icon: 'ri-user-add-line',         color: 'text-emerald-600', bg: 'bg-emerald-50' },
  edicao_dados:   { icon: 'ri-edit-2-line',            color: 'text-blue-600',    bg: 'bg-blue-50' },
  movimentacao:   { icon: 'ri-arrow-right-circle-line',color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  amostra:        { icon: 'ri-gift-2-line',            color: 'text-purple-600',  bg: 'bg-purple-50' },
  logistica:      { icon: 'ri-truck-line',             color: 'text-orange-600',  bg: 'bg-orange-50' },
  pix:            { icon: 'ri-bank-card-line',         color: 'text-cyan-600',    bg: 'bg-cyan-50' },
  pagamento:      { icon: 'ri-money-dollar-circle-line', color: 'text-green-600', bg: 'bg-green-50' },
  tarefa:         { icon: 'ri-checkbox-circle-line',   color: 'text-yellow-600',  bg: 'bg-yellow-50' },
  interacao:      { icon: 'ri-chat-3-line',            color: 'text-pink-600',    bg: 'bg-pink-50' },
  resultado:      { icon: 'ri-bar-chart-2-line',       color: 'text-teal-600',    bg: 'bg-teal-50' },
  formulario:     { icon: 'ri-file-list-3-line',       color: 'text-violet-600',  bg: 'bg-violet-50' },
  acompanhamento: { icon: 'ri-focus-3-line',           color: 'text-sky-600',     bg: 'bg-sky-50' },
  exclusao:       { icon: 'ri-delete-bin-6-line',      color: 'text-red-500',     bg: 'bg-red-50' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ClientHistoryTimeline({ clientId }: Props) {
  const { fetchClientHistory } = useClientHistory();
  const [entries, setEntries] = useState<ClientHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetchClientHistory(clientId).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
        <i className="ri-loader-4-line animate-spin text-lg" />
        Carregando histórico...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm gap-2">
        <i className="ri-history-line text-3xl" />
        <p>Nenhum evento registrado ainda</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Linha vertical da timeline */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100" />

      <div className="space-y-4">
        {entries.map((entry) => {
          const cfg = EVENT_CONFIG[entry.event_type] ?? {
            icon: 'ri-information-line',
            color: 'text-gray-500',
            bg: 'bg-gray-50',
          };

          return (
            <div key={entry.id} className="relative flex gap-4 pl-1">
              {/* Ícone */}
              <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center`}>
                <i className={`${cfg.icon} ${cfg.color} text-base`} />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 leading-snug">
                    {entry.title}
                  </p>
                  <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                    {formatDate(entry.created_at)}
                  </span>
                </div>

                {entry.description && (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {entry.description}
                  </p>
                )}

                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                  <i className="ri-user-line text-xs" />
                  {entry.user_name}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

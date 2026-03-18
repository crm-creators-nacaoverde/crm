// src/pages/formularios/components/WebhookLogsPanel.tsx
import { useEffect } from 'react';
import { useWebhookEndpoints, type WebhookLog } from '../../../hooks/useWebhookEndpoints';

interface Props {
  endpointId: string;
  endpointName: string;
}

const STATUS_CONFIG: Record<WebhookLog['status'], { label: string; color: string; icon: string }> = {
  received:  { label: 'Recebido',   color: 'text-gray-600 bg-gray-100',     icon: 'ri-download-line' },
  created:   { label: 'Criado',     color: 'text-emerald-700 bg-emerald-100', icon: 'ri-user-add-line' },
  updated:   { label: 'Atualizado', color: 'text-blue-700 bg-blue-100',      icon: 'ri-refresh-line' },
  duplicate: { label: 'Duplicata',  color: 'text-amber-700 bg-amber-100',    icon: 'ri-git-branch-line' },
  error:     { label: 'Erro',       color: 'text-rose-700 bg-rose-100',      icon: 'ri-error-warning-line' },
};

export default function WebhookLogsPanel({ endpointId, endpointName }: Props) {
  const { logs, fetchLogs } = useWebhookEndpoints();

  useEffect(() => {
    if (endpointId) fetchLogs(endpointId);
  }, [endpointId]);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Logs de chamadas</p>
          <p className="text-[11px] text-gray-400">{endpointName} — últimas 50 chamadas</p>
        </div>
        <button onClick={() => fetchLogs(endpointId)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
          <i className="ri-refresh-line text-sm"></i>Atualizar
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
            <i className="ri-inbox-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-sm font-medium">Nenhuma chamada recebida ainda</p>
          <p className="text-xs text-gray-300 mt-1">Configure a URL no seu sistema externo e envie um lead teste</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.received;
            return (
              <details key={log.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden group">
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors list-none">
                  {/* Status badge */}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${cfg.color}`}>
                    <i className={`${cfg.icon} text-[10px]`}></i>{cfg.label}
                  </span>

                  {/* Creator */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {log.client_name || 'Lead não identificado'}
                    </p>
                    {log.error_message && (
                      <p className="text-[11px] text-rose-500 truncate">{log.error_message}</p>
                    )}
                  </div>

                  {/* Data + IP */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-gray-500">{formatDateTime(log.created_at)}</p>
                    {log.ip_address && (
                      <p className="text-[10px] text-gray-300">{log.ip_address}</p>
                    )}
                  </div>

                  <i className="ri-arrow-down-s-line text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0"></i>
                </summary>

                {/* Payload expandido */}
                <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                  {log.client_id && (
                    <div className="flex items-center gap-2">
                      <i className="ri-user-line text-xs text-gray-400"></i>
                      <span className="text-xs text-gray-600">Creator ID:</span>
                      <code className="text-[11px] font-mono text-gray-500">{log.client_id}</code>
                    </div>
                  )}
                  {log.deal_id && (
                    <div className="flex items-center gap-2">
                      <i className="ri-kanban-view text-xs text-gray-400"></i>
                      <span className="text-xs text-gray-600">Deal ID:</span>
                      <code className="text-[11px] font-mono text-gray-500">{log.deal_id}</code>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Payload recebido</p>
                    <pre className="text-[11px] font-mono text-gray-700 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-48">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

// src/pages/formularios/components/WebhookManagerModal.tsx
// Modal que agrupa: lista de webhooks do formulário + botão configurar + logs
import { useState, useEffect } from 'react';
import { useWebhookEndpoints, type WebhookEndpoint } from '../../../hooks/useWebhookEndpoints';
import WebhookConfigModal from './WebhookConfigModal';
import WebhookLogsPanel from './WebhookLogsPanel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formName: string;
}

export default function WebhookManagerModal({ isOpen, onClose, formId, formName }: Props) {
  const { endpoints, loading, fetchEndpoints, toggleEndpoint, deleteEndpoint, getWebhookUrl } =
    useWebhookEndpoints(formId);

  const [showConfig, setShowConfig]         = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null);
  const [logsEndpoint, setLogsEndpoint]     = useState<WebhookEndpoint | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [copied, setCopied]                 = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) fetchEndpoints();
  }, [isOpen, fetchEndpoints]);

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(getWebhookUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string) => {
    await deleteEndpoint(id);
    setDeletingId(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                <i className="ri-webhook-line text-violet-600 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Webhooks</p>
                <p className="text-[11px] text-gray-400">{formName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingEndpoint(null); setShowConfig(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl cursor-pointer transition-colors">
                <i className="ri-add-line text-sm"></i>Novo Webhook
              </button>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Painel de logs */}
            {logsEndpoint ? (
              <div className="space-y-4">
                <button onClick={() => setLogsEndpoint(null)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 cursor-pointer transition-colors">
                  <i className="ri-arrow-left-line text-sm"></i>Voltar aos webhooks
                </button>
                <WebhookLogsPanel endpointId={logsEndpoint.id} endpointName={logsEndpoint.name} />
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="ri-loader-4-line text-2xl text-violet-400 animate-spin"></i>
              </div>
            ) : endpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
                  <i className="ri-webhook-line text-3xl text-violet-300"></i>
                </div>
                <p className="text-sm font-medium text-gray-600">Nenhum webhook configurado</p>
                <p className="text-xs text-gray-400 mt-1 text-center max-w-xs">
                  Crie um webhook para receber leads automaticamente de fontes como Facebook Lead Ads, RD Station ou Zapier
                </p>
                <button onClick={() => { setEditingEndpoint(null); setShowConfig(true); }}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl cursor-pointer transition-colors">
                  <i className="ri-add-line"></i>Configurar primeiro webhook
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {endpoints.map(ep => (
                  <div key={ep.id} className={`border rounded-xl p-4 transition-colors ${ep.is_active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Nome + status */}
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900">{ep.name}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${ep.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                            {ep.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                          {ep.source_label && ep.source_label !== 'Genérico' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700">
                              {ep.source_label}
                            </span>
                          )}
                        </div>

                        {/* Funil + etapa */}
                        {ep.funnel_name && (
                          <p className="text-[11px] text-gray-500 flex items-center gap-1">
                            <i className="ri-kanban-view text-[10px]"></i>
                            {ep.funnel_name}{ep.stage_label ? ` → ${ep.stage_label}` : ''}
                            {ep.assigned_name ? ` · ${ep.assigned_name}` : ''}
                          </p>
                        )}

                        {/* URL */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <code className="text-[11px] font-mono text-gray-500 truncate max-w-xs">
                            {getWebhookUrl(ep.token)}
                          </code>
                          <button onClick={() => handleCopy(ep.token)}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-violet-600 cursor-pointer transition-colors" title="Copiar URL">
                            <i className={`${copied === ep.token ? 'ri-check-line text-emerald-500' : 'ri-file-copy-line'} text-xs`}></i>
                          </button>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Toggle ativo */}
                        <button onClick={() => toggleEndpoint(ep.id, !ep.is_active)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-all" title={ep.is_active ? 'Desativar' : 'Ativar'}>
                          <i className={`${ep.is_active ? 'ri-pause-line' : 'ri-play-line'} text-sm`}></i>
                        </button>
                        {/* Logs */}
                        <button onClick={() => setLogsEndpoint(ep)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg cursor-pointer transition-all" title="Ver logs">
                          <i className="ri-list-check text-sm"></i>
                        </button>
                        {/* Editar */}
                        <button onClick={() => { setEditingEndpoint(ep); setShowConfig(true); }}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-lg cursor-pointer transition-all" title="Editar">
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        {/* Excluir */}
                        <button onClick={() => setDeletingId(ep.id)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all" title="Excluir">
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                    </div>

                    {/* Mapeamento resumido */}
                    {Object.keys(ep.field_mapping || {}).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Mapeamento</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(ep.field_mapping).slice(0, 5).map(([src, crm]) => (
                            <span key={src} className="inline-flex items-center gap-1 text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                              {src} → {crm}
                            </span>
                          ))}
                          {Object.keys(ep.field_mapping).length > 5 && (
                            <span className="text-[10px] text-gray-400">+{Object.keys(ep.field_mapping).length - 5} campos</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de configuração */}
      <WebhookConfigModal
        isOpen={showConfig}
        onClose={() => { setShowConfig(false); setEditingEndpoint(null); fetchEndpoints(); }}
        formId={formId}
        formName={formName}
        editingEndpoint={editingEndpoint}
      />

      {/* Confirm delete */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-rose-50 rounded-xl flex items-center justify-center">
                <i className="ri-delete-bin-line text-rose-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Excluir webhook</p>
                <p className="text-xs text-gray-500">Todos os logs também serão excluídos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deletingId)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

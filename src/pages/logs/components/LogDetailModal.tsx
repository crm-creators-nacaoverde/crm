import Modal from '../../../components/base/Modal';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: 'create' | 'update' | 'delete';
  module: 'creators' | 'deals' | 'interactions' | 'forms' | 'users' | 'settings' | 'funnels';
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

interface LogDetailModalProps {
  log: ActivityLog;
  onClose: () => void;
}

const LogDetailModal = ({ log, onClose }: LogDetailModalProps) => {
  const moduleLabels: Record<string, string> = {
    creators: 'Creators',
    deals: 'Acompanhamento',
    interactions: 'Interações',
    forms: 'Formulários',
    users: 'Usuários',
    settings: 'Configurações',
    funnels: 'Funis',
  };

  const actionLabels: Record<string, string> = {
    create: 'Criar',
    update: 'Editar',
    delete: 'Excluir',
  };

  const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderDetails = () => {
    if (!log.details) return null;

    const { before, after, changes, ...otherDetails } = log.details;

    return (
      <div className="space-y-4">
        {/* Dados Antes (para edição e exclusão) */}
        {before && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Dados Anteriores</h4>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Dados Depois (para criação e edição) */}
        {after && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Dados Atualizados</h4>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {JSON.stringify(after, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Mudanças Específicas */}
        {changes && Object.keys(changes).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Campos Alterados</h4>
            <div className="space-y-2">
              {Object.entries(changes).map(([field, change]: [string, any]) => (
                <div key={field} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1">{field}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Antes:</p>
                      <p className="text-xs text-red-600 font-mono">{JSON.stringify(change.from)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Depois:</p>
                      <p className="text-xs text-green-600 font-mono">{JSON.stringify(change.to)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outros Detalhes */}
        {Object.keys(otherDetails).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Informações Adicionais</h4>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {JSON.stringify(otherDetails, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Detalhes do Log">
      <div className="space-y-4">
        {/* Informações Principais */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data e Hora</label>
            <p className="text-sm text-gray-900">{formatDate(log.created_at)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ação</label>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${actionColors[log.action]}`}>
              {actionLabels[log.action]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Módulo</label>
            <p className="text-sm text-gray-900">{moduleLabels[log.module]}</p>
          </div>
          {log.entity_name && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entidade</label>
              <p className="text-sm text-gray-900">{log.entity_name}</p>
            </div>
          )}
        </div>

        {/* Usuário */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Usuário</label>
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {log.user_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{log.user_name}</p>
              <p className="text-xs text-gray-500">{log.user_email}</p>
            </div>
          </div>
        </div>

        {/* IP Address */}
        {log.ip_address && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Endereço IP</label>
            <p className="text-sm text-gray-900 font-mono">{log.ip_address}</p>
          </div>
        )}

        {/* ID da Entidade */}
        {log.entity_id && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ID da Entidade</label>
            <p className="text-sm text-gray-900 font-mono">{log.entity_id}</p>
          </div>
        )}

        {/* Detalhes */}
        {log.details && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Detalhes da Ação</label>
            {renderDetails()}
          </div>
        )}

        {/* Botão Fechar */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LogDetailModal;

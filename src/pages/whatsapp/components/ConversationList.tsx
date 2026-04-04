import { WaConversation } from '../../../hooks/useWhatsApp';

interface Props {
  conversations: WaConversation[];
  activeConvId: string | null;
  filter: 'mine' | 'all' | 'pending' | 'closed';
  loading: boolean;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onSetFilter: (f: 'mine' | 'all' | 'pending' | 'closed') => void;
  onNewConversation: () => void;
}

function statusColor(conv: WaConversation): string {
  if (conv.status === 'pending') return 'bg-amber-400';
  const mins = (Date.now() - new Date(conv.last_message_at).getTime()) / 60000;
  if (mins > 120) return 'bg-rose-500';
  return 'bg-emerald-500';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function phoneDisplay(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

export default function ConversationList({
  conversations, activeConvId, filter, loading, isAdmin,
  onSelect, onSetFilter, onNewConversation,
}: Props) {
  const filters: { id: typeof filter; label: string }[] = [
    ...(isAdmin ? [{ id: 'all' as const, label: 'Todas' }] : []),
    { id: 'mine', label: 'Minhas' },
    { id: 'pending', label: 'Pendentes' },
    ...(isAdmin ? [{ id: 'closed' as const, label: 'Encerradas' }] : []),
  ];

  return (
    <div className="w-full flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <i className="ri-whatsapp-line text-emerald-500 text-lg"></i>
            <h2 className="text-sm font-bold text-gray-900">WhatsApp</h2>
          </div>
          <button onClick={onNewConversation}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg cursor-pointer transition-colors">
            <i className="ri-add-line text-xs"></i>Nova
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {filters.map(f => (
            <button key={f.id} onClick={() => onSetFilter(f.id)}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md cursor-pointer transition-all ${
                filter === f.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <i className="ri-chat-off-line text-3xl text-gray-200 mb-2"></i>
            <p className="text-sm text-gray-400">Nenhuma conversa</p>
          </div>
        ) : (
          conversations.map(conv => {
            const isActive = conv.id === activeConvId;
            return (
              <button key={conv.id} onClick={() => onSelect(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer ${isActive ? 'bg-emerald-50/60 border-l-2 border-l-emerald-500' : ''}`}>
                {/* Avatar + status dot */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {(conv.client_name || conv.push_name || phoneDisplay(conv.remote_jid)).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColor(conv)}`}></span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-emerald-700' : 'text-gray-800'}`}>
                      {conv.client_name || conv.push_name || phoneDisplay(conv.remote_jid)}
                    </p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{timeAgo(conv.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-gray-500 truncate flex-1">{conv.last_message || '...'}</p>
                    {conv.unread_count > 0 && (
                      <span className="ml-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-emerald-500 text-white text-[9px] font-bold rounded-full px-1 flex-shrink-0">
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                  {conv.status === 'pending' && (
                    <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">Pendente</span>
                  )}
                  {conv.status === 'closed' && (
                    <div className="text-[9px] text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                      <span className="font-semibold">Encerrada</span>
                      {conv.outcome_reason_id && (
                        <span className="ml-1 text-gray-500">({conv.outcome_reason_id})</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

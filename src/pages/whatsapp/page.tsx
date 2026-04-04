import { useState } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { supabase } from '../../lib/supabase';
import ConversationList    from './components/ConversationList';
import ChatWindow          from './components/ChatWindow';
import CreatorSidebar      from './components/CreatorSidebar';
import NewConversationModal from './components/NewConversationModal';
import CloseConversationModal from './components/CloseConversationModal';
import ConnectModal        from './components/ConnectModal';

export default function WhatsAppPage() {
  const { user, profile, hasPermission } = useAuth();
  const {
    conversations, messages, activeConvId, activeConversation,
    loading, loadingMessages, sending, filter, totalUnread, isAdmin,
    setFilter, selectConversation, sendMessage,
    assignConversation, transferConversation, linkClient, closeConversation, startConversation,
    loadConversations,
  } = useWhatsApp();

  const [showNewConv, setShowNewConv]     = useState(false);
  const [showCloseConv, setShowCloseConv] = useState(false);
  const [showConnect, setShowConnect]     = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Vincular creator existente à conversa
  const [linkSearch, setLinkSearch] = useState('');
  const [linkClients, setLinkClients] = useState<{ id: string; name: string; phone: string }[]>([]);

  const handleLinkSearch = async (q: string) => {
    setLinkSearch(q);
    if (!q.trim()) { setLinkClients([]); return; }
    const { data } = await supabase.from('clients').select('id, name, phone')
      .ilike('name', `%${q}%`).limit(10);
    setLinkClients(data || []);
  };

  const handleSelectLink = async (c: { id: string; name: string }) => {
    if (!activeConvId) return;
    await linkClient(activeConvId, c.id, c.name);
    setShowLinkModal(false);
    setLinkSearch('');
    setLinkClients([]);
    await loadConversations();
  };

  const handleAssignToMe = async () => {
    if (!activeConvId || !profile) return;
    await assignConversation(activeConvId, profile.id, profile.full_name);
  };

  const [allUsers, setAllUsers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const loadAllUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id, full_name, role').eq('is_active', true);
    setAllUsers(data || []);
  };

  const handleTransfer = async (userId: string, userName: string) => {
    if (!activeConvId) return;
    await transferConversation(activeConvId, userId, userName);
    setShowTransferModal(false);
  };

  const handleClose = async (
    outcome: 'won' | 'lost',
    reasonId: string | null,
    funnelId: string | null,
    stageId: string | null,
  ) => {
    if (!activeConvId) return;
    await closeConversation(activeConvId, outcome, reasonId, funnelId, stageId);
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-88px)] -m-5 lg:-m-6 overflow-hidden rounded-xl border border-gray-100 bg-white">

        {/* ── Coluna 1: Lista de conversas ── */}
        <div className="w-96 flex-shrink-0 flex flex-col border-r border-gray-100 overflow-hidden">
          <ConversationList
            conversations={conversations}
            activeConvId={activeConvId}
            filter={filter}
            loading={loading}
            isAdmin={isAdmin}
            onSelect={selectConversation}
            onSetFilter={setFilter}
            onNewConversation={() => setShowNewConv(true)}
          />

          {/* Botão de configuração (admin) */}
          {isAdmin && (
            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowConnect(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                <i className="ri-settings-3-line text-sm"></i>
                Configurar instância
              </button>
            </div>
          )}
        </div>

        {/* ── Coluna 2: Chat ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ChatWindow
            conversation={activeConversation}
            messages={messages}
            loadingMessages={loadingMessages}
            sending={sending}
            currentUserId={user?.id}
            onSend={sendMessage}
            onClose={() => setShowCloseConv(true)}
            onAssignToMe={handleAssignToMe}
            onLinkCreator={() => setShowLinkModal(true)}
            onTransfer={() => { loadAllUsers(); setShowTransferModal(true); }}
            isAdmin={isAdmin}
          />
        </div>

        {/* ── Coluna 3: Info do creator ── */}
        <CreatorSidebar
          conversation={activeConversation}
          onLinkCreator={() => setShowLinkModal(true)}
        />
      </div>

      {/* ── Modais ── */}
      <NewConversationModal
        isOpen={showNewConv}
        onClose={() => setShowNewConv(false)}
        onStart={startConversation}
      />

      <CloseConversationModal
        isOpen={showCloseConv}
        conversation={activeConversation}
        onClose={() => setShowCloseConv(false)}
        onConfirm={handleClose}
      />

      <ConnectModal
        isOpen={showConnect}
        onClose={() => setShowConnect(false)}
      />

      {/* Modal de transferir conversa */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Transferir Conversa</p>
              <button onClick={() => setShowTransferModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {allUsers.filter(u => u.id !== user?.id).map(u => (
                <button key={u.id} onClick={() => handleTransfer(u.id, u.full_name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors text-left">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-user-line text-gray-400 text-sm"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{u.role}</p>
                  </div>
                </button>
              ))}
              {allUsers.length <= 1 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum outro usuário disponível</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de vincular creator */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Vincular Creator</p>
              <button onClick={() => { setShowLinkModal(false); setLinkSearch(''); setLinkClients([]); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input type="text" value={linkSearch} onChange={e => handleLinkSearch(e.target.value)}
                  placeholder="Buscar creator pelo nome..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {linkClients.map(c => (
                  <button key={c.id} onClick={() => handleSelectLink(c)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors text-left">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{c.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-[11px] text-gray-400">{c.phone}</p>
                    </div>
                  </button>
                ))}
                {linkSearch && linkClients.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum creator encontrado</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

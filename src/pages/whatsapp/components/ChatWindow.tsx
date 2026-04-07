import { useState, useRef, useEffect } from 'react';
import { WaConversation, WaMessage } from '../../../hooks/useWhatsApp';
import AudioRecorder from './AudioRecorder';

interface Props {
  conversation: WaConversation | null;
  messages: WaMessage[];
  loadingMessages: boolean;
  sending: boolean;
  currentUserId: string | undefined;
  onSend: (text: string) => Promise<boolean>;
  onSendAudio: (audioBlob: Blob, duration: number) => Promise<boolean>;
  onClose: () => void;
  onAssignToMe: () => void;
  onLinkCreator: () => void;
  onTransfer: () => void;
  isAdmin: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR');
}

export default function ChatWindow({
  conversation, messages, loadingMessages, sending,
  currentUserId, onSend, onSendAudio, onClose, onAssignToMe, onLinkCreator, onTransfer, isAdmin,
}: Props) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll automático ao final
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const msg = text.trim();
    setText('');
    await onSend(msg);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleAudioRecorded = async (blob: Blob, duration: number) => {
    await onSendAudio(blob, duration);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar se é arquivo de áudio
    if (!file.type.startsWith('audio/')) {
      alert('Por favor, selecione um arquivo de áudio válido.');
      return;
    }

    await onSendAudio(file, 0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center p-6">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-whatsapp-line text-3xl text-emerald-400"></i>
        </div>
        <p className="text-sm font-medium text-gray-500">Selecione uma conversa para começar</p>
        <p className="text-xs text-gray-400 mt-1">ou inicie uma nova conversa</p>
      </div>
    );
  }

  // Agrupar mensagens por data
  const groups: { date: string; msgs: WaMessage[] }[] = [];
  messages.forEach(m => {
    const d = new Date(m.created_at).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.msgs.push(m);
    else groups.push({ date: d, msgs: [m] });
  });

  const phoneDisplay = conversation.remote_jid.replace('@s.whatsapp.net', '').replace('@c.us', '');

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header da conversa */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">
            {(conversation.client_name || conversation.push_name || phoneDisplay).charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {conversation.client_name || conversation.push_name || phoneDisplay}
          </p>
          <p className="text-[11px] text-gray-400">{phoneDisplay}</p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!conversation.client_id && (
            <button onClick={onLinkCreator}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#004aad] bg-[#004aad]/5 hover:bg-[#004aad]/10 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
              <i className="ri-user-add-line text-xs"></i>Vincular Creator
            </button>
          )}
          {!conversation.assigned_to && (
            <button onClick={onAssignToMe}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
              <i className="ri-user-received-line text-xs"></i>Assumir
            </button>
          )}
          {conversation.assigned_to && (
            <button onClick={onTransfer}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
              <i className="ri-user-shared-line text-xs"></i>Transferir
            </button>
          )}
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
            conversation.status === 'pending' ? 'text-amber-700 bg-amber-100' :
            conversation.status === 'open'    ? 'text-emerald-700 bg-emerald-100' :
            'text-gray-600 bg-gray-100'
          }`}>
            {conversation.status === 'pending' ? 'Pendente' : conversation.status === 'open' ? 'Aberta' : 'Fechada'}
          </span>
          <button onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
            <i className="ri-close-circle-line text-xs"></i>Encerrar
          </button>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
        style={{ backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundColor: '#f9fafb' }}>
        {loadingMessages ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.date}>
              {/* Separador de data */}
              <div className="flex items-center justify-center my-3">
                <span className="text-[10px] text-gray-500 bg-white/80 px-3 py-1 rounded-full shadow-sm">
                  {formatDate(group.msgs[0].created_at)}
                </span>
              </div>
              {group.msgs.map(msg => {
                const isOut = msg.direction === 'outbound';
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className={`max-w-[72%] px-3 py-2 rounded-2xl shadow-sm ${
                      isOut ? 'bg-emerald-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md'
                    }`}>
                      {msg.message_type !== 'text' && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <i className={`text-sm ${
                            msg.message_type === 'image' ? 'ri-image-line' :
                            msg.message_type === 'audio' ? 'ri-mic-line' :
                            msg.message_type === 'video' ? 'ri-video-line' :
                            'ri-file-line'
                          }`}></i>
                          <span className="text-[11px] capitalize">{msg.message_type}</span>
                        </div>
                      )}
                      {isOut && msg.sent_by_name && (
                        <p className="text-[10px] font-bold mb-1 opacity-80 uppercase tracking-wider">
                          Especialista ({msg.sent_by_name})
                        </p>
                      )}
                      {msg.message_type === 'audio' && msg.media_url ? (
                        <div className="mb-2">
                          <audio controls className="w-full h-8 rounded">
                            <source src={msg.media_url} type="audio/webm" />
                            Seu navegador não suporta o elemento de áudio.
                          </audio>
                          {msg.body && (
                            <p className="text-xs italic mt-1 opacity-75">{msg.body}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] ${isOut ? 'text-emerald-100' : 'text-gray-400'}`}>
                          {formatTime(msg.created_at)}
                        </span>
                        {isOut && (
                          <i className={`text-[10px] ${
                            msg.status === 'read' ? 'ri-check-double-line text-blue-200' :
                            msg.status === 'delivered' ? 'ri-check-double-line text-emerald-200' :
                            msg.status === 'failed' ? 'ri-error-warning-line text-rose-300' :
                            'ri-check-line text-emerald-200'
                          }`}></i>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {conversation.status !== 'closed' && (
        <div className="flex items-end gap-2 px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
          <AudioRecorder onAudioRecorded={handleAudioRecorded} isLoading={sending} />
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex-shrink-0"
            title="Anexar arquivo de áudio"
          >
            <i className="ri-attachment-line text-sm"></i>
          </button>

          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-400 transition-all"
            style={{ maxHeight: '120px' }}
          />
          <button onClick={handleSend} disabled={!text.trim() || sending}
            className="w-9 h-9 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl cursor-pointer transition-colors disabled:opacity-40 flex-shrink-0">
            {sending
              ? <i className="ri-loader-4-line animate-spin text-sm"></i>
              : <i className="ri-send-plane-fill text-sm"></i>}
          </button>
        </div>
      )}
    </div>
  );
}

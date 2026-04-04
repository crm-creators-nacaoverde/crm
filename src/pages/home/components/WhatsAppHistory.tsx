import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WhatsAppHistoryProps {
  clientId: string;
}

interface WhatsAppMessage {
  id: string;
  remote_jid: string;
  from_me: boolean;
  message_type: string;
  message_text?: string;
  message_media_url?: string;
  created_at: string;
}

const WhatsAppHistory = ({ clientId }: WhatsAppHistoryProps) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      // Primeiro, obter o número de telefone do cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('phone')
        .eq('id', clientId)
        .single();

      if (clientError || !clientData?.phone) {
        console.error('Erro ao buscar telefone do cliente:', clientError?.message);
        setLoading(false);
        return;
      }

      let phoneNumber = clientData.phone.replace(/\D/g, '');
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }
      const remoteJid = phoneNumber + '@s.whatsapp.net';

      // Em seguida, buscar as mensagens
      const { data, error } = await supabase
        .from('wa_messages')
        .select('*')
        .eq('remote_jid', remoteJid)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao carregar mensagens do WhatsApp:', error.message);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMessages();
  }, [clientId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <i className="ri-loader-4-line animate-spin text-2xl mr-2"></i> Carregando histórico...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <i className="ri-chat-off-line text-2xl mr-2"></i> Nenhum histórico de conversa encontrado para este creator.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] bg-gray-50 rounded-xl p-4 overflow-y-auto custom-scrollbar">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex mb-4 ${msg.from_me ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] p-3 rounded-lg shadow-sm ${msg.from_me
              ? 'bg-[#DCF8C6] text-gray-800' // Mensagens enviadas por mim (verde claro)
              : 'bg-white text-gray-800' // Mensagens recebidas (branco)
            }`}
          >
            {msg.message_text && <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>}
            {msg.message_media_url && (
              <a href={msg.message_media_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                <i className="ri-image-line"></i> Visualizar Mídia
              </a>
            )}
            <p className="text-xs text-gray-500 mt-1 text-right">
              {format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </p>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default WhatsAppHistory;

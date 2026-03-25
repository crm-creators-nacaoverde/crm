import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { WaConversation } from '../../../hooks/useWhatsApp';
import { useNavigate } from 'react-router-dom';

interface Props {
  conversation: WaConversation | null;
  onLinkCreator: () => void;
}

interface ClientInfo {
  id: string;
  name: string;
  phone: string;
  platform: string;
  category: string;
  capture_source: string | null;
  gmv_geral: number;
  chave_pix: string | null;
  created_at: string;
}

interface RecentInteraction {
  id: string;
  type: string;
  title: string;
  date: string;
}

export default function CreatorSidebar({ conversation, onLinkCreator }: Props) {
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [interactions, setInteractions] = useState<RecentInteraction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversation?.client_id) { setClient(null); setInteractions([]); return; }
    setLoading(true);
    Promise.all([
      supabase.from('clients').select('id,name,phone,platform,category,capture_source,gmv_geral,chave_pix,created_at')
        .eq('id', conversation.client_id).single(),
      supabase.from('interactions').select('id,type,title,date')
        .eq('client_id', conversation.client_id).order('date', { ascending: false }).limit(5),
    ]).then(([clientRes, intRes]) => {
      setClient(clientRes.data);
      setInteractions(intRes.data || []);
      setLoading(false);
    });
  }, [conversation?.client_id]);

  const fmtMoney = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtDate  = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  if (!conversation) return null;

  return (
    <div className="w-64 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-y-auto">
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Creator</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : client ? (
        <div className="p-4 space-y-4">
          {/* Avatar + nome */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-2xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">{client.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{client.name}</p>
              <p className="text-[11px] text-gray-400">{client.phone}</p>
            </div>
            <button onClick={() => navigate(`/creators?id=${client.id}`)}
              className="flex items-center gap-1 text-[11px] text-[#004aad] hover:underline cursor-pointer">
              <i className="ri-external-link-line text-xs"></i>Ver perfil completo
            </button>
          </div>

          {/* Info */}
          <div className="space-y-2 bg-gray-50 rounded-xl p-3">
            {[
              { label: 'Plataforma', value: client.platform },
              { label: 'Categoria', value: client.category },
              { label: 'GMV Total', value: fmtMoney(client.gmv_geral) },
              { label: 'Cadastrado em', value: fmtDate(client.created_at) },
              ...(client.chave_pix ? [{ label: 'PIX', value: client.chave_pix }] : []),
              ...(client.capture_source ? [{ label: 'Origem', value: client.capture_source }] : []),
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] text-gray-400">{item.label}</p>
                <p className="text-xs font-medium text-gray-700 truncate">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Interações recentes */}
          {interactions.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Interações recentes</p>
              <div className="space-y-1.5">
                {interactions.map(i => (
                  <div key={i.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                    <i className="ri-chat-1-line text-xs text-gray-400 mt-0.5 flex-shrink-0"></i>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{i.title}</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(i.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Sem creator vinculado */
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
            <i className="ri-user-question-line text-2xl text-gray-300"></i>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Número não vinculado</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Este contato não está cadastrado como creator</p>
          </div>
          <button onClick={onLinkCreator}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors">
            <i className="ri-user-add-line text-xs"></i>Vincular Creator
          </button>
        </div>
      )}
    </div>
  );
}

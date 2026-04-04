import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { WaConversation } from '../../../hooks/useWhatsApp';
import { useNavigate } from 'react-router-dom';
import { useFunnels } from '../../../hooks/useFunnels';
import { useFunnelStages } from '../../../hooks/useFunnelStages';
import KanbanDealModal from '../../home/components/KanbanDealModal';

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
  notes: string | null;
  created_at: string;
}

interface RecentInteraction {
  id: string;
  type: string;
  title: string;
  date: string;
}

interface ActiveDeal {
  id: string;
  title: string;
  stage: string;
  funnel_id: string;
}

type TabType = 'perfil' | 'anotacoes' | 'resultados' | 'tarefas';

export default function CreatorSidebar({ conversation, onLinkCreator }: Props) {
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [interactions, setInteractions] = useState<RecentInteraction[]>([]);
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('perfil');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  
  // Estado para o modal de criação de deal
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  const { funnels, selectedFunnelId } = useFunnels();
  const { stages } = useFunnelStages(activeDeal?.funnel_id || selectedFunnelId);

  const loadData = async () => {
    if (!conversation?.client_id) { 
      setClient(null); 
      setInteractions([]); 
      setActiveDeal(null);
      return; 
    }
    setLoading(true);
    try {
      const [clientRes, intRes, dealRes, usersRes] = await Promise.all([
        supabase.from('clients').select('id,name,phone,platform,category,capture_source,gmv_geral,chave_pix,notes,created_at')
          .eq('id', conversation.client_id).single(),
        supabase.from('interactions').select('id,type,title,date')
          .eq('client_id', conversation.client_id).order('date', { ascending: false }).limit(5),
        supabase.from('deals').select('id,title,stage,funnel_id')
          .eq('client_id', conversation.client_id)
          .not('stage', 'in', '("won","lost")')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('user_profiles').select('id, full_name').eq('is_active', true).order('full_name')
      ]);

      setClient(clientRes.data);
      setNoteText(clientRes.data?.notes || '');
      setInteractions(intRes.data || []);
      setActiveDeal(dealRes.data);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados da sidebar:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [conversation?.client_id]);

  const handleSaveNote = async () => {
    if (!client) return;
    setSavingNote(true);
    try {
      await supabase.from('clients').update({ notes: noteText }).eq('id', client.id);
      setClient(prev => prev ? { ...prev, notes: noteText } : null);
    } catch (error) {
      console.error('Erro ao salvar anotação:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateStage = async (newStage: string) => {
    if (!activeDeal) return;
    setUpdatingStage(true);
    try {
      const { error } = await supabase
        .from('deals')
        .update({ 
          stage: newStage,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeDeal.id);
      
      if (error) throw error;
      setActiveDeal(prev => prev ? { ...prev, stage: newStage } : null);
    } catch (error) {
      console.error('Erro ao atualizar estágio:', error);
    } finally {
      setUpdatingStage(false);
    }
  };

  const fmtMoney = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtDate  = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  if (!conversation) return null;

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'perfil', label: 'Perfil', icon: 'ri-user-line' },
    { id: 'anotacoes', label: 'Anotações', icon: 'ri-sticky-note-line' },
    { id: 'resultados', label: 'Resultados', icon: 'ri-bar-chart-line' },
    { id: 'tarefas', label: 'Tarefas', icon: 'ri-checkbox-line' },
  ];

  return (
    <div className="w-96 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Creator</p>
        {client && (
          <button 
            onClick={() => {
              if (activeDeal) {
                navigate(`/?section=kanban&funnelId=${activeDeal.funnel_id}&dealId=${activeDeal.id}`);
              } else {
                navigate(`/creators?id=${client.id}`);
              }
            }}
            title={activeDeal ? "Ver no Kanban" : "Ver Perfil"}
            className="p-1.5 text-gray-400 hover:text-[#004aad] hover:bg-gray-50 rounded-lg transition-colors">
            <i className="ri-external-link-line text-sm"></i>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : client ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Perfil Resumido */}
          <div className="p-5 flex flex-col items-center text-center border-b border-gray-50">
            <div className="w-16 h-16 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-2xl flex items-center justify-center shadow-sm mb-3">
              <span className="text-white font-bold text-xl">{client.name.charAt(0).toUpperCase()}</span>
            </div>
            <h3 className="text-sm font-bold text-gray-900">{client.name}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{client.phone}</p>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-gray-100 px-2 bg-gray-50/50">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-2.5 gap-1 transition-all relative ${
                  activeTab === tab.id ? 'text-[#004aad]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <i className={`${tab.icon} text-sm`}></i>
                <span className="text-[9px] font-bold uppercase tracking-tighter">{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#004aad] rounded-full mx-2"></div>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'perfil' && (
              <div className="space-y-4">
                {/* Funil de Acompanhamento */}
                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/50">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="ri-git-merge-line text-xs text-emerald-600"></i>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Funil de Acompanhamento</p>
                  </div>
                  
                  {activeDeal ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-emerald-600 font-medium">
                          {funnels.find(f => f.id === activeDeal.funnel_id)?.name || 'Funil'}
                        </p>
                        {updatingStage && <i className="ri-loader-4-line animate-spin text-emerald-600 text-xs"></i>}
                      </div>
                      <select
                        value={activeDeal.stage}
                        onChange={(e) => handleUpdateStage(e.target.value)}
                        disabled={updatingStage}
                        className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      >
                        {stages.map(stage => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="py-1">
                      <p className="text-[10px] text-gray-500 italic">Nenhum acompanhamento ativo para este creator.</p>
                      <button 
                        onClick={() => setIsDealModalOpen(true)}
                        className="mt-2 text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <i className="ri-add-circle-line"></i> Criar no Kanban
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Plataforma', value: client.platform, icon: 'ri-global-line' },
                    { label: 'Categoria', value: client.category, icon: 'ri-price-tag-3-line' },
                    { label: 'GMV Total', value: fmtMoney(client.gmv_geral), icon: 'ri-money-dollar-circle-line' },
                    { label: 'Cadastrado em', value: fmtDate(client.created_at), icon: 'ri-calendar-line' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100/50">
                      <div className="flex items-center gap-2 mb-1">
                        <i className={`${item.icon} text-xs text-gray-400`}></i>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{item.label}</p>
                      </div>
                      <p className="text-xs font-semibold text-gray-700">{item.value || 'Não informado'}</p>
                    </div>
                  ))}
                </div>

                {interactions.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Interações Recentes</p>
                    <div className="space-y-2">
                      {interactions.map(i => (
                        <div key={i.id} className="flex items-start gap-3 p-2.5 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <div className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="ri-chat-1-line text-xs text-brand-600"></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-gray-800 truncate leading-tight">{i.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(i.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'anotacoes' && (
              <div className="h-full flex flex-col gap-3">
                <div className="flex-1">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Escreva anotações importantes sobre este creator..."
                    className="w-full h-full min-h-[200px] p-3 text-xs border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6] resize-none bg-gray-50/30"
                  />
                </div>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || noteText === (client.notes || '')}
                  className="w-full py-2.5 bg-[#004aad] hover:bg-[#003d91] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  {savingNote ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className="ri-save-line"></i>
                  )}
                  Salvar Anotação
                </button>
              </div>
            )}

            {activeTab === 'resultados' && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                  <i className="ri-bar-chart-box-line text-2xl text-blue-400"></i>
                </div>
                <p className="text-xs font-bold text-gray-900">Métricas de Performance</p>
                <p className="text-[10px] text-gray-400 mt-1">Dados detalhados de vendas e engajamento estarão disponíveis em breve.</p>
              </div>
            )}

            {activeTab === 'tarefas' && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                  <i className="ri-todo-line text-2xl text-amber-400"></i>
                </div>
                <p className="text-xs font-bold text-gray-900">Tarefas Pendentes</p>
                <p className="text-[10px] text-gray-400 mt-1">Gerencie lembretes e ações para este creator nesta aba.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center gap-4">
          <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center">
            <i className="ri-user-search-line text-3xl text-gray-200"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Número não vinculado</p>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Este contato ainda não possui um perfil de creator associado no CRM.</p>
          </div>
          <button onClick={onLinkCreator}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-all shadow-sm">
            <i className="ri-user-add-line text-sm"></i>Vincular Creator
          </button>
        </div>
      )}

      {/* Modal de Criação de Deal */}
      {isDealModalOpen && client && (
        <KanbanDealModal
          isOpen={isDealModalOpen}
          onClose={() => setIsDealModalOpen(false)}
          deal={null}
          clients={[{ id: client.id, name: client.name }]}
          users={users}
          stages={stages}
          onSave={() => {}} // O modal já salva no banco internamente
          onClientsUpdated={loadData}
          currentFunnelId={selectedFunnelId || ''}
        />
      )}
    </div>
  );
}

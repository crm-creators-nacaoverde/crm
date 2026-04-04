import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/feature/AppLayout';
import Modal from '../../components/base/Modal';
import Button from '../../components/base/Button';

interface UnifiedActivity {
  id: string;
  type: 'system' | 'communication';
  action: string;
  module: string;
  title: string;
  description?: string;
  user_name: string;
  user_id: string;
  entity_name?: string;
  entity_id?: string;
  date: string;
  details?: any;
  config: {
    icon: string;
    color: string;
    bg: string;
    text: string;
    label: string;
  };
}

const LogsPage = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<UnifiedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterView, setFilterView] = useState<'all' | 'system' | 'communication'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<UnifiedActivity | null>(null);
  
  const moduleLabels: Record<string, string> = {
    creators: 'Creators',
    deals: 'Acompanhamento',
    interactions: 'Interações',
    forms: 'Formulários',
    users: 'Usuários',
    settings: 'Configurações',
    funnels: 'Funis',
    logistics: 'Logística',
    tasks: 'Tarefas',
    financeiro: 'Financeiro',
    metrics: 'Métricas',
    imports: 'Importações',
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, interactionsRes] = await Promise.all([
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('interactions').select('*, clients(*)').order('date', { ascending: false }).limit(500)
      ]);

      if (logsRes.error) throw logsRes.error;
      if (interactionsRes.error) throw interactionsRes.error;

      // Formatar Logs do Sistema
      const systemActivities: UnifiedActivity[] = (logsRes.data || []).map(log => ({
        id: log.id,
        type: 'system',
        action: log.action,
        module: log.module,
        title: getActionLabel(log.action, log.module),
        description: log.entity_name ? `Alteração em: ${log.entity_name}` : undefined,
        user_name: log.user_name,
        user_id: log.user_id,
        entity_name: log.entity_name,
        entity_id: log.entity_id,
        date: log.created_at,
        details: log.details,
        config: getSystemConfig(log.action, log.module)
      }));

      // Formatar Interações (Comunicações)
      const communicationActivities: UnifiedActivity[] = (interactionsRes.data || []).map(inter => ({
        id: inter.id,
        type: 'communication',
        action: 'interaction',
        module: 'interactions',
        title: inter.title,
        description: inter.description,
        user_name: inter.clients?.name || 'Creator',
        user_id: inter.client_id,
        entity_name: inter.clients?.name,
        entity_id: inter.client_id,
        date: inter.date,
        details: inter,
        config: getCommunicationConfig(inter.type)
      }));

      // Unificar e Ordenar
      const unified = [...systemActivities, ...communicationActivities].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setActivities(unified);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string, module: string) => {
    const labels: any = { create: 'Criação', update: 'Edição', delete: 'Exclusão' };
    return `${labels[action] || action} em ${moduleLabels[module] || module}`;
  };

  const getSystemConfig = (action: string, module: string) => {
    const configs: any = {
      create: { icon: 'ri-add-circle-line', color: '#10b981', bg: 'bg-green-50', text: 'text-green-600', label: 'Sistema' },
      update: { icon: 'ri-edit-line', color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600', label: 'Sistema' },
      delete: { icon: 'ri-delete-bin-line', color: '#ef4444', bg: 'bg-red-50', text: 'text-red-600', label: 'Sistema' },
    };
    return configs[action] || { icon: 'ri-settings-3-line', color: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-600', label: 'Sistema' };
  };

  const getCommunicationConfig = (type: string) => {
    const configs: any = {
      meeting:  { icon: 'ri-calendar-event-line', color: '#0891b2', bg: 'bg-sky-50',    text: 'text-sky-600',    label: 'Comunicação' },
      email:    { icon: 'ri-mail-line',            color: '#7c3aed', bg: 'bg-violet-50', text: 'text-violet-600', label: 'Comunicação' },
      call:     { icon: 'ri-phone-line',           color: '#059669', bg: 'bg-emerald-50',text: 'text-emerald-600',label: 'Comunicação' },
      whatsapp: { icon: 'ri-whatsapp-line',        color: '#25d366', bg: 'bg-green-50',  text: 'text-green-600',  label: 'Comunicação' },
    };
    return configs[type] || { icon: 'ri-chat-1-line', color: '#374151', bg: 'bg-gray-50', text: 'text-gray-600', label: 'Comunicação' };
  };

  const filteredActivities = activities.filter(act => {
    const matchesView = filterView === 'all' || act.type === filterView;
    const matchesSearch = 
      act.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (act.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesView && matchesSearch;
  });

  const stats = {
    total: activities.length,
    system: activities.filter(a => a.type === 'system').length,
    comm: activities.filter(a => a.type === 'communication').length,
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50/50 pb-20">
        <div className="max-w-5xl mx-auto p-6 space-y-8">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">CENTRAL 360º</h1>
              <p className="text-sm font-medium text-gray-500 mt-1 uppercase tracking-widest">Visão Unificada de Atividades e Comunicações</p>
            </div>
            <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
              <button 
                onClick={() => setFilterView('all')}
                className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all ${filterView === 'all' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                TUDO
              </button>
              <button 
                onClick={() => setFilterView('system')}
                className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all ${filterView === 'system' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                SISTEMA
              </button>
              <button 
                onClick={() => setFilterView('communication')}
                className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all ${filterView === 'communication' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                CONTATOS
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total de Eventos</p>
              <p className="text-3xl font-black text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Ações do Sistema</p>
              <p className="text-3xl font-black text-blue-600">{stats.system}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Comunicações</p>
              <p className="text-3xl font-black text-emerald-600">{stats.comm}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <i className="ri-search-2-line absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl transition-colors group-focus-within:text-brand-500"></i>
            <input 
              type="text" 
              placeholder="Pesquisar na timeline (usuário, creator, ação ou conteúdo)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-5 bg-white border border-gray-100 rounded-3xl shadow-sm focus:ring-4 focus:ring-brand-500/5 focus:border-brand-500 outline-none text-base font-medium transition-all"
            />
          </div>

          {/* Timeline */}
          <div className="relative space-y-4">
            {/* Vertical Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-100 hidden sm:block"></div>

            {filteredActivities.map((act) => (
              <div key={act.id} className="relative pl-0 sm:pl-20 group">
                {/* Timeline Icon */}
                <div 
                  className={`absolute left-4 top-6 w-9 h-9 rounded-2xl border-4 border-white shadow-md z-10 hidden sm:flex items-center justify-center transition-transform group-hover:scale-110 ${act.config.bg} ${act.config.text}`}
                >
                  <i className={`${act.config.icon} text-lg`}></i>
                </div>

                <div 
                  onClick={() => setSelectedActivity(act)}
                  className="bg-white rounded-3xl border border-gray-100 p-6 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/5 transition-all cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter rounded-md ${act.type === 'system' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {act.type === 'system' ? 'SISTEMA' : 'CONTATO'}
                          </span>
                          <h3 className="text-base font-bold text-gray-900 truncate">{act.title}</h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1.5 text-gray-600 font-semibold">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">
                              <i className="ri-user-line"></i>
                            </div>
                            {act.user_name}
                          </div>
                          {act.entity_name && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                              <div className="flex items-center gap-1.5 text-brand-600 font-bold">
                                <i className="ri-focus-3-line"></i>
                                {act.entity_name}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-900">{new Date(act.date).toLocaleDateString('pt-BR')}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(act.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors">
                        <i className="ri-arrow-right-s-line text-xl"></i>
                      </div>
                    </div>
                  </div>

                  {act.description && (
                    <div className="mt-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 italic">
                        "{act.description}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredActivities.length === 0 && !loading && (
              <div className="bg-white rounded-[40px] border border-dashed border-gray-200 text-center py-32">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-radar-line text-5xl text-gray-200 animate-pulse"></i>
                </div>
                <h3 className="text-xl font-black text-gray-900">Nenhum sinal encontrado</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto font-medium">Não há registros que correspondam aos seus filtros atuais na timeline.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        title="Detalhes do Evento"
        width="max-w-2xl"
      >
        {selectedActivity && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${selectedActivity.config.bg} ${selectedActivity.config.text}`}>
                <i className={selectedActivity.config.icon}></i>
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">{selectedActivity.title}</h2>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{selectedActivity.config.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Responsável / Creator</p>
                <p className="text-sm font-bold text-gray-900">{selectedActivity.user_name}</p>
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Data e Hora</p>
                <p className="text-sm font-bold text-gray-900">
                  {new Date(selectedActivity.date).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            {selectedActivity.description && (
              <div className="p-6 bg-white border border-gray-100 rounded-3xl">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-3">Conteúdo / Descrição</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedActivity.description}
                </p>
              </div>
            )}

            {selectedActivity.details && (
              <div className="p-6 bg-gray-900 rounded-3xl overflow-hidden">
                <p className="text-[10px] font-black text-gray-500 uppercase mb-4">Dados Técnicos (JSON)</p>
                <pre className="text-[11px] text-emerald-400 font-mono overflow-x-auto custom-scrollbar">
                  {JSON.stringify(selectedActivity.details, null, 2)}
                </pre>
              </div>
            )}

            <Button onClick={() => setSelectedActivity(null)} fullWidth className="!py-4 !rounded-2xl shadow-xl">
              Fechar Visualização
            </Button>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
};

export default LogsPage;

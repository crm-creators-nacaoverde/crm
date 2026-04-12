import { useState, useEffect } from 'react';
import { supabase, Interaction, Client, UserProfile } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import { useClientHistory, historyEvent } from '../../../hooks/useClientHistory';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';
import InteractionsFilterBar from './InteractionsFilterBar';

export default function InteractionsSection() {
  const [interactions, setInteractions] = useState<(Interaction & { client?: Client })[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // Mantém para compatibilidade
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { user, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();
  const { logClientEvent } = useClientHistory();
  const [interactionTypes, setInteractionTypes] = useState<{ id: string; name: string; icon: string; color: string }[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    responsible: '',
    creator: '',
    type: 'all',
    searchTerm: '',
  });

  const [formData, setFormData] = useState({
    client_id: '',
    type: '' as string,
    title: '',
    description: '',
    date: ''
  });

  const canEdit = hasPermission('interactions', 'edit');
  const canDelete = hasPermission('interactions', 'delete');

  useEffect(() => {
    loadData();
    loadUsers();
    supabase.from('interaction_types').select('id, name, icon, color')
      .eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data && data.length > 0) setInteractionTypes(data); });
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadData = async () => {
    try {
      const [interactionsRes, clientsRes] = await Promise.all([
        supabase.from('interactions').select('*, clients(*)').order('date', { ascending: false }),
        supabase.from('clients').select('*').eq('status', 'active').order('name')
      ]);
      if (interactionsRes.error) throw interactionsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      const interactionsWithClients = (interactionsRes.data || []).map((interaction: any) => ({
        ...interaction,
        client: interaction.clients
      }));
      setInteractions(interactionsWithClients);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInteractions = interactions.filter(interaction => {
    const clientName = interaction.client?.name || '';
    const interactionDate = new Date(interaction.date);
    
    // Search filter
    const matchesSearch = clientName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                         interaction.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                         (interaction.description || '').toLowerCase().includes(filters.searchTerm.toLowerCase());
    
    // Type filter
    const matchesType = filters.type === 'all' || interaction.type === filters.type;
    
    // Creator filter
    const matchesCreator = !filters.creator || interaction.client_id === filters.creator;
    
    // Responsible filter (created_by)
    const matchesResponsible = !filters.responsible || interaction.created_by === filters.responsible;
    
    // Date range filter
    let matchesDateRange = true;
    if (filters.dateRange.start || filters.dateRange.end) {
      const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
      const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
      
      if (startDate && interactionDate < startDate) matchesDateRange = false;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (interactionDate > endOfDay) matchesDateRange = false;
      }
    }
    
    return matchesSearch && matchesType && matchesCreator && matchesResponsible && matchesDateRange;
  });

  const handleAddInteraction = () => {
    setSelectedInteraction(null);
    setFormData({ client_id: '', type: interactionTypes[0]?.name || 'other', title: '', description: '', date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
    setFilters({ ...filters, searchTerm: '' });
  };

  const handleViewInteraction = (interaction: Interaction) => {
    setSelectedInteraction(interaction);
    setFormData({
      client_id: interaction.client_id,
      type: interaction.type,
      title: interaction.title,
      description: interaction.description || '',
      date: interaction.date.split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleDeleteInteraction = async (id: string) => {
    try {
      const interactionToDelete = interactions.find(i => i.id === id);
      const { error } = await supabase.from('interactions').delete().eq('id', id);
      if (error) throw error;
      
      if (interactionToDelete) {
        await logActivity({
          action: 'delete',
          module: 'interactions',
          entityId: id,
          entityName: interactionToDelete.title,
          details: { deletedData: interactionToDelete }
        });
        
        if (interactionToDelete.client_id) {
          await logClientEvent({
            client_id: interactionToDelete.client_id,
            ...historyEvent.exclusaoDado('Interacao', interactionToDelete.title)
          });
        }
      }
      
      await loadData();
      setDeleteConfirm(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao excluir interação:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const interactionData = {
        client_id: formData.client_id,
        type: formData.type,
        title: formData.title,
        description: formData.description,
        date: new Date(formData.date).toISOString(),
        created_by: user?.id,
        updated_at: new Date().toISOString()
      };

      if (selectedInteraction) {
        const { error } = await supabase.from('interactions').update(interactionData).eq('id', selectedInteraction.id);
        if (error) throw error;
        
        await logActivity({
          action: 'update',
          module: 'interactions',
          entityId: selectedInteraction.id,
          entityName: formData.title,
          details: { before: selectedInteraction, after: interactionData }
        });
        
        if (formData.client_id) {
          await logClientEvent({
            client_id: formData.client_id,
            ...historyEvent.interacaoRegistrada(formData.type, formData.title)
          });
        }
      } else {
        const { data: newInteraction, error } = await supabase.from('interactions').insert([interactionData]).select().single();
        if (error) throw error;
        
        await logActivity({
          action: 'create',
          module: 'interactions',
          entityId: newInteraction.id,
          entityName: formData.title,
          details: { data: interactionData }
        });
        
        if (formData.client_id) {
          await logClientEvent({
            client_id: formData.client_id,
            ...historyEvent.interacaoRegistrada(formData.type, formData.title)
          });
        }
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar interação:', error);
    }
  };

  const getTypeConfig = (type: string) => {
    const found = interactionTypes.find(t => t.name === type || t.id === type);
    if (found) {
      return { icon: found.icon, bg: `bg-gray-50`, text: `text-gray-700`, label: found.name, color: found.color };
    }
    const fallback: Record<string, { icon: string; bg: string; text: string; label: string; color: string }> = {
      meeting:  { icon: 'ri-calendar-event-line', bg: 'bg-sky-50',    text: 'text-sky-600',    label: 'Reunião',   color: '#0891b2' },
      email:    { icon: 'ri-mail-line',            bg: 'bg-violet-50', text: 'text-violet-600', label: 'Email',     color: '#7c3aed' },
      call:     { icon: 'ri-phone-line',           bg: 'bg-emerald-50',text: 'text-emerald-600',label: 'Ligação',   color: '#059669' },
      whatsapp: { icon: 'ri-whatsapp-line',        bg: 'bg-green-50',  text: 'text-green-600',  label: 'WhatsApp',  color: '#059669' },
      other:    { icon: 'ri-chat-1-line',          bg: 'bg-gray-50',   text: 'text-gray-600',   label: 'Outro',     color: '#374151' },
    };
    return fallback[type] || fallback.other;
  };

  const totalByType = interactions.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Interações</h1>
          <p className="text-sm text-gray-500 mt-1">Acompanhe todas as comunicações e eventos registrados no CRM.</p>
        </div>
        {canEdit && (
          <Button onClick={handleAddInteraction} size="lg" className="shadow-lg shadow-brand-500/20">
            <i className="ri-add-line mr-2"></i>
            Nova Interação
          </Button>
        )}
      </div>

      {/* Stats Cards - Interactive */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button 
          onClick={() => setFilters({ ...filters, type: 'all' })}
          className={`bg-white rounded-2xl border p-5 flex flex-col items-start gap-3 transition-all text-left group ${filters.type === 'all' ? 'border-brand-500 ring-4 ring-brand-500/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${filters.type === 'all' ? 'bg-brand-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
            <i className="ri-message-3-line text-xl"></i>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{interactions.length}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</p>
          </div>
        </button>

        {['meeting', 'email', 'call', 'whatsapp'].map(type => {
          const cfg = getTypeConfig(type);
          const isActive = filters.type === type;
          return (
            <button 
              key={type}
              onClick={() => setFilters({ ...filters, type })}
              className={`bg-white rounded-2xl border p-5 flex flex-col items-start gap-3 transition-all text-left group ${isActive ? 'border-brand-500 ring-4 ring-brand-500/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'text-white' : `${cfg.text} ${cfg.bg} group-hover:opacity-80`}`} style={isActive ? { backgroundColor: cfg.color } : {}}>
                <i className={`${cfg.icon} text-xl`}></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalByType[type] || 0}</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{cfg.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Advanced Filter Bar */}
      <InteractionsFilterBar
        filters={filters}
        onFilterChange={setFilters}
        clients={clients}
        users={users}
        interactionTypes={interactionTypes}
      />

      {/* Timeline List */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-100 hidden sm:block"></div>

        <div className="space-y-6">
          {filteredInteractions.map((interaction, index) => {
            const cfg = getTypeConfig(interaction.type);
            const date = new Date(interaction.date);
            
            return (
              <div key={interaction.id} className="relative pl-0 sm:pl-14 group">
                {/* Timeline Dot */}
                <div className="absolute left-4 top-5 w-4 h-4 rounded-full border-4 border-white shadow-sm z-10 hidden sm:block transition-transform group-hover:scale-125" style={{ backgroundColor: cfg.color }}></div>
                
                <div 
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/5 transition-all cursor-pointer"
                  onClick={() => handleViewInteraction(interaction)}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl ${cfg.bg} ${cfg.text}`}>
                        <i className={`${cfg.icon} text-2xl`}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900 truncate">{interaction.title}</h3>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <i className="ri-user-star-line text-brand-500"></i>
                          <span className="font-medium text-gray-700">{interaction.client?.name || 'Creator não identificado'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                      <div className="flex items-center gap-2 text-gray-400">
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                          <i className="ri-calendar-line text-xs"></i>
                          <span className="text-xs font-semibold">{date.toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                          <i className="ri-time-line text-xs"></i>
                          <span className="text-xs font-semibold">{date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(interaction.id); }}
                          className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  {interaction.description && (
                    <div className="mt-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100/50">
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-3">
                        {interaction.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredInteractions.length === 0 && (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 text-center py-24">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-chat-history-line text-4xl text-gray-200"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Nenhuma interação encontrada</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">Tente ajustar seus filtros ou faça uma nova busca para encontrar o que procura.</p>
            <Button variant="outline" onClick={() => { setFilterType('all'); setSearchTerm(''); }} className="mt-6">
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>

      {/* Modals and Confirmation (Keep existing logic but improve UI) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedInteraction ? 'Detalhes da Interação' : 'Nova Interação'}
        width="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Creator / Cliente</label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 bg-gray-50/50 transition-all"
                required
                disabled={!!selectedInteraction}
              >
                <option value="">Selecione um creator</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Contato</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 bg-gray-50/50 transition-all"
                  disabled={!!selectedInteraction}
                >
                  {interactionTypes.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Data do Evento</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  disabled={!!selectedInteraction}
                  className="!py-3 !rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Título / Assunto</label>
              <Input
                type="text"
                placeholder="Ex: Reunião de alinhamento, Envio de contrato..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                disabled={!!selectedInteraction}
                className="!py-3 !rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Notas e Observações</label>
              <textarea
                placeholder="Descreva o que foi conversado ou o resultado desta interação..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 bg-gray-50/50 transition-all resize-none"
                disabled={!!selectedInteraction}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-100">
            {selectedInteraction && canDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(selectedInteraction.id)}
                className="px-5 py-3 text-sm font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all"
              >
                <i className="ri-delete-bin-line mr-2"></i>
                Excluir
              </button>
            )}
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 !py-3 !rounded-xl">
              {selectedInteraction ? 'Fechar' : 'Cancelar'}
            </Button>
            {!selectedInteraction && (
              <Button type="submit" className="flex-1 !py-3 !rounded-xl shadow-lg shadow-brand-500/20">
                Salvar Interação
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <i className="ri-delete-bin-line text-3xl text-rose-500"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Excluir Interação?</h3>
            <p className="text-sm text-gray-500 text-center mb-8">Esta ação é permanente e removerá este registro do histórico do creator.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteInteraction(deleteConfirm)}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase, Interaction, Client } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';

export default function InteractionsSection() {
  const [interactions, setInteractions] = useState<(Interaction & { client?: Client })[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { user, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();
  const [interactionTypes, setInteractionTypes] = useState<{ id: string; name: string; icon: string; color: string }[]>([]);

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
    supabase.from('interaction_types').select('id, name, icon, color')
      .eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data && data.length > 0) setInteractionTypes(data); });
  }, []);

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
    const matchesSearch = clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         interaction.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || interaction.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleAddInteraction = () => {
    setSelectedInteraction(null);
    setFormData({ client_id: '', type: interactionTypes[0]?.name || '', title: '', description: '', date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
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
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar interação:', error);
    }
  };

  const getTypeConfig = (type: string) => {
    // Buscar nos tipos dinâmicos do banco
    const found = interactionTypes.find(t => t.name === type || t.id === type);
    if (found) {
      return { icon: found.icon, bg: `bg-gray-50`, text: `text-gray-700`, label: found.name, color: found.color };
    }
    // Fallback para tipos legados
    const fallback: Record<string, { icon: string; bg: string; text: string; label: string; color: string }> = {
      meeting:  { icon: 'ri-calendar-event-line', bg: 'bg-sky-50',    text: 'text-sky-600',    label: 'Reunião',   color: '#0891b2' },
      email:    { icon: 'ri-mail-line',            bg: 'bg-violet-50', text: 'text-violet-600', label: 'Email',     color: '#7c3aed' },
      call:     { icon: 'ri-phone-line',           bg: 'bg-emerald-50',text: 'text-emerald-600',label: 'Ligação',   color: '#059669' },
      whatsapp: { icon: 'ri-whatsapp-line',        bg: 'bg-green-50',  text: 'text-green-600',  label: 'WhatsApp',  color: '#059669' },
      other:    { icon: 'ri-chat-1-line',          bg: 'bg-gray-50',   text: 'text-gray-600',   label: 'Outro',     color: '#374151' },
    };
    return fallback[type] || fallback.other;
  };

  const typeFilters = [
    { value: 'all', label: 'Todos' },
    ...interactionTypes.map(t => ({ value: t.name, label: t.name })),
  ];

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
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
            <i className="ri-message-3-line text-brand-600 text-base"></i>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{interactions.length}</p>
            <p className="text-[11px] text-gray-400">Total</p>
          </div>
        </div>
        {['meeting', 'email', 'call', 'whatsapp'].map(type => {
          const cfg = getTypeConfig(type);
          return (
            <div key={type} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 ${cfg.bg} rounded-lg flex items-center justify-center`}>
                <i className={`${cfg.icon} ${cfg.text} text-base`}></i>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{totalByType[type] || 0}</p>
                <p className="text-[11px] text-gray-400">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Buscar por cliente ou título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-gray-50/50"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {typeFilters.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilterType(type.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer transition-all ${
                    filterType === type.value
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            {canEdit && (
              <Button onClick={handleAddInteraction} size="md">
                <i className="ri-add-line text-sm"></i>
                <span className="hidden sm:inline">Nova</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filteredInteractions.map((interaction) => {
          const cfg = getTypeConfig(interaction.type);
          return (
            <div
              key={interaction.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => handleViewInteraction(interaction)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${cfg.bg} ${cfg.text}`}>
                  <i className={`${cfg.icon} text-lg`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900">{interaction.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{interaction.client?.name || 'Cliente não encontrado'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-gray-700">
                          {new Date(interaction.date).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(interaction.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(interaction.id); }}
                          className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Excluir"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  {interaction.description && (
                    <p className="text-xs text-gray-500 line-clamp-1 mt-1">{interaction.description}</p>
                  )}
                  <div className="mt-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md ${cfg.bg} ${cfg.text}`}>
                      <i className={`${cfg.icon} text-[10px]`}></i>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredInteractions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-chat-off-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-sm text-gray-400">Nenhuma interação encontrada</p>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedInteraction ? 'Detalhes da Interação' : 'Nova Interação'}
        subtitle={selectedInteraction ? 'Visualização dos dados' : 'Registre uma nova comunicação'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Cliente</label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
              required
              disabled={!!selectedInteraction}
            >
              <option value="">Selecione um cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
                disabled={!!selectedInteraction}
              >
                {interactionTypes.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Data</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                disabled={!!selectedInteraction}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Título</label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              disabled={!!selectedInteraction}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 500) })}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              disabled={!!selectedInteraction}
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {selectedInteraction && canDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(selectedInteraction.id)}
                className="px-4 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-delete-bin-line mr-1"></i>
                Excluir
              </button>
            )}
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
              {selectedInteraction ? 'Fechar' : 'Cancelar'}
            </Button>
            {!selectedInteraction && (
              <Button type="submit" className="flex-1">
                Adicionar Interação
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-delete-bin-line text-2xl text-rose-500"></i>
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Excluir Interação</h3>
            <p className="text-sm text-gray-500 text-center mb-5">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteInteraction(deleteConfirm)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

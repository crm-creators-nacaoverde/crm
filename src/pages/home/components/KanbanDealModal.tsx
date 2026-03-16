import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';
import { supabase } from '../../../lib/supabase';
import { Deal, ClientOption, UserOption } from './KanbanSection';
import SendFormFromDealModal from './SendFormFromDealModal';

interface KanbanDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  clients: ClientOption[];
  users: UserOption[];
  stages: { id: string; label: string; color: string }[];
  onSave: (data: Partial<Deal>) => void;
  onClientsUpdated: () => void;
  currentFunnelId: string;
}

interface FormData {
  title: string;
  client_id: string;
  assigned_to: string;
  supervisor_id: string;
  value: string;
  stage: string;
  description: string;
  expected_close_date: string;
  priority: string;
  tags: string[];
  funnel_id: string;
}

function sendNotification(title: string, options?: { body?: string; icon?: string }) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, options);
  }
}

export default function KanbanDealModal({
  isOpen,
  onClose,
  deal,
  clients,
  users,
  stages,
  onSave,
  onClientsUpdated,
  currentFunnelId,
}: KanbanDealModalProps) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    client_id: '',
    assigned_to: '',
    supervisor_id: '',
    value: '',
    stage: stages[0]?.id || '',
    description: '',
    expected_close_date: '',
    priority: 'medium',
    tags: [],
    funnel_id: currentFunnelId,
  });

  const [tagInput, setTagInput] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [isSendFormModalOpen, setIsSendFormModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        client_id: deal.client_id || '',
        assigned_to: deal.assigned_to || '',
        supervisor_id: deal.supervisor_id || '',
        value: String(deal.value || ''),
        stage: deal.stage,
        description: deal.description || '',
        expected_close_date: deal.expected_close_date || '',
        priority: deal.priority,
        tags: deal.tags || [],
        funnel_id: deal.funnel_id || currentFunnelId,
      });
      
      // Extrair categoria do título se existir
      const match = deal.title.match(/#(.+)$/);
      if (match) {
        setSelectedCategory(match[1]);
      }
    } else {
      setFormData({
        title: '',
        client_id: '',
        assigned_to: '',
        supervisor_id: '',
        value: '',
        stage: stages[0]?.id || '',
        description: '',
        expected_close_date: '',
        priority: 'medium',
        tags: [],
        funnel_id: currentFunnelId,
      });
      setSelectedCategory('');
    }
  }, [deal, stages, currentFunnelId]);

  // Atualizar título automaticamente quando cliente ou categoria mudar
  useEffect(() => {
    if (!deal && formData.client_id && selectedCategory) {
      const selectedClient = clients.find(c => c.id === formData.client_id);
      const category = categories.find(c => c.id === selectedCategory);
      if (selectedClient && category) {
        setFormData(prev => ({
          ...prev,
          title: `${selectedClient.name} #${category.id} - ${category.name}`
        }));
      }
    }
  }, [formData.client_id, selectedCategory, clients, deal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id || !selectedCategory) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const dealData = {
      title: formData.title,
      client_id: formData.client_id,
      assigned_to: formData.assigned_to || null,
      supervisor_id: formData.supervisor_id || null,
      value: 0,
      stage: formData.stage,
      description: formData.description || null,
      expected_close_date: formData.expected_close_date || null,
      priority: formData.priority,
      tags: formData.tags,
      funnel_id: formData.funnel_id,
    };

    try {
      if (deal) {
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', deal.id);

        if (error) throw error;
        
        sendNotification('Acompanhamento Atualizado', {
          body: `"${formData.title}" foi atualizado com sucesso.`,
          icon: '/favicon.ico'
        });
      } else {
        const { error } = await supabase
          .from('deals')
          .insert([dealData]);

        if (error) throw error;
        
        sendNotification('Novo Acompanhamento Criado! 🎉', {
          body: `"${formData.title}" foi adicionado ao pipeline.`,
          icon: '/favicon.ico'
        });
      }

      // Recarregar dados antes de fechar
      await onClientsUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar acompanhamento');
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{ name: newClientName.trim() }])
        .select()
        .single();

      if (error) throw error;

      setFormData({ ...formData, client_id: data.id });
      setNewClientName('');
      setIsAddingClient(false);
      onClientsUpdated();
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      alert('Erro ao adicionar cliente');
    }
  };

  const categories = [
    { id: '1', name: 'Hunter Lucas' },
    { id: '2', name: 'Hunter Cesar' },
    { id: '3', name: 'Hunter Felipe' },
    { id: '15', name: 'Cosméticos' },
    { id: '16', name: 'Top creators' },
    { id: '24', name: 'TESTOMEGA' },
    { id: '25', name: 'Treinadores' },
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={deal ? 'Editar Acompanhamento' : 'Novo Acompanhamento'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Creator *</label>
            {!isAddingClient ? (
              <div className="flex gap-2">
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um creator</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddingClient(true)}
                >
                  <i className="ri-add-line"></i>
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nome do novo creator"
                />
                <Button type="button" onClick={handleAddClient}>
                  <i className="ri-check-line"></i>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsAddingClient(false);
                    setNewClientName('');
                  }}
                >
                  <i className="ri-close-line"></i>
                </Button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            >
              <option value="">Selecione uma categoria</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>#{cat.id} - {cat.name}</option>
              ))}
            </select>
          </div>

          {formData.title && (
            <div className="bg-[#5de0e6]/10 border border-[#5de0e6]/20 rounded-lg p-3">
              <p className="text-xs text-[#004aad] font-medium mb-1">Título da Negociação:</p>
              <p className="text-sm text-gray-900 font-semibold">{formData.title}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
            <select
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {stages.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Nenhum</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor</label>
            <select
              value={formData.supervisor_id}
              onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Nenhum</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Atenção</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <Input
            label="Previsão de Fechamento"
            type="date"
            value={formData.expected_close_date}
            onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
              placeholder="Detalhes adicionais..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Adicionar tag"
              />
              <Button type="button" onClick={handleAddTag}>
                <i className="ri-add-line"></i>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 rounded-md text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-teal-900"
                  >
                    <i className="ri-close-line text-xs"></i>
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {deal ? 'Salvar' : 'Criar'}
            </Button>
            {deal && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsSendFormModalOpen(true)}
              >
                <i className="ri-file-list-3-line mr-2"></i>
                Enviar Formulário
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      {deal && (
        <SendFormFromDealModal
          isOpen={isSendFormModalOpen}
          onClose={() => setIsSendFormModalOpen(false)}
          deal={deal}
        />
      )}
    </>
  );
}

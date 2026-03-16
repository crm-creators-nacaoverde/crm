import { useState, useEffect } from 'react';
import { supabase, Interaction, Client } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';

// Tarefa vinda do deal_tasks
interface TaskItem {
  id: string;
  deal_id: string;
  client_id: string | null;
  deal_title: string | null;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by_name: string | null;
  assigned_name: string | null;
  created_at: string;
  _source: 'task'; // discriminador
}

type FeedItem =
  | ((Interaction & { client?: Client }) & { _source: 'interaction' })
  | TaskItem;

const TASK_TYPE_CONFIG: Record<string, { icon: string; bg: string; text: string; label: string }> = {
  task:      { icon: 'ri-task-line',         bg: 'bg-[#004aad]/10', text: 'text-[#004aad]',   label: 'Tarefa' },
  call:      { icon: 'ri-phone-line',         bg: 'bg-emerald-50',   text: 'text-emerald-600', label: 'Ligação' },
  whatsapp:  { icon: 'ri-whatsapp-line',      bg: 'bg-green-50',     text: 'text-green-600',   label: 'WhatsApp' },
  meeting:   { icon: 'ri-video-chat-line',    bg: 'bg-purple-50',    text: 'text-purple-600',  label: 'Reunião' },
  email:     { icon: 'ri-mail-line',          bg: 'bg-sky-50',       text: 'text-sky-600',     label: 'E-mail' },
  follow_up: { icon: 'ri-repeat-line',        bg: 'bg-amber-50',     text: 'text-amber-600',   label: 'Follow-up' },
  review:    { icon: 'ri-search-eye-line',    bg: 'bg-rose-50',      text: 'text-rose-600',    label: 'Revisão' },
  send:      { icon: 'ri-send-plane-line',    bg: 'bg-teal-50',      text: 'text-teal-600',    label: 'Envio' },
};

const INTERACTION_TYPE_CONFIG: Record<string, { icon: string; bg: string; text: string; label: string }> = {
  meeting:  { icon: 'ri-calendar-event-line', bg: 'bg-sky-50',    text: 'text-sky-600',    label: 'Reunião' },
  email:    { icon: 'ri-mail-line',           bg: 'bg-violet-50', text: 'text-violet-600', label: 'Email' },
  call:     { icon: 'ri-phone-line',          bg: 'bg-emerald-50',text: 'text-emerald-600',label: 'Ligação' },
  whatsapp: { icon: 'ri-whatsapp-line',       bg: 'bg-green-50',  text: 'text-green-600',  label: 'WhatsApp' },
  other:    { icon: 'ri-chat-1-line',         bg: 'bg-gray-50',   text: 'text-gray-600',   label: 'Outro' },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string }> = {
  high:   { label: 'Alta',  dot: 'bg-rose-500' },
  medium: { label: 'Média', dot: 'bg-amber-500' },
  low:    { label: 'Baixa', dot: 'bg-gray-400' },
};

export default function InteractionsSection() {
  const [interactions, setInteractions] = useState<(Interaction & { client?: Client })[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState<'all' | 'interactions' | 'tasks'>('all');
  const [filterTaskStatus, setFilterTaskStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { user, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();

  const [formData, setFormData] = useState({
    client_id: '',
    type: 'meeting' as 'meeting' | 'email' | 'call' | 'whatsapp' | 'other',
    title: '',
    description: '',
    date: '',
  });

  const canEdit = hasPermission('interactions', 'edit');
  const canDelete = hasPermission('interactions', 'delete');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [interactionsRes, clientsRes, tasksRes] = await Promise.all([
        supabase.from('interactions').select('*, clients(*)').order('date', { ascending: false }),
        supabase.from('clients').select('*').eq('status', 'active').order('name'),
        supabase.from('deal_tasks')
          .select('id, deal_id, client_id, deal_title, title, description, type, priority, due_date, is_completed, completed_at, completed_by_name, assigned_name, created_at')
          .order('created_at', { ascending: false }),
      ]);
      if (interactionsRes.error) throw interactionsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      const withClients = (interactionsRes.data || []).map((i: any) => ({ ...i, client: i.clients, _source: 'interaction' as const }));
      setInteractions(withClients);
      setClients(clientsRes.data || []);
      setTasks((tasksRes.data || []).map(t => ({ ...t, _source: 'task' as const })));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mesclar e ordenar feed
  const allItems: FeedItem[] = [
    ...interactions.map(i => ({ ...i, _source: 'interaction' as const })),
    ...tasks,
  ].sort((a, b) => {
    const dateA = a._source === 'interaction' ? new Date((a as any).date) : new Date((a as any).created_at);
    const dateB = b._source === 'interaction' ? new Date((b as any).date) : new Date((b as any).created_at);
    return dateB.getTime() - dateA.getTime();
  });

  const filtered = allItems.filter(item => {
    // Filtro por fonte
    if (filterSource === 'interactions' && item._source !== 'interaction') return false;
    if (filterSource === 'tasks' && item._source !== 'task') return false;

    // Filtro de status de tarefa
    if (item._source === 'task') {
      if (filterTaskStatus === 'pending' && item.is_completed) return false;
      if (filterTaskStatus === 'completed' && !item.is_completed) return false;
    }

    // Filtro por tipo
    if (filterType !== 'all') {
      if (item._source === 'interaction' && (item as any).type !== filterType) return false;
      if (item._source === 'task' && (item as any).type !== filterType) return false;
    }

    // Busca por texto
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (item._source === 'interaction') {
        const clientName = (item as any).client?.name || '';
        return clientName.toLowerCase().includes(q) || (item as any).title.toLowerCase().includes(q);
      }
      if (item._source === 'task') {
        return (item as any).title.toLowerCase().includes(q) ||
          ((item as any).deal_title || '').toLowerCase().includes(q) ||
          ((item as any).assigned_name || '').toLowerCase().includes(q);
      }
    }
    return true;
  });

  const handleAddInteraction = () => {
    setSelectedInteraction(null);
    setSelectedTask(null);
    setFormData({ client_id: '', type: 'meeting', title: '', description: '', date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const handleViewInteraction = (interaction: Interaction & { client?: Client }) => {
    setSelectedInteraction(interaction);
    setSelectedTask(null);
    setFormData({ client_id: interaction.client_id, type: interaction.type, title: interaction.title, description: interaction.description || '', date: interaction.date.split('T')[0] });
    setIsModalOpen(true);
  };

  const handleViewTask = (task: TaskItem) => {
    setSelectedTask(task);
    setSelectedInteraction(null);
    setIsModalOpen(true);
  };

  const handleToggleTask = async (task: TaskItem) => {
    const nowCompleting = !task.is_completed;
    await supabase.from('deal_tasks').update({
      is_completed: nowCompleting,
      completed_at: nowCompleting ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    await loadData();
  };

  const handleDeleteInteraction = async (id: string) => {
    try {
      const item = interactions.find(i => i.id === id);
      const { error } = await supabase.from('interactions').delete().eq('id', id);
      if (error) throw error;
      if (item) await logActivity({ action: 'delete', module: 'interactions', entityId: id, entityName: item.title, details: { deletedData: item } });
      await loadData();
      setDeleteConfirm(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao excluir interação:', error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    await supabase.from('deal_tasks').delete().eq('id', id);
    await loadData();
    setDeleteConfirm(null);
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { client_id: formData.client_id, type: formData.type, title: formData.title, description: formData.description, date: new Date(formData.date).toISOString(), created_by: user?.id, updated_at: new Date().toISOString() };
      if (selectedInteraction) {
        const { error } = await supabase.from('interactions').update(data).eq('id', selectedInteraction.id);
        if (error) throw error;
        await logActivity({ action: 'update', module: 'interactions', entityId: selectedInteraction.id, entityName: formData.title, details: { before: selectedInteraction, after: data } });
      } else {
        const { data: newI, error } = await supabase.from('interactions').insert([data]).select().single();
        if (error) throw error;
        await logActivity({ action: 'create', module: 'interactions', entityId: newI.id, entityName: formData.title, details: { data } });
      }
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar interação:', error);
    }
  };

  const isOverdue = (dueDate: string | null, completed: boolean) => {
    if (!dueDate || completed) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(dueDate) < today;
  };

  // Contadores para stats
  const totalInteractions = interactions.length;
  const pendingTasks = tasks.filter(t => !t.is_completed).length;
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const overdueTasks = tasks.filter(t => isOverdue(t.due_date, t.is_completed)).length;

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
            <i className="ri-message-3-line text-brand-600 text-base"></i>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{totalInteractions}</p>
            <p className="text-[11px] text-gray-400">Interações</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
            <i className="ri-task-line text-amber-600 text-base"></i>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{pendingTasks}</p>
            <p className="text-[11px] text-gray-400">Tarefas pendentes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
            <i className="ri-checkbox-circle-line text-emerald-600 text-base"></i>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{completedTasks}</p>
            <p className="text-[11px] text-gray-400">Tarefas concluídas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center">
            <i className="ri-alarm-warning-line text-rose-600 text-base"></i>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{overdueTasks}</p>
            <p className="text-[11px] text-gray-400">Atrasadas</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1 w-full">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input type="text" placeholder="Buscar por título, creator ou acompanhamento..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-gray-50/50" />
          </div>
          {canEdit && (
            <Button onClick={handleAddInteraction} size="md">
              <i className="ri-add-line text-sm"></i>
              <span className="hidden sm:inline">Nova Interação</span>
            </Button>
          )}
        </div>

        {/* Filtros em linha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fonte */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {[{ v: 'all', l: 'Tudo' }, { v: 'interactions', l: 'Interações' }, { v: 'tasks', l: 'Tarefas' }].map(f => (
              <button key={f.v} onClick={() => setFilterSource(f.v as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer transition-all ${filterSource === f.v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.l}
              </button>
            ))}
          </div>

          {/* Status das tarefas (só quando mostrando tarefas) */}
          {filterSource !== 'interactions' && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {[{ v: 'all', l: 'Todos status' }, { v: 'pending', l: 'Pendentes' }, { v: 'completed', l: 'Concluídas' }].map(f => (
                <button key={f.v} onClick={() => setFilterTaskStatus(f.v as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer transition-all ${filterTaskStatus === f.v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f.l}
                </button>
              ))}
            </div>
          )}

          {/* Tipo */}
          <div className="relative">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="pl-3 pr-7 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50 appearance-none cursor-pointer font-medium text-gray-600">
              <option value="all">Todos os tipos</option>
              <optgroup label="Interações">
                <option value="meeting">Reunião</option>
                <option value="email">Email</option>
                <option value="call">Ligação</option>
                <option value="whatsapp">WhatsApp</option>
              </optgroup>
              <optgroup label="Tarefas">
                <option value="task">Tarefa</option>
                <option value="follow_up">Follow-up</option>
                <option value="review">Revisão</option>
                <option value="send">Envio</option>
              </optgroup>
            </select>
            <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
          </div>
        </div>
      </div>

      {/* Feed unificado */}
      <div className="space-y-2">
        {filtered.map(item => {
          if (item._source === 'interaction') {
            const interaction = item as (Interaction & { client?: Client } & { _source: 'interaction' });
            const cfg = INTERACTION_TYPE_CONFIG[interaction.type] || INTERACTION_TYPE_CONFIG.other;
            return (
              <div key={`int-${interaction.id}`}
                className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleViewInteraction(interaction)}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                    <i className={`${cfg.icon} text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{interaction.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{interaction.client?.name || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">{new Date(interaction.date).toLocaleDateString('pt-BR')}</p>
                          <p className="text-[11px] text-gray-400">{new Date(interaction.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        {canDelete && (
                          <button onClick={e => { e.stopPropagation(); setDeleteConfirm(`int:${interaction.id}`); }}
                            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    {interaction.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-1">{interaction.description}</p>
                    )}
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md ${cfg.bg} ${cfg.text}`}>
                        <i className={`${cfg.icon} text-[10px]`}></i>{cfg.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Task item
          const task = item as TaskItem;
          const tcfg = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.task;
          const pcfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
          const overdue = isOverdue(task.due_date, task.is_completed);

          return (
            <div key={`task-${task.id}`}
              className={`rounded-xl border p-4 hover:shadow-sm transition-all group ${task.is_completed ? 'bg-gray-50/80 border-gray-100 opacity-75' : overdue ? 'bg-rose-50/30 border-rose-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button onClick={() => handleToggleTask(task)}
                  className={`w-5 h-5 flex items-center justify-center rounded-md border-2 transition-all cursor-pointer flex-shrink-0 mt-0.5 ${task.is_completed ? 'bg-[#004aad] border-[#004aad]' : 'border-gray-300 hover:border-[#5de0e6]'}`}>
                  {task.is_completed && <i className="ri-check-line text-white text-xs"></i>}
                </button>

                {/* Ícone */}
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 ${tcfg.bg} ${tcfg.text}`}>
                  <i className={`${tcfg.icon} text-base`}></i>
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleViewTask(task)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${task.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {task.title}
                      </p>
                      {task.deal_title && (
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <i className="ri-kanban-view text-[10px]"></i>{task.deal_title}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.due_date && (
                        <span className={`text-[11px] font-medium flex items-center gap-1 ${overdue ? 'text-rose-500' : task.is_completed ? 'text-gray-300' : 'text-gray-400'}`}>
                          <i className="ri-calendar-line text-[10px]"></i>
                          {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                      {canDelete && (
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirm(`task:${task.id}`); }}
                          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {/* Badge tipo */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md ${tcfg.bg} ${tcfg.text}`}>
                      <i className={`${tcfg.icon} text-[9px]`}></i>{tcfg.label}
                    </span>
                    {/* Badge prioridade */}
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${task.is_completed ? 'bg-gray-300' : pcfg.dot}`}></span>
                      {pcfg.label}
                    </span>
                    {/* Responsável */}
                    {task.assigned_name && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <i className="ri-user-line text-[9px]"></i>{task.assigned_name}
                      </span>
                    )}
                    {/* Atrasada */}
                    {overdue && (
                      <span className="text-[10px] font-medium text-rose-500 flex items-center gap-1">
                        <i className="ri-alarm-warning-line text-[9px]"></i>Atrasada
                      </span>
                    )}
                    {/* Concluída por */}
                    {task.is_completed && task.completed_by_name && (
                      <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                        <i className="ri-check-double-line text-[9px]"></i>por {task.completed_by_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-chat-off-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-sm text-gray-400">Nenhum item encontrado</p>
          <p className="text-xs text-gray-300 mt-1">Tente ajustar os filtros</p>
        </div>
      )}

      {/* Modal de interação */}
      <Modal isOpen={isModalOpen && !selectedTask} onClose={() => { setIsModalOpen(false); setSelectedInteraction(null); }}
        title={selectedInteraction ? 'Detalhes da Interação' : 'Nova Interação'}
        subtitle={selectedInteraction ? 'Visualização' : 'Registre uma nova comunicação'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Creator</label>
            <select value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
              required disabled={!!selectedInteraction}>
              <option value="">Selecione um creator</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none cursor-pointer"
                disabled={!!selectedInteraction}>
                <option value="meeting">Reunião</option>
                <option value="email">Email</option>
                <option value="call">Ligação</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Data</label>
              <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required disabled={!!selectedInteraction} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Título</label>
            <Input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required disabled={!!selectedInteraction} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value.slice(0, 500) })}
              rows={3} maxLength={500}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              disabled={!!selectedInteraction} />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {selectedInteraction && canDelete && (
              <button type="button" onClick={() => setDeleteConfirm(`int:${selectedInteraction.id}`)}
                className="px-4 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-delete-bin-line mr-1"></i>Excluir
              </button>
            )}
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
              {selectedInteraction ? 'Fechar' : 'Cancelar'}
            </Button>
            {!selectedInteraction && <Button type="submit" className="flex-1">Adicionar Interação</Button>}
          </div>
        </form>
      </Modal>

      {/* Modal de tarefa — visualização */}
      {selectedTask && (
        <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTask(null); }}
          title="Detalhe da Tarefa" subtitle={selectedTask.deal_title || 'Acompanhamento'}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task).bg} ${(TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task).text}`}>
                <i className={`${(TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task).icon} text-lg`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${selectedTask.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{selectedTask.title}</p>
                {selectedTask.deal_title && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><i className="ri-kanban-view text-[10px]"></i>{selectedTask.deal_title}</p>}
              </div>
              <button onClick={() => handleToggleTask(selectedTask)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${selectedTask.is_completed ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
                <i className={selectedTask.is_completed ? 'ri-refresh-line' : 'ri-check-line'}></i>
                {selectedTask.is_completed ? 'Reabrir' : 'Concluir'}
              </button>
            </div>

            {/* Detalhes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Tipo</p>
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${(TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task).text}`}>
                  <i className={`${(TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task).icon} text-xs`}></i>
                  {(TASK_TYPE_CONFIG[selectedTask.type] || TASK_TYPE_CONFIG.task).label}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Prioridade</p>
                <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${(PRIORITY_CONFIG[selectedTask.priority] || PRIORITY_CONFIG.medium).dot}`}></span>
                  {(PRIORITY_CONFIG[selectedTask.priority] || PRIORITY_CONFIG.medium).label}
                </span>
              </div>
              {selectedTask.due_date && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Prazo</p>
                  <p className={`text-xs font-medium ${isOverdue(selectedTask.due_date, selectedTask.is_completed) ? 'text-rose-500' : 'text-gray-700'}`}>
                    {new Date(selectedTask.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {isOverdue(selectedTask.due_date, selectedTask.is_completed) && ' · Atrasada'}
                  </p>
                </div>
              )}
              {selectedTask.assigned_name && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Responsável</p>
                  <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5"><i className="ri-user-line text-gray-400"></i>{selectedTask.assigned_name}</p>
                </div>
              )}
            </div>

            {selectedTask.description && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Descrição</p>
                <p className="text-sm text-gray-600 leading-relaxed">{selectedTask.description}</p>
              </div>
            )}

            {selectedTask.is_completed && selectedTask.completed_by_name && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <i className="ri-check-double-line text-emerald-500"></i>
                <p className="text-xs text-emerald-700 font-medium">
                  Concluída por {selectedTask.completed_by_name}
                  {selectedTask.completed_at && ` em ${new Date(selectedTask.completed_at).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-gray-100">
              {canDelete && (
                <button onClick={() => setDeleteConfirm(`task:${selectedTask.id}`)}
                  className="px-4 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-delete-bin-line mr-1"></i>Excluir
                </button>
              )}
              <Button variant="outline" onClick={() => { setIsModalOpen(false); setSelectedTask(null); }} className="flex-1">Fechar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-delete-bin-line text-2xl text-rose-500"></i>
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">
              Excluir {deleteConfirm.startsWith('task:') ? 'Tarefa' : 'Interação'}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={() => {
                if (deleteConfirm.startsWith('task:')) handleDeleteTask(deleteConfirm.slice(5));
                else handleDeleteInteraction(deleteConfirm.slice(4));
              }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors cursor-pointer whitespace-nowrap">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

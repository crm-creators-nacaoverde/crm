import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import { useClientHistory, historyEvent } from '../../../hooks/useClientHistory';

export interface DealTask {
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
  completed_by: string | null;
  completed_by_name: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const TASK_TYPES = [
  { value: 'task',      label: 'Tarefa',         icon: 'ri-task-line',           color: 'text-[#004aad] bg-[#004aad]/10' },
  { value: 'call',      label: 'Ligação',         icon: 'ri-phone-line',          color: 'text-emerald-700 bg-emerald-50' },
  { value: 'whatsapp',  label: 'WhatsApp',        icon: 'ri-whatsapp-line',       color: 'text-emerald-600 bg-green-50' },
  { value: 'meeting',   label: 'Reunião',         icon: 'ri-video-chat-line',     color: 'text-purple-700 bg-purple-50' },
  { value: 'email',     label: 'E-mail',          icon: 'ri-mail-line',           color: 'text-sky-700 bg-sky-50' },
  { value: 'follow_up', label: 'Follow-up',       icon: 'ri-repeat-line',         color: 'text-amber-700 bg-amber-50' },
  { value: 'review',    label: 'Revisão',         icon: 'ri-search-eye-line',     color: 'text-rose-700 bg-rose-50' },
  { value: 'send',      label: 'Envio',           icon: 'ri-send-plane-line',     color: 'text-teal-700 bg-teal-50' },
];

const PRIORITIES = [
  { value: 'high',   label: 'Alta',   color: 'text-rose-600 bg-rose-50 border-rose-200',   dot: 'bg-rose-500' },
  { value: 'medium', label: 'Média',  color: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  { value: 'low',    label: 'Baixa',  color: 'text-gray-500 bg-gray-50 border-gray-200',    dot: 'bg-gray-400' },
];

const TASK_SUGGESTIONS = [
  { title: 'Acompanhar GMV 7 Dias',      type: 'review',    priority: 'high' },
  { title: 'Acompanhar GMV 14 Dias',     type: 'review',    priority: 'medium' },
  { title: 'Acompanhar GMV 28 Dias',     type: 'review',    priority: 'medium' },
  { title: 'Verificar Vídeos Publicados',type: 'review',    priority: 'medium' },
  { title: 'Acompanhar Lives',           type: 'review',    priority: 'medium' },
  { title: 'Enviar Relatório',           type: 'send',      priority: 'high' },
  { title: 'Responder Mensagem',         type: 'whatsapp',  priority: 'high' },
  { title: 'Ligar para o Creator',       type: 'call',      priority: 'medium' },
  { title: 'Reunião de Resultado',       type: 'meeting',   priority: 'high' },
  { title: 'Revisar Comissão',           type: 'review',    priority: 'medium' },
  { title: 'Follow-up de Conteúdo',      type: 'follow_up', priority: 'low' },
  { title: 'Enviar Brief de Produto',    type: 'send',      priority: 'high' },
];

interface DealTasksSectionProps {
  dealId: string;
  clientId?: string | null;
  dealTitle?: string;
}

interface UserOption { id: string; full_name: string; }

export default function DealTasksSection({ dealId, clientId, dealTitle }: DealTasksSectionProps) {
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'pending' | 'all'>('pending');
  const { user, profile } = useAuth();
  const { logActivity } = useActivityLog();
  const { logClientEvent } = useClientHistory();

  const [form, setForm] = useState({
    title: '', description: '', type: 'task',
    priority: 'medium', due_date: '', assigned_to: '', assigned_name: '',
  });

  const loadTasks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('deal_tasks').select('*').eq('deal_id', dealId)
        .order('is_completed', { ascending: true })
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
    } finally { setLoading(false); }
  }, [dealId]);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('user_profiles').select('id, full_name').eq('is_active', true).order('full_name');
    setUsers(data || []);
  }, []);

  useEffect(() => { if (dealId) { loadTasks(); loadUsers(); } }, [dealId, loadTasks, loadUsers]);

  const resetForm = () => setForm({ title: '', description: '', type: 'task', priority: 'medium', due_date: '', assigned_to: '', assigned_name: '' });

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const assignedUser = users.find(u => u.id === form.assigned_to);
      const { error } = await supabase.from('deal_tasks').insert([{
        deal_id: dealId,
        client_id: clientId || null,
        deal_title: dealTitle || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
        assigned_name: assignedUser?.full_name || null,
        created_by: user?.id,
      }]);
      if (error) throw error;
      await logActivity({ action: 'create', module: 'tasks', entityName: form.title.trim(), details: { dealId, dealTitle, type: form.type, priority: form.priority } });
      
      if (clientId) {
        await logClientEvent({
          client_id: clientId,
          ...historyEvent.tarefaCriada(form.title.trim())
        });
      }
      
      resetForm();
      setShowAddForm(false);
      setShowSuggestions(false);
      await loadTasks();
    } catch (err) { console.error('Erro ao criar tarefa:', err); }
    finally { setSaving(false); }
  };

  const handleToggleComplete = async (task: DealTask) => {
    const nowCompleting = !task.is_completed;
    try {
      await supabase.from('deal_tasks').update({
        is_completed: nowCompleting,
        completed_at: nowCompleting ? new Date().toISOString() : null,
        completed_by: nowCompleting ? (user?.id || null) : null,
        completed_by_name: nowCompleting ? (profile?.full_name || null) : null,
        updated_at: new Date().toISOString(),
      }).eq('id', task.id);
      await logActivity({ action: 'update', module: 'tasks', entityId: task.id, entityName: task.title, details: { is_completed: nowCompleting } });
      
      if (nowCompleting && task.client_id) {
        await logClientEvent({
          client_id: task.client_id,
          ...historyEvent.tarefaConcluida(task.title)
        });
      }
      
      await loadTasks();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    await supabase.from('deal_tasks').delete().eq('id', id);
    if (task) {
      await logActivity({ action: 'delete', module: 'tasks', entityId: id, entityName: task.title });
      
      if (task.client_id) {
        await logClientEvent({
          client_id: task.client_id,
          ...historyEvent.exclusaoDado('Tarefa', task.title)
        });
      }
    }
    await loadTasks();
  };

  const selectSuggestion = (s: typeof TASK_SUGGESTIONS[0]) => {
    setForm(prev => ({ ...prev, title: s.title, type: s.type, priority: s.priority }));
    setShowSuggestions(false);
  };

  const isOverdue = (dueDate: string | null, completed: boolean) => {
    if (!dueDate || completed) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(dueDate) < today;
  };

  const getTypeConfig = (type: string) => TASK_TYPES.find(t => t.value === type) || TASK_TYPES[0];
  const getPriorityConfig = (p: string) => PRIORITIES.find(x => x.value === p) || PRIORITIES[1];

  const pending = tasks.filter(t => !t.is_completed);
  const completed = tasks.filter(t => t.is_completed);
  const visibleTasks = filterTab === 'pending' ? pending : tasks;
  const completedCount = completed.length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white';

  if (loading) return (
    <div className="flex items-center gap-2 py-3">
      <i className="ri-loader-4-line text-sm text-teal-500 animate-spin"></i>
      <span className="text-xs text-gray-400">Carregando tarefas...</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#5de0e6]/10 rounded-lg flex items-center justify-center">
            <i className="ri-task-line text-[#004aad] text-sm"></i>
          </div>
          <span className="text-sm font-semibold text-gray-700">Tarefas</span>
          {tasks.length > 0 && (
            <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md font-medium">
              {completedCount}/{tasks.length}
            </span>
          )}
        </div>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-xs font-medium text-[#004aad] hover:text-[#003d91] cursor-pointer transition-colors whitespace-nowrap">
            <i className="ri-add-line text-sm"></i>Nova Tarefa
          </button>
        )}
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#004aad] rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
          </div>
          {/* Tabs pending/all */}
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterTab('pending')}
              className={`text-[11px] font-medium px-2 py-0.5 rounded transition-all cursor-pointer ${filterTab === 'pending' ? 'bg-[#004aad]/10 text-[#004aad]' : 'text-gray-400 hover:text-gray-600'}`}>
              Pendentes ({pending.length})
            </button>
            <span className="text-gray-200">|</span>
            <button onClick={() => setFilterTab('all')}
              className={`text-[11px] font-medium px-2 py-0.5 rounded transition-all cursor-pointer ${filterTab === 'all' ? 'bg-[#004aad]/10 text-[#004aad]' : 'text-gray-400 hover:text-gray-600'}`}>
              Todas ({tasks.length})
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {visibleTasks.map(task => {
          const typeConf = getTypeConfig(task.type);
          const priConf = getPriorityConfig(task.priority);
          const overdue = isOverdue(task.due_date, task.is_completed);
          const expanded = expandedTask === task.id;

          return (
            <div key={task.id}
              className={`rounded-xl border transition-all ${task.is_completed ? 'bg-gray-50/80 border-gray-100 opacity-70' : overdue ? 'bg-rose-50/40 border-rose-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {/* Checkbox */}
                <button onClick={() => handleToggleComplete(task)}
                  className={`w-5 h-5 flex items-center justify-center rounded-md border-2 transition-all cursor-pointer flex-shrink-0 ${task.is_completed ? 'bg-[#004aad] border-[#004aad]' : 'border-gray-300 hover:border-[#5de0e6]'}`}>
                  {task.is_completed && <i className="ri-check-line text-white text-xs"></i>}
                </button>

                {/* Ícone do tipo */}
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${typeConf.color}`}>
                  <i className={`${typeConf.icon} text-xs`}></i>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedTask(expanded ? null : task.id)}>
                  <p className={`text-[13px] leading-tight font-medium truncate ${task.is_completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {/* Prioridade */}
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${task.is_completed ? 'text-gray-300' : priConf.color.split(' ')[0]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.is_completed ? 'bg-gray-300' : priConf.dot}`}></span>
                      {priConf.label}
                    </span>
                    {/* Due date */}
                    {task.due_date && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${task.is_completed ? 'text-gray-300' : overdue ? 'text-rose-500 font-medium' : 'text-gray-400'}`}>
                        <i className="ri-calendar-line text-[9px]"></i>
                        {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        {!task.is_completed && overdue && ' • Atrasada'}
                      </span>
                    )}
                    {/* Responsável */}
                    {task.assigned_name && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <i className="ri-user-line text-[9px]"></i>{task.assigned_name}
                      </span>
                    )}
                    {/* Concluída por */}
                    {task.is_completed && task.completed_by_name && (
                      <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                        <i className="ri-check-double-line text-[9px]"></i>por {task.completed_by_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand + delete */}
                <div className="flex items-center gap-1">
                  <button onClick={() => setExpandedTask(expanded ? null : task.id)}
                    className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded transition-all cursor-pointer">
                    <i className={`ri-arrow-${expanded ? 'up' : 'down'}-s-line text-sm`}></i>
                  </button>
                  <button onClick={() => handleDelete(task.id)}
                    className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer">
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
              </div>

              {/* Expandido */}
              {expanded && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-50">
                  <div className="pt-2 space-y-1.5">
                    {task.description && (
                      <p className="text-xs text-gray-600 leading-relaxed">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${typeConf.color}`}>
                        <i className={`${typeConf.icon} text-[10px]`}></i>{typeConf.label}
                      </span>
                      {task.completed_at && (
                        <span className="flex items-center gap-1">
                          <i className="ri-check-double-line text-emerald-500"></i>
                          Concluída em {new Date(task.completed_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <i className="ri-time-line"></i>
                        Criada em {new Date(task.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {tasks.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center py-5 text-center">
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 mb-2">
            <i className="ri-checkbox-circle-line text-lg text-gray-300"></i>
          </div>
          <p className="text-xs text-gray-400 mb-2">Nenhuma tarefa cadastrada</p>
          <button onClick={() => setShowAddForm(true)}
            className="text-xs font-medium text-[#004aad] hover:text-[#003d91] cursor-pointer transition-colors">
            + Adicionar tarefa
          </button>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-3 space-y-3">

          {/* Título com sugestões */}
          <div className="relative">
            <input type="text" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Nome da tarefa..." maxLength={120}
              className={inputClass} />
            {showSuggestions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)}></div>
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20 max-h-56 overflow-y-auto">
                  <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sugestões rápidas</p>
                  {TASK_SUGGESTIONS.map(s => {
                    const tc = getTypeConfig(s.type);
                    const pc = getPriorityConfig(s.priority);
                    return (
                      <button key={s.title} onClick={() => selectSuggestion(s)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors text-left">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${tc.color}`}>
                          <i className={`${tc.icon} text-xs`}></i>
                        </div>
                        <span className="text-sm text-gray-700 flex-1">{s.title}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${pc.color}`}>{pc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Tipo + Prioridade */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={`${inputClass} cursor-pointer`}>
                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Prioridade</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={`${inputClass} cursor-pointer`}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Data + Responsável */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Data limite</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Responsável</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={`${inputClass} cursor-pointer`}>
                <option value="">Nenhum</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Descrição (opcional)</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} maxLength={500} placeholder="Detalhes sobre a tarefa..."
              className={`${inputClass} resize-none`} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setShowAddForm(false); resetForm(); setShowSuggestions(false); }}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
              Cancelar
            </button>
            <button onClick={handleAdd} disabled={!form.title.trim() || saving}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#004aad] rounded-lg hover:bg-[#003d91] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
              {saving ? <span className="flex items-center justify-center gap-2"><i className="ri-loader-4-line animate-spin"></i>Salvando...</span>
                : <span className="flex items-center justify-center gap-2"><i className="ri-add-line"></i>Adicionar Tarefa</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

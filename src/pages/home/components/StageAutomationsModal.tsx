import { useState, useEffect } from 'react';
import { useStageAutomations, StageAutomation, AutomationActionType, AutomationConfig } from '../../../hooks/useStageAutomations';
import { supabase } from '../../../lib/supabase';

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  notif_push?: boolean;
  notif_email?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stageId: string;
  stageLabel: string;
  stageColor: string;
  funnelId: string;
}

const ACTION_TYPES: { id: AutomationActionType; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'notify_push',  label: 'Notificacao Push',    desc: 'Alerta no navegador em tempo real',              icon: 'ri-notification-badge-line', color: 'text-blue-600 bg-blue-50' },
  { id: 'notify_email', label: 'Notificacao E-mail',  desc: 'Envia e-mail para os responsaveis',              icon: 'ri-mail-check-line',          color: 'text-violet-600 bg-violet-50' },
  { id: 'create_task',  label: 'Criar Tarefa',        desc: 'Gera uma tarefa automaticamente',                icon: 'ri-task-line',                color: 'text-emerald-600 bg-emerald-50' },
  { id: 'send_webhook', label: 'Webhook',             desc: 'Envia dados para URL externa (Zapier, Make...)', icon: 'ri-links-line',               color: 'text-amber-600 bg-amber-50' },
];

const TASK_TYPES = [
  { id: 'task',     label: 'Tarefa'    },
  { id: 'call',     label: 'Ligacao'   },
  { id: 'whatsapp', label: 'WhatsApp'  },
  { id: 'meeting',  label: 'Reuniao'   },
  { id: 'email',    label: 'E-mail'    },
  { id: 'followup', label: 'Follow-up' },
];

const TASK_PRIORITIES = [
  { id: 'high',   label: 'Alta'  },
  { id: 'medium', label: 'Media' },
  { id: 'low',    label: 'Baixa' },
];

const EMPTY_CONFIG: AutomationConfig = {
  title: '',
  message: '',
  notify_all: true,
  notify_users: [],
  task_title: 'Acompanhar {{creator}} na etapa {{stage}}',
  task_description: '',
  task_type: 'task',
  task_priority: 'medium',
  assign_to_responsible: true,
  webhook_url: '',
  webhook_method: 'POST',
};

export default function StageAutomationsModal({
  isOpen,
  onClose,
  stageId,
  stageLabel,
  stageColor,
  funnelId,
}: Props) {
  const { getAutomationsForStage, createAutomation, updateAutomation, deleteAutomation, saving } =
    useStageAutomations();

  const [automations, setAutomations] = useState<StageAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [form, setForm] = useState({
    name: '',
    action_type: 'notify_push' as AutomationActionType,
    config: { ...EMPTY_CONFIG },
  });

  useEffect(() => {
    if (isOpen) {
      load();
    } else {
      setShowForm(false);
      setEditingId(null);
    }
  }, [isOpen, stageId]);

  const load = async () => {
    setLoading(true);
    const [automationsData, usersData] = await Promise.all([
      getAutomationsForStage(stageId),
      supabase.from('user_profiles').select('id, full_name, email, notif_push, notif_email').eq('is_active', true).order('full_name'),
    ]);
    setAutomations(automationsData);
    if (usersData.data) setUsers(usersData.data);
    setLoading(false);
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({
      name: '',
      action_type: 'notify_push',
      config: {
        ...EMPTY_CONFIG,
        title: 'Creator movido para ' + stageLabel,
        message: '{{creator}} entrou na etapa {{stage}} — deal: {{deal}}',
      },
    });
    setShowForm(true);
  };

  const openEdit = (a: StageAutomation) => {
    setEditingId(a.id);
    setForm({ name: a.name, action_type: a.action_type, config: { ...EMPTY_CONFIG, ...a.config } });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('De um nome para a automacao', false); return; }
    if (editingId) {
      const r = await updateAutomation(editingId, { name: form.name, action_type: form.action_type, config: form.config });
      if (r.success) { showToast('Automacao atualizada!'); await load(); setShowForm(false); }
      else showToast('Erro ao salvar', false);
    } else {
      const r = await createAutomation(stageId, funnelId, form.action_type, form.config, form.name);
      if (r.success) { showToast('Automacao criada!'); await load(); setShowForm(false); }
      else showToast('Erro ao criar', false);
    }
  };

  const handleDelete = async (id: string) => {
    const r = await deleteAutomation(id);
    if (r.success) { showToast('Removida!'); await load(); }
    else showToast('Erro ao remover', false);
    setConfirmDelete(null);
  };

  const handleToggle = async (a: StageAutomation) => {
    await updateAutomation(a.id, { is_active: !a.is_active });
    await load();
  };

  const setConfig = (k: keyof AutomationConfig, v: unknown) =>
    setForm(f => ({ ...f, config: { ...f.config, [k]: v } }));

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white transition-all';
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stageColor }} />
          <div>
            <h2 className="text-base font-bold text-gray-900">Automacoes — {stageLabel}</h2>
            <p className="text-xs text-gray-400">Acoes disparadas quando um creator entra nesta etapa</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!showForm ? (
            <div className="p-6 space-y-3">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : automations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <i className="ri-flashlight-line text-2xl text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Nenhuma automacao configurada</p>
                  <p className="text-xs text-gray-400 mt-1">Crie acoes que serao disparadas automaticamente</p>
                </div>
              ) : (
                automations.map(a => {
                  const meta = ACTION_TYPES.find(t => t.id === a.action_type);
                  return (
                    <div key={a.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${a.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta?.color || 'text-gray-500 bg-gray-100'}`}>
                        <i className={meta?.icon + ' text-sm'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
                        <p className="text-xs text-gray-400">{meta?.label}</p>
                      </div>
                      <button onClick={() => handleToggle(a)}
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${a.is_active ? 'bg-blue-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${a.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <button onClick={() => openEdit(a)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer">
                        <i className="ri-edit-line text-sm" />
                      </button>
                      {confirmDelete === a.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(a.id)} className="px-2 py-1 text-xs font-medium text-white bg-rose-500 rounded-lg cursor-pointer">Confirmar</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg cursor-pointer">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(a.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-rose-50 text-gray-400 hover:text-rose-500 cursor-pointer">
                          <i className="ri-delete-bin-line text-sm" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-6 space-y-5">

              {/* Nome */}
              <div>
                <label className={lbl}>Nome da automacao <span className="text-rose-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Notificar equipe sobre reuniao marcada" className={inp} maxLength={80} />
              </div>

              {/* Tipo */}
              <div>
                <label className={lbl}>Tipo de acao</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTION_TYPES.map(t => (
                    <button key={t.id} type="button" onClick={() => setForm(f => ({ ...f, action_type: t.id }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${form.action_type === t.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.color}`}>
                        <i className={t.icon + ' text-sm'} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{t.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* notify_push */}
              {form.action_type === 'notify_push' && (
                <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Configurar Push</p>
                  <div>
                    <label className={lbl}>Titulo — use: {'{{creator}} {{deal}} {{stage}}'}</label>
                    <input type="text" value={form.config.title || ''} onChange={e => setConfig('title', e.target.value)}
                      placeholder="Creator movido para {{stage}}" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Mensagem</label>
                    <textarea rows={2} value={form.config.message || ''} onChange={e => setConfig('message', e.target.value)}
                      placeholder="{{creator}} entrou na etapa {{stage}} — deal: {{deal}}" className={inp + ' resize-none'} />
                  </div>
                  {/* Destinatários */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={lbl + ' mb-0'}>Destinatários</label>
                      <button type="button" onClick={() => setConfig('notify_all', !form.config.notify_all)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 cursor-pointer hover:text-blue-900 transition-colors">
                        <div className={`relative w-8 h-4 rounded-full transition-colors ${form.config.notify_all ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${form.config.notify_all ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        Todos os usuários
                      </button>
                    </div>
                    {!form.config.notify_all && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {users.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-3">Nenhum usuário ativo encontrado</p>
                        )}
                        {users.map(u => {
                          const selected = (form.config.notify_users || []).includes(u.id);
                          return (
                            <label key={u.id}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                {selected && <i className="ri-check-line text-white text-[10px]"></i>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{u.full_name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                              </div>
                              <input type="checkbox" className="sr-only" checked={selected}
                                onChange={e => {
                                  const current = form.config.notify_users || [];
                                  setConfig('notify_users', e.target.checked
                                    ? [...current, u.id]
                                    : current.filter((id: string) => id !== u.id));
                                }} />
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {form.config.notify_all && (
                      <p className="text-[11px] text-blue-600">A notificação será enviada para todos os usuários com push ativo no navegador.</p>
                    )}
                  </div>
                </div>
              )}

              {/* notify_email */}
              {form.action_type === 'notify_email' && (
                <div className="space-y-3 p-4 bg-violet-50/50 rounded-xl border border-violet-100">
                  <p className="text-xs font-bold text-violet-800 uppercase tracking-wide">Configurar E-mail</p>
                  <div>
                    <label className={lbl}>Assunto — use: {'{{creator}} {{deal}} {{stage}}'}</label>
                    <input type="text" value={form.config.title || ''} onChange={e => setConfig('title', e.target.value)}
                      placeholder="Creator movido: {{stage}}" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Corpo do e-mail</label>
                    <textarea rows={3} value={form.config.message || ''} onChange={e => setConfig('message', e.target.value)}
                      placeholder="{{creator}} foi movido para a etapa {{stage}} no deal {{deal}}." className={inp + ' resize-none'} />
                  </div>
                  {/* Destinatários */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={lbl + ' mb-0'}>Destinatários</label>
                      <button type="button" onClick={() => setConfig('notify_all', !form.config.notify_all)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700 cursor-pointer hover:text-violet-900 transition-colors">
                        <div className={`relative w-8 h-4 rounded-full transition-colors ${form.config.notify_all ? 'bg-violet-500' : 'bg-gray-300'}`}>
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${form.config.notify_all ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        Todos os usuários
                      </button>
                    </div>
                    {!form.config.notify_all && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {users.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-3">Nenhum usuário ativo encontrado</p>
                        )}
                        {users.map(u => {
                          const selected = (form.config.notify_users || []).includes(u.id);
                          return (
                            <label key={u.id}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${selected ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-violet-500 border-violet-500' : 'border-gray-300'}`}>
                                {selected && <i className="ri-check-line text-white text-[10px]"></i>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{u.full_name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                              </div>
                              <input type="checkbox" className="sr-only" checked={selected}
                                onChange={e => {
                                  const current = form.config.notify_users || [];
                                  setConfig('notify_users', e.target.checked
                                    ? [...current, u.id]
                                    : current.filter((id: string) => id !== u.id));
                                }} />
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {form.config.notify_all && (
                      <p className="text-[11px] text-violet-600">A notificação será enviada para todos os usuários com e-mail ativo.</p>
                    )}
                  </div>
                </div>
              )}

              {/* create_task */}
              {form.action_type === 'create_task' && (
                <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Configurar Tarefa</p>
                  <div>
                    <label className={lbl}>Titulo da tarefa — use: {'{{creator}} {{deal}} {{stage}}'}</label>
                    <input type="text" value={form.config.task_title || ''} onChange={e => setConfig('task_title', e.target.value)}
                      placeholder="Acompanhar {{creator}} na etapa {{stage}}" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Descricao (opcional)</label>
                    <textarea rows={2} value={form.config.task_description || ''} onChange={e => setConfig('task_description', e.target.value)}
                      placeholder="Detalhes sobre o que precisa ser feito..." className={inp + ' resize-none'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Tipo</label>
                      <select value={form.config.task_type || 'task'} onChange={e => setConfig('task_type', e.target.value)} className={inp + ' cursor-pointer'}>
                        {TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Prioridade</label>
                      <select value={form.config.task_priority || 'medium'} onChange={e => setConfig('task_priority', e.target.value)} className={inp + ' cursor-pointer'}>
                        {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setConfig('assign_to_responsible', !form.config.assign_to_responsible)}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.config.assign_to_responsible ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${form.config.assign_to_responsible ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-xs text-gray-600">Atribuir ao responsavel do deal automaticamente</span>
                  </div>
                </div>
              )}

              {/* send_webhook */}
              {form.action_type === 'send_webhook' && (
                <div className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Configurar Webhook</p>
                  <div>
                    <label className={lbl}>URL do webhook</label>
                    <input type="url" value={form.config.webhook_url || ''} onChange={e => setConfig('webhook_url', e.target.value)}
                      placeholder="https://hooks.zapier.com/..." className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Metodo HTTP</label>
                    <select value={form.config.webhook_method || 'POST'} onChange={e => setConfig('webhook_method', e.target.value)} className={inp + ' cursor-pointer'}>
                      {['POST', 'PUT', 'PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-[11px] text-amber-700 font-medium mb-1">Payload enviado automaticamente:</p>
                    <pre className="text-[10px] text-amber-800 font-mono leading-relaxed">
                      {'{ "event": "stage_entered", "deal": "{{deal}}", "creator": "{{creator}}", "stage": "{{stage}}", "timestamp": "ISO 8601" }'}
                    </pre>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {!showForm ? (
            <>
              <span className="text-xs text-gray-400">
                {automations.length} {automations.length !== 1 ? 'automacoes' : 'automacao'} configurada{automations.length !== 1 ? 's' : ''}
              </span>
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-sm">
                <i className="ri-add-line" />Nova Automacao
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowForm(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                <i className="ri-arrow-left-line" />Voltar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-sm">
                {saving
                  ? <><i className="ri-loader-4-line animate-spin" />Salvando...</>
                  : <><i className="ri-save-line" />{editingId ? 'Atualizar' : 'Criar Automacao'}</>}
              </button>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70]">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl ${toast.ok ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white'}`}>
            <i className={`text-lg ${toast.ok ? 'ri-check-line text-emerald-400' : 'ri-error-warning-line'}`} />
            <p className="text-sm font-medium">{toast.msg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

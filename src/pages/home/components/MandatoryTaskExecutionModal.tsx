import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useClientHistory, historyEvent } from '../../../hooks/useClientHistory';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deal: {
    id: string;
    title: string;
    client_id: string | null;
    client_name?: string;
    value?: number;
    expected_close_date?: string;
  };
  stage: {
    id: string;
    label: string;
    mandatory_task_title: string;
    mandatory_task_description?: string;
    mandatory_task_type?: 'manual' | 'field' | 'task_standard';
    mandatory_task_target_id?: string;
    mandatory_task_rule?: 'filled' | 'created' | 'completed';
  };
}

export default function MandatoryTaskExecutionModal({
  isOpen,
  onClose,
  onConfirm,
  deal,
  stage,
}: Props) {
  const { user } = useAuth();
  const { logClientEvent } = useClientHistory();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'success' | 'error'>('pending');

  const checkValidation = async () => {
    if (stage.mandatory_task_type === 'manual') {
      setValidationStatus('success');
      return;
    }

    setLoading(true);
    setValidationError(null);
    try {
      if (stage.mandatory_task_type === 'field') {
        // Buscar dados do deal e do cliente
        const { data: dealData, error: dealError } = await supabase
          .from('deals')
          .select('*, clients(*)')
          .eq('id', deal.id)
          .single();

        if (dealError) throw dealError;

        const targetField = stage.mandatory_task_target_id;
        let value = null;

        if (targetField?.startsWith('client_')) {
          const clientField = targetField.replace('client_', '');
          value = dealData.clients?.[clientField];
        } else if (targetField?.startsWith('deal_')) {
          const dealField = targetField.replace('deal_', '');
          value = dealData[dealField];
        }

        if (value === null || value === undefined || value === '' || (typeof value === 'number' && value === 0)) {
          setValidationStatus('error');
          setValidationError(`O campo "${stage.mandatory_task_title}" não está preenchido.`);
        } else {
          setValidationStatus('success');
          setCompleted(true);
        }
      } else if (stage.mandatory_task_type === 'task_standard') {
        // Buscar tarefas do deal
        const { data: tasks, error: tasksError } = await supabase
          .from('deal_tasks')
          .select('*')
          .eq('deal_id', deal.id)
          .eq('type', stage.mandatory_task_target_id);

        if (tasksError) throw tasksError;

        if (stage.mandatory_task_rule === 'created') {
          if (tasks && tasks.length > 0) {
            setValidationStatus('success');
            setCompleted(true);
          } else {
            setValidationStatus('error');
            setValidationError(`Nenhuma tarefa do tipo "${stage.mandatory_task_target_id}" foi criada.`);
          }
        } else if (stage.mandatory_task_rule === 'completed') {
          const completedTask = tasks?.find(t => t.is_completed);
          if (completedTask) {
            setValidationStatus('success');
            setCompleted(true);
          } else {
            setValidationStatus('error');
            setValidationError(`Nenhuma tarefa do tipo "${stage.mandatory_task_target_id}" foi concluída.`);
          }
        }
      }
    } catch (err) {
      console.error('[MandatoryTaskExecutionModal] Validation error:', err);
      setValidationStatus('error');
      setValidationError('Erro ao validar regra. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCompleted(false);
      setValidationError(null);
      setValidationStatus('pending');
      checkValidation();
    }
  }, [isOpen, stage, deal]);

  const handleCompleteAndAdvance = async () => {
    if (!completed) return;
    
    setSaving(true);
    try {
      // Se for manual, registra a tarefa concluída
      if (stage.mandatory_task_type === 'manual') {
        const { error } = await supabase.from('deal_tasks').insert({
          deal_id: deal.id,
          client_id: deal.client_id,
          deal_title: deal.title,
          title: `[OBRIGATÓRIA] ${stage.mandatory_task_title}`,
          description: stage.mandatory_task_description || 'Tarefa obrigatória concluída para avanço de etapa.',
          type: 'task',
          priority: 'high',
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          completed_by_name: user?.user_metadata?.full_name || user?.email,
          created_by: 'system',
        });
        if (error) throw error;
      }

      // Registrar no histórico do creator
      if (deal.client_id) {
        await logClientEvent({
          client_id: deal.client_id,
          ...historyEvent.tarefaObrigatoriaConcluida(
            stage.mandatory_task_title,
            stage.label
          )
        });
      }

      onConfirm();
    } catch (err) {
      console.error('[MandatoryTaskExecutionModal] Error saving task:', err);
      alert('Erro ao salvar conclusão da tarefa. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center gap-4 ${
          validationStatus === 'error' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            validationStatus === 'error' ? 'bg-rose-100' : 'bg-amber-100'
          }`}>
            <i className={`text-2xl ${
              validationStatus === 'error' ? 'ri-error-warning-fill text-rose-600' : 'ri-flashlight-fill text-amber-600'
            }`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Validação Obrigatória</h2>
            <p className={`text-xs font-medium ${
              validationStatus === 'error' ? 'text-rose-700' : 'text-amber-700'
            }`}>
              {validationStatus === 'error' ? 'Ação pendente detectada' : 'Esta etapa exige uma ação antes de avançar'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Negociação</p>
            <p className="text-sm font-semibold text-gray-700">{deal.title}</p>
            {deal.client_name && (
              <p className="text-xs text-gray-500 mt-0.5">{deal.client_name}</p>
            )}
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-3 py-2">
                <i className="ri-loader-4-line animate-spin text-blue-500 text-xl" />
                <span className="text-sm text-gray-500">Validando regras do sistema...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {stage.mandatory_task_type === 'manual' ? (
                    <div className="mt-0.5">
                      <input 
                        type="checkbox" 
                        id="mandatory-check"
                        checked={completed}
                        onChange={(e) => setCompleted(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-gray-300 text-[#004aad] focus:ring-[#004aad] cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      validationStatus === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                      <i className={validationStatus === 'success' ? 'ri-check-line' : 'ri-close-line'} />
                    </div>
                  )}
                  <label htmlFor="mandatory-check" className="flex-1 cursor-pointer">
                    <p className="text-sm font-bold text-gray-900">{stage.mandatory_task_title}</p>
                    {stage.mandatory_task_description && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{stage.mandatory_task_description}</p>
                    )}
                  </label>
                </div>

                {validationError && (
                  <div className="ml-8 p-3 bg-rose-50 rounded-lg border border-rose-100">
                    <p className="text-xs text-rose-600 font-medium flex items-center gap-2">
                      <i className="ri-information-line" />
                      {validationError}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleCompleteAndAdvance}
            disabled={!completed || saving || loading}
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
              completed 
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {saving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-double-line" />}
            {validationStatus === 'error' ? 'Ação Pendente' : 'Concluir e Avançar'}
          </button>
        </div>
      </div>
    </div>
  );
}

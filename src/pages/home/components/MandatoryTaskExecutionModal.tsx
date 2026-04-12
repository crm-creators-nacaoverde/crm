import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deal: {
    id: string;
    title: string;
    client_id: string | null;
    client_name?: string;
  };
  stage: {
    id: string;
    label: string;
    mandatory_task_title: string;
    mandatory_task_description?: string;
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
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleCompleteAndAdvance = async () => {
    if (!completed) return;
    
    setSaving(true);
    try {
      // Criar a tarefa como concluída no banco de dados para registro histórico
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
        <div className="bg-amber-50 px-6 py-5 border-b border-amber-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-fill text-2xl text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Tarefa Obrigatória</h2>
            <p className="text-xs text-amber-700 font-medium">Esta etapa exige uma ação antes de avançar</p>
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

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <input 
                  type="checkbox" 
                  id="mandatory-check"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  className="w-5 h-5 rounded-lg border-gray-300 text-[#004aad] focus:ring-[#004aad] cursor-pointer"
                />
              </div>
              <label htmlFor="mandatory-check" className="flex-1 cursor-pointer">
                <p className="text-sm font-bold text-gray-900">{stage.mandatory_task_title}</p>
                {stage.mandatory_task_description && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{stage.mandatory_task_description}</p>
                )}
              </label>
            </div>
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
            disabled={!completed || saving}
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
              completed 
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {saving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-double-line" />}
            Concluir e Avançar
          </button>
        </div>
      </div>
    </div>
  );
}

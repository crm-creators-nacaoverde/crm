import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useActivityLog } from '../../../hooks/useActivityLog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stage: { 
    id: string; 
    label: string; 
    color: string;
    mandatory_task_title?: string;
    mandatory_task_description?: string;
  };
  onSave: () => void;
}

export default function StageMandatoryTaskModal({
  isOpen,
  onClose,
  stage,
  onSave,
}: Props) {
  const { logActivity } = useActivityLog();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(stage.mandatory_task_title || '');
      setDescription(stage.mandatory_task_description || '');
    }
  }, [isOpen, stage]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('funnel_stages')
        .update({
          mandatory_task_title: title.trim() || null,
          mandatory_task_description: description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stage.id);

      if (error) throw error;

      await logActivity({
        action: 'update',
        module: 'funnels',
        entityId: stage.id,
        entityName: stage.label,
        details: { 
          action: 'update_mandatory_task',
          title: title.trim() || null,
          description: description.trim() || null
        }
      });

      showToast('Configuração salva!');
      setTimeout(() => {
        onSave();
        onClose();
      }, 500);
    } catch (err) {
      console.error('[StageMandatoryTaskModal] Error saving:', err);
      showToast('Erro ao salvar', false);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white transition-all';
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
          <div>
            <h2 className="text-base font-bold text-gray-900">Tarefa Obrigatória — {stage.label}</h2>
            <p className="text-xs text-gray-400">Exigir conclusão de tarefa ao entrar nesta etapa</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <label className={lbl}>Título da Tarefa</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Validar contrato assinado" 
              className={inp} 
              maxLength={100} 
            />
            <p className="text-[10px] text-gray-400 mt-1">Deixe em branco para desativar a obrigatoriedade</p>
          </div>

          <div>
            <label className={lbl}>Descrição / Instruções</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o que o usuário deve fazer ou conferir..." 
              className={`${inp} min-h-[100px] resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <div className="flex-1">
            {toast && (
              <span className={`text-xs font-medium ${toast.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                {toast.msg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 text-sm font-bold text-white bg-[#004aad] hover:bg-[#003a8a] rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
            >
              {saving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-line" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

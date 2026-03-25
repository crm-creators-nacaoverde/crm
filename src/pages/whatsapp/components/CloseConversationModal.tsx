import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { WaConversation } from '../../../hooks/useWhatsApp';

interface Props {
  isOpen: boolean;
  conversation: WaConversation | null;
  onClose: () => void;
  onConfirm: (outcome: 'won' | 'lost', reasonId: string | null, funnelId: string | null, stageId: string | null) => Promise<void>;
}

export default function CloseConversationModal({ isOpen, conversation, onClose, onConfirm }: Props) {
  const [outcome, setOutcome] = useState<'won' | 'lost'>('won');
  const [reasons, setReasons] = useState<{ id: string; name: string; type: string }[]>([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [funnels, setFunnels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; label: string }[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      supabase.from('deal_outcome_reasons').select('id, name, type').eq('is_active', true).order('sort_order'),
      supabase.from('funnels').select('id, name, color').order('created_at'),
    ]).then(([rRes, fRes]) => {
      setReasons(rRes.data || []);
      setFunnels(fRes.data || []);
      if (fRes.data?.[0]) setSelectedFunnel(fRes.data[0].id);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!selectedFunnel) return;
    supabase.from('funnel_stages').select('id, label').eq('funnel_id', selectedFunnel).order('sort_order')
      .then(({ data }) => { setStages(data || []); if (data?.[0]) setSelectedStage(data[0].id); });
  }, [selectedFunnel]);

  const filteredReasons = reasons.filter(r => r.type === outcome);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm(outcome, selectedReason || null, selectedFunnel || null, selectedStage || null);
    setConfirming(false);
    onClose();
  };

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';

  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-900">Encerrar Conversa</p>
            <p className="text-[11px] text-gray-400 truncate max-w-xs">{conversation.client_name || conversation.remote_jid}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Outcome */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resultado</label>
            <div className="grid grid-cols-2 gap-2">
              {(['won', 'lost'] as const).map(o => (
                <button key={o} onClick={() => { setOutcome(o); setSelectedReason(''); }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-all font-semibold text-sm ${
                    outcome === o
                      ? o === 'won' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}>
                  <i className={`${o === 'won' ? 'ri-checkbox-circle-line text-emerald-500' : 'ri-close-circle-line text-rose-500'} text-base`}></i>
                  {o === 'won' ? 'Ganho' : 'Perdido'}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo */}
          {filteredReasons.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Motivo de {outcome === 'won' ? 'ganho' : 'perda'}
              </label>
              <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)} className={inp}>
                <option value="">Selecionar motivo (opcional)</option>
                {filteredReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          {/* Funil + stage */}
          {conversation.client_id && (
            <>
              <div className="flex items-center gap-2 p-3 bg-[#004aad]/5 rounded-xl border border-[#004aad]/10">
                <i className="ri-kanban-view text-[#004aad] text-sm"></i>
                <p className="text-xs text-[#004aad]">Um deal será criado no funil selecionado</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Funil</label>
                  <select value={selectedFunnel} onChange={e => setSelectedFunnel(e.target.value)} className={inp}>
                    <option value="">Sem funil</option>
                    {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Etapa</label>
                  <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)} className={inp} disabled={!selectedFunnel}>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={confirming}
            className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              outcome === 'won' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}>
            {confirming ? <><i className="ri-loader-4-line animate-spin"></i>Encerrando...</> :
             <><i className={outcome === 'won' ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'}></i>
               Confirmar {outcome === 'won' ? 'Ganho' : 'Perda'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

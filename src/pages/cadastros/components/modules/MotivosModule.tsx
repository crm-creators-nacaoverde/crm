// src/pages/cadastros/components/modules/MotivosModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { DealOutcomeReason } from '../../../../hooks/useCadastros';

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';

export default function MotivosModule() {
  const { outcomeReasons, reload } = useCadastrosContext();
  const [editing, setEditing] = useState<DealOutcomeReason | null>(null);
  const [form, setForm] = useState({ name: '', type: 'won' as 'won' | 'lost' });
  const [activeTab, setActiveTab] = useState<'won' | 'lost'>('won');
  const [saving, setSaving] = useState(false);

  const wonReasons  = outcomeReasons.filter(r => r.type === 'won');
  const lostReasons = outcomeReasons.filter(r => r.type === 'lost');
  const current     = activeTab === 'won' ? wonReasons : lostReasons;

  const openEdit = (item: DealOutcomeReason) => { setEditing(item); setForm({ name: item.name, type: item.type }); };
  const reset    = () => { setEditing(null); setForm({ name: '', type: activeTab }); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('deal_outcome_reasons').update({ name: form.name }).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...current.map(r => r.sort_order));
      await supabase.from('deal_outcome_reasons').insert({ name: form.name, type: activeTab, sort_order: maxOrder + 1 });
    }
    await reload(); reset(); setSaving(false);
  };

  const toggle  = async (item: DealOutcomeReason) => { await supabase.from('deal_outcome_reasons').update({ is_active: !item.is_active }).eq('id', item.id); await reload(); };
  const del     = async (item: DealOutcomeReason) => { await supabase.from('deal_outcome_reasons').delete().eq('id', item.id); await reload(); };
  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = current.findIndex(r => r.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= current.length) return;
    await supabase.from('deal_outcome_reasons').update({ sort_order: current[swap].sort_order }).eq('id', current[idx].id);
    await supabase.from('deal_outcome_reasons').update({ sort_order: current[idx].sort_order }).eq('id', current[swap].id);
    await reload();
  };

  return (
    <div className="p-5 space-y-5">
      {/* Tabs */}
      <div className="flex items-center bg-gray-100 rounded-xl p-1">
        <button onClick={() => { setActiveTab('won'); reset(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg cursor-pointer transition-all ${activeTab === 'won' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}>
          <i className="ri-checkbox-circle-line text-emerald-500"></i>Motivos de Ganho ({wonReasons.length})
        </button>
        <button onClick={() => { setActiveTab('lost'); reset(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg cursor-pointer transition-all ${activeTab === 'lost' ? 'bg-white shadow-sm text-rose-700' : 'text-gray-500'}`}>
          <i className="ri-close-circle-line text-rose-500"></i>Motivos de Perda ({lostReasons.length})
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {editing ? 'Editando motivo' : `Novo motivo de ${activeTab === 'won' ? 'ganho' : 'perda'}`}
        </p>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder={`Ex: ${activeTab === 'won' ? 'Fechou contrato' : 'Sem interesse'}`} className={inp} />
        <div className="flex gap-2">
          <button onClick={save} disabled={!form.name.trim() || saving}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg cursor-pointer transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
          </button>
          {editing && <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 bg-gray-200 rounded-lg cursor-pointer">Cancelar</button>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <CadastroList items={current} onToggle={toggle} onEdit={openEdit} onDelete={del} onReorder={reorder}
          emptyMessage={`Nenhum motivo de ${activeTab === 'won' ? 'ganho' : 'perda'} cadastrado.`}
          renderBadge={item => (
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.type === 'won' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <i className={`${item.type === 'won' ? 'ri-checkbox-circle-line text-emerald-600' : 'ri-close-circle-line text-rose-600'} text-sm`}></i>
            </div>
          )} />
      </div>
    </div>
  );
}

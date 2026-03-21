// src/pages/cadastros/components/modules/PagamentosModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { PaymentType } from '../../../../hooks/useCadastros';

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';

export default function PagamentosModule() {
  const { paymentTypes, reload } = useCadastrosContext();
  const [editing, setEditing] = useState<PaymentType | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (item: PaymentType) => { setEditing(item); setName(item.name); };
  const reset    = () => { setEditing(null); setName(''); };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('payment_types').update({ name }).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...paymentTypes.map(p => p.sort_order));
      await supabase.from('payment_types').insert({ name, sort_order: maxOrder + 1 });
    }
    await reload(); reset(); setSaving(false);
  };

  const toggle  = async (item: PaymentType) => { await supabase.from('payment_types').update({ is_active: !item.is_active }).eq('id', item.id); await reload(); };
  const del     = async (item: PaymentType) => { await supabase.from('payment_types').delete().eq('id', item.id); await reload(); };
  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = paymentTypes.findIndex(p => p.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= paymentTypes.length) return;
    await supabase.from('payment_types').update({ sort_order: paymentTypes[swap].sort_order }).eq('id', paymentTypes[idx].id);
    await supabase.from('payment_types').update({ sort_order: paymentTypes[idx].sort_order }).eq('id', paymentTypes[swap].id);
    await reload();
  };

  return (
    <div className="p-5 space-y-5">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{editing ? 'Editando tipo' : 'Novo tipo de pagamento'}</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cachê, Premiação..." className={inp} />
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim() || saving}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg cursor-pointer transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
          </button>
          {editing && <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 bg-gray-200 rounded-lg cursor-pointer">Cancelar</button>}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipos de Pagamento ({paymentTypes.length})</p>
        </div>
        <CadastroList items={paymentTypes} onToggle={toggle} onEdit={openEdit} onDelete={del} onReorder={reorder}
          renderBadge={() => <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center"><i className="ri-money-dollar-circle-line text-sm text-emerald-600"></i></div>} />
      </div>
    </div>
  );
}

// src/pages/cadastros/components/modules/FontesModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { CaptureSource } from '../../../../hooks/useCadastros';

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';

export default function FontesModule() {
  const { captureSources, reload } = useCadastrosContext();
  const [editing, setEditing] = useState<CaptureSource | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (item: CaptureSource) => { setEditing(item); setName(item.name); };
  const reset    = () => { setEditing(null); setName(''); };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('capture_sources').update({ name }).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...captureSources.map(c => c.sort_order));
      await supabase.from('capture_sources').insert({ name, sort_order: maxOrder + 1 });
    }
    await reload(); reset(); setSaving(false);
  };

  const toggle   = async (item: CaptureSource) => { await supabase.from('capture_sources').update({ is_active: !item.is_active }).eq('id', item.id); await reload(); };
  const del      = async (item: CaptureSource) => { await supabase.from('capture_sources').delete().eq('id', item.id); await reload(); };
  const reorder  = async (id: string, dir: 'up' | 'down') => {
    const idx = captureSources.findIndex(c => c.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= captureSources.length) return;
    await supabase.from('capture_sources').update({ sort_order: captureSources[swap].sort_order }).eq('id', captureSources[idx].id);
    await supabase.from('capture_sources').update({ sort_order: captureSources[idx].sort_order }).eq('id', captureSources[swap].id);
    await reload();
  };

  return (
    <div className="p-5 space-y-5">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{editing ? 'Editando fonte' : 'Nova fonte de captura'}</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da fonte" className={inp} />
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fontes ({captureSources.length})</p>
        </div>
        <CadastroList items={captureSources} onToggle={toggle} onEdit={openEdit} onDelete={del} onReorder={reorder}
          renderBadge={() => <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center"><i className="ri-focus-3-line text-sm text-teal-600"></i></div>} />
      </div>
    </div>
  );
}

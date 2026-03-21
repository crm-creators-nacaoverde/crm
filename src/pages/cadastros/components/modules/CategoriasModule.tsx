// src/pages/cadastros/components/modules/CategoriasModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { CreatorCategory } from '../../../../hooks/useCadastros';

const ICONS = ['ri-medal-line','ri-user-star-line','ri-shield-star-line','ri-crown-line','ri-megaphone-line','ri-handshake-line','ri-links-line','ri-award-line'];
const COLORS = ['#004aad','#d97706','#7c3aed','#059669','#dc2626','#0891b2','#db2777','#374151'];
const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';

export default function CategoriasModule() {
  const { categories, reload } = useCadastrosContext();
  const [editing, setEditing] = useState<CreatorCategory | null>(null);
  const [form, setForm] = useState({ name: '', color: COLORS[0], icon: ICONS[0] });
  const [saving, setSaving] = useState(false);

  const openNew  = () => { setEditing(null); setForm({ name: '', color: COLORS[0], icon: ICONS[0] }); };
  const openEdit = (item: CreatorCategory) => { setEditing(item); setForm({ name: item.name, color: item.color, icon: item.icon }); };
  const reset    = () => { setEditing(null); setForm({ name: '', color: COLORS[0], icon: ICONS[0] }); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('creator_categories').update({ name: form.name, color: form.color, icon: form.icon }).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...categories.map(c => c.sort_order));
      await supabase.from('creator_categories').insert({ name: form.name, color: form.color, icon: form.icon, sort_order: maxOrder + 1 });
    }
    await reload(); reset(); setSaving(false);
  };

  const toggle = async (item: CreatorCategory) => {
    await supabase.from('creator_categories').update({ is_active: !item.is_active }).eq('id', item.id);
    await reload();
  };

  const del = async (item: CreatorCategory) => {
    await supabase.from('creator_categories').delete().eq('id', item.id);
    await reload();
  };

  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = categories.findIndex(c => c.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= categories.length) return;
    await supabase.from('creator_categories').update({ sort_order: categories[swap].sort_order }).eq('id', categories[idx].id);
    await supabase.from('creator_categories').update({ sort_order: categories[idx].sort_order }).eq('id', categories[swap].id);
    await reload();
  };

  const blockDelete = (item: CreatorCategory) => item.is_default ? 'A categoria padrão não pode ser excluída.' : null;

  return (
    <div className="p-5 space-y-5">
      {/* Formulário */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{editing ? 'Editando categoria' : 'Nova categoria'}</p>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="Nome da categoria" className={inp} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Cor</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-lg cursor-pointer transition-all hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Ícone</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all ${form.icon === ic ? 'ring-2 ring-offset-1 ring-gray-400' : 'bg-white hover:bg-gray-100'}`}
                  style={form.icon === ic ? { backgroundColor: `${form.color}20`, color: form.color } : {}}>
                  <i className={`${ic} text-sm`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        {form.name && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Preview:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: `${form.color}20`, color: form.color }}>
              <i className={`${form.icon} text-xs`}></i>{form.name}
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!form.name.trim() || saving}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg cursor-pointer transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar'}
          </button>
          {editing && (
            <button onClick={reset} className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg cursor-pointer transition-colors">
              Cancelar
            </button>
          )}
          {!editing && <button onClick={openNew} className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 cursor-pointer">Limpar</button>}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categorias ({categories.length})</p>
        </div>
        <CadastroList
          items={categories}
          onToggle={toggle} onEdit={openEdit} onDelete={del} onReorder={reorder}
          blockDelete={blockDelete}
          renderBadge={item => (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${item.color}20`, color: item.color }}>
              <i className={`${item.icon} text-sm`}></i>
            </div>
          )}
          renderExtra={item => item.is_default ? (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">padrão</span>
          ) : undefined}
        />
      </div>
    </div>
  );
}

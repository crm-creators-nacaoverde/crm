// src/pages/cadastros/components/modules/PlataformasModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { Platform } from '../../../../hooks/useCadastros';

const ICONS = ['ri-tiktok-line','ri-instagram-line','ri-youtube-line','ri-play-circle-line','ri-facebook-circle-line','ri-twitter-x-line','ri-twitch-line','ri-pinterest-line','ri-linkedin-box-line','ri-global-line'];
const COLORS = ['#374151','#db2777','#dc2626','#d97706','#2563eb','#0891b2','#7c3aed','#dc2626','#1d4ed8','#6b7280'];
const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';

export default function PlataformasModule() {
  const { platforms, reload } = useCadastrosContext();
  const [editing, setEditing] = useState<Platform | null>(null);
  const [form, setForm] = useState({ name: '', color: COLORS[0], icon: ICONS[0] });
  const [saving, setSaving] = useState(false);

  const openEdit = (item: Platform) => { setEditing(item); setForm({ name: item.name, color: item.color, icon: item.icon }); };
  const reset    = () => { setEditing(null); setForm({ name: '', color: COLORS[0], icon: ICONS[0] }); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('platforms').update({ name: form.name, color: form.color, icon: form.icon }).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...platforms.map(p => p.sort_order));
      await supabase.from('platforms').insert({ name: form.name, color: form.color, icon: form.icon, sort_order: maxOrder + 1 });
    }
    await reload(); reset(); setSaving(false);
  };

  const toggle = async (item: Platform) => {
    await supabase.from('platforms').update({ is_active: !item.is_active }).eq('id', item.id);
    await reload();
  };

  const del = async (item: Platform) => {
    await supabase.from('platforms').delete().eq('id', item.id);
    await reload();
  };

  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = platforms.findIndex(p => p.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= platforms.length) return;
    await supabase.from('platforms').update({ sort_order: platforms[swap].sort_order }).eq('id', platforms[idx].id);
    await supabase.from('platforms').update({ sort_order: platforms[idx].sort_order }).eq('id', platforms[swap].id);
    await reload();
  };

  const setDefault = async (item: Platform) => {
    await supabase.from('platforms').update({ is_default: false }).neq('id', item.id);
    await supabase.from('platforms').update({ is_default: true }).eq('id', item.id);
    await reload();
  };

  return (
    <div className="p-5 space-y-5">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{editing ? 'Editando plataforma' : 'Nova plataforma'}</p>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="Nome da plataforma" className={inp} />
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
        {form.name && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Preview:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: `${form.color}20`, color: form.color }}>
              <i className={`${form.icon} text-xs`}></i>{form.name}
            </span>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!form.name.trim() || saving}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg cursor-pointer transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
          </button>
          {editing && <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 bg-gray-200 rounded-lg cursor-pointer">Cancelar</button>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plataformas ({platforms.length})</p>
        </div>
        <CadastroList
          items={platforms} onToggle={toggle} onEdit={openEdit} onDelete={del} onReorder={reorder}
          renderBadge={item => (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${item.color}20`, color: item.color }}>
              <i className={`${item.icon} text-sm`}></i>
            </div>
          )}
          renderExtra={item => (
            <div className="flex items-center gap-2 mt-0.5">
              {item.is_default && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">padrão</span>}
              {!item.is_default && item.is_active && (
                <button onClick={() => setDefault(item)}
                  className="text-[10px] text-gray-400 hover:text-amber-600 cursor-pointer transition-colors">
                  definir como padrão
                </button>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}

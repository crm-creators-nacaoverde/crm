// src/pages/cadastros/components/modules/InteracoesModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { InteractionType } from '../../../../hooks/useCadastros';

const ICONS = ['ri-chat-1-line','ri-phone-line','ri-mail-line','ri-calendar-event-line','ri-whatsapp-line','ri-map-pin-line','ri-task-line','ri-file-text-line','ri-pen-nib-line','ri-group-line','ri-user-add-line','ri-checkbox-circle-line'];
const COLORS = ['#374151','#059669','#7c3aed','#004aad','#059669','#d97706','#374151','#004aad','#059669','#d97706','#0891b2','#059669'];
const GOAL_KEYS = [
  { value: '',                   label: 'Não vinculado' },
  { value: 'cadastros_mornos',   label: 'Cadastros Mornos' },
  { value: 'reunioes_agendadas', label: 'Reuniões Agendadas' },
  { value: 'reunioes_fechadas',  label: 'Reuniões Fechadas' },
  { value: 'grupos_criados',     label: 'Grupos Criados' },
  { value: 'contratos_emitidos', label: 'Contratos Emitidos' },
  { value: 'contratos_assinados',label: 'Contratos Assinados' },
];
const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';

const EMPTY = { name: '', icon: ICONS[0], color: COLORS[0], category: 'both' as 'task'|'interaction'|'both', counts_as_goal_metric: false, goal_metric_key: '' };

export default function InteracoesModule() {
  const { interactionTypes, reload } = useCadastrosContext();
  const [editing, setEditing] = useState<InteractionType | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const openEdit = (item: InteractionType) => {
    setEditing(item);
    setForm({ name: item.name, icon: item.icon, color: item.color, category: item.category, counts_as_goal_metric: item.counts_as_goal_metric, goal_metric_key: item.goal_metric_key || '' });
  };
  const reset = () => { setEditing(null); setForm({ ...EMPTY }); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { name: form.name, icon: form.icon, color: form.color, category: form.category, counts_as_goal_metric: form.counts_as_goal_metric, goal_metric_key: form.goal_metric_key || null };
    if (editing) {
      await supabase.from('interaction_types').update(data).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...interactionTypes.map(t => t.sort_order));
      await supabase.from('interaction_types').insert({ ...data, sort_order: maxOrder + 1 });
    }
    await reload(); reset(); setSaving(false);
  };

  const toggle  = async (item: InteractionType) => { await supabase.from('interaction_types').update({ is_active: !item.is_active }).eq('id', item.id); await reload(); };
  const del     = async (item: InteractionType) => { await supabase.from('interaction_types').delete().eq('id', item.id); await reload(); };
  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = interactionTypes.findIndex(t => t.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= interactionTypes.length) return;
    await supabase.from('interaction_types').update({ sort_order: interactionTypes[swap].sort_order }).eq('id', interactionTypes[idx].id);
    await supabase.from('interaction_types').update({ sort_order: interactionTypes[idx].sort_order }).eq('id', interactionTypes[swap].id);
    await reload();
  };

  const catLabel = { task: 'Tarefa', interaction: 'Interação', both: 'Ambos' };

  return (
    <div className="p-5 space-y-5">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{editing ? 'Editando tipo' : 'Novo tipo'}</p>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do tipo" className={inp} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Cor</p>
            <div className="flex gap-1.5 flex-wrap">
              {COLORS.map((c, i) => (
                <button key={i} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-6 h-6 rounded-md cursor-pointer transition-all ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Ícone</p>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                  className={`w-6 h-6 flex items-center justify-center rounded-md cursor-pointer transition-all ${form.icon === ic ? 'ring-2 ring-offset-1 ring-gray-400' : 'bg-white hover:bg-gray-100'}`}
                  style={form.icon === ic ? { backgroundColor: `${form.color}20`, color: form.color } : {}}>
                  <i className={`${ic} text-xs`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Categoria</p>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))} className={inp}>
              <option value="interaction">Interação</option>
              <option value="task">Tarefa</option>
              <option value="both">Ambos</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Métrica de meta</p>
            <select value={form.goal_metric_key} onChange={e => setForm(p => ({ ...p, goal_metric_key: e.target.value, counts_as_goal_metric: !!e.target.value }))} className={inp}>
              {GOAL_KEYS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
        </div>

        {form.name && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Preview:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: `${form.color}20`, color: form.color }}>
              <i className={`${form.icon} text-xs`}></i>{form.name}
            </span>
            <span className="text-[10px] text-gray-400">{catLabel[form.category]}</span>
            {form.counts_as_goal_metric && <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">conta para metas</span>}
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipos ({interactionTypes.length})</p>
        </div>
        <CadastroList items={interactionTypes} onToggle={toggle} onEdit={openEdit} onDelete={del} onReorder={reorder}
          renderBadge={item => (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
              <i className={`${item.icon} text-sm`}></i>
            </div>
          )}
          renderExtra={item => (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-gray-400">{catLabel[item.category]}</span>
              {item.counts_as_goal_metric && <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">meta</span>}
            </div>
          )} />
      </div>
    </div>
  );
}

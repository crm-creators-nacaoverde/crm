// src/pages/cadastros/components/modules/TransportadorasModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { Carrier } from '../../../../hooks/useCadastros';

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';
const EMPTY = { name: '', tracking_url: '', tracking_url_tiktok: '' };

export default function TransportadorasModule() {
  const { carriers, reload } = useCadastrosContext();
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [testCode, setTestCode] = useState('');

  const openEdit = (item: Carrier) => {
    setEditing(item);
    setForm({ name: item.name, tracking_url: item.tracking_url || '', tracking_url_tiktok: item.tracking_url_tiktok || '' });
  };
  const reset = () => { setEditing(null); setForm({ ...EMPTY }); setTestCode(''); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { name: form.name, tracking_url: form.tracking_url || null, tracking_url_tiktok: form.tracking_url_tiktok || null };
    if (editing) {
      await supabase.from('carriers').update(data).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...carriers.map(c => c.sort_order));
      await supabase.from('carriers').insert({ ...data, sort_order: maxOrder + 1 });
    }
    await reload(); reset(); setSaving(false);
  };

  const buildUrl = (template: string, code: string) => template ? template.replace('{codigo}', code) : '';

  const toggle  = async (item: Carrier) => { await supabase.from('carriers').update({ is_active: !item.is_active }).eq('id', item.id); await reload(); };
  const del     = async (item: Carrier) => { await supabase.from('carriers').delete().eq('id', item.id); await reload(); };
  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx = carriers.findIndex(c => c.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= carriers.length) return;
    await supabase.from('carriers').update({ sort_order: carriers[swap].sort_order }).eq('id', carriers[idx].id);
    await supabase.from('carriers').update({ sort_order: carriers[idx].sort_order }).eq('id', carriers[swap].id);
    await reload();
  };

  return (
    <div className="p-5 space-y-5">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{editing ? 'Editando transportadora' : 'Nova transportadora'}</p>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome da transportadora" className={inp} />

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            URL de rastreio padrão
            <span className="ml-1 text-gray-400 font-normal">— use <code className="bg-gray-200 px-1 rounded text-[10px]">{'{codigo}'}</code> onde vai o código</span>
          </label>
          <input value={form.tracking_url} onChange={e => setForm(p => ({ ...p, tracking_url: e.target.value }))}
            placeholder="https://rastreamento.correios.com.br/?P={codigo}" className={inp} />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            URL de rastreio TikTok Shop
            <span className="ml-1 text-gray-400 font-normal">— específica para pedidos do TikTok</span>
          </label>
          <input value={form.tracking_url_tiktok} onChange={e => setForm(p => ({ ...p, tracking_url_tiktok: e.target.value }))}
            placeholder="https://seller-br.tiktok.com/order?order_id={codigo}" className={inp} />
        </div>

        {/* Testar URL */}
        {(form.tracking_url || form.tracking_url_tiktok) && (
          <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Testar link de rastreio</p>
            <input value={testCode} onChange={e => setTestCode(e.target.value)} placeholder="Digite um código para testar..." className={`${inp} text-xs`} />
            {testCode && form.tracking_url && (
              <a href={buildUrl(form.tracking_url, testCode)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#004aad] hover:underline">
                <i className="ri-external-link-line text-xs"></i>
                Testar link padrão: {buildUrl(form.tracking_url, testCode).slice(0, 60)}...
              </a>
            )}
            {testCode && form.tracking_url_tiktok && (
              <a href={buildUrl(form.tracking_url_tiktok, testCode)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#004aad] hover:underline">
                <i className="ri-tiktok-line text-xs"></i>
                Testar link TikTok: {buildUrl(form.tracking_url_tiktok, testCode).slice(0, 60)}...
              </a>
            )}
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transportadoras ({carriers.length})</p>
        </div>
        <CadastroList items={carriers} onToggle={toggle} onEdit={openEdit} onDelete={del} onReorder={reorder}
          renderBadge={() => <div className="w-7 h-7 bg-sky-50 rounded-lg flex items-center justify-center"><i className="ri-truck-line text-sm text-sky-600"></i></div>}
          renderExtra={item => (
            <div className="flex items-center gap-2 mt-0.5">
              {item.tracking_url && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><i className="ri-link text-[9px]"></i>Padrão</span>}
              {item.tracking_url_tiktok && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><i className="ri-tiktok-line text-[9px]"></i>TikTok</span>}
            </div>
          )} />
      </div>
    </div>
  );
}

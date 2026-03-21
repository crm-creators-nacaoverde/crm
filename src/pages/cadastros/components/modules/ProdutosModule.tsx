// src/pages/cadastros/components/modules/ProdutosModule.tsx
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCadastrosContext } from '../../../../contexts/CadastrosContext';
import CadastroList from '../CadastroList';
import type { Product } from '../../../../hooks/useCadastros';

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]';
const EMPTY = { name: '', description: '', sku: '', image_url: '', bling_id: '' };

export default function ProdutosModule() {
  const { products, reload } = useCadastrosContext();
  const [editing, setEditing]           = useState<Product | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY });
  const [saving, setSaving]             = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const openEdit = (item: Product) => {
    setEditing(item);
    setForm({
      name:        item.name,
      description: item.description  || '',
      sku:         item.sku          || '',
      image_url:   item.image_url    || '',
      bling_id:    item.bling_id     || '',
    });
    setShowAdvanced(!!(item.sku || item.bling_id));
  };

  const reset = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setShowAdvanced(false);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = {
      name:        form.name,
      description: form.description || null,
      sku:         form.sku         || null,
      image_url:   form.image_url   || null,
      bling_id:    form.bling_id    || null,
      updated_at:  new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('products').update(data).eq('id', editing.id);
    } else {
      const maxOrder = Math.max(0, ...products.map(p => p.sort_order));
      await supabase.from('products').insert({ ...data, sort_order: maxOrder + 1 });
    }
    await reload();
    reset();
    setSaving(false);
  };

  const toggle = async (item: Product) => {
    await supabase.from('products').update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq('id', item.id);
    await reload();
  };

  const del = async (item: Product) => {
    await supabase.from('products').delete().eq('id', item.id);
    await reload();
  };

  const reorder = async (id: string, dir: 'up' | 'down') => {
    const idx  = products.findIndex(p => p.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= products.length) return;
    await supabase.from('products').update({ sort_order: products[swap].sort_order }).eq('id', products[idx].id);
    await supabase.from('products').update({ sort_order: products[idx].sort_order }).eq('id', products[swap].id);
    await reload();
  };

  return (
    <div className="p-5 space-y-5">

      {/* ── Formulário ── */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {editing ? 'Editando produto' : 'Novo produto'}
        </p>

        <input
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="Nome do produto *"
          className={inp}
        />

        <textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Descrição (opcional)"
          rows={2}
          className={`${inp} resize-none`}
        />

        <input
          value={form.image_url}
          onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
          placeholder="URL da imagem (opcional)"
          className={inp}
        />

        {/* Preview da imagem */}
        {form.image_url && (
          <div className="flex items-center gap-3">
            <img
              src={form.image_url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover border border-gray-200"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <p className="text-xs text-gray-400">Preview da imagem</p>
          </div>
        )}

        {/* Toggle campos avançados */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
        >
          <i className={`ri-arrow-${showAdvanced ? 'up' : 'down'}-s-line text-sm`}></i>
          {showAdvanced ? 'Ocultar' : 'Mostrar'} campos de integração (SKU e Bling)
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-1 border-t border-gray-200">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">SKU</label>
              <input
                value={form.sku}
                onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                placeholder="Código SKU do produto"
                className={inp}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                ID Bling
                <span className="ml-1.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                  Integração futura
                </span>
              </label>
              <input
                value={form.bling_id}
                onChange={e => setForm(p => ({ ...p, bling_id: e.target.value }))}
                placeholder="ID do produto no Bling"
                className={inp}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg cursor-pointer transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar produto'}
          </button>
          {editing && (
            <button
              onClick={reset}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg cursor-pointer transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* ── Lista de produtos ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Produtos ({products.length})
          </p>
        </div>
        <CadastroList
          items={products}
          onToggle={toggle}
          onEdit={openEdit}
          onDelete={del}
          onReorder={reorder}
          emptyMessage="Nenhum produto cadastrado. Adicione o primeiro produto acima."
          renderBadge={item =>
            item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-9 h-9 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-gift-line text-sm text-violet-500"></i>
              </div>
            )
          }
          renderExtra={item => (
            <div className="flex items-center gap-2 mt-0.5">
              {item.description && (
                <span className="text-[11px] text-gray-400 truncate max-w-[160px]">
                  {item.description}
                </span>
              )}
              {item.sku && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  SKU: {item.sku}
                </span>
              )}
              {item.bling_id && (
                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                  Bling
                </span>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}

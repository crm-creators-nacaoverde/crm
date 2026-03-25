import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { BibleModule } from '../../../hooks/useBiblia';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: BibleModule | null;
}

const COLORS = ['#004aad','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#db2777','#374151','#ea580c','#0d9488'];
const ICONS  = [
  'ri-book-open-line','ri-lightbulb-line','ri-rocket-line','ri-trophy-line','ri-star-line',
  'ri-target-line','ri-bar-chart-line','ri-team-line','ri-shield-line','ri-fire-line',
];

const ROLES = [
  { value: 'admin',    label: 'Admin' },
  { value: 'manager',  label: 'Gerente' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer',   label: 'Visualizador' },
];

export default function ModuleFormModal({ isOpen, onClose, onSaved, editing }: Props) {
  const { user } = useAuth();
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [color, setColor]         = useState('#004aad');
  const [icon, setIcon]           = useState('ri-book-open-line');
  const [roles, setRoles]         = useState<string[]>([]);
  const [published, setPublished] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [coverError, setCoverError] = useState('');
  const [coverDims, setCoverDims] = useState<{ w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setTitle(editing.title);
        setDesc(editing.description || '');
        setColor(editing.color);
        setIcon(editing.icon);
        setRoles(editing.required_roles || []);
        setPublished(editing.is_published);
        setCoverPreview(editing.cover_image_url || null);
      } else {
        setTitle(''); setDesc(''); setColor('#004aad'); setIcon('ri-book-open-line');
        setRoles([]); setPublished(false); setCoverPreview(null);
      }
      setCoverFile(null);
    }
  }, [isOpen, editing]);

  const handleFile = (f: File) => {
    setCoverError('');
    if (!f.type.startsWith('image/')) {
      setCoverError('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setCoverError('Imagem muito grande. Máximo 5 MB.');
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setCoverDims({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const uploadCover = async (): Promise<string | null> => {
    if (!coverFile) return editing?.cover_image_url || null;
    setUploading(true);
    const ext  = coverFile.name.split('.').pop();
    const path = `covers/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('bible-materials').upload(path, coverFile, { contentType: coverFile.type });
    setUploading(false);
    if (error) return null;
    const { data: urlData } = supabase.storage.from('bible-materials').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const coverUrl = await uploadCover();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      color, icon,
      required_roles: roles,
      is_published: published,
      cover_image_url: coverUrl,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('bible_modules').update(payload).eq('id', editing.id);
    } else {
      const { data: last } = await supabase.from('bible_modules').select('sort_order').order('sort_order', { ascending: false }).limit(1).single();
      await supabase.from('bible_modules').insert({ ...payload, sort_order: (last?.sort_order ?? -1) + 1, created_by: user?.id });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const toggleRole = (r: string) => setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              <i className={`${icon} text-lg`} style={{ color }}></i>
            </div>
            <p className="text-sm font-bold text-gray-900">{editing ? 'Editar Módulo' : 'Novo Módulo'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Capa */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Imagem de capa</label>
              <span className="text-[10px] text-gray-400">JPG, PNG ou WEBP · máx. 5 MB</span>
            </div>

            {/* Instruções de dimensão */}
            <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl mb-2">
              <i className="ri-information-line text-blue-500 text-sm flex-shrink-0 mt-0.5"></i>
              <div className="text-[11px] text-blue-700 space-y-0.5">
                <p className="font-semibold">Dimensão recomendada: 1280 × 480 px (proporção 8:3)</p>
                <p className="text-blue-600">Mínimo: 640 × 240 px &nbsp;·&nbsp; A imagem será recortada para preencher a capa do card</p>
              </div>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`relative cursor-pointer rounded-xl border-2 overflow-hidden transition-all
                ${coverError ? 'border-rose-300' : 'border-dashed border-gray-200 hover:border-[#5de0e6]/60'}`}
              style={{ height: '144px' }}>
              {coverPreview
                ? <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                : <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                    <i className="ri-image-add-line text-2xl"></i>
                    <p className="text-xs font-medium">Arraste ou clique para adicionar capa</p>
                    <p className="text-[10px] text-gray-300">1280 × 480 px recomendado</p>
                  </div>}
              {coverPreview && (
                <>
                  <button type="button" onClick={e => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null); setCoverDims(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-lg flex items-center justify-center hover:bg-black/70 cursor-pointer">
                    <i className="ri-close-line text-sm"></i>
                  </button>
                  {coverDims && (
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-mono px-2 py-0.5 rounded-md">
                      {coverDims.w} × {coverDims.h} px
                    </div>
                  )}
                </>
              )}
            </div>
            {coverError && <p className="text-xs text-rose-600 mt-1">{coverError}</p>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inp} placeholder="Ex: Fundamentos de Vendas" maxLength={80} />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descrição</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]" placeholder="Descreva o objetivo deste módulo" maxLength={300} />
          </div>

          {/* Cor */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cor</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg cursor-pointer transition-all hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ícone</label>
            <div className="grid grid-cols-10 gap-1.5">
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all ${icon === ic ? 'ring-2 ring-[#004aad]' : 'hover:bg-gray-100'}`}
                  style={{ color: icon === ic ? color : undefined }}>
                  <i className={`${ic} text-base`}></i>
                </button>
              ))}
            </div>
          </div>

          {/* Acesso por cargo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Acesso por cargo</label>
            <p className="text-[11px] text-gray-400 mb-2">Deixe vazio para todos os cargos. Admin sempre vê tudo.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLES.map(r => (
                <label key={r.value} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all
                  ${roles.includes(r.value) ? 'border-[#004aad]/40 bg-[#004aad]/5' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                    ${roles.includes(r.value) ? 'bg-[#004aad] border-[#004aad]' : 'border-gray-300'}`}>
                    {roles.includes(r.value) && <i className="ri-check-line text-white text-[9px]"></i>}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{r.label}</span>
                  <input type="checkbox" className="sr-only" checked={roles.includes(r.value)} onChange={() => toggleRole(r.value)} />
                </label>
              ))}
            </div>
          </div>

          {/* Publicar */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-800">Publicar módulo</p>
              <p className="text-[11px] text-gray-400">Módulos não publicados são rascunhos — só admins/gerentes veem</p>
            </div>
            <button type="button" onClick={() => setPublished(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${published ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${published ? 'translate-x-5' : 'translate-x-0'}`}></span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={!title.trim() || saving || uploading}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving || uploading
              ? <><i className="ri-loader-4-line animate-spin"></i>{uploading ? 'Enviando...' : 'Salvando...'}</>
              : <><i className={editing ? 'ri-save-line' : 'ri-add-line'}></i>{editing ? 'Salvar' : 'Criar módulo'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

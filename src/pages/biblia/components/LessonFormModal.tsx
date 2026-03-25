import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { BibleLesson, detectVideoProvider } from '../../../hooks/useBiblia';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  moduleId: string;
  editing?: BibleLesson | null;
  nextSortOrder?: number;
}

const CONTENT_TYPES = [
  { value: 'video',   label: 'Vídeo',     icon: 'ri-play-circle-line',     color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'pdf',     label: 'PDF',        icon: 'ri-file-pdf-line',        color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { value: 'doc',     label: 'Documento',  icon: 'ri-file-word-line',       color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'image',   label: 'Imagem',     icon: 'ri-image-line',           color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { value: 'article', label: 'Artigo',     icon: 'ri-article-line',         color: 'text-teal-600 bg-teal-50 border-teal-200' },
] as const;

export default function LessonFormModal({ isOpen, onClose, onSaved, moduleId, editing, nextSortOrder = 0 }: Props) {
  const { user } = useAuth();
  const [type, setType]           = useState<BibleLesson['content_type']>('video');
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [videoUrl, setVideoUrl]   = useState('');
  const [detectedProvider, setDetectedProvider] = useState<'youtube' | 'vimeo' | null>(null);
  const [articleBody, setArticle] = useState('');
  const [duration, setDuration]   = useState('');
  const [published, setPublished] = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setType(editing.content_type);
        setTitle(editing.title);
        setDesc(editing.description || '');
        setVideoUrl(editing.video_url || '');
        setDetectedProvider(editing.video_provider);
        setArticle(editing.article_body || '');
        setDuration(editing.duration_minutes?.toString() || '');
        setPublished(editing.is_published);
        setExistingFileUrl(editing.file_url);
        setExistingFileName(editing.file_name);
        setFile(null);
      } else {
        setType('video'); setTitle(''); setDesc(''); setVideoUrl('');
        setDetectedProvider(null); setArticle(''); setDuration(''); setPublished(false);
        setExistingFileUrl(null); setExistingFileName(null); setFile(null);
      }
    }
  }, [isOpen, editing]);

  const handleVideoUrl = (url: string) => {
    setVideoUrl(url);
    setDetectedProvider(detectVideoProvider(url));
  };

  const acceptedTypes: Record<string, string> = {
    pdf:   'application/pdf',
    doc:   '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    image: 'image/jpeg,image/png,image/webp',
  };

  const uploadFile = async (): Promise<{ url: string; name: string } | null> => {
    if (!file) return existingFileUrl ? { url: existingFileUrl, name: existingFileName || file?.name || '' } : null;
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `lessons/${moduleId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('bible-materials').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return null;
    const { data: urlData } = supabase.storage.from('bible-materials').getPublicUrl(data.path);
    return { url: urlData.publicUrl, name: file.name };
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    let fileData: { url: string; name: string } | null = null;
    if (['pdf','doc','image'].includes(type)) {
      fileData = await uploadFile();
    }
    const payload: any = {
      module_id: moduleId,
      title: title.trim(),
      description: description.trim() || null,
      content_type: type,
      video_url: type === 'video' ? (videoUrl.trim() || null) : null,
      video_provider: type === 'video' ? (detectedProvider || null) : null,
      file_url: fileData?.url || null,
      file_name: fileData?.name || null,
      article_body: type === 'article' ? (articleBody.trim() || null) : null,
      duration_minutes: duration ? parseInt(duration) : null,
      is_published: published,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('bible_lessons').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('bible_lessons').insert({ ...payload, sort_order: nextSortOrder, created_by: user?.id });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">{editing ? 'Editar Aula' : 'Nova Aula'}</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tipo de conteúdo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de conteúdo</label>
            <div className="grid grid-cols-5 gap-1.5">
              {CONTENT_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`py-2.5 px-1 text-[10px] font-medium rounded-xl border-2 cursor-pointer transition-all text-center flex flex-col items-center gap-1
                    ${type === t.value ? t.color + ' border-2' : 'border-gray-100 text-gray-500 hover:border-gray-200 bg-white'}`}>
                  <i className={`${t.icon} text-base`}></i>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inp} placeholder="Ex: Introdução ao módulo" maxLength={100} />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descrição</label>
            <input type="text" value={description} onChange={e => setDesc(e.target.value)} className={inp} placeholder="Breve descrição da aula" maxLength={200} />
          </div>

          {/* Campos por tipo */}
          {type === 'video' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">URL do vídeo</label>
              <input type="url" value={videoUrl} onChange={e => handleVideoUrl(e.target.value)} className={inp} placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..." />
              {videoUrl && (
                <div className={`mt-2 flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-lg w-fit
                  ${detectedProvider === 'youtube' ? 'text-red-700 bg-red-50' : detectedProvider === 'vimeo' ? 'text-[#1ab7ea] bg-[#1ab7ea]/10' : 'text-gray-500 bg-gray-100'}`}>
                  <i className={detectedProvider === 'youtube' ? 'ri-youtube-line' : detectedProvider === 'vimeo' ? 'ri-vimeo-line' : 'ri-link-m'}></i>
                  {detectedProvider ? `Detectado: ${detectedProvider === 'youtube' ? 'YouTube' : 'Vimeo'}` : 'URL não reconhecida (YouTube ou Vimeo)'}
                </div>
              )}
            </div>
          )}

          {(type === 'pdf' || type === 'doc' || type === 'image') && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {type === 'pdf' ? 'Arquivo PDF' : type === 'doc' ? 'Documento Word' : 'Imagem'}
              </label>
              {(file || existingFileUrl) ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <i className={`${type === 'pdf' ? 'ri-file-pdf-line text-rose-600' : type === 'doc' ? 'ri-file-word-line text-blue-600' : 'ri-image-line text-purple-600'} text-2xl flex-shrink-0`}></i>
                  <p className="text-xs font-medium text-gray-700 truncate flex-1">{file?.name || existingFileName || 'Arquivo'}</p>
                  <button type="button" onClick={() => { setFile(null); setExistingFileUrl(null); setExistingFileName(null); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200 cursor-pointer text-gray-500">
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[#5de0e6]/60 hover:bg-gray-50 transition-all">
                  <i className="ri-upload-cloud-2-line text-2xl text-gray-400"></i>
                  <p className="text-xs text-gray-500">Clique para selecionar {type === 'image' ? 'imagem' : 'arquivo'}</p>
                  <p className="text-[11px] text-gray-400">Máx. 50 MB</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept={acceptedTypes[type]} className="hidden"
                onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            </div>
          )}

          {type === 'article' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Conteúdo do artigo</label>
              <textarea value={articleBody} onChange={e => setArticle(e.target.value)} rows={8}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] font-mono"
                placeholder="Escreva o conteúdo do artigo aqui. HTML básico é suportado." />
              <p className="text-[11px] text-gray-400 mt-1 text-right">{articleBody.length} caracteres</p>
            </div>
          )}

          {/* Duração */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Duração estimada (minutos)</label>
            <input type="number" min="1" max="600" value={duration} onChange={e => setDuration(e.target.value)} className={inp} placeholder="Ex: 15" />
          </div>

          {/* Publicar */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-800">Publicar aula</p>
              <p className="text-[11px] text-gray-400">Aulas não publicadas são rascunhos</p>
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
              : <><i className={editing ? 'ri-save-line' : 'ri-add-line'}></i>{editing ? 'Salvar' : 'Criar aula'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

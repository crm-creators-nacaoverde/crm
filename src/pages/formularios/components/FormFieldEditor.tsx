import { useState, useRef } from 'react';
import Button from '../../../components/base/Button';

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'url' | 'rating' | 'section_title' | 'image';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  description?: string;
  image_url?: string;
}

interface FormFieldEditorProps {
  field: FormField;
  index: number;
  totalFields: number;
  onUpdate: (field: FormField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const fieldTypeLabels: Record<FormField['type'], { label: string; icon: string }> = {
  section_title: { label: 'Título de seção', icon: 'ri-heading' },
  image: { label: 'Imagem', icon: 'ri-image-line' },
  text: { label: 'Texto curto', icon: 'ri-text' },
  textarea: { label: 'Texto longo', icon: 'ri-file-text-line' },
  number: { label: 'Número', icon: 'ri-hashtag' },
  email: { label: 'E-mail', icon: 'ri-mail-line' },
  phone: { label: 'Telefone', icon: 'ri-phone-line' },
  select: { label: 'Seleção única', icon: 'ri-list-check' },
  multiselect: { label: 'Múltipla escolha', icon: 'ri-checkbox-multiple-line' },
  checkbox: { label: 'Sim/Não', icon: 'ri-checkbox-line' },
  date: { label: 'Data', icon: 'ri-calendar-line' },
  url: { label: 'Link/URL', icon: 'ri-link' },
  rating: { label: 'Avaliação', icon: 'ri-star-line' },
};

export default function FormFieldEditor({
  field,
  index,
  totalFields,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: FormFieldEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [newOption, setNewOption] = useState('');
  const [imageMode, setImageMode] = useState<'url' | 'file'>(field.image_url && !field.image_url.startsWith('data:') ? 'url' : 'url');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeInfo = fieldTypeLabels[field.type];
  const hasOptions = field.type === 'select' || field.type === 'multiselect';
  const isSectionTitle = field.type === 'section_title';
  const isImage = field.type === 'image';

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    const updated = { ...field, options: [...(field.options || []), newOption.trim()] };
    onUpdate(updated);
    setNewOption('');
  };

  const handleRemoveOption = (optIndex: number) => {
    const updated = { ...field, options: (field.options || []).filter((_, i) => i !== optIndex) };
    onUpdate(updated);
  };

  const handleFileSelect = (file: File) => {
    setImageError('');

    if (!file.type.startsWith('image/')) {
      setImageError('Selecione apenas arquivos de imagem (JPG, PNG, GIF, WebP)');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setImageError('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onUpdate({ ...field, image_url: dataUrl });
      setUploadingImage(false);
    };
    reader.onerror = () => {
      setImageError('Erro ao ler o arquivo. Tente novamente.');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden group hover:border-brand-300 transition-all">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            <i className="ri-arrow-up-s-line text-base"></i>
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalFields - 1}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            <i className="ri-arrow-down-s-line text-base"></i>
          </button>
        </div>

        <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-100 text-brand-600">
          <i className={`${typeInfo.icon} text-sm`}></i>
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate block">
            {field.label || 'Campo sem nome'}
          </span>
          <span className="text-[10px] text-gray-400">{typeInfo.label}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 cursor-pointer transition-all"
          >
            <i className={`ri-arrow-${expanded ? 'up' : 'down'}-s-line text-base`}></i>
          </button>
          <button
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-rose-100 hover:text-rose-600 cursor-pointer transition-all"
          >
            <i className="ri-delete-bin-6-line text-sm"></i>
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-4">
          {isSectionTitle ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Título da seção</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => onUpdate({ ...field, label: e.target.value })}
                  placeholder="Ex: Dados Pessoais"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição da seção</label>
                <textarea
                  value={field.description || ''}
                  onChange={(e) => onUpdate({ ...field, description: e.target.value })}
                  placeholder="Ex: Preencha seus dados pessoais abaixo"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all resize-none"
                />
              </div>
            </>
          ) : isImage ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome identificador</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => onUpdate({ ...field, label: e.target.value })}
                  placeholder="Ex: Banner do formulário"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                />
              </div>

              {/* Toggle URL / Arquivo */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Origem da imagem</label>
                <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => { setImageMode('url'); setImageError(''); }}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                      imageMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <i className="ri-link mr-1.5"></i>URL
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImageMode('file'); setImageError(''); }}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                      imageMode === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <i className="ri-upload-2-line mr-1.5"></i>Arquivo
                  </button>
                </div>
              </div>

              {imageMode === 'url' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">URL da imagem</label>
                  <input
                    type="url"
                    value={field.image_url && !field.image_url.startsWith('data:') ? field.image_url : ''}
                    onChange={(e) => onUpdate({ ...field, image_url: e.target.value })}
                    placeholder="https://exemplo.com/imagem.jpg"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <i className="ri-information-line text-xs"></i>
                    Tamanho recomendado: 1920 x 650 pixels. Cole a URL de uma imagem hospedada.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Enviar imagem</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                      e.target.value = '';
                    }}
                  />
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      uploadingImage
                        ? 'border-brand-300 bg-brand-50/30'
                        : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/20'
                    }`}
                  >
                    {uploadingImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-brand-600 font-medium">Processando imagem...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                          <i className="ri-image-add-line text-xl text-gray-400"></i>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600">
                            Clique para selecionar ou arraste a imagem aqui
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            JPG, PNG, GIF ou WebP • Máximo 5MB • Recomendado: 1920x650px
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {imageError && (
                    <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
                      <i className="ri-error-warning-line text-sm"></i>
                      {imageError}
                    </p>
                  )}
                </div>
              )}

              {field.image_url && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-600">Pré-visualização</label>
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...field, image_url: '' })}
                      className="text-[10px] text-rose-500 hover:text-rose-600 cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <i className="ri-delete-bin-line text-xs"></i>
                      Remover imagem
                    </button>
                  </div>
                  <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img
                      src={field.image_url}
                      alt={field.label || 'Imagem'}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome do campo</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => onUpdate({ ...field, label: e.target.value })}
                    placeholder="Ex: Nome completo"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo do campo</label>
                  <select
                    value={field.type}
                    onChange={(e) => onUpdate({ ...field, type: e.target.value as FormField['type'], options: (e.target.value === 'select' || e.target.value === 'multiselect') ? (field.options || []) : undefined })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all cursor-pointer bg-white"
                  >
                    {Object.entries(fieldTypeLabels).filter(([key]) => key !== 'section_title').map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Texto de ajuda (placeholder)</label>
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
                  placeholder="Ex: Digite seu nome completo"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                />
              </div>

              {/* Options for select/multiselect */}
              {hasOptions && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Opções</label>
                  <div className="space-y-2">
                    {(field.options || []).map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400 font-medium">
                          {i + 1}
                        </div>
                        <span className="flex-1 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">{opt}</span>
                        <button
                          onClick={() => handleRemoveOption(i)}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 cursor-pointer transition-all"
                        >
                          <i className="ri-close-line text-sm"></i>
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                        placeholder="Nova opção..."
                        className="flex-1 px-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                      />
                      <Button size="sm" variant="secondary" onClick={handleAddOption}>
                        <i className="ri-add-line text-sm"></i>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Required toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => onUpdate({ ...field, required: !field.required })}
                  className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${field.required ? 'bg-brand-500' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${field.required ? 'left-[18px]' : 'left-0.5'}`}></div>
                </button>
                <span className="text-xs text-gray-600">Campo obrigatório</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

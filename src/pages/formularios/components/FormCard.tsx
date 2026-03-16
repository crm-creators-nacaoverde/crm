import { useState } from 'react';
import type { FormField } from './FormFieldEditor';

interface FormTemplate {
  id: string;
  name: string;
  public_name?: string | null;
  slug?: string | null;
  description: string;
  fields: FormField[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  share_token?: string;
}

interface FormCardProps {
  form: FormTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function FormCard({ form, onEdit, onDuplicate, onToggleActive, onDelete, canEdit = true, canDelete = true }: FormCardProps) {
  const [copied, setCopied] = useState(false);

  const fieldTypeIcons: Record<string, string> = {
    text: 'ri-text', textarea: 'ri-file-text-line', number: 'ri-hashtag',
    email: 'ri-mail-line', phone: 'ri-phone-line', select: 'ri-list-check',
    multiselect: 'ri-checkbox-multiple-line', checkbox: 'ri-checkbox-line',
    date: 'ri-calendar-line', url: 'ri-link', rating: 'ri-star-line',
  };

  const requiredCount = form.fields.filter(f => f.required).length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // URL preferencial: slug amigável, fallback para share_token
  const getFormUrl = () => {
    const basePath = (window as any).__BASE_PATH__ || '';
    const cleanBase = basePath.startsWith('/') ? basePath.slice(1) : basePath;
    const base = `${window.location.origin}${cleanBase ? '/' + cleanBase : ''}`;

    if (form.slug) return `${base}/f/${form.slug}`;
    if (form.share_token) return `${base}/formulario/${form.share_token}`;
    return '';
  };

  const handleCopyLink = async () => {
    const url = getFormUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const hasLink = !!(form.slug || form.share_token);
  const displayUrl = form.slug ? `/f/${form.slug}` : form.share_token ? `/formulario/${form.share_token.slice(0, 12)}...` : '';

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md group ${form.is_active ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{form.name}</h3>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-gray-100 text-gray-400 rounded-full whitespace-nowrap">
                <i className="ri-lock-line text-[9px]"></i>Interno
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${form.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                {form.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {form.public_name && (
              <div className="flex items-center gap-1 mb-1">
                <i className="ri-global-line text-[10px] text-teal-400"></i>
                <span className="text-xs text-teal-600 font-medium truncate">{form.public_name}</span>
              </div>
            )}
            {/* URL amigável */}
            {hasLink && (
              <div className="flex items-center gap-1 mb-1">
                <i className="ri-link text-[10px] text-indigo-400"></i>
                <span className="text-[10px] text-indigo-500 font-mono truncate">{displayUrl}</span>
                {form.slug && (
                  <span className="ml-1 px-1 py-0.5 text-[8px] font-semibold bg-indigo-50 text-indigo-500 rounded">URL amigável</span>
                )}
              </div>
            )}
            {form.description && (
              <p className="text-xs text-gray-500 line-clamp-2">{form.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Copy link bar */}
      {form.is_active && hasLink && (
        <div className="px-5 pb-3">
          <button
            onClick={handleCopyLink}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-gray-50 border border-gray-150 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={`${copied ? 'ri-check-line' : 'ri-link'} text-sm`}></i>
            </div>
            <span className="truncate flex-1 text-left">
              {copied ? 'Link copiado!' : 'Copiar link para enviar ao creator'}
            </span>
            <div className="w-5 h-5 flex items-center justify-center">
              <i className={`${copied ? 'ri-checkbox-circle-fill text-emerald-500' : 'ri-file-copy-line'} text-sm`}></i>
            </div>
          </button>
        </div>
      )}

      {/* Field types preview */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {form.fields.slice(0, 6).map((field, i) => (
            <div key={i} title={field.label} className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-50 text-gray-400 border border-gray-100">
              <i className={`${fieldTypeIcons[field.type] || 'ri-question-line'} text-xs`}></i>
            </div>
          ))}
          {form.fields.length > 6 && (
            <span className="text-[10px] text-gray-400 font-medium ml-1">+{form.fields.length - 6}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            <i className="ri-list-check text-xs text-gray-400"></i>{form.fields.length} campos
          </span>
          {requiredCount > 0 && (
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <i className="ri-asterisk text-xs text-rose-400"></i>{requiredCount} obrigatórios
            </span>
          )}
          <span className="text-[11px] text-gray-400">{formatDate(form.updated_at || form.created_at)}</span>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <button onClick={onEdit} title="Editar" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-brand-50 hover:text-brand-600 cursor-pointer transition-all">
              <i className="ri-edit-line text-sm"></i>
            </button>
          )}
          {canEdit && (
            <button onClick={onDuplicate} title="Duplicar" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-all">
              <i className="ri-file-copy-line text-sm"></i>
            </button>
          )}
          {canEdit && (
            <button onClick={onToggleActive} title={form.is_active ? 'Desativar' : 'Ativar'} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-all">
              <i className={`${form.is_active ? 'ri-pause-circle-line' : 'ri-play-circle-line'} text-sm`}></i>
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} title="Excluir" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition-all">
              <i className="ri-delete-bin-6-line text-sm"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

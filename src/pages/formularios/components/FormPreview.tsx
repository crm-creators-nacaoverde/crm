import type { FormField } from './FormFieldEditor';

interface FormPreviewProps {
  formName: string;
  formDescription: string;
  fields: FormField[];
}

export default function FormPreview({ formName, formDescription, fields }: FormPreviewProps) {
  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-file-list-3-line text-2xl text-gray-300"></i>
        </div>
        <p className="text-sm text-gray-400">Adicione campos para visualizar o formulário</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {formName && (
        <div className="mb-2">
          <h3 className="text-base font-semibold text-gray-900">{formName}</h3>
          {formDescription && <p className="text-xs text-gray-500 mt-1">{formDescription}</p>}
        </div>
      )}

      {fields.map((field) => (
        <div key={field.id}>
          {field.type === 'section_title' ? (
            <div className="pt-4 pb-1 border-b border-gray-200 mb-1">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <i className="ri-heading text-brand-500 text-base"></i>
                {field.label || 'Título da seção'}
              </h4>
              {field.description && (
                <p className="text-xs text-gray-500 mt-1 ml-6">{field.description}</p>
              )}
            </div>
          ) : field.type === 'image' ? (
            <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
              {field.image_url ? (
                <div className="w-full" style={{ aspectRatio: '1920 / 650' }}>
                  <img
                    src={field.image_url}
                    alt={field.label || 'Imagem'}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-10 text-gray-300" style={{ aspectRatio: '1920 / 650' }}>
                  <i className="ri-image-line text-3xl mb-2"></i>
                  <span className="text-xs">Nenhuma imagem definida</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {field.label || 'Campo sem nome'}
                {field.required && <span className="text-rose-500 ml-1">*</span>}
              </label>

              {field.type === 'text' && (
                <input
                  type="text"
                  placeholder={field.placeholder}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  placeholder={field.placeholder}
                  disabled
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 resize-none"
                />
              )}

              {field.type === 'number' && (
                <input
                  type="number"
                  placeholder={field.placeholder}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
              )}

              {field.type === 'email' && (
                <input
                  type="email"
                  placeholder={field.placeholder || 'email@exemplo.com'}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
              )}

              {field.type === 'phone' && (
                <input
                  type="tel"
                  placeholder={field.placeholder || '(00) 00000-0000'}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
              )}

              {field.type === 'url' && (
                <input
                  type="url"
                  placeholder={field.placeholder || 'https://'}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
              )}

              {field.type === 'date' && (
                <input
                  type="date"
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
              )}

              {field.type === 'select' && (
                <select disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                  <option>{field.placeholder || 'Selecione...'}</option>
                  {(field.options || []).map((opt, i) => (
                    <option key={i}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'multiselect' && (
                <div className="flex flex-wrap gap-2">
                  {(field.options || []).length === 0 ? (
                    <span className="text-xs text-gray-400">Nenhuma opção adicionada</span>
                  ) : (
                    (field.options || []).map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                        <div className="w-4 h-4 border border-gray-300 rounded"></div>
                        {opt}
                      </label>
                    ))
                  )}
                </div>
              )}

              {field.type === 'checkbox' && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 rounded cursor-not-allowed"></div>
                  <span className="text-sm text-gray-500">{field.placeholder || 'Sim'}</span>
                </div>
              )}

              {field.type === 'rating' && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div key={star} className="w-7 h-7 flex items-center justify-center">
                      <i className="ri-star-line text-xl text-gray-300"></i>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      <div className="pt-4 border-t border-gray-100">
        <button disabled className="px-5 py-2 bg-[#004aad] text-white text-sm font-medium rounded-lg opacity-60 cursor-not-allowed whitespace-nowrap">
          Enviar Formulário
        </button>
      </div>
    </div>
  );
}

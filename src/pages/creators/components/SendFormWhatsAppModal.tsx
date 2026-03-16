import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import { supabase, Client } from '../../../lib/supabase';

interface FormTemplate {
  id: string;
  name: string;
  public_name?: string | null;
  description: string;
  is_active: boolean;
  share_token?: string;
  fields: { id: string; type: string; label: string }[];
}

interface SendFormWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export default function SendFormWhatsAppModal({ isOpen, onClose, client }: SendFormWhatsAppModalProps) {
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadForms();
      setSelectedFormId(null);
      setCopied(false);
      setSearch('');
    }
  }, [isOpen]);

  const loadForms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_templates')
        .select('id, name, public_name, description, is_active, share_token, fields')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setForms((data || []).filter((f: FormTemplate) => f.share_token));
    } catch (err) {
      console.error('Erro ao carregar formulários:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFormUrl = (form: FormTemplate) => {
    if (!form.share_token || !client) return '';
    const basePath = __BASE_PATH__ || '';
    const cleanBasePath = basePath.startsWith('/') ? basePath.slice(1) : basePath;
    const url = `${window.location.origin}/${cleanBasePath}/formulario/${form.share_token}?creator=${client.id}`.replace(/\/+/g, '/').replace(':/', '://');
    return url;
  };

  const getWhatsAppUrl = (form: FormTemplate) => {
    if (!client?.phone) return '';
    const url = getFormUrl(form);
    const phone = client.phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${client.name}! 👋\n\nPrecisamos que você preencha o formulário "${form.name}".\n\nAcesse pelo link abaixo:\n${url}\n\nAlguns campos já estarão preenchidos automaticamente para facilitar. 😊`
    );
    return `https://wa.me/${phone}?text=${message}`;
  };

  const handleCopyLink = async (form: FormTemplate) => {
    const url = getFormUrl(form);
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

  const handleSendWhatsApp = (form: FormTemplate) => {
    const url = getWhatsAppUrl(form);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const filteredForms = forms.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedForm = forms.find(f => f.id === selectedFormId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar Formulário via WhatsApp"
      subtitle={client ? `Para: ${client.name}` : ''}
      size="md"
    >
      <div className="space-y-4">
        {/* Creator info */}
        {client && (
          <div className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <i className="ri-whatsapp-line text-white text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{client.name}</p>
              <p className="text-xs text-gray-500">{client.phone}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 rounded-lg">
              <i className="ri-magic-line text-xs text-emerald-600"></i>
              <span className="text-[11px] font-medium text-emerald-700">Preenchimento automático</span>
            </div>
          </div>
        )}

        {/* Search */}
        {forms.length > 3 && (
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar formulário..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
            />
          </div>
        )}

        {/* Forms list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-3 text-xs text-gray-400">Carregando formulários...</p>
            </div>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
              <i className="ri-file-list-3-line text-2xl text-gray-300"></i>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              {forms.length === 0 ? 'Nenhum formulário ativo' : 'Nenhum resultado'}
            </p>
            <p className="text-xs text-gray-400">
              {forms.length === 0
                ? 'Crie e ative um formulário na página de Formulários'
                : 'Tente outra busca'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {filteredForms.map((form) => {
              const isSelected = selectedFormId === form.id;
              return (
                <button
                  key={form.id}
                  onClick={() => setSelectedFormId(isSelected ? null : form.id)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-400 bg-brand-50/50 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 transition-all ${
                      isSelected ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <i className="ri-survey-line text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-brand-700' : 'text-gray-800'}`}>
                          {form.public_name || form.name}
                        </p>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {form.fields?.length || 0} campos
                        </span>
                      </div>
                      {form.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{form.description}</p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <i className="ri-check-line text-white text-xs"></i>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Actions */}
        {selectedForm && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-gray-400 mb-1.5">Link personalizado para {client?.name}:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-gray-600 bg-white px-2.5 py-1.5 rounded-md border border-gray-200 truncate block">
                  {getFormUrl(selectedForm)}
                </code>
                <button
                  onClick={() => handleCopyLink(selectedForm)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    copied ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                  title="Copiar link"
                >
                  <i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} text-sm`}></i>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <button
                onClick={() => handleSendWhatsApp(selectedForm)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-whatsapp-line text-base"></i>
                Enviar pelo WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

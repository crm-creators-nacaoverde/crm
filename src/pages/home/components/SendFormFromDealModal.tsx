import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import { supabase } from '../../../lib/supabase';

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  share_token?: string;
  fields: { id: string; type: string; label: string }[];
}

interface SendFormFromDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealTitle: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
}

export default function SendFormFromDealModal({
  isOpen,
  onClose,
  dealTitle,
  clientId,
  clientName,
  clientPhone,
}: SendFormFromDealModalProps) {
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
        .select('id, name, description, is_active, share_token, fields')
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
    if (!form.share_token || !clientId) return '';
    return `${window.location.origin}${__BASE_PATH__ || ''}/formulario/${form.share_token}?creator=${clientId}`;
  };

  const getWhatsAppUrl = (form: FormTemplate) => {
    if (!clientPhone) return '';
    const url = getFormUrl(form);
    const phone = clientPhone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${clientName}! 👋\n\nReferente a "${dealTitle}", precisamos que você preencha o formulário "${form.name}".\n\nAcesse pelo link abaixo:\n${url}\n\nAlguns campos já estarão preenchidos automaticamente. 😊`
    );
    return `https://wa.me/${phone}?text=${message}`;
  };

  const handleCopyLink = async (form: FormTemplate) => {
    const url = getFormUrl(form);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

  if (!clientId) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Enviar Formulário" size="sm">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
            <i className="ri-user-unfollow-line text-2xl text-amber-400"></i>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhum creator vinculado</p>
          <p className="text-xs text-gray-400">Vincule um creator a esta negociação para enviar formulários.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar Formulário ao Creator"
      subtitle={`Negociação: ${dealTitle}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Creator info */}
        <div className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <i className="ri-whatsapp-line text-white text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{clientName}</p>
            <p className="text-xs text-gray-500">{clientPhone || 'Sem telefone cadastrado'}</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#5de0e6]/10 rounded-lg">
            <i className="ri-magic-line text-xs text-[#004aad]"></i>
            <span className="text-[11px] font-medium text-[#004aad]">Auto-preenchimento</span>
          </div>
        </div>

        {/* Info about data sync */}
        <div className="flex items-start gap-2.5 bg-sky-50/60 border border-sky-100 rounded-xl p-3">
          <i className="ri-refresh-line text-sky-500 text-base mt-0.5"></i>
          <div>
            <p className="text-xs font-medium text-sky-800">Sincronização automática</p>
            <p className="text-[11px] text-sky-600 mt-0.5">
              Quando o creator preencher e enviar o formulário, os dados serão atualizados automaticamente no cadastro dele.
            </p>
          </div>
        </div>

        {/* Search */}
        {forms.length > 3 && (
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar formulário..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
            />
          </div>
        )}

        {/* Forms list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {filteredForms.map((form) => {
              const isSelected = selectedFormId === form.id;
              return (
                <button
                  key={form.id}
                  onClick={() => setSelectedFormId(isSelected ? null : form.id)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-teal-400 bg-teal-50/50 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 transition-all ${
                      isSelected ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <i className="ri-survey-line text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-teal-700' : 'text-gray-800'}`}>
                          {form.name}
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
                      isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300'
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
              <p className="text-[11px] text-gray-400 mb-1.5">Link personalizado para {clientName}:</p>
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
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSendWhatsApp(selectedForm)}
                disabled={!clientPhone}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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

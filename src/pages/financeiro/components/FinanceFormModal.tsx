import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';

interface ClientOption { id: string; name: string; chave_pix: string | null; chave_pix_tipo: string | null; cpf_cnpj: string | null; }

interface PaymentFormData {
  id?: string;
  client_id: string;
  client_name: string;
  type: string;
  amount: string;
  status: string;
  pix_key: string;
  pix_key_type: string;
  notes: string;
  due_date: string;
  paid_at: string;
  receipt_url?: string;
  receipt_name?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (payload?: any) => void;
  editing?: PaymentFormData | null;
}


const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Aleatória',
};

const PAYMENT_TYPES_FALLBACK = [
  { value: 'premiacao', label: 'Premiação', icon: 'ri-trophy-line', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'cache', label: 'Cachê', icon: 'ri-money-dollar-circle-line', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'bonus', label: 'Bônus', icon: 'ri-gift-line', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { value: 'reembolso', label: 'Reembolso', icon: 'ri-refund-line', color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { value: 'outro', label: 'Outro', icon: 'ri-more-line', color: 'text-gray-700 bg-gray-50 border-gray-200' },
];

export default function FinanceFormModal({ isOpen, onClose, onSaved, editing }: Props) {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const [paymentTypes, setPaymentTypes] = useState<{ value: string; label: string; icon: string; color: string }[]>(PAYMENT_TYPES_FALLBACK);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const emptyForm: PaymentFormData = {
    client_id: '', client_name: '', type: paymentTypes[0]?.value || '', amount: '',
    status: 'pendente', pix_key: '', pix_key_type: 'cpf',
    notes: '', due_date: '', paid_at: '',
  };
  const [form, setForm] = useState<PaymentFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('payment_types').select('id, name').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const icons = ['ri-trophy-line','ri-money-dollar-circle-line','ri-gift-line','ri-refund-line','ri-more-line','ri-wallet-line','ri-bank-line'];
          const colors = [
            'text-amber-700 bg-amber-50 border-amber-200',
            'text-blue-700 bg-blue-50 border-blue-200',
            'text-purple-700 bg-purple-50 border-purple-200',
            'text-teal-700 bg-teal-50 border-teal-200',
            'text-gray-700 bg-gray-50 border-gray-200',
            'text-green-700 bg-green-50 border-green-200',
            'text-rose-700 bg-rose-50 border-rose-200',
          ];
          setPaymentTypes(data.map((p, i) => ({
            value: p.id,
            label: p.name,
            icon: icons[i % icons.length],
            color: colors[i % colors.length],
          })));
        }
      });
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadClients();
      if (editing) {
        setForm({ ...editing, amount: editing.amount?.toString() || '' });
        setClientSearch(editing.client_name);
        if (editing.receipt_url) setUploadedFile({ url: editing.receipt_url, name: editing.receipt_name || 'Comprovante' });
        else setUploadedFile(null);
      } else {
        setForm(emptyForm);
        setClientSearch('');
        setUploadedFile(null);
        setErrors({});
      }
    }
  }, [isOpen, editing]);

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, chave_pix, chave_pix_tipo, cpf_cnpj')
      .eq('is_active', true)
      .order('name');
    setClients(data || []);
  };

  const selectClient = (c: ClientOption) => {
    setForm(prev => ({
      ...prev,
      client_id: c.id,
      client_name: c.name,
      pix_key: c.chave_pix || '',
      pix_key_type: c.chave_pix_tipo || 'cpf',
    }));
    setClientSearch(c.name);
    setShowDropdown(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) { setErrors(e => ({ ...e, receipt: 'Arquivo inválido. Use JPG, PNG, WEBP ou PDF.' })); return; }
    if (file.size > 10 * 1024 * 1024) { setErrors(e => ({ ...e, receipt: 'Arquivo muito grande. Máx. 10 MB.' })); return; }
    setUploading(true);
    setErrors(e => ({ ...e, receipt: '' }));
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) { setErrors(e => ({ ...e, receipt: 'Erro no upload. Tente novamente.' })); return; }
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(data.path);
    setUploadedFile({ url: urlData.publicUrl, name: file.name });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.client_id) e.client = 'Selecione um creator';
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) e.amount = 'Informe um valor válido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      client_id: form.client_id,
      client_name: form.client_name,
      type: form.type,
      amount: parseFloat(form.amount),
      status: form.status,
      pix_key: form.pix_key || null,
      pix_key_type: form.pix_key_type || null,
      receipt_url: uploadedFile?.url || null,
      receipt_name: uploadedFile?.name || null,
      notes: form.notes || null,
      due_date: form.due_date || null,
      paid_at: form.status === 'pago' ? (form.paid_at ? new Date(form.paid_at).toISOString() : new Date().toISOString()) : null,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    };
    if (editing?.id) {
      await supabase.from('creator_payments').update(payload).eq('id', editing.id);
      await logActivity({ action: 'update', module: 'financeiro', entityId: editing.id, entityName: form.client_name, details: { type: form.type, amount: parseFloat(form.amount), status: form.status } });
      
      setSaving(false);
      onSaved({
        isNew: false,
        client_id: form.client_id,
        type: form.type,
        amount: parseFloat(form.amount),
        status: form.status,
        previousStatus: editing.status
      });
    } else {
      const { data: newPay } = await supabase.from('creator_payments').insert({ ...payload, created_by: user?.id || null, created_by_name: user?.email || '' }).select('id').single();
      await logActivity({ action: 'create', module: 'financeiro', entityId: newPay?.id, entityName: form.client_name, details: { type: form.type, amount: parseFloat(form.amount) } });
      
      setSaving(false);
      onSaved({
        isNew: true,
        client_id: form.client_id,
        type: form.type,
        amount: parseFloat(form.amount),
        status: form.status
      });
    }
    onClose();
  };

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';
  const isEditing = !!editing?.id;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center">
              <i className="ri-money-dollar-circle-line text-[#004aad] text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{isEditing ? 'Editar Pagamento' : 'Novo Pagamento'}</p>
              <p className="text-[11px] text-gray-400">{isEditing ? editing.client_name : 'Registrar para um creator'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Creator */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Creator <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input type="text" value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); if (!e.target.value) setForm(f => ({ ...f, client_id: '', client_name: '' })); }}
                onFocus={() => setShowDropdown(true)}
                disabled={isEditing}
                placeholder="Buscar creator..."
                className={`${inp} pl-9 ${errors.client ? 'border-rose-400' : ''} ${isEditing ? 'bg-gray-50 cursor-default' : ''}`} />
            </div>
            {errors.client && <p className="text-xs text-rose-600 mt-1">{errors.client}</p>}
            {showDropdown && !isEditing && clientSearch && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {filteredClients.length === 0
                  ? <p className="px-4 py-3 text-sm text-gray-400">Nenhum creator encontrado</p>
                  : filteredClients.map(c => (
                    <button key={c.id} onClick={() => selectClient(c)}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 cursor-pointer transition-colors">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        {c.chave_pix && <p className="text-[11px] text-gray-400 truncate">PIX: {c.chave_pix}</p>}
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Tipo de pagamento */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo</label>
            <div className="grid grid-cols-5 gap-1.5">
              {paymentTypes.map(t => (
                <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`py-2.5 px-1 text-[11px] font-medium rounded-xl border-2 cursor-pointer transition-all text-center flex flex-col items-center gap-1
                    ${form.type === t.value ? t.color + ' border-2' : 'border-gray-100 text-gray-500 hover:border-gray-200 bg-white'}`}>
                  <i className={`${t.icon} text-base`}></i>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Valor e Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Valor (R$) <span className="text-rose-500">*</span>
              </label>
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setErrors(er => ({ ...er, amount: '' })); }}
                placeholder="0,00"
                className={`${inp} ${errors.amount ? 'border-rose-400' : ''}`} />
              {errors.amount && <p className="text-xs text-rose-600 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* PIX */}
          {form.client_id && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <i className="ri-bank-card-line text-emerald-600 text-sm"></i>
                <p className="text-xs font-semibold text-emerald-800">Chave PIX do pagamento</p>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' },
                  { value: 'email', label: 'E-mail' }, { value: 'telefone', label: 'Tel.' },
                  { value: 'aleatoria', label: 'Aleat.' },
                ].map(t => (
                  <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, pix_key_type: t.value }))}
                    className={`py-1.5 text-[11px] font-medium rounded-lg border cursor-pointer transition-all
                      ${form.pix_key_type === t.value ? 'border-emerald-400 bg-white text-emerald-700' : 'border-transparent text-emerald-600 hover:bg-emerald-100'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <input type="text" value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))}
                placeholder="Chave PIX"
                className="w-full px-3 py-2 text-sm font-mono border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300/40 bg-white" />
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vencimento</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inp} />
            </div>
            {form.status === 'pago' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Data do pagamento</label>
                <input type="date" value={form.paid_at?.split('T')[0] || ''} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} className={inp} />
              </div>
            )}
          </div>

          {/* Comprovante */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Comprovante</label>
            {uploadedFile ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className={`${uploadedFile.name.endsWith('.pdf') ? 'ri-file-pdf-line text-rose-600' : 'ri-image-line text-emerald-600'} text-lg`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 truncate">{uploadedFile.name}</p>
                  <a href={uploadedFile.url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-emerald-600 hover:underline">Ver comprovante</a>
                </div>
                <button type="button" onClick={() => setUploadedFile(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-100 cursor-pointer text-emerald-600">
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all
                  ${uploading ? 'border-[#5de0e6] bg-[#5de0e6]/5' : 'border-gray-200 hover:border-[#5de0e6]/60 hover:bg-gray-50'}`}>
                {uploading
                  ? <><i className="ri-loader-4-line animate-spin text-[#004aad] text-xl"></i><p className="text-xs text-gray-500">Enviando...</p></>
                  : <><i className="ri-upload-cloud-2-line text-gray-400 text-2xl"></i>
                     <p className="text-xs text-gray-500">Clique para anexar comprovante</p>
                     <p className="text-[11px] text-gray-400">JPG, PNG, PDF — máx. 10 MB</p></>}
              </div>
            )}
            {errors.receipt && <p className="text-xs text-rose-600 mt-1">{errors.receipt}</p>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ''; }} />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Detalhes sobre o pagamento..." rows={2} maxLength={500}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6]" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || uploading}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</>
              : <><i className={isEditing ? 'ri-save-line' : 'ri-add-line'}></i>{isEditing ? 'Salvar' : 'Registrar'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

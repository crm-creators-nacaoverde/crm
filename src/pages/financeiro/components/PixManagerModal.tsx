import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  currentPixKey: string | null;
  currentPixType: string | null;
  onSaved: (key: string, type: string) => void;
}

const PIX_TYPES = [
  { value: 'cpf',       label: 'CPF',              mask: '000.000.000-00' },
  { value: 'cnpj',      label: 'CNPJ',             mask: '00.000.000/0000-00' },
  { value: 'email',     label: 'E-mail',            mask: '' },
  { value: 'telefone',  label: 'Telefone',          mask: '+55 (00) 00000-0000' },
  { value: 'aleatoria', label: 'Chave aleatória',   mask: '' },
];

export default function PixManagerModal({
  isOpen, onClose, clientId, clientName, currentPixKey, currentPixType, onSaved,
}: Props) {
  const { logActivity } = useActivityLog();
  const [pixKey, setPixKey] = useState('');
  const [pixType, setPixType] = useState('cpf');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPixKey(currentPixKey || '');
      setPixType(currentPixType || 'cpf');
      setError('');
    }
  }, [isOpen, currentPixKey, currentPixType]);

  const handleSave = async () => {
    if (!pixKey.trim()) { setError('Informe a chave PIX.'); return; }
    setSaving(true);
    const { error: err } = await supabase
      .from('clients')
      .update({ chave_pix: pixKey.trim(), chave_pix_tipo: pixType, updated_at: new Date().toISOString() })
      .eq('id', clientId);
    setSaving(false);
    if (err) { setError('Erro ao salvar. Tente novamente.'); return; }
    await logActivity({ action: 'update', module: 'financeiro', entityId: clientId, entityName: clientName, details: { field: 'pix_key', pix_key_type: pixType } });
    onSaved(pixKey.trim(), pixType);
    onClose();
  };

  if (!isOpen) return null;

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <i className="ri-bank-card-line text-emerald-600 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Chave PIX</p>
              <p className="text-[11px] text-gray-400">{clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de chave</label>
            <div className="grid grid-cols-5 gap-1.5">
              {PIX_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setPixType(t.value)}
                  className={`py-2 px-1 text-[11px] font-medium rounded-lg border-2 cursor-pointer transition-all text-center
                    ${pixType === t.value ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chave */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Chave PIX — {PIX_TYPES.find(t => t.value === pixType)?.label}
            </label>
            <input type="text" value={pixKey} onChange={e => { setPixKey(e.target.value); setError(''); }}
              placeholder={pixType === 'email' ? 'email@exemplo.com' : pixType === 'aleatoria' ? 'Cole a chave aleatória' : PIX_TYPES.find(t => t.value === pixType)?.mask}
              className={`${inp} font-mono`} />
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          </div>

          {/* Info box */}
          {currentPixKey && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <i className="ri-information-line text-gray-400 text-sm flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500">Chave atual</p>
                <p className="text-xs font-mono font-medium text-gray-700 truncate">{currentPixKey}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</> : <><i className="ri-save-line"></i>Salvar PIX</>}
          </button>
        </div>
      </div>
    </div>
  );
}

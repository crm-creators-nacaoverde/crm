import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Payment {
  id: string;
  client_id: string;
  client_name: string;
  type: string;
  amount: number;
  status: string;
  pix_key: string | null;
  pix_key_type: string | null;
  receipt_url: string | null;
  receipt_name: string | null;
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  payment: Payment;
  onClose: () => void;
  onEdit: (p: Payment) => void;
  canEdit: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  premiacao: { label: 'Premiação',  icon: 'ri-trophy-line',               color: 'text-amber-700 bg-amber-50' },
  cache:     { label: 'Cachê',      icon: 'ri-money-dollar-circle-line',  color: 'text-blue-700 bg-blue-50' },
  bonus:     { label: 'Bônus',      icon: 'ri-gift-line',                 color: 'text-purple-700 bg-purple-50' },
  reembolso: { label: 'Reembolso',  icon: 'ri-refund-line',               color: 'text-teal-700 bg-teal-50' },
  outro:     { label: 'Outro',      icon: 'ri-more-line',                 color: 'text-gray-700 bg-gray-100' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pendente:  { label: 'Pendente',  color: 'text-amber-700 bg-amber-100',   icon: 'ri-time-line' },
  pago:      { label: 'Pago',      color: 'text-emerald-700 bg-emerald-100', icon: 'ri-checkbox-circle-line' },
  cancelado: { label: 'Cancelado', color: 'text-rose-700 bg-rose-100',     icon: 'ri-close-circle-line' },
};

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Chave aleatória',
};

export default function FinanceDetailModal({ payment, onClose, onEdit, canEdit }: Props) {
  const [history, setHistory] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [payment.client_id]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('creator_payments')
      .select('*')
      .eq('client_id', payment.client_id)
      .neq('id', payment.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setHistory(data || []);
    setLoadingHistory(false);
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const type = TYPE_CONFIG[payment.type] || TYPE_CONFIG.outro;
  const status = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pendente;
  const isPDF = payment.receipt_name?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type.color}`}>
              <i className={`${type.icon} text-lg`}></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{payment.client_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-400">{type.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
                  <i className={`${status.icon} mr-0.5`}></i>{status.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Valor destaque */}
          <div className="bg-[#004aad]/5 border border-[#004aad]/15 rounded-2xl p-5 text-center">
            <p className="text-[11px] font-semibold text-[#004aad]/60 uppercase tracking-wide mb-1">Valor</p>
            <p className="text-3xl font-bold text-[#004aad]">{fmtMoney(payment.amount)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Info pagamento */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalhes</p>
              <div>
                <p className="text-[11px] text-gray-400">Tipo</p>
                <p className="text-sm font-medium text-gray-800">{type.label}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Vencimento</p>
                <p className="text-sm text-gray-700">{fmt(payment.due_date)}</p>
              </div>
              {payment.paid_at && (
                <div>
                  <p className="text-[11px] text-gray-400">Pago em</p>
                  <p className="text-sm font-medium text-emerald-700">{fmt(payment.paid_at)}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-gray-400">Registrado em</p>
                <p className="text-sm text-gray-700">{fmt(payment.created_at)}</p>
              </div>
              {payment.created_by_name && (
                <div>
                  <p className="text-[11px] text-gray-400">Criado por</p>
                  <p className="text-sm text-gray-700">{payment.created_by_name}</p>
                </div>
              )}
            </div>

            {/* PIX */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                <i className="ri-bank-card-line"></i>Chave PIX
              </p>
              {payment.pix_key ? (
                <>
                  <div>
                    <p className="text-[11px] text-emerald-600/70">Tipo</p>
                    <p className="text-sm font-medium text-emerald-800">{PIX_TYPE_LABELS[payment.pix_key_type || ''] || payment.pix_key_type}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-emerald-600/70">Chave</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-medium text-emerald-900 break-all flex-1">{payment.pix_key}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(payment.pix_key!)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-100 cursor-pointer flex-shrink-0"
                        title="Copiar">
                        <i className="ri-file-copy-line text-emerald-600 text-sm"></i>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-24 text-emerald-400">
                  <i className="ri-bank-card-line text-2xl mb-1"></i>
                  <p className="text-xs">Sem chave PIX</p>
                </div>
              )}
            </div>
          </div>

          {/* Comprovante */}
          {payment.receipt_url && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Comprovante</p>
              {isPDF ? (
                <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors">
                  <div className="w-9 h-9 bg-rose-100 rounded-lg flex items-center justify-center">
                    <i className="ri-file-pdf-line text-rose-600 text-lg"></i>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-rose-800">{payment.receipt_name || 'Comprovante.pdf'}</p>
                    <p className="text-[11px] text-rose-600">Clique para abrir</p>
                  </div>
                  <i className="ri-external-link-line text-rose-500 ml-auto"></i>
                </a>
              ) : (
                <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity">
                  <img src={payment.receipt_url} alt="Comprovante" className="w-full max-h-64 object-contain bg-gray-50" />
                  <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-2">
                    <i className="ri-image-line text-gray-400 text-sm"></i>
                    <span className="text-xs text-gray-500">{payment.receipt_name || 'Comprovante'}</span>
                    <i className="ri-external-link-line text-gray-400 text-xs ml-auto"></i>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Observações */}
          {payment.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observações</p>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{payment.notes}</p>
              </div>
            </div>
          )}

          {/* Histórico do creator */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Outros pagamentos de {payment.client_name}
            </p>
            {loadingHistory ? (
              <div className="h-16 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin text-gray-400"></i>
              </div>
            ) : history.length === 0 ? (
              <div className="h-14 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                Nenhum outro pagamento registrado
              </div>
            ) : (
              <div className="space-y-1.5">
                {history.map(h => {
                  const ht = TYPE_CONFIG[h.type] || TYPE_CONFIG.outro;
                  const hs = STATUS_CONFIG[h.status] || STATUS_CONFIG.pendente;
                  return (
                    <div key={h.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ht.color}`}>
                        <i className={`${ht.icon} text-xs`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">{ht.label}</p>
                        <p className="text-[11px] text-gray-400">{fmt(h.created_at)}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${hs.color}`}>{hs.label}</span>
                      <span className="text-xs font-bold text-gray-700 flex-shrink-0">{fmtMoney(h.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
            Fechar
          </button>
          {canEdit && (
            <button onClick={() => onEdit(payment)}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2">
              <i className="ri-edit-line"></i>Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

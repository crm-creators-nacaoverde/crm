import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../hooks/useActivityLog';
import AppLayout from '../../components/feature/AppLayout';
import FinanceFormModal from './components/FinanceFormModal';
import FinanceDetailModal from './components/FinanceDetailModal';
import PixManagerModal from './components/PixManagerModal';

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

interface Stats {
  total: number;
  totalAmount: number;
  pendente: number;
  pago: number;
  cancelado: number;
  paidAmount: number;
  pendingAmount: number;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  premiacao: { label: 'Premiação',  icon: 'ri-trophy-line',              color: 'text-amber-700',  bg: 'bg-amber-100' },
  cache:     { label: 'Cachê',      icon: 'ri-money-dollar-circle-line', color: 'text-blue-700',   bg: 'bg-blue-100' },
  bonus:     { label: 'Bônus',      icon: 'ri-gift-line',                color: 'text-purple-700', bg: 'bg-purple-100' },
  reembolso: { label: 'Reembolso',  icon: 'ri-refund-line',              color: 'text-teal-700',   bg: 'bg-teal-100' },
  outro:     { label: 'Outro',      icon: 'ri-more-line',                color: 'text-gray-600',   bg: 'bg-gray-100' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pendente:  { label: 'Pendente',  color: 'text-amber-700',   bg: 'bg-amber-100',   icon: 'ri-time-line' },
  pago:      { label: 'Pago',      color: 'text-emerald-700', bg: 'bg-emerald-100', icon: 'ri-checkbox-circle-line' },
  cancelado: { label: 'Cancelado', color: 'text-rose-700',    bg: 'bg-rose-100',    icon: 'ri-close-circle-line' },
};

export default function FinanceiroPage() {
  const { hasPermission } = useAuth();
  const { logActivity } = useActivityLog();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pixClient, setPixClient] = useState<{ id: string; name: string; pix: string | null; pixType: string | null } | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, totalAmount: 0, pendente: 0, pago: 0, cancelado: 0, paidAmount: 0, pendingAmount: 0 });

  const canEdit = hasPermission('deals', 'edit');
  const canDelete = hasPermission('deals', 'delete');

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('creator_payments')
      .select('*')
      .order('created_at', { ascending: false });
    const list = data || [];
    setPayments(list);
    setStats({
      total: list.length,
      totalAmount: list.reduce((s, p) => s + Number(p.amount), 0),
      pendente: list.filter(p => p.status === 'pendente').length,
      pago: list.filter(p => p.status === 'pago').length,
      cancelado: list.filter(p => p.status === 'cancelado').length,
      paidAmount: list.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.amount), 0),
      pendingAmount: list.filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.amount), 0),
    });
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    const item = payments.find(p => p.id === deletingId);
    // Remover comprovante do storage se existir
    if (item?.receipt_url) {
      const path = item.receipt_url.split('/receipts/')[1];
      if (path) await supabase.storage.from('receipts').remove([path]);
    }
    await supabase.from('creator_payments').delete().eq('id', deletingId);
    if (item) await logActivity({ action: 'delete', module: 'financeiro', entityId: deletingId, entityName: item.client_name, details: { amount: item.amount, type: item.type } });
    setDeletingId(null);
    setDeleting(false);
    await fetchPayments();
  };

  const filtered = payments.filter(p => {
    const matchSearch = !search ||
      p.client_name.toLowerCase().includes(search.toLowerCase()) ||
      p.pix_key?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchType = typeFilter === 'all' || p.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total de pagamentos', value: stats.total.toString(), icon: 'ri-money-dollar-circle-line', bg: 'bg-[#004aad]/10', ic: 'text-[#004aad]' },
            { label: 'Valor total', value: fmtMoney(stats.totalAmount), icon: 'ri-hand-coin-line', bg: 'bg-[#5de0e6]/10', ic: 'text-[#004aad]' },
            { label: 'Pagos', value: fmtMoney(stats.paidAmount), icon: 'ri-checkbox-circle-line', bg: 'bg-emerald-50', ic: 'text-emerald-600' },
            { label: 'Pendente', value: fmtMoney(stats.pendingAmount), icon: 'ri-time-line', bg: 'bg-amber-50', ic: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <i className={`${s.icon} text-lg ${s.ic}`}></i>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate">{s.value}</p>
                <p className="text-[11px] text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input type="text" placeholder="Buscar creator ou chave PIX..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6]" />
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none cursor-pointer appearance-none bg-white">
                <option value="all">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none cursor-pointer appearance-none bg-white">
                <option value="all">Todos os tipos</option>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {canEdit && (
                <button onClick={() => { setEditing(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                  <i className="ri-add-line text-sm"></i>Novo Pagamento
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Valor</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">PIX</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vencimento</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Comprovante</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-16 text-center">
                    <div className="w-10 h-10 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-gray-400 mt-3">Carregando...</p>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <i className="ri-money-dollar-circle-line text-3xl text-gray-300"></i>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Nenhum pagamento encontrado</p>
                    <p className="text-xs text-gray-400 mt-1">{search || statusFilter !== 'all' ? 'Ajuste os filtros' : 'Registre o primeiro pagamento'}</p>
                  </td></tr>
                ) : filtered.map(p => {
                  const t = TYPE_CONFIG[p.type] || TYPE_CONFIG.outro;
                  const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendente;
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-xs">{p.client_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{p.client_name}</p>
                            <p className="text-[11px] text-gray-400">{fmt(p.created_at)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${t.bg} ${t.color}`}>
                          <i className={`${t.icon} text-[10px]`}></i>{t.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-bold text-gray-900">{fmtMoney(p.amount)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
                          <i className={`${s.icon} text-[10px]`}></i>{s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.pix_key ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-gray-700 truncate max-w-[100px]">{p.pix_key}</span>
                            <button onClick={() => navigator.clipboard.writeText(p.pix_key!)}
                              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-[#004aad] cursor-pointer opacity-0 group-hover:opacity-100 transition-all" title="Copiar PIX">
                              <i className="ri-file-copy-line text-xs"></i>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setPixClient({ id: p.client_id, name: p.client_name, pix: p.pix_key, pixType: p.pix_key_type })}
                            className="text-xs text-[#004aad] hover:underline cursor-pointer flex items-center gap-1">
                            <i className="ri-add-line text-[10px]"></i>Adicionar PIX
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{fmt(p.due_date)}</td>
                      <td className="px-5 py-3.5">
                        {p.receipt_url ? (
                          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#004aad] hover:underline">
                            <i className={`${p.receipt_name?.endsWith('.pdf') ? 'ri-file-pdf-line' : 'ri-image-line'} text-sm`}></i>
                            Ver
                          </a>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setSelected(p)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-lg cursor-pointer transition-all" title="Ver detalhes">
                            <i className="ri-eye-line text-sm"></i>
                          </button>
                          {canEdit && (
                            <button onClick={() => { setEditing(p); setShowForm(true); }}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-lg cursor-pointer transition-all" title="Editar">
                              <i className="ri-edit-line text-sm"></i>
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => setPixClient({ id: p.client_id, name: p.client_name, pix: p.pix_key, pixType: p.pix_key_type })}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-all" title="Gerenciar PIX">
                              <i className="ri-bank-card-line text-sm"></i>
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeletingId(p.id)}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all" title="Excluir">
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              {filtered.length} pagamento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <FinanceFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={fetchPayments}
        editing={editing}
      />

      {selected && (
        <FinanceDetailModal
          payment={selected}
          onClose={() => setSelected(null)}
          onEdit={p => { setSelected(null); setEditing(p); setShowForm(true); }}
          canEdit={canEdit}
        />
      )}

      {pixClient && (
        <PixManagerModal
          isOpen={!!pixClient}
          onClose={() => setPixClient(null)}
          clientId={pixClient.id}
          clientName={pixClient.name}
          currentPixKey={pixClient.pix}
          currentPixType={pixClient.pixType}
          onSaved={(key, type) => {
            setPayments(prev => prev.map(p => p.client_id === pixClient!.id ? { ...p, pix_key: key, pix_key_type: type } : p));
          }}
        />
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-rose-50 rounded-xl flex items-center justify-center">
                <i className="ri-delete-bin-line text-rose-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Excluir pagamento</p>
                <p className="text-xs text-gray-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">O comprovante também será removido do storage.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <><i className="ri-loader-4-line animate-spin"></i>Excluindo...</> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

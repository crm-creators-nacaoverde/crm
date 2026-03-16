
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../hooks/useActivityLog';
import AppLayout from '../../components/feature/AppLayout';
import Button from '../../components/base/Button';
import Modal from '../../components/base/Modal';
import LogisticsFormModal from './components/LogisticsFormModal';
import LogisticsDetailModal from './components/LogisticsDetailModal';

interface LogisticsItem {
  id: string;
  client_id: string;
  deal_id: string | null;
  client_name: string;
  shipping_status: string;
  tracking_code: string | null;
  carrier: string | null;
  shipping_date: string | null;
  estimated_delivery: string | null;
  delivered_date: string | null;
  shipping_address: string | null;
  notes: string | null;
  updated_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deal_title?: string;
  deal_stage?: string;
  client_email?: string;
  client_phone?: string;
  client_city?: string;
  client_state?: string;
}

interface LogisticsStats {
  total: number;
  pending: number;
  shipped: number;
  delivered: number;
  inTransit: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-100', icon: 'ri-time-line' },
  preparing: { label: 'Preparando', color: 'text-sky-700', bg: 'bg-sky-100', icon: 'ri-box-3-line' },
  shipped: { label: 'Enviado', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: 'ri-truck-line' },
  in_transit: { label: 'Em Trânsito', color: 'text-violet-700', bg: 'bg-violet-100', icon: 'ri-route-line' },
  delivered: { label: 'Entregue', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: 'ri-checkbox-circle-line' },
  returned: { label: 'Devolvido', color: 'text-rose-700', bg: 'bg-rose-100', icon: 'ri-arrow-go-back-line' },
};

export default function LogisticaPage() {
  const { user, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();
  const [items, setItems] = useState<LogisticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<LogisticsItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<LogisticsItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState<LogisticsStats>({ total: 0, pending: 0, shipped: 0, delivered: 0, inTransit: 0 });

  const canEdit = hasPermission('deals', 'edit');
  const canDelete = hasPermission('deals', 'delete');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data: logisticsData, error } = await supabase
        .from('logistics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with client and deal data
      const clientIds = [...new Set((logisticsData || []).map(l => l.client_id))];
      const dealIds = [...new Set((logisticsData || []).filter(l => l.deal_id).map(l => l.deal_id))];

      let clientsMap: Record<string, any> = {};
      let dealsMap: Record<string, any> = {};

      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name, email, phone, endereco_cidade, endereco_estado')
          .in('id', clientIds);
        (clientsData || []).forEach(c => { clientsMap[c.id] = c; });
      }

      if (dealIds.length > 0) {
        const { data: dealsData } = await supabase
          .from('deals')
          .select('id, title, stage')
          .in('id', dealIds);
        (dealsData || []).forEach(d => { dealsMap[d.id] = d; });
      }

      const enriched = (logisticsData || []).map(item => {
        const client = clientsMap[item.client_id];
        const deal = item.deal_id ? dealsMap[item.deal_id] : null;
        return {
          ...item,
          client_email: client?.email || '',
          client_phone: client?.phone || '',
          client_city: client?.endereco_cidade || '',
          client_state: client?.endereco_estado || '',
          deal_title: deal?.title || '',
          deal_stage: deal?.stage || '',
        };
      });

      setItems(enriched);
      calculateStats(enriched);
    } catch (err) {
      console.error('Erro ao carregar logística:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: LogisticsItem[]) => {
    setStats({
      total: data.length,
      pending: data.filter(i => i.shipping_status === 'pending' || i.shipping_status === 'preparing').length,
      shipped: data.filter(i => i.shipping_status === 'shipped').length,
      inTransit: data.filter(i => i.shipping_status === 'in_transit').length,
      delivered: data.filter(i => i.shipping_status === 'delivered').length,
    });
  };

  const handleSave = async (formData: any) => {
    try {
      const payload = {
        client_id: formData.client_id,
        deal_id: formData.deal_id || null,
        client_name: formData.client_name,
        shipping_status: formData.shipping_status,
        tracking_code: formData.tracking_code || null,
        carrier: formData.carrier || null,
        shipping_date: formData.shipping_date || null,
        estimated_delivery: formData.estimated_delivery || null,
        delivered_date: formData.delivered_date || null,
        shipping_address: formData.shipping_address || null,
        notes: formData.notes || null,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      };

      if (formData.id) {
        const { error } = await supabase
          .from('logistics')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;

        await logActivity({
          action: 'update',
          module: 'logistics',
          entityId: formData.id,
          entityName: formData.client_name,
          details: { status: formData.shipping_status, tracking_code: formData.tracking_code },
        });

        // Also update client tracking code if available
        if (formData.tracking_code) {
          await supabase
            .from('clients')
            .update({
              codigo_rastreio: formData.tracking_code,
              amostra_enviada: ['shipped', 'in_transit', 'delivered'].includes(formData.shipping_status),
              amostra_data_envio: formData.shipping_date || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', formData.client_id);
        }
      } else {
        const { error } = await supabase
          .from('logistics')
          .insert({
            ...payload,
            created_by: user?.id || null,
          });
        if (error) throw error;

        await logActivity({
          action: 'create',
          module: 'logistics',
          entityName: formData.client_name,
          details: { status: formData.shipping_status, tracking_code: formData.tracking_code },
        });

        // Sync with client
        if (formData.tracking_code) {
          await supabase
            .from('clients')
            .update({
              codigo_rastreio: formData.tracking_code,
              amostra_enviada: ['shipped', 'in_transit', 'delivered'].includes(formData.shipping_status),
              amostra_data_envio: formData.shipping_date || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', formData.client_id);
        }
      }

      setShowFormModal(false);
      setEditingItem(null);
      await fetchItems();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('logistics')
        .delete()
        .eq('id', itemToDelete.id);
      if (error) throw error;

      await logActivity({
        action: 'delete',
        module: 'logistics',
        entityId: itemToDelete.id,
        entityName: itemToDelete.client_name,
      });

      setShowDeleteModal(false);
      setItemToDelete(null);
      await fetchItems();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (item: LogisticsItem) => {
    setEditingItem(item);
    setSelectedItem(null);
    setShowFormModal(true);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchText ||
      item.client_name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.tracking_code?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.carrier?.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.shipping_status === statusFilter;
    const matchesCarrier = carrierFilter === 'all' || item.carrier === carrierFilter;
    return matchesSearch && matchesStatus && matchesCarrier;
  });

  const uniqueCarriers = [...new Set(items.map(i => i.carrier).filter(Boolean))];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${config.bg} ${config.color}`}>
        <i className={`${config.icon} text-[11px]`}></i>
        {config.label}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <i className="ri-box-3-line text-lg text-gray-600"></i>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-[11px] text-gray-400">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <i className="ri-time-line text-lg text-amber-600"></i>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-[11px] text-gray-400">Pendentes</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <i className="ri-truck-line text-lg text-indigo-600"></i>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stats.shipped}</p>
                <p className="text-[11px] text-gray-400">Enviados</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                <i className="ri-route-line text-lg text-violet-600"></i>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stats.inTransit}</p>
                <p className="text-[11px] text-gray-400">Em Trânsito</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <i className="ri-checkbox-circle-line text-lg text-emerald-600"></i>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stats.delivered}</p>
                <p className="text-[11px] text-gray-400">Entregues</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar por creator, rastreio ou transportadora..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6]"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6] appearance-none bg-white cursor-pointer"
                >
                  <option value="all">Todos os status</option>
                  {Object.entries(statusConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
              </div>
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={carrierFilter}
                  onChange={(e) => setCarrierFilter(e.target.value)}
                  className="w-full sm:w-auto pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/20 focus:border-[#5de0e6] appearance-none bg-white cursor-pointer"
                >
                  <option value="all">Transportadoras</option>
                  {uniqueCarriers.map(c => (
                    <option key={c} value={c!}>{c}</option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
              </div>
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
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rastreio</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Transportadora</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Envio</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Previsão</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Card</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm text-gray-400 mt-3">Carregando envios...</p>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <i className="ri-truck-line text-3xl text-gray-300"></i>
                      </div>
                      <p className="text-sm text-gray-500 font-medium">Nenhum envio encontrado</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {searchText || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Crie um novo envio para começar'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center shadow-sm">
                            <span className="text-white font-semibold text-xs">
                              {item.client_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.client_name}</p>
                            {item.client_city && (
                              <p className="text-[11px] text-gray-400 truncate">{item.client_city} - {item.client_state}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(item.shipping_status)}</td>
                      <td className="px-5 py-3.5">
                        {item.tracking_code ? (
                          <span className="text-sm font-mono text-gray-900 bg-gray-50 px-2 py-0.5 rounded">
                            {item.tracking_code}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{item.carrier || '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(item.shipping_date)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(item.estimated_delivery)}</td>
                      <td className="px-5 py-3.5">
                        {item.deal_title ? (
                          <span className="text-xs text-[#004aad] bg-[#004aad]/5 px-2 py-1 rounded-lg font-medium truncate max-w-[120px] inline-block">
                            {item.deal_title}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-lg transition-all cursor-pointer"
                            title="Ver detalhes"
                          >
                            <i className="ri-eye-line text-sm"></i>
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-lg transition-all cursor-pointer"
                              title="Editar"
                            >
                              <i className="ri-edit-line text-sm"></i>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => { setItemToDelete(item); setShowDeleteModal(true); }}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Excluir"
                            >
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Count */}
          {!loading && filteredItems.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              {filteredItems.length} envio{filteredItems.length !== 1 ? 's' : ''} encontrado{filteredItems.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <LogisticsFormModal
        isOpen={showFormModal}
        onClose={() => { setShowFormModal(false); setEditingItem(null); }}
        onSave={handleSave}
        editingItem={editingItem}
      />

      {/* Detail Modal */}
      {selectedItem && (
        <LogisticsDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={handleEdit}
          canEdit={canEdit}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteModal && itemToDelete && (
        <Modal isOpen={true} onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }} title="Excluir Envio" subtitle="Esta ação não pode ser desfeita">
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl">
              <div className="w-11 h-11 bg-gradient-to-br from-rose-400 to-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                <i className="ri-error-warning-line text-white text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{itemToDelete.client_name}</p>
                <p className="text-xs text-gray-500">
                  {itemToDelete.tracking_code ? `Rastreio: ${itemToDelete.tracking_code}` : 'Sem código de rastreio'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Tem certeza que deseja excluir este registro de envio? Esta ação é permanente.
            </p>
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <Button onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }} variant="outline" className="flex-1" disabled={deleting}>
                Cancelar
              </Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-loader-4-line animate-spin"></i>
                    Excluindo...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-delete-bin-line"></i>
                    Excluir Envio
                  </span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}

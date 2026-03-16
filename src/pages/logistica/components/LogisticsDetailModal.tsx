
import { useState } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';

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

interface LogisticsDetailModalProps {
  item: LogisticsItem;
  onClose: () => void;
  onEdit: (item: LogisticsItem) => void;
  canEdit: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700', icon: 'ri-time-line' },
  preparing: { label: 'Preparando', color: 'bg-sky-100 text-sky-700', icon: 'ri-box-3-line' },
  shipped: { label: 'Enviado', color: 'bg-indigo-100 text-indigo-700', icon: 'ri-truck-line' },
  in_transit: { label: 'Em Trânsito', color: 'bg-violet-100 text-violet-700', icon: 'ri-route-line' },
  delivered: { label: 'Entregue', color: 'bg-emerald-100 text-emerald-700', icon: 'ri-checkbox-circle-line' },
  returned: { label: 'Devolvido', color: 'bg-rose-100 text-rose-700', icon: 'ri-arrow-go-back-line' },
};

export default function LogisticsDetailModal({ item, onClose, onEdit, canEdit }: LogisticsDetailModalProps) {
  const status = statusConfig[item.shipping_status] || statusConfig.pending;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusTimeline = () => {
    const steps = ['pending', 'preparing', 'shipped', 'in_transit', 'delivered'];
    const currentIdx = steps.indexOf(item.shipping_status);
    if (item.shipping_status === 'returned') {
      return steps.map((s, i) => ({ ...statusConfig[s], key: s, active: false, current: false, returned: true }));
    }
    return steps.map((s, i) => ({
      ...statusConfig[s],
      key: s,
      active: i <= currentIdx,
      current: i === currentIdx,
      returned: false,
    }));
  };

  const timeline = getStatusTimeline();

  return (
    <Modal isOpen={true} onClose={onClose} title="Detalhes do Envio" subtitle={item.client_name} size="lg">
      <div className="space-y-6">
        {/* Status Timeline */}
        <div className="bg-gray-50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-700">Status do Envio</h4>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
              <i className={`${status.icon} text-[11px]`}></i>
              {status.label}
            </span>
          </div>
          {item.shipping_status !== 'returned' ? (
            <div className="flex items-center gap-1">
              {timeline.map((step, idx) => (
                <div key={step.key} className="flex items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step.active ? 'bg-[#004aad] text-white' : 'bg-gray-200 text-gray-400'
                  } ${step.current ? 'ring-4 ring-[#004aad]/20' : ''}`}>
                    {step.active ? <i className="ri-check-line text-sm"></i> : idx + 1}
                  </div>
                  {idx < timeline.length - 1 && (
                    <div className={`flex-1 h-1 mx-1 rounded-full ${step.active && timeline[idx + 1]?.active ? 'bg-[#004aad]' : 'bg-gray-200'}`}></div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-lg">
              <i className="ri-arrow-go-back-line text-rose-500"></i>
              <span className="text-sm text-rose-700 font-medium">Este envio foi devolvido</span>
            </div>
          )}
          <div className="flex justify-between mt-2">
            {timeline.map((step) => (
              <span key={step.key} className={`text-[10px] text-center flex-1 ${step.active ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>
                {step.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Creator Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <i className="ri-user-star-line text-[#004aad]"></i>
              Informações do Creator
            </h4>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Nome</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{item.client_name}</p>
              </div>
              {item.client_email && (
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider">Email</p>
                  <p className="text-sm text-gray-700 mt-0.5">{item.client_email}</p>
                </div>
              )}
              {item.client_phone && (
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider">Telefone</p>
                  <p className="text-sm text-gray-700 mt-0.5">{item.client_phone}</p>
                </div>
              )}
              {(item.client_city || item.client_state) && (
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider">Localização</p>
                  <p className="text-sm text-gray-700 mt-0.5">
                    {[item.client_city, item.client_state].filter(Boolean).join(' - ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <i className="ri-truck-line text-[#004aad]"></i>
              Informações do Envio
            </h4>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Código de Rastreio</p>
                <p className="text-sm font-mono font-medium text-gray-900 mt-0.5">
                  {item.tracking_code || '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Transportadora</p>
                <p className="text-sm text-gray-700 mt-0.5">{item.carrier || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Data de Envio</p>
                <p className="text-sm text-gray-700 mt-0.5">{formatDate(item.shipping_date)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Previsão de Entrega</p>
                <p className="text-sm text-gray-700 mt-0.5">{formatDate(item.estimated_delivery)}</p>
              </div>
              {item.delivered_date && (
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider">Data de Entrega</p>
                  <p className="text-sm text-emerald-600 font-medium mt-0.5">{formatDate(item.delivered_date)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        {item.shipping_address && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <i className="ri-map-pin-line text-[#004aad]"></i>
              Endereço de Entrega
            </h4>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-700">{item.shipping_address}</p>
            </div>
          </div>
        )}

        {/* Deal Info */}
        {item.deal_title && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <i className="ri-kanban-view text-[#004aad]"></i>
              Card Vinculado
            </h4>
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-[#004aad]/10 rounded-lg flex items-center justify-center">
                <i className="ri-kanban-view text-[#004aad] text-sm"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.deal_title}</p>
                {item.deal_stage && <p className="text-xs text-gray-400 mt-0.5">Etapa: {item.deal_stage}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <i className="ri-sticky-note-line text-[#004aad]"></i>
              Observações
            </h4>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes}</p>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex items-center gap-6 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span>Criado em: {formatDateTime(item.created_at)}</span>
          <span>Atualizado em: {formatDateTime(item.updated_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Fechar
          </Button>
          {canEdit && (
            <Button onClick={() => onEdit(item)} className="flex-1">
              <i className="ri-edit-line text-sm"></i>
              Editar Envio
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

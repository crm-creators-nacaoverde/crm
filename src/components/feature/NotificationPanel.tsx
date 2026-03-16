import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SampleAlert } from '../../../hooks/useSampleAlerts';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: SampleAlert[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

const alertConfig = {
  pending: {
    icon: 'ri-error-warning-line',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
    label: 'Amostra pendente',
  },
  transit_long: {
    icon: 'ri-truck-line',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    label: 'Em trânsito há muito tempo',
  },
  no_address: {
    icon: 'ri-map-pin-line',
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    border: 'border-sky-100',
    label: 'Sem endereço cadastrado',
  },
};

export default function NotificationPanel({
  isOpen,
  onClose,
  alerts,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationPanelProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredAlerts = filter === 'unread' ? alerts.filter(a => !a.read) : alerts;

  const handleAlertClick = (alert: SampleAlert) => {
    onMarkAsRead(alert.id);
    navigate('/creators');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden animate-[fadeIn_0.15s_ease-out]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[11px] font-medium text-[#004aad] hover:text-[#003d91] cursor-pointer whitespace-nowrap"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {[
              { value: 'all' as const, label: `Todas (${alerts.length})` },
              { value: 'unread' as const, label: `Não lidas (${unreadCount})` },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap cursor-pointer transition-all ${
                  filter === tab.value
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts list */}
        <div className="flex-1 overflow-y-auto">
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                <i className="ri-checkbox-circle-line text-2xl text-emerald-400"></i>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Tudo em dia!</p>
              <p className="text-xs text-gray-400 text-center">
                {filter === 'unread'
                  ? 'Nenhuma notificação não lida'
                  : 'Nenhum alerta de amostra pendente'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredAlerts.map((alert) => {
                const config = alertConfig[alert.type];
                return (
                  <button
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors cursor-pointer ${
                      alert.read
                        ? 'hover:bg-gray-50'
                        : 'bg-[#5de0e6]/5 hover:bg-[#5de0e6]/10'
                    }`}
                  >
                    <div className={`w-8 h-8 min-w-[32px] rounded-lg flex items-center justify-center ${config.bg}`}>
                      <i className={`${config.icon} text-sm ${config.color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-[13px] leading-tight truncate ${alert.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                          {alert.clientName}
                        </p>
                        {!alert.read && (
                          <span className="w-2 h-2 min-w-[8px] bg-[#004aad] rounded-full"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug mb-1">
                        {alert.type === 'pending' && (
                          <>
                            <span className="font-medium text-rose-600">{alert.daysElapsed} dias</span> sem envio de amostra
                          </>
                        )}
                        {alert.type === 'transit_long' && (
                          <>
                            Em trânsito há <span className="font-medium text-amber-600">{alert.daysElapsed} dias</span>
                          </>
                        )}
                        {alert.type === 'no_address' && (
                          <>
                            Cadastrado há <span className="font-medium text-sky-600">{alert.daysElapsed} dias</span> sem endereço
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md ${config.bg} ${config.color} border ${config.border}`}>
                          {config.label}
                        </span>
                        {alert.dealTitle && (
                          <span className="text-[9px] text-gray-400 truncate">
                            {alert.dealTitle}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {alerts.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  {alerts.filter(a => a.type === 'pending').length} pendentes
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  {alerts.filter(a => a.type === 'transit_long').length} em trânsito
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  {alerts.filter(a => a.type === 'no_address').length} sem endereço
                </span>
              </div>
              <button
                onClick={() => { navigate('/creators'); onClose(); }}
                className="text-[11px] font-medium text-[#004aad] hover:text-[#003d91] cursor-pointer whitespace-nowrap"
              >
                Ver Creators →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import { useNotificationContext } from '../../../contexts/NotificationContext';
import { useActivityLog } from '../../../hooks/useActivityLog';

export default function SettingsSection() {
  const { requestPermission, permission, sendNotification } = useNotificationContext();
  const { logActivity } = useActivityLog();
  
  const [settings, setSettings] = useState({
    companyName: 'CRM Creators',
    email: 'admin@crm.com',
    phone: '+55 11 99999-9999',
    address: 'São Paulo, SP',
    notifications: true,
    emailAlerts: true,
    darkMode: false,
    sampleAlertDays: 3,
    sampleAlertTransit: true,
    sampleAlertNoAddress: true,
  });

  const [saved, setSaved] = useState(false);

  // Carregar configurações do localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('crm_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ ...prev, ...parsed }));
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const oldSettings = JSON.parse(localStorage.getItem('crm_settings') || '{}');
    localStorage.setItem('crm_settings', JSON.stringify(settings));
    
    logActivity({
      action: 'update',
      module: 'settings',
      entityId: 'company_info',
      entityName: 'Informações da Empresa',
      details: { before: oldSettings, after: settings }
    });
    
    setSaved(true);
    sendNotification('Configurações Salvas', {
      body: 'Suas configurações foram atualizadas com sucesso!',
      icon: '/favicon.ico'
    });
    setTimeout(() => setSaved(false), 3000);
  };

  const handleToggleNotifications = async (key: string, value: boolean) => {
    if (key === 'notifications' && value) {
      const granted = await requestPermission();
      if (!granted) {
        alert('Permissão de notificação negada. Por favor, habilite nas configurações do navegador.');
        return;
      }
      sendNotification('Notificações Ativadas! 🎉', {
        body: 'Você receberá alertas sobre novas interações e atualizações importantes.',
        icon: '/favicon.ico'
      });
    }
    
    const oldValue = settings[key as keyof typeof settings];
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('crm_settings', JSON.stringify(newSettings));
    
    logActivity({
      action: 'update',
      module: 'settings',
      entityId: key,
      entityName: `Configuração: ${key}`,
      details: { setting: key, from: oldValue, to: value }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Company info */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center">
                <i className="ri-building-line text-brand-600 text-base"></i>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Informações da Empresa</h3>
                <p className="text-[11px] text-gray-400">Dados básicos do seu negócio</p>
              </div>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome da Empresa</label>
                <Input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                  <Input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Telefone</label>
                  <Input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Endereço</label>
                <Input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                />
              </div>
              <div className="pt-2">
                <Button type="submit">
                  <i className="ri-save-line text-sm"></i>
                  Salvar Alterações
                </Button>
              </div>
              {saved && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl">
                  <i className="ri-checkbox-circle-line"></i>
                  Configurações salvas com sucesso!
                </div>
              )}
            </form>
          </div>

          {/* Alertas de Amostra */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
                <i className="ri-alarm-warning-line text-rose-600 text-base"></i>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Alertas de Amostra</h3>
                <p className="text-[11px] text-gray-400">Configure quando receber alertas sobre amostras pendentes</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Prazo em dias */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Alertar após quantos dias sem envio?
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, sampleAlertDays: Math.max(1, s.sampleAlertDays - 1) }))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <i className="ri-subtract-line text-sm"></i>
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={settings.sampleAlertDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setSettings(s => ({ ...s, sampleAlertDays: Math.min(90, Math.max(1, val)) }));
                      }}
                      className="w-14 h-10 text-center text-sm font-semibold text-gray-900 border-x border-gray-200 bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, sampleAlertDays: Math.min(90, s.sampleAlertDays + 1) }))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <i className="ri-add-line text-sm"></i>
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">dias</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Creators cadastrados há mais de {settings.sampleAlertDays} {settings.sampleAlertDays === 1 ? 'dia' : 'dias'} sem amostra enviada serão notificados
                </p>
              </div>

              {/* Presets rápidos */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Atalhos rápidos</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { days: 1, label: '1 dia' },
                    { days: 3, label: '3 dias' },
                    { days: 5, label: '5 dias' },
                    { days: 7, label: '1 semana' },
                    { days: 14, label: '2 semanas' },
                    { days: 30, label: '1 mês' },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, sampleAlertDays: preset.days }))}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                        settings.sampleAlertDays === preset.days
                          ? 'bg-brand-50 border-brand-200 text-brand-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipos de alerta */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-medium text-gray-600 mb-3">Tipos de alerta</label>
                <div className="space-y-1">
                  {[
                    {
                      key: 'sampleAlertTransit',
                      label: 'Em trânsito há muito tempo',
                      desc: 'Alertar quando uma amostra estiver em trânsito além do prazo configurado',
                      icon: 'ri-truck-line',
                      iconColor: 'text-amber-500 bg-amber-50',
                    },
                    {
                      key: 'sampleAlertNoAddress',
                      label: 'Sem endereço cadastrado',
                      desc: 'Alertar quando o creator não tem endereço para envio',
                      icon: 'ri-map-pin-line',
                      iconColor: 'text-sky-500 bg-sky-50',
                    },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.iconColor}`}>
                          <i className={`${item.icon} text-sm`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.label}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newSettings = { ...settings, [item.key]: !settings[item.key as keyof typeof settings] };
                          setSettings(newSettings);
                          localStorage.setItem('crm_settings', JSON.stringify(newSettings));
                        }}
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                          settings[item.key as keyof typeof settings] ? 'bg-brand-500' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                            settings[item.key as keyof typeof settings] ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        ></span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Salvar configurações de alerta */}
              <div className="pt-2">
                <Button
                  onClick={() => {
                    const oldSettings = JSON.parse(localStorage.getItem('crm_settings') || '{}');
                    localStorage.setItem('crm_settings', JSON.stringify(settings));
                    
                    logActivity({
                      action: 'update',
                      module: 'settings',
                      entityId: 'sample_alerts',
                      entityName: 'Alertas de Amostra',
                      details: { before: oldSettings, after: settings }
                    });
                    
                    setSaved(true);
                    sendNotification('Alertas Configurados', {
                      body: `Você será notificado sobre amostras pendentes após ${settings.sampleAlertDays} dias.`,
                    });
                    setTimeout(() => setSaved(false), 3000);
                  }}
                >
                  <i className="ri-save-line text-sm"></i>
                  Salvar Configuração de Alertas
                </Button>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                <i className="ri-notification-3-line text-amber-600 text-base"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                <p className="text-[11px] text-gray-400">Gerencie como você recebe alertas</p>
              </div>
              {permission === 'granted' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-lg">
                  <i className="ri-checkbox-circle-fill text-emerald-500 text-xs"></i>
                  <span className="text-[10px] font-medium text-emerald-700">Ativado</span>
                </div>
              )}
              {permission === 'denied' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 rounded-lg">
                  <i className="ri-close-circle-fill text-rose-500 text-xs"></i>
                  <span className="text-[10px] font-medium text-rose-700">Bloqueado</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              {[
                { key: 'notifications', label: 'Notificações Push', desc: 'Receba notificações sobre novas interações', icon: 'ri-notification-badge-line' },
                { key: 'emailAlerts', label: 'Alertas por Email', desc: 'Receba resumos diários por email', icon: 'ri-mail-check-line' },
                { key: 'darkMode', label: 'Modo Escuro', desc: 'Ativar tema escuro na interface', icon: 'ri-moon-line' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                      <i className={`${item.icon} text-sm text-gray-500`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleNotifications(item.key, !settings[item.key as keyof typeof settings])}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                      settings[item.key as keyof typeof settings] ? 'bg-brand-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                        settings[item.key as keyof typeof settings] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    ></span>
                  </button>
                </div>
              ))}
            </div>
            {permission === 'denied' && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-start gap-2">
                  <i className="ri-information-line text-amber-600 text-sm mt-0.5"></i>
                  <div>
                    <p className="text-xs font-medium text-amber-800">Notificações Bloqueadas</p>
                    <p className="text-[11px] text-amber-600 mt-1">
                      Para receber notificações, habilite nas configurações do seu navegador.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              {[
                { icon: 'ri-download-cloud-line', label: 'Exportar Dados', color: 'text-brand-600 bg-brand-50' },
                { icon: 'ri-file-chart-line', label: 'Gerar Relatório', color: 'text-amber-600 bg-amber-50' },
                { icon: 'ri-database-2-line', label: 'Backup de Dados', color: 'text-sky-600 bg-sky-50' },
              ].map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50/80 hover:bg-gray-100 rounded-xl transition-all cursor-pointer whitespace-nowrap group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color}`}>
                    <i className={`${action.icon} text-sm`}></i>
                  </div>
                  <span>{action.label}</span>
                  <i className="ri-arrow-right-s-line text-gray-300 ml-auto group-hover:text-gray-500 transition-colors"></i>
                </button>
              ))}
            </div>
          </div>

          {/* System info */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Sistema</h3>
            <div className="space-y-3">
              {[
                { label: 'Versão', value: '1.0.0' },
                { label: 'Última Atualização', value: 'Hoje' },
              ].map((info) => (
                <div key={info.label} className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-400">{info.label}</span>
                  <span className="text-xs font-medium text-gray-700">{info.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-rose-50/50 rounded-xl border border-rose-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-error-warning-line text-rose-500"></i>
              <h3 className="text-sm font-semibold text-rose-800">Zona de Perigo</h3>
            </div>
            <p className="text-xs text-rose-600/70 mb-4">Ações irreversíveis que afetam seus dados</p>
            <Button variant="danger" size="sm" className="w-full">
              <i className="ri-delete-bin-line text-sm"></i>
              Limpar Todos os Dados
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
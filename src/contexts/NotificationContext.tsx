import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNotifications, type NotificationPermission, type NotificationOptions } from '../hooks/useNotifications';

interface NotificationContextType {
  sendNotification: (title: string, options?: NotificationOptions) => void;
  requestPermission: () => Promise<boolean>;
  permission: NotificationPermission;
  isSupported: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notifications = useNotifications();

  useEffect(() => {
    // Solicita permissão automaticamente ao carregar
    const settings = localStorage.getItem('crm_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.notifications && notifications.permission === 'default') {
        notifications.requestPermission();
      }
    }
  }, []);

  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext deve ser usado dentro de NotificationProvider');
  }
  return context;
}

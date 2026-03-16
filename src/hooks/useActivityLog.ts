import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export type LogAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'view'
  | 'export'
  | 'move'
  | 'send';

export type LogModule =
  | 'creators'
  | 'deals'
  | 'interactions'
  | 'forms'
  | 'form_submissions'
  | 'users'
  | 'settings'
  | 'funnels'
  | 'logistics'
  | 'auth';

interface LogActivityParams {
  action: LogAction;
  module: LogModule;
  entityId?: string;
  entityName?: string;
  details?: Record<string, any>;
}

export const useActivityLog = () => {
  const { user, profile } = useAuth();

  const logActivity = async ({
    action,
    module,
    entityId,
    entityName,
    details,
  }: LogActivityParams) => {
    try {
      if (!user) return;

      const userName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Usuário';

      const userEmail = profile?.email || user.email || '';

      // Limpa dados sensíveis do details antes de gravar
      const safeDetails = sanitizeDetails(details);

      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: userName,
        user_email: userEmail,
        action,
        module,
        entity_id: entityId || null,
        entity_name: entityName || null,
        details: safeDetails || {},
        ip_address: null,
      });

      if (error) {
        console.error('[ActivityLog] Erro ao gravar log:', error.message);
      }
    } catch (err) {
      // Log nunca deve quebrar a aplicação
      console.error('[ActivityLog] Exceção:', err);
    }
  };

  return { logActivity };
};

// Remove campos sensíveis como senhas antes de gravar no log
function sanitizeDetails(details?: Record<string, any>): Record<string, any> {
  if (!details) return {};
  const sensitive = ['password', 'senha', 'token', 'secret', 'key', 'apikey'];
  const clean = JSON.parse(JSON.stringify(details));

  function scrub(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (sensitive.some(s => k.toLowerCase().includes(s))) {
        obj[k] = '***';
      } else {
        scrub(obj[k]);
      }
    }
  }
  scrub(clean);
  return clean;
}

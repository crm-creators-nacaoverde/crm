import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export type LogAction = 'create' | 'update' | 'delete';
export type LogModule = 'creators' | 'deals' | 'interactions' | 'forms' | 'users' | 'settings' | 'funnels' | 'logistics' | 'tasks' | 'financeiro' | 'metrics' | 'imports' | 'bible';

interface LogActivityParams {
  action: LogAction;
  module: LogModule;
  entityId?: string;
  entityName?: string;
  details?: Record<string, any>;
}

export const useActivityLog = () => {
  const { user } = useAuth();

  const logActivity = async ({
    action,
    module,
    entityId,
    entityName,
    details,
  }: LogActivityParams) => {
    try {
      if (!user) return;

      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
        user_email: user.email || '',
        action,
        module,
        entity_id: entityId,
        entity_name: entityName,
        details,
        ip_address: null,
      });

      if (error) {
        console.error('Erro ao registrar log:', error);
      }
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  };

  return { logActivity };
};

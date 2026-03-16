import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type AutomationActionType = 'notify_push' | 'notify_email' | 'create_task' | 'send_webhook';

export interface AutomationConfig {
  // notify_push / notify_email
  title?: string;
  message?: string;
  notify_all?: boolean;
  notify_users?: string[];
  // create_task
  task_title?: string;
  task_description?: string;
  task_type?: string;
  task_priority?: string;
  assign_to_responsible?: boolean;
  // send_webhook
  webhook_url?: string;
  webhook_method?: string;
}

export interface StageAutomation {
  id: string;
  stage_id: string;
  funnel_id: string;
  action_type: AutomationActionType;
  config: AutomationConfig;
  name: string;
  is_active: boolean;
  created_at: string;
}

export function useStageAutomations(funnelId?: string) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

  // Buscar automações de uma etapa específica
  const getAutomationsForStage = useCallback(async (stageId: string): Promise<StageAutomation[]> => {
    try {
      const { data, error } = await supabase
        .from('stage_automations')
        .select('*')
        .eq('stage_id', stageId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[useStageAutomations] getForStage:', err);
      return [];
    }
  }, []);

  // Buscar todas as automações de um funil
  const getAutomationsForFunnel = useCallback(async (fId: string): Promise<StageAutomation[]> => {
    try {
      const { data, error } = await supabase
        .from('stage_automations')
        .select('*')
        .eq('funnel_id', fId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[useStageAutomations] getForFunnel:', err);
      return [];
    }
  }, []);

  // Criar automação
  const createAutomation = useCallback(async (
    stageId: string,
    fId: string,
    actionType: AutomationActionType,
    config: AutomationConfig,
    name: string
  ) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('stage_automations')
        .insert({
          stage_id: stageId,
          funnel_id: fId,
          action_type: actionType,
          config,
          name,
          is_active: true,
          created_by: profile?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('[useStageAutomations] create:', err);
      return { success: false, error: err };
    } finally {
      setSaving(false);
    }
  }, [profile]);

  // Atualizar automação
  const updateAutomation = useCallback(async (
    id: string,
    updates: Partial<Pick<StageAutomation, 'name' | 'config' | 'is_active' | 'action_type'>>
  ) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stage_automations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    } finally {
      setSaving(false);
    }
  }, []);

  // Deletar automação
  const deleteAutomation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('stage_automations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  }, []);

  // ── EXECUTAR automações de uma etapa (chamado ao mover deal) ──────────
  const executeAutomations = useCallback(async (
    stageId: string,
    dealId: string,
    clientId: string | null,
    dealTitle: string,
    clientName: string,
    stageLabel: string
  ) => {
    try {
      const automations = await getAutomationsForStage(stageId);
      const active = automations.filter(a => a.is_active);
      if (active.length === 0) return;

      for (const automation of active) {
        try {
          await runAutomation(automation, { dealId, clientId, dealTitle, clientName, stageLabel });
          // Log de sucesso
          await supabase.from('stage_automation_logs').insert({
            automation_id: automation.id,
            deal_id: dealId,
            client_id: clientId,
            status: 'success',
            result: { action: automation.action_type, stageLabel },
          });
        } catch (err) {
          await supabase.from('stage_automation_logs').insert({
            automation_id: automation.id,
            deal_id: dealId,
            client_id: clientId,
            status: 'error',
            result: { error: String(err) },
          });
        }
      }
    } catch (err) {
      console.error('[useStageAutomations] executeAutomations:', err);
    }
  }, [getAutomationsForStage]);

  return {
    saving,
    getAutomationsForStage,
    getAutomationsForFunnel,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    executeAutomations,
  };
}

// ── Executor de cada tipo de ação ─────────────────────────────────────────
async function runAutomation(
  automation: StageAutomation,
  ctx: { dealId: string; clientId: string | null; dealTitle: string; clientName: string; stageLabel: string }
) {
  const { action_type, config } = automation;

  if (action_type === 'notify_push') {
    await runPushNotification(config, ctx);
  } else if (action_type === 'notify_email') {
    await runEmailNotification(config, ctx);
  } else if (action_type === 'create_task') {
    await runCreateTask(automation, config, ctx);
  } else if (action_type === 'send_webhook') {
    await runWebhook(config, ctx);
  }
}

async function runPushNotification(
  config: AutomationConfig,
  ctx: { dealTitle: string; clientName: string; stageLabel: string }
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = interpolate(config.title || '🔔 Creator movido para {{stage}}', ctx);
  const body = interpolate(
    config.message || '{{creator}} — {{deal}} entrou na etapa {{stage}}',
    ctx
  );

  // Quem recebe: todos os usuários ou específicos — push é local (navegador do usuário atual)
  new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: `automation_${ctx.dealId}`,
  });
}

async function runEmailNotification(
  config: AutomationConfig,
  ctx: { dealTitle: string; clientName: string; stageLabel: string }
) {
  // Salvar uma notificação interna no Supabase para cada usuário alvo
  // (o envio de e-mail real precisaria de um backend/edge function)
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, notif_email')
    .eq('notif_email', true);

  if (!users || users.length === 0) return;

  const targetUsers = config.notify_all
    ? users
    : users.filter(u => config.notify_users?.includes(u.id));

  const subject = interpolate(config.title || 'Creator movido: {{stage}}', ctx);
  const body = interpolate(
    config.message || '{{creator}} foi movido para a etapa {{stage}} no deal {{deal}}.',
    ctx
  );

  // Registrar notificação para cada usuário (exibe no painel interno)
  for (const user of targetUsers) {
    await supabase.from('stage_automation_logs').insert({
      automation_id: null,
      deal_id: ctx.dealId,
      client_id: ctx.clientId,
      status: 'success',
      result: { type: 'email_queued', to: user.email, subject, body },
    }).select();
  }
}

async function runCreateTask(
  automation: StageAutomation,
  config: AutomationConfig,
  ctx: { dealId: string; clientId: string | null; dealTitle: string; clientName: string; stageLabel: string }
) {
  // Buscar responsável do deal se assign_to_responsible = true
  let assignedTo = null;
  let assignedName = null;

  if (config.assign_to_responsible && ctx.dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('responsible_id, responsible_name')
      .eq('id', ctx.dealId)
      .single();
    if (deal?.responsible_id) {
      assignedTo = deal.responsible_id;
      assignedName = deal.responsible_name;
    }
  }

  const taskTitle = interpolate(
    config.task_title || 'Tarefa: {{deal}} entrou em {{stage}}',
    ctx
  );

  await supabase.from('deal_tasks').insert({
    deal_id: ctx.dealId,
    client_id: ctx.clientId,
    deal_title: ctx.dealTitle,
    title: taskTitle,
    description: config.task_description
      ? interpolate(config.task_description, ctx)
      : null,
    type: config.task_type || 'task',
    priority: config.task_priority || 'medium',
    assigned_to: assignedTo,
    assigned_name: assignedName,
    is_completed: false,
    created_by: 'automation',
  });
}

async function runWebhook(
  config: AutomationConfig,
  ctx: { dealTitle: string; clientName: string; stageLabel: string }
) {
  if (!config.webhook_url) return;

  const body = config.webhook_method !== 'GET'
    ? JSON.stringify({
        event: 'stage_entered',
        deal: ctx.dealTitle,
        creator: ctx.clientName,
        stage: ctx.stageLabel,
        timestamp: new Date().toISOString(),
      })
    : undefined;

  await fetch(config.webhook_url, {
    method: config.webhook_method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

// Interpolação simples: {{stage}} → stageLabel, {{deal}} → dealTitle, {{creator}} → clientName
function interpolate(
  template: string,
  ctx: { dealTitle: string; clientName: string; stageLabel: string }
): string {
  return template
    .replace(/\{\{stage\}\}/g, ctx.stageLabel)
    .replace(/\{\{deal\}\}/g, ctx.dealTitle)
    .replace(/\{\{creator\}\}/g, ctx.clientName);
}

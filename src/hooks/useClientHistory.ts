// src/hooks/useClientHistory.ts
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type ClientHistoryEventType =
  | 'cadastro'
  | 'edicao_dados'
  | 'movimentacao'
  | 'amostra'
  | 'logistica'
  | 'pix'
  | 'pagamento'
  | 'tarefa'
  | 'interacao'
  | 'resultado'
  | 'formulario'
  | 'acompanhamento'
  | 'exclusao';

export interface ClientHistoryEntry {
  id: string;
  client_id: string;
  event_type: ClientHistoryEventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
  user_name: string;
  created_at: string;
}

export interface LogClientEventParams {
  client_id: string;
  event_type: ClientHistoryEventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export function useClientHistory() {
  const { profile } = useAuth();

  /**
   * Registra um evento no histórico do creator.
   * Chame isso em QUALQUER ação que afete um creator específico.
   */
  const logClientEvent = useCallback(async (params: LogClientEventParams): Promise<void> => {
    try {
      await supabase.from('client_history').insert({
        client_id: params.client_id,
        event_type: params.event_type,
        title: params.title,
        description: params.description ?? null,
        metadata: params.metadata ?? {},
        user_id: profile?.id ?? null,
        user_name: profile?.full_name ?? profile?.email ?? 'Sistema',
      });
    } catch (err) {
      // Nunca bloquear a ação principal por falha no log
      console.warn('[ClientHistory] Falha ao registrar evento:', err);
    }
  }, [profile?.id, profile?.full_name, profile?.email]);

  /**
   * Busca todos os eventos de um creator ordenados do mais recente ao mais antigo.
   */
  const fetchClientHistory = useCallback(async (clientId: string): Promise<ClientHistoryEntry[]> => {
    const { data, error } = await supabase
      .from('client_history')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ClientHistory] Erro ao buscar histórico:', error);
      return [];
    }
    return data as ClientHistoryEntry[];
  }, []); // supabase é estável, sem dependências variáveis

  return { logClientEvent, fetchClientHistory };
}

// ─── HELPERS DE EVENTO (use esses nas chamadas) ───────────────────────────────

/** Creator criado manualmente ou via formulário */
export const historyEvent = {
  cadastro: (name: string) => ({
    event_type: 'cadastro' as const,
    title: 'Creator cadastrado no sistema',
    description: `${name} foi adicionado ao CRM`,
  }),

  edicaoDados: (fields: string[]) => ({
    event_type: 'edicao_dados' as const,
    title: 'Dados cadastrais atualizados',
    description: `Campos alterados: ${fields.join(', ')}`,
  }),

  movimentacao: (from: string, to: string, dealTitle?: string) => ({
    event_type: 'movimentacao' as const,
    title: `Movido para "${to}"`,
    description: `Antes: ${from}${dealTitle ? ` (${dealTitle})` : ''}`,
    metadata: { from, to, deal_title: dealTitle },
  }),

  amostraEnviada: (codigo?: string) => ({
    event_type: 'amostra' as const,
    title: 'Amostra enviada',
    description: codigo ? `Código de rastreio: ${codigo}` : 'Envio registrado sem código',
    metadata: { codigo_rastreio: codigo },
  }),

  amostraAtualizada: (obs?: string) => ({
    event_type: 'amostra' as const,
    title: 'Amostra atualizada',
    description: obs ?? undefined,
  }),

  logisticaAtualizada: (status: string, codigo?: string) => ({
    event_type: 'logistica' as const,
    title: `Logística: ${status}`,
    description: codigo ? `Rastreio: ${codigo}` : undefined,
    metadata: { status, codigo_rastreio: codigo },
  }),

  pixAtualizado: (tipo: string, chave: string) => ({
    event_type: 'pix' as const,
    title: 'Chave PIX atualizada',
    description: `Tipo: ${tipo} | Chave: ${chave}`,
    metadata: { tipo, chave },
  }),

  pagamentoRegistrado: (tipo: string, valor: number) => ({
    event_type: 'pagamento' as const,
    title: 'Pagamento registrado',
    description: `Tipo: ${tipo} | Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    metadata: { tipo, valor },
  }),

  pagamentoAtualizado: (status: string, valor: number) => ({
    event_type: 'pagamento' as const,
    title: `Pagamento marcado como "${status}"`,
    description: `Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    metadata: { status, valor },
  }),

  tarefaCriada: (titulo: string) => ({
    event_type: 'tarefa' as const,
    title: 'Tarefa criada',
    description: titulo,
  }),

  tarefaConcluida: (titulo: string) => ({
    event_type: 'tarefa' as const,
    title: 'Tarefa concluída',
    description: titulo,
  }),

  interacaoRegistrada: (tipo: string, tituloInteracao: string) => ({
    event_type: 'interacao' as const,
    title: `Interação: ${tituloInteracao}`,
    description: `Tipo: ${tipo}`,
    metadata: { tipo },
  }),

  resultadoAtualizado: (campos: Record<string, unknown>) => ({
    event_type: 'resultado' as const,
    title: 'Métricas/resultados atualizados',
    description: Object.entries(campos)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | '),
    metadata: campos,
  }),

  formularioRecebido: (formName: string) => ({
    event_type: 'formulario' as const,
    title: 'Formulário recebido',
    description: `Formulário: ${formName}`,
  }),

  acompanhamentoCriado: (dealTitle: string) => ({
    event_type: 'acompanhamento' as const,
    title: 'Acompanhamento criado',
    description: dealTitle,
  }),

  exclusaoDado: (tipo: string, descricao?: string) => ({
    event_type: 'exclusao' as const,
    title: `${tipo} removido`,
    description: descricao,
  }),
};

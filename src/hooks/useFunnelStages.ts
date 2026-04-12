import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface FunnelStage {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  is_fixed: boolean;
  funnel_id?: string;
  description?: string;
  mandatory_task_title?: string;
  mandatory_task_description?: string;
}

const CACHE_KEY = 'crm_funnel_stages_cache';

function getCachedStages(funnelId?: string): FunnelStage[] | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${funnelId || 'all'}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 3) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function setCachedStages(stages: FunnelStage[], funnelId?: string) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${funnelId || 'all'}`, JSON.stringify(stages));
  } catch {
    /* ignore */
  }
}

export function useFunnelStages(funnelId?: string) {
  const [stages, setStages] = useState<FunnelStage[]>(() => getCachedStages(funnelId) || []);
  const [loading, setLoading] = useState(true);

  const loadStages = useCallback(async () => {
    try {
      let query = supabase
        .from('funnel_stages')
        .select('*')
        .order('sort_order', { ascending: true });

      // Filtrar por funil se fornecido
      if (funnelId) {
        query = query.eq('funnel_id', funnelId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        setStages(data);
        setCachedStages(data, funnelId);
      }
    } catch (err) {
      console.error('Erro ao carregar etapas do funil:', err);
    } finally {
      setLoading(false);
    }
  }, [funnelId]);

  useEffect(() => {
    loadStages();
  }, [loadStages]);

  const saveStages = useCallback(async (newStages: FunnelStage[]) => {
    try {
      // Get current stages from DB
      let query = supabase.from('funnel_stages').select('id');
      
      if (funnelId) {
        query = query.eq('funnel_id', funnelId);
      }

      const { data: currentStages } = await query;

      const currentIds = new Set((currentStages || []).map(s => s.id));
      const newIds = new Set(newStages.map(s => s.id));

      // Delete removed stages
      const toDelete = [...currentIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('funnel_stages')
          .delete()
          .in('id', toDelete);
        if (delError) throw delError;
      }

      // Upsert all stages
      const upsertData = newStages.map((s, index) => {
        // Garantir que etapas finais tenham IDs únicos por funil se o funnelId estiver presente
        let finalId = s.id;
        if (funnelId && (s.id === 'won' || s.id === 'lost' || s.id.startsWith('won_') || s.id.startsWith('lost_'))) {
          const base = s.id.includes('_') ? s.id.split('_')[0] : s.id;
          finalId = `${base}_${funnelId}`;
        }

        return {
          id: finalId,
          label: s.label,
          color: s.color,
          sort_order: index,
          is_fixed: s.id === 'won' || s.id === 'lost' || s.id.startsWith('won_') || s.id.startsWith('lost_'),
          funnel_id: funnelId || s.funnel_id,
          description: s.description ?? null,
          mandatory_task_title: s.mandatory_task_title ?? null,
          mandatory_task_description: s.mandatory_task_description ?? null,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: upsertError } = await supabase
        .from('funnel_stages')
        .upsert(upsertData, { onConflict: 'id' });

      if (upsertError) throw upsertError;

      setStages(newStages.map((s, i) => ({ 
        ...s, 
        sort_order: i, 
        is_fixed: s.id === 'won' || s.id === 'lost',
        funnel_id: funnelId || s.funnel_id
      })));
      setCachedStages(newStages, funnelId);

      return { success: true };
    } catch (err) {
      console.error('Erro ao salvar etapas do funil:', err);
      return { success: false, error: err };
    }
  }, [funnelId]);

  // Formato completo incluindo description para tooltips e mandatory tasks
  const stagesSimple = stages.map(({ id, label, color, description, mandatory_task_title, mandatory_task_description }) => ({ 
    id, 
    label, 
    color, 
    description,
    mandatory_task_title,
    mandatory_task_description
  }));

  return { stages: stagesSimple, loading, saveStages, reloadStages: loadStages };
}

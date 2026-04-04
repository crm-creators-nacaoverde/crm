import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Funnel {
  id: string;
  name: string;
  description?: string;
  color: string;
  is_default: boolean;
  manager_id?: string | null;
  manager_name?: string | null;
  allowed_user_ids?: string[] | null; // null = todos; array = restrito
  created_at: string;
  updated_at: string;
}

const CACHE_KEY = 'crm_funnels_cache';
const SELECTED_FUNNEL_KEY = 'crm_selected_funnel_id';

function getCachedFunnels(): Funnel[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function setCachedFunnels(funnels: Funnel[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(funnels));
  } catch {
    /* ignore */
  }
}

export function getSelectedFunnelId(): string | null {
  try {
    return localStorage.getItem(SELECTED_FUNNEL_KEY);
  } catch {
    return null;
  }
}

export function setSelectedFunnelId(funnelId: string) {
  try {
    localStorage.setItem(SELECTED_FUNNEL_KEY, funnelId);
  } catch {
    /* ignore */
  }
}

export function useFunnels() {
  const [funnels, setFunnels] = useState<Funnel[]>(() => getCachedFunnels() || []);
  const [loading, setLoading] = useState(true);
  const [selectedFunnelId, setSelectedFunnelIdState] = useState<string | null>(() => getSelectedFunnelId());

  const loadFunnels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setFunnels(data);
        setCachedFunnels(data);

        const currentSelected = getSelectedFunnelId();
        if (!currentSelected || !data.find(f => f.id === currentSelected)) {
          const defaultFunnel = data.find(f => f.is_default) || data[0];
          setSelectedFunnelId(defaultFunnel.id);
          setSelectedFunnelIdState(defaultFunnel.id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar funis:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFunnels();
  }, [loadFunnels]);

  const createFunnel = useCallback(async (funnel: Omit<Funnel, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('funnels')
        .insert([{
          name: funnel.name,
          description: funnel.description,
          color: funnel.color,
          is_default: funnel.is_default,
        }])
        .select()
        .single();

      if (error) throw error;

      // Criar etapas padrão para o novo funil
      const defaultStages = [
        { id: `stage_1_${data.id}`, label: 'Primeira etapa', color: '#38bdf8', sort_order: 0, funnel_id: data.id, is_fixed: false },
        { id: `won_${data.id}`, label: 'Ganho', color: '#34d399', sort_order: 1, funnel_id: data.id, is_fixed: true },
        { id: `lost_${data.id}`, label: 'Perdido', color: '#f87171', sort_order: 2, funnel_id: data.id, is_fixed: true },
      ];

      await supabase.from('funnel_stages').insert(defaultStages);

      await loadFunnels();
      return { success: true, data };
    } catch (err) {
      console.error('Erro ao criar funil:', err);
      return { success: false, error: err };
    }
  }, [loadFunnels]);

  const updateFunnel = useCallback(async (id: string, updates: Partial<Omit<Funnel, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      if (updates.is_default) {
        await supabase
          .from('funnels')
          .update({ is_default: false })
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('funnels')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await loadFunnels();
      return { success: true, data };
    } catch (err) {
      console.error('Erro ao atualizar funil:', err);
      return { success: false, error: err };
    }
  }, [loadFunnels]);

  const deleteFunnel = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('funnels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (selectedFunnelId === id) {
        const remaining = funnels.filter(f => f.id !== id);
        if (remaining.length > 0) {
          const newSelected = remaining.find(f => f.is_default) || remaining[0];
          setSelectedFunnelId(newSelected.id);
          setSelectedFunnelIdState(newSelected.id);
        }
      }

      await loadFunnels();
      return { success: true };
    } catch (err) {
      console.error('Erro ao deletar funil:', err);
      return { success: false, error: err };
    }
  }, [funnels, selectedFunnelId, loadFunnels]);

  const selectFunnel = useCallback((funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setSelectedFunnelIdState(funnelId);
  }, []);

  const selectedFunnel = funnels.find(f => f.id === selectedFunnelId) || funnels.find(f => f.is_default) || funnels[0];

  return {
    funnels,
    loading,
    selectedFunnelId: selectedFunnel?.id || null,
    selectedFunnel,
    createFunnel,
    updateFunnel,
    deleteFunnel,
    selectFunnel,
    reloadFunnels: loadFunnels,
  };
}

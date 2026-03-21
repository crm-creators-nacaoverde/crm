// src/hooks/useCadastros.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Product {
  id: string; name: string; description: string | null;
  sku: string | null; image_url: string | null; bling_id: string | null;
  is_active: boolean; sort_order: number; created_at: string; updated_at: string;
}
export interface CreatorCategory {
  id: string; name: string; color: string; icon: string;
  is_default: boolean; is_active: boolean; sort_order: number; created_at: string;
}
export interface Platform {
  id: string; name: string; icon: string; color: string;
  is_default: boolean; is_active: boolean; sort_order: number; created_at: string;
}
export interface CaptureSource {
  id: string; name: string; is_active: boolean; sort_order: number; created_at: string;
}
export interface DealOutcomeReason {
  id: string; type: 'won' | 'lost'; name: string;
  is_active: boolean; sort_order: number; created_at: string;
}
export interface PaymentType {
  id: string; name: string; is_active: boolean; sort_order: number; created_at: string;
}
export interface InteractionType {
  id: string; name: string; icon: string; color: string;
  category: 'task' | 'interaction' | 'both';
  counts_as_goal_metric: boolean; goal_metric_key: string | null;
  is_active: boolean; sort_order: number; created_at: string;
}
export interface Carrier {
  id: string; name: string; tracking_url: string | null;
  tracking_url_tiktok: string | null; is_active: boolean;
  sort_order: number; created_at: string;
}

export interface CadastrosData {
  products:         Product[];
  categories:       CreatorCategory[];
  platforms:        Platform[];
  captureSources:   CaptureSource[];
  outcomeReasons:   DealOutcomeReason[];
  paymentTypes:     PaymentType[];
  interactionTypes: InteractionType[];
  carriers:         Carrier[];
  loading:          boolean;
  reload:           () => Promise<void>;
}

export function useCadastros(): CadastrosData {
  const [products,         setProducts]         = useState<Product[]>([]);
  const [categories,       setCategories]       = useState<CreatorCategory[]>([]);
  const [platforms,        setPlatforms]        = useState<Platform[]>([]);
  const [captureSources,   setCaptureSources]   = useState<CaptureSource[]>([]);
  const [outcomeReasons,   setOutcomeReasons]   = useState<DealOutcomeReason[]>([]);
  const [paymentTypes,     setPaymentTypes]     = useState<PaymentType[]>([]);
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  const [carriers,         setCarriers]         = useState<Carrier[]>([]);
  const [loading,          setLoading]          = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, cat, plat, cs, or_, pt, it, car] = await Promise.all([
        supabase.from('products').select('*').order('sort_order'),
        supabase.from('creator_categories').select('*').order('sort_order'),
        supabase.from('platforms').select('*').order('sort_order'),
        supabase.from('capture_sources').select('*').order('sort_order'),
        supabase.from('deal_outcome_reasons').select('*').order('sort_order'),
        supabase.from('payment_types').select('*').order('sort_order'),
        supabase.from('interaction_types').select('*').order('sort_order'),
        supabase.from('carriers').select('*').order('sort_order'),
      ]);
      if (p.data)    setProducts(p.data);
      if (cat.data)  setCategories(cat.data);
      if (plat.data) setPlatforms(plat.data);
      if (cs.data)   setCaptureSources(cs.data);
      if (or_.data)  setOutcomeReasons(or_.data);
      if (pt.data)   setPaymentTypes(pt.data);
      if (it.data)   setInteractionTypes(it.data);
      if (car.data)  setCarriers(car.data);
    } catch (e) {
      console.error('Erro ao carregar cadastros:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    products, categories, platforms, captureSources,
    outcomeReasons, paymentTypes, interactionTypes, carriers,
    loading, reload,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Gera link de rastreio substituindo {codigo} pelo código informado
export function buildTrackingUrl(carrier: Carrier, code: string, isTiktok = false): string | null {
  const template = isTiktok ? carrier.tracking_url_tiktok : carrier.tracking_url;
  if (!template || !code) return null;
  return template.replace('{codigo}', code.trim());
}

// Retorna a categoria padrão (is_default = true) ou a primeira ativa
export function getDefaultCategory(categories: CreatorCategory[]): string {
  const def = categories.find(c => c.is_default && c.is_active);
  const first = categories.find(c => c.is_active);
  return def?.name || first?.name || 'Creators';
}

// Retorna a plataforma padrão ou a primeira ativa
export function getDefaultPlatform(platforms: Platform[]): string {
  const def = platforms.find(p => p.is_default && p.is_active);
  const first = platforms.find(p => p.is_active);
  return def?.name || first?.name || 'TikTok';
}

// Match de valor recebido no webhook contra os cadastros (case-insensitive)
export function matchCategoryName(value: string, categories: CreatorCategory[]): string {
  const exact = categories.find(c => c.name === value && c.is_active);
  if (exact) return exact.name;
  const ci = categories.find(c => c.name.toLowerCase() === value.toLowerCase() && c.is_active);
  if (ci) return ci.name;
  return getDefaultCategory(categories);
}

export function matchPlatformName(value: string, platforms: Platform[]): string {
  const exact = platforms.find(p => p.name === value && p.is_active);
  if (exact) return exact.name;
  const ci = platforms.find(p => p.name.toLowerCase() === value.toLowerCase() && p.is_active);
  if (ci) return ci.name;
  return getDefaultPlatform(platforms);
}

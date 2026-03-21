// src/contexts/CadastrosContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Product, CreatorCategory, Platform, CaptureSource,
  DealOutcomeReason, PaymentType, InteractionType, Carrier,
} from '../hooks/useCadastros';

interface CadastrosContextType {
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

const CadastrosContext = createContext<CadastrosContextType>({
  products: [], categories: [], platforms: [], captureSources: [],
  outcomeReasons: [], paymentTypes: [], interactionTypes: [], carriers: [],
  loading: false, reload: async () => {},
});

export function CadastrosProvider({ children }: { children: React.ReactNode }) {
  const [products,         setProducts]         = useState<Product[]>([]);
  const [categories,       setCategories]       = useState<CreatorCategory[]>([]);
  const [platforms,        setPlatforms]        = useState<Platform[]>([]);
  const [captureSources,   setCaptureSources]   = useState<CaptureSource[]>([]);
  const [outcomeReasons,   setOutcomeReasons]   = useState<DealOutcomeReason[]>([]);
  const [paymentTypes,     setPaymentTypes]     = useState<PaymentType[]>([]);
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  const [carriers,         setCarriers]         = useState<Carrier[]>([]);
  const [loading,          setLoading]          = useState(true);

  const reload = async () => {
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
  };

  useEffect(() => { reload(); }, []);

  return (
    <CadastrosContext.Provider value={{
      products, categories, platforms, captureSources,
      outcomeReasons, paymentTypes, interactionTypes, carriers,
      loading, reload,
    }}>
      {children}
    </CadastrosContext.Provider>
  );
}

export function useCadastrosContext() {
  return useContext(CadastrosContext);
}

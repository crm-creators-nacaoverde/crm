import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e Anon Key são obrigatórios');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  permissions: {
    clients: { view: boolean; edit: boolean; delete: boolean };
    interactions: { view: boolean; edit: boolean; delete: boolean };
    deals: { view: boolean; edit: boolean; delete: boolean };
    forms: { view: boolean; edit: boolean; delete: boolean };
    metrics: { view: boolean };
    settings: { view: boolean; edit: boolean };
    users: { view: boolean; edit: boolean };
    bible: { view: boolean; edit: boolean };
    whatsapp: { view: boolean; edit: boolean };
  };
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  platform: string;
  followers: number;
  category: string;
  revenue: number;
  status: 'active' | 'inactive';
  notes?: string;
  tiktok_links: string[];
  gmv_geral: number;
  produtos_divulgados: string;
  comissao_organica: number;
  comissao_trafego: number;
  gmv_interno_7d: number;
  gmv_interno_14d: number;
  gmv_interno_28d: number;
  gmv_interno_30d: number;
  whatsapp_group_link: string;
  videos_7d: number;
  videos_14d: number;
  videos_28d: number;
  videos_30d: number;
  endereco_cep: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  chave_pix: string;
  chave_pix_tipo: string;
  codigo_rastreio: string;
  amostra_enviada: boolean;
  amostra_data_envio: string;
  amostra_observacao: string;
  cpf_cnpj: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  client_id: string;
  type: 'meeting' | 'email' | 'call' | 'whatsapp' | 'other';
  title: string;
  description?: string;
  date: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

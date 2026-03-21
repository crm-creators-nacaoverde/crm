import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { getDefaultPermissions } from '../lib/rolePermissions';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (section: string, action: 'view' | 'edit' | 'delete') => boolean;
  hasFunnelAccess: (funnelId: string) => boolean;
  allowedFunnels: string[] | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Erro ao conectar com Supabase:', error);
          setLoading(false);
          return;
        }
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro de conexão:', error);
        setLoading(false);
      }
    };

    checkConnection();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        console.warn('Perfil não encontrado para o usuário:', userId);
        setProfile(null);
        return;
      }

      // ── Garantir que todos os módulos novos existem nas permissões ─────────
      // Se o usuário foi criado antes dos módulos financeiro/logistica/webhooks,
      // eles não existem no JSON. Completamos com false sem salvar no banco.
      const completePermissions = {
        clients:      { view: false, edit: false, delete: false },
        deals:        { view: false, edit: false, delete: false },
        interactions: { view: false, edit: false, delete: false },
        forms:        { view: false, edit: false, delete: false },
        financeiro:   { view: false, edit: false, delete: false },
        logistica:    { view: false, edit: false, delete: false },
        webhooks:     { view: false, edit: false },
        logs:         { view: false },
        metrics:      { view: false, edit: false },
        settings:     { view: false, edit: false },
        users:        { view: false, edit: false },
        ...(data.permissions || {}),
      };

      setProfile({ ...data, permissions: completePermissions });
    } catch (error: any) {
      console.error('Erro ao carregar perfil:', error?.message || error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      console.error('Erro no login:', error);
      throw new Error(error?.message || 'Erro ao fazer login. Verifique suas credenciais.');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        // ── Novos usuários via signUp entram como viewer inativo ──────────────
        // Permissões padrão do viewer (inclui todos os módulos)
        const viewerPermissions = getDefaultPermissions('viewer');

        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id:           data.user.id,
            full_name:    fullName,
            email:        email,
            role:         'viewer',
            is_active:    false,
            permissions:  viewerPermissions,
            allowed_funnels: [],
          });

        if (profileError) throw profileError;
      }
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      throw new Error(error?.message || 'Erro ao criar conta. Tente novamente.');
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Erro do Supabase ao sair:', error);
    } catch (error: any) {
      console.error('Erro ao sair:', error);
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  const hasPermission = (section: string, action: 'view' | 'edit' | 'delete'): boolean => {
    if (!profile || !profile.is_active) return false;

    // Admin tem acesso total sempre
    if (profile.role === 'admin') return true;

    const sectionPermissions = (profile.permissions as any)[section];

    // Seção não encontrada no JSON = sem acesso
    if (!sectionPermissions) return false;

    return sectionPermissions[action] === true;
  };

  // null = acesso irrestrito | [] = sem acesso | [ids] = restrito aos ids
  const hasFunnelAccess = (funnelId: string): boolean => {
    if (!profile || !profile.is_active) return false;
    if (profile.role === 'admin') return true;
    if (profile.allowed_funnels === null) return true;
    if (!profile.allowed_funnels || profile.allowed_funnels.length === 0) return false;
    return profile.allowed_funnels.includes(funnelId);
  };

  const allowedFunnels = profile?.allowed_funnels ?? null;

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signOut,
      hasPermission, hasFunnelAccess, allowedFunnels,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

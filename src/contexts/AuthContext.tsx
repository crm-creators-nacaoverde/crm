import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (section: string, action: 'view' | 'edit' | 'delete') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar conexão com Supabase
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

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        throw error;
      }

      if (!data) {
        console.warn('Perfil não encontrado para o usuário:', userId);
        setProfile(null);
        return;
      }

      setProfile(data);
    } catch (error: any) {
      console.error('Erro ao carregar perfil:', error?.message || error);
      // Não bloquear o login se houver erro ao carregar perfil
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
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            full_name: fullName,
            email: email,
            role: 'viewer',
            is_active: false,
            permissions: {
              clients: { view: false, edit: false, delete: false },
              interactions: { view: false, edit: false, delete: false },
              deals: { view: false, edit: false, delete: false },
              forms: { view: false, edit: false, delete: false },
              metrics: { view: false },
              settings: { view: false, edit: false },
              users: { view: false, edit: false },
              bible: { view: false, edit: false },
              whatsapp: { view: false, edit: false }
            }
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
      if (error) {
        console.error('Erro do Supabase ao sair:', error);
        // Mesmo com erro, limpar o estado local
      }
      // Limpar estado local independente do resultado
      setUser(null);
      setProfile(null);
    } catch (error: any) {
      console.error('Erro ao sair:', error);
      // Limpar estado local mesmo em caso de exceção
      setUser(null);
      setProfile(null);
    }
  };

  const hasPermission = (section: string, action: 'view' | 'edit' | 'delete'): boolean => {
    if (!profile || !profile.is_active) return false;
    if (profile.role === 'admin') return true;

    const sectionPermissions = profile.permissions[section as keyof typeof profile.permissions];

    // Seção não existe no perfil (usuário criado antes do campo ser adicionado):
    // view = true por padrão (opt-out), edit/delete = false por padrão (opt-in)
    if (!sectionPermissions) {
      return action === 'view';
    }

    if (action === 'view') {
      return (sectionPermissions as any).view === true;
    }
    if (action === 'edit') {
      return (sectionPermissions as any).edit === true;
    }
    if (action === 'delete') {
      return (sectionPermissions as any).delete === true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, hasPermission }}>
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

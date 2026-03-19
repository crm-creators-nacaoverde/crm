// src/components/feature/ProtectedRoute.tsx
// Bloqueia acesso direto por URL para rotas que exigem permissão específica.
// Se o usuário não tiver permissão, redireciona para a home.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission: string;          // módulo: 'logs', 'users', 'settings', etc.
  action?: 'view' | 'edit' | 'delete';
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  permission,
  action = 'view',
  redirectTo = '/',
}: ProtectedRouteProps) {
  const { profile, loading, hasPermission } = useAuth();

  // Aguarda carregar o perfil antes de decidir
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Não autenticado — AppLayout já redireciona para /login
  if (!profile) return null;

  // Sem permissão → redireciona para home
  if (!hasPermission(permission, action)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import LoginPage from "../pages/auth/LoginPage";
import UsersPage from "../pages/users/UsersPage";
import AcompanhamentoPage from "../pages/acompanhamento/page";
import CreatorsPage from "../pages/creators/page";
import InteracoesPage from "../pages/interacoes/page";
import MetricasPage from "../pages/metricas/page";
import ConfiguracoesPage from "../pages/configuracoes/page";
import ConfiguracoesEmpresaPage from "../pages/configuracoes/empresa/page";
import ConfiguracoesUsuarioPage from "../pages/configuracoes/usuario/page";
import FormulariosPage from "../pages/formularios/page";
import PublicFormPage from "../pages/formularios/components/PublicFormPage";
import LogsPage from "../pages/logs/page";
import LogisticaPage from "../pages/logistica/page";
import FinanceiroPage from "../pages/financeiro/page";
import WebhooksPage from "../pages/webhooks/page";
import ProtectedRoute from "../components/feature/ProtectedRoute";

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <MetricasPage />,
  },
  {
    path: "/creators",
    element: <CreatorsPage />,
  },
  {
    path: "/acompanhamento",
    element: <AcompanhamentoPage />,
  },
  {
    path: "/interacoes",
    element: <InteracoesPage />,
  },
  {
    path: "/logistica",
    element: (
      <ProtectedRoute permission="logistica">
        <LogisticaPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/financeiro",
    element: (
      <ProtectedRoute permission="financeiro">
        <FinanceiroPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/formularios",
    element: (
      <ProtectedRoute permission="forms">
        <FormulariosPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/webhooks",
    element: (
      <ProtectedRoute permission="webhooks">
        <WebhooksPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/logs",
    element: (
      <ProtectedRoute permission="logs">
        <LogsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/users",
    element: (
      <ProtectedRoute permission="users">
        <UsersPage />
      </ProtectedRoute>
    ),
  },
  // Hub de configurações
  {
    path: "/configuracoes",
    element: <ConfiguracoesPage />,
  },
  {
    path: "/configuracoes/usuario",
    element: <ConfiguracoesUsuarioPage />,
  },
  {
    path: "/configuracoes/empresa",
    element: (
      <ProtectedRoute permission="settings" action="edit">
        <ConfiguracoesEmpresaPage />
      </ProtectedRoute>
    ),
  },
  // Formulários públicos — sem proteção (acesso externo)
  {
    path: "/formulario/:token",
    element: <PublicFormPage />,
  },
  {
    path: "/form/:token",
    element: <PublicFormPage />,
  },
  {
    path: "/f/:token",
    element: <PublicFormPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;

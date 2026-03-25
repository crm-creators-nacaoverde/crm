import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import LoginPage from "../pages/auth/LoginPage";
import UsersPage from "../pages/users/UsersPage";
import AcompanhamentoPage from "../pages/acompanhamento/page";
import CreatorsPage from "../pages/creators/page";
import InteracoesPage from "../pages/interacoes/page";
import MetricasPage from "../pages/metricas/page";
import ConfiguracoesPage from "../pages/configuracoes/page";
import CadastrosPage from "../pages/cadastros/page";
import ConfiguracoesEmpresaPage from "../pages/configuracoes/empresa/page";
import ConfiguracoesUsuarioPage from "../pages/configuracoes/usuario/page";
import FormulariosPage from "../pages/formularios/page";
import PublicFormPage from "../pages/formularios/components/PublicFormPage";
import LogsPage from "../pages/logs/page";
import LogisticaPage from "../pages/logistica/page";
import FinanceiroPage from "../pages/financeiro/page";
import BibliaPage from "../pages/biblia/page";
import WhatsAppPage from "../pages/whatsapp/page";
import ModulePage from "../pages/biblia/ModulePage";

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
    path: "/configuracoes",
    element: <ConfiguracoesPage />,
  },
  {
    path: "/configuracoes/usuario",
    element: <ConfiguracoesUsuarioPage />,
  },
  {
    path: "/configuracoes/empresa",
    element: <ConfiguracoesEmpresaPage />,
  },
  {
    path: "/configuracoes/cadastros",
    element: <CadastrosPage />,
  },
  {
    path: "/formularios",
    element: <FormulariosPage />,
  },
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
    path: "/users",
    element: <UsersPage />,
  },
  {
    path: "/logs",
    element: <LogsPage />,
  },
  {
    path: "/logistica",
    element: <LogisticaPage />,
  },
  {
    path: "/financeiro",
    element: <FinanceiroPage />,
  },
  {
    path: "/biblia",
    element: <BibliaPage />,
  },
  {
    path: "/biblia/:moduleId",
    element: <ModulePage />,
  },
  {
    path: "/whatsapp",
    element: <WhatsAppPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;

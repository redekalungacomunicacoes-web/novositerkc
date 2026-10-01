import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";

import { financeiroRoutes } from "@/app/pages/admin/Financeiro/routes";
import { TeamMemberPublicPage } from "@/app/pages/public/TeamMember/TeamMemberPublicPage";
import {
  FINANCE_MODULE_ROLES,
  getCurrentUserRoles,
  hasAdminPanelRole,
  hasAnyRole,
} from "@/lib/rbac";
import { supabase } from "@/lib/supabase";

const Academia = lazy(() => import("@/app/pages/admin/academia/Academia").then(m => ({ default: m.Academia })));
const AdminLayout = lazy(() => import("@/app/layouts/AdminLayout").then(m => ({ default: m.AdminLayout })));
const RootLayout = lazy(() => import("@/app/layouts/RootLayout").then(m => ({ default: m.RootLayout })));
const Contato = lazy(() => import("@/app/pages/Contato").then(m => ({ default: m.Contato })));
const Home = lazy(() => import("@/app/pages/Home").then(m => ({ default: m.Home })));
const MateriaDetalhes = lazy(() => import("@/app/pages/MateriaDetalhes").then(m => ({ default: m.MateriaDetalhes })));
const Materias = lazy(() => import("@/app/pages/Materias").then(m => ({ default: m.Materias })));
const Newsletter = lazy(() => import("@/app/pages/Newsletter").then(m => ({ default: m.Newsletter })));
const NotFound = lazy(() => import("@/app/pages/NotFound").then(m => ({ default: m.NotFound })));
const ProjetoDetalhes = lazy(() => import("@/app/pages/ProjetoDetalhes").then(m => ({ default: m.ProjetoDetalhes })));
const Projetos = lazy(() => import("@/app/pages/Projetos").then(m => ({ default: m.Projetos })));
const QuemSomos = lazy(() => import("@/app/pages/QuemSomos").then(m => ({ default: m.QuemSomos })));
const AdminConfiguracoes = lazy(() => import("@/app/pages/admin/AdminConfiguracoes").then(m => ({ default: m.AdminConfiguracoes })));
const AdminEquipe = lazy(() => import("@/app/pages/admin/AdminEquipe").then(m => ({ default: m.AdminEquipe })));
const AdminEquipeForm = lazy(() => import("@/app/pages/admin/AdminEquipeForm").then(m => ({ default: m.AdminEquipeForm })));
const Dashboard = lazy(() => import("@/app/pages/admin/Dashboard").then(m => ({ default: m.Dashboard })));
const AdminLogin = lazy(() => import("@/app/pages/admin/AdminLogin").then(m => ({ default: m.AdminLogin })));
const AdminMateriaForm = lazy(() => import("@/app/pages/admin/AdminMateriaForm").then(m => ({ default: m.AdminMateriaForm })));
const AdminMateriasAlias = lazy(() => import("@/app/pages/admin/AdminMaterias").then(m => ({ default: m.AdminMaterias })));
const AdminNewsletter = lazy(() => import("@/app/pages/admin/AdminNewsletter").then(m => ({ default: m.AdminNewsletter })));
const AdminPerfil = lazy(() => import("@/app/pages/admin/AdminPerfil").then(m => ({ default: m.AdminPerfil })));
const AdminProjetoForm = lazy(() => import("@/app/pages/admin/AdminProjetoForm").then(m => ({ default: m.AdminProjetoForm })));
const AdminProjetos = lazy(() => import("@/app/pages/admin/AdminProjetos").then(m => ({ default: m.AdminProjetos })));
const AdminQuemSomos = lazy(() => import("@/app/pages/admin/AdminQuemSomos").then(m => ({ default: m.AdminQuemSomos })));
const AdminTarefas = lazy(() => import("@/app/pages/admin/AdminTarefas").then(m => ({ default: m.AdminTarefas })));
const AdminTarefasAnexos = lazy(() => import("@/app/pages/admin/AdminTarefasAnexos").then(m => ({ default: m.AdminTarefasAnexos })));
const AdminTarefasConfiguracoes = lazy(() => import("@/app/pages/admin/AdminTarefasConfiguracoes").then(m => ({ default: m.AdminTarefasConfiguracoes })));
const AdminTarefasKanban = lazy(() => import("@/app/pages/admin/AdminTarefasKanban").then(m => ({ default: m.AdminTarefasKanban })));
const AdminTarefasRelatorios = lazy(() => import("@/app/pages/admin/AdminTarefasRelatorios").then(m => ({ default: m.AdminTarefasRelatorios })));
const AdminUsuarios = lazy(() => import("@/app/pages/admin/AdminUsuarios").then(m => ({ default: m.AdminUsuarios })));

type RoleName = "admin_alfa" | "admin" | "editor" | "autor" | "financeiro";

async function getMyRoles(): Promise<RoleName[]> {
  const { roles } = await getCurrentUserRoles();
  return roles as RoleName[];
}

async function adminRootLoader() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect("/admin/login");

  const roles = await getMyRoles();
  if (!hasAdminPanelRole(roles)) throw redirect("/admin/login");

  return { roles };
}

function requireRoles(required: RoleName[]) {
  return async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect("/admin/login");

    const roles = await getMyRoles();
    if (!hasAnyRole(roles, required)) throw redirect("/admin");

    return { roles };
  };
}

const taskRoles: RoleName[] = ["admin", "editor", "autor"];

export const router = createBrowserRouter([
  {
    path: "/admin",
    children: [
      { path: "login", element: <AdminLogin /> },
      {
        path: "",
        loader: adminRootLoader,
        element: <AdminLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "academia", loader: requireRoles(["admin", "editor", "autor", "financeiro"]), element: <Academia /> },
          { path: "academia/cursos/:courseId", loader: requireRoles(["admin", "editor", "autor", "financeiro"]), element: <Academia /> },
          { path: "academia/cursos/:courseId/aulas/:lessonId", loader: requireRoles(["admin", "editor", "autor", "financeiro"]), element: <Academia /> },
          { path: "materias", loader: requireRoles(["admin", "editor", "autor"]), element: <AdminMateriasAlias /> },
          { path: "materias/nova", loader: requireRoles(["admin", "editor", "autor"]), element: <AdminMateriaForm /> },
          { path: "materias/editar/:id", loader: requireRoles(["admin", "editor", "autor"]), element: <AdminMateriaForm /> },
          { path: "projetos", loader: requireRoles(["admin", "editor"]), element: <AdminProjetos /> },
          { path: "projetos/novo", loader: requireRoles(["admin", "editor"]), element: <AdminProjetoForm /> },
          { path: "projetos/editar/:id", loader: requireRoles(["admin", "editor"]), element: <AdminProjetoForm /> },
          { path: "equipe", loader: requireRoles(["admin", "editor"]), element: <AdminEquipe /> },
          { path: "equipe/novo", loader: requireRoles(["admin", "editor"]), element: <AdminEquipeForm /> },
          { path: "equipe/editar/:id", loader: requireRoles(["admin", "editor"]), element: <AdminEquipeForm /> },
          { path: "perfil", loader: requireRoles(["autor"]), element: <AdminPerfil /> },
          { path: "quem-somos", loader: requireRoles(["admin", "editor"]), element: <AdminQuemSomos /> },
          { path: "newsletter", loader: requireRoles(["admin", "editor"]), element: <AdminNewsletter /> },
          { path: "tarefas", loader: requireRoles(taskRoles), element: <AdminTarefas /> },
          { path: "tarefas/kanban", loader: requireRoles(taskRoles), element: <AdminTarefasKanban /> },
          { path: "tarefas/anexos", loader: requireRoles(taskRoles), element: <AdminTarefasAnexos /> },
          { path: "tarefas/relatorios", loader: requireRoles(taskRoles), element: <AdminTarefasRelatorios /> },
          { path: "tarefas/configuracoes", loader: requireRoles(taskRoles), element: <AdminTarefasConfiguracoes /> },
          {
            path: "financeiro",
            loader: requireRoles([...FINANCE_MODULE_ROLES]),
            children: financeiroRoutes.map((route) => ({
              ...route,
              loader: requireRoles([...FINANCE_MODULE_ROLES]),
            })),
          },
          { path: "usuarios", loader: requireRoles(["admin_alfa"]), element: <AdminUsuarios /> },
          { path: "configuracoes", loader: requireRoles(["admin_alfa"]), element: <AdminConfiguracoes /> },
        ],
      },
    ],
  },
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "quem-somos", element: <QuemSomos /> },
      { path: "equipe/:slug", element: <TeamMemberPublicPage /> },
      { path: "equipe/id/:id", element: <TeamMemberPublicPage /> },
      { path: "projetos", element: <Projetos /> },
      { path: "projetos/:id", element: <ProjetoDetalhes /> },
      { path: "materias", element: <Materias /> },
      { path: "materias/:id", element: <MateriaDetalhes /> },
      { path: "newsletter", element: <Newsletter /> },
      { path: "contato", element: <Contato /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
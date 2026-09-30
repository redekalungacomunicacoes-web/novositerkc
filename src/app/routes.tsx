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
      { path: "login", Component: AdminLogin },
      {
        path: "",
        loader: adminRootLoader,
        Component: AdminLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: "materias", loader: requireRoles(["admin", "editor", "autor"]), Component: AdminMateriasAlias },
          { path: "materias/nova", loader: requireRoles(["admin", "editor", "autor"]), Component: AdminMateriaForm },
          { path: "materias/editar/:id", loader: requireRoles(["admin", "editor", "autor"]), Component: AdminMateriaForm },
          { path: "projetos", loader: requireRoles(["admin", "editor"]), Component: AdminProjetos },
          { path: "projetos/novo", loader: requireRoles(["admin", "editor"]), Component: AdminProjetoForm },
          { path: "projetos/editar/:id", loader: requireRoles(["admin", "editor"]), Component: AdminProjetoForm },
          { path: "equipe", loader: requireRoles(["admin", "editor"]), Component: AdminEquipe },
          { path: "equipe/novo", loader: requireRoles(["admin", "editor"]), Component: AdminEquipeForm },
          { path: "equipe/editar/:id", loader: requireRoles(["admin", "editor"]), Component: AdminEquipeForm },
          { path: "perfil", loader: requireRoles(["autor"]), Component: AdminPerfil },
          { path: "quem-somos", loader: requireRoles(["admin", "editor"]), Component: AdminQuemSomos },
          { path: "newsletter", loader: requireRoles(["admin", "editor"]), Component: AdminNewsletter },
          { path: "tarefas", loader: requireRoles(taskRoles), Component: AdminTarefas },
          { path: "tarefas/kanban", loader: requireRoles(taskRoles), Component: AdminTarefasKanban },
          { path: "tarefas/anexos", loader: requireRoles(taskRoles), Component: AdminTarefasAnexos },
          { path: "tarefas/relatorios", loader: requireRoles(taskRoles), Component: AdminTarefasRelatorios },
          { path: "tarefas/configuracoes", loader: requireRoles(taskRoles), Component: AdminTarefasConfiguracoes },
          {
            path: "financeiro",
            loader: requireRoles([...FINANCE_MODULE_ROLES]),
            children: financeiroRoutes.map((route) => ({
              ...route,
              loader: requireRoles([...FINANCE_MODULE_ROLES]),
            })),
          },
          { path: "usuarios", loader: requireRoles(["admin_alfa"]), Component: AdminUsuarios },
          { path: "configuracoes", loader: requireRoles(["admin_alfa"]), Component: AdminConfiguracoes },
        ],
      },
    ],
  },
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Home },
      { path: "quem-somos", Component: QuemSomos },
      { path: "equipe/:slug", Component: TeamMemberPublicPage },
      { path: "equipe/id/:id", Component: TeamMemberPublicPage },
      { path: "projetos", Component: Projetos },
      { path: "projetos/:id", Component: ProjetoDetalhes },
      { path: "materias", Component: Materias },
      { path: "materias/:id", Component: MateriaDetalhes },
      { path: "newsletter", Component: Newsletter },
      { path: "contato", Component: Contato },
      { path: "*", Component: NotFound },
    ],
  },
]);
import { createBrowserRouter, redirect } from "react-router-dom";

import { AdminLayout } from "@/app/layouts/AdminLayout";
import { RootLayout } from "@/app/layouts/RootLayout";
import { Contato } from "@/app/pages/Contato";
import { Home } from "@/app/pages/Home";
import { MateriaDetalhes } from "@/app/pages/MateriaDetalhes";
import { Materias } from "@/app/pages/Materias";
import { Newsletter } from "@/app/pages/Newsletter";
import { NotFound } from "@/app/pages/NotFound";
import { ProjetoDetalhes } from "@/app/pages/ProjetoDetalhes";
import { Projetos } from "@/app/pages/Projetos";
import { QuemSomos } from "@/app/pages/QuemSomos";
import { AdminConfiguracoes } from "@/app/pages/admin/AdminConfiguracoes";
import { AdminEquipe } from "@/app/pages/admin/AdminEquipe";
import { AdminEquipeForm } from "@/app/pages/admin/AdminEquipeForm";
import { Dashboard } from "@/app/pages/admin/Dashboard";
import { AdminLogin } from "@/app/pages/admin/AdminLogin";
import { AdminMateriaForm } from "@/app/pages/admin/AdminMateriaForm";
import { AdminMaterias as AdminMateriasAlias } from "@/app/pages/admin/AdminMaterias";
import { AdminNewsletter } from "@/app/pages/admin/AdminNewsletter";
import { AdminPerfil } from "@/app/pages/admin/AdminPerfil";
import { AdminProjetoForm } from "@/app/pages/admin/AdminProjetoForm";
import { AdminProjetos } from "@/app/pages/admin/AdminProjetos";
import { AdminQuemSomos } from "@/app/pages/admin/AdminQuemSomos";
import { AdminTarefas } from "@/app/pages/admin/AdminTarefas";
import { AdminTarefasAnexos } from "@/app/pages/admin/AdminTarefasAnexos";
import { AdminTarefasConfiguracoes } from "@/app/pages/admin/AdminTarefasConfiguracoes";
import { AdminTarefasKanban } from "@/app/pages/admin/AdminTarefasKanban";
import { AdminTarefasRelatorios } from "@/app/pages/admin/AdminTarefasRelatorios";
import { AdminUsuarios } from "@/app/pages/admin/AdminUsuarios";
import { financeiroRoutes } from "@/app/pages/admin/Financeiro/routes";
import { TeamMemberPublicPage } from "@/app/pages/public/TeamMember/TeamMemberPublicPage";
import {
  FINANCE_MODULE_ROLES,
  getCurrentUserRoles,
  hasAdminPanelRole,
  hasAnyRole,
} from "@/lib/rbac";
import { supabase } from "@/lib/supabase";

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

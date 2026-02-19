import { createBrowserRouter, redirect } from "react-router-dom";
import { supabase } from "@/lib/supabase";

import { RootLayout } from "@/app/layouts/RootLayout";
import { AdminLayout } from "@/app/layouts/AdminLayout";

// Público
import { Home } from "@/app/pages/Home";
import { QuemSomos } from "@/app/pages/QuemSomos";
import { Projetos } from "@/app/pages/Projetos";
import { ProjetoDetalhes } from "@/app/pages/ProjetoDetalhes";
import { Materias } from "@/app/pages/Materias";
import { MateriaDetalhes } from "@/app/pages/MateriaDetalhes";
import { Newsletter } from "@/app/pages/Newsletter";
import { Contato } from "@/app/pages/Contato";
import { NotFound } from "@/app/pages/NotFound";

// Admin
import { Dashboard } from "@/app/pages/admin/Dashboard";
import { AdminMaterias } from "@/app/pages/admin/AdminMaterias";
import { AdminMaterias as AdminMateriasAlias } from "@/app/pages/admin/AdminMaterias";
import { AdminProjetos } from "@/app/pages/admin/AdminProjetos";
import { AdminLogin } from "@/app/pages/admin/AdminLogin";
import { AdminMateriaForm } from "@/app/pages/admin/AdminMateriaForm";
import { AdminProjetoForm } from "@/app/pages/admin/AdminProjetoForm";
import { AdminUsuarios } from "@/app/pages/admin/AdminUsuarios";
import { AdminConfiguracoes } from "@/app/pages/admin/AdminConfiguracoes";
import { AdminEquipe } from "@/app/pages/admin/AdminEquipe";
import { AdminEquipeForm } from "@/app/pages/admin/AdminEquipeForm";

// ✅ NOVO
import { AdminNewsletter } from "@/app/pages/admin/AdminNewsletter";

type RoleName = "admin_alfa" | "admin" | "editor" | "autor";

async function getMyRoles(): Promise<RoleName[]> {
  const { data: sessionRes } = await supabase.auth.getSession();
  const session = sessionRes.session;
  if (!session) return [];

  // Join: user_roles -> roles
  const { data, error } = await supabase
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", session.user.id);

  if (error) return [];
  const roles =
    (data || [])
      .map((r: any) => r?.role?.name)
      .filter(Boolean) as RoleName[];

  return roles;
}

function hasAnyRole(userRoles: RoleName[], required: RoleName[]) {
  if (userRoles.includes("admin_alfa")) return true; // super
  return required.some((r) => userRoles.includes(r));
}

/**
 * Loader base do /admin:
 * - exige sessão
 * - retorna roles pra UI usar (sidebar / etc)
 */
async function adminRootLoader() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect("/admin/login");

  const roles = await getMyRoles();

  // Se a pessoa logou mas não tem role nenhuma, manda pro login (ou página de "sem acesso")
  if (!roles.length) throw redirect("/admin/login");

  return { roles };
}

/**
 * Loader por rota (protege URL + sidebar esconde menu)
 */
function requireRoles(required: RoleName[]) {
  return async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect("/admin/login");

    const roles = await getMyRoles();
    if (!hasAnyRole(roles, required)) throw redirect("/admin"); // sem permissão → volta dashboard

    return { roles };
  };
}

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
          // dashboard: qualquer role logada
          { index: true, Component: Dashboard },

          // matérias: admin/editor/autor
          { path: "materias", loader: requireRoles(["admin", "editor", "autor"]), Component: AdminMateriasAlias },
          { path: "materias/nova", loader: requireRoles(["admin", "editor", "autor"]), Component: AdminMateriaForm },
          { path: "materias/editar/:id", loader: requireRoles(["admin", "editor", "autor"]), Component: AdminMateriaForm },

          // projetos: admin/editor
          { path: "projetos", loader: requireRoles(["admin", "editor"]), Component: AdminProjetos },
          { path: "projetos/novo", loader: requireRoles(["admin", "editor"]), Component: AdminProjetoForm },
          { path: "projetos/editar/:id", loader: requireRoles(["admin", "editor"]), Component: AdminProjetoForm },

          // equipe: admin/editor
          { path: "equipe", loader: requireRoles(["admin", "editor"]), Component: AdminEquipe },
          { path: "equipe/novo", loader: requireRoles(["admin", "editor"]), Component: AdminEquipeForm },
          { path: "equipe/editar/:id", loader: requireRoles(["admin", "editor"]), Component: AdminEquipeForm },

          // ✅ NOVO: newsletter: admin/editor
          { path: "newsletter", loader: requireRoles(["admin", "editor"]), Component: AdminNewsletter },

          // usuários (RBAC): só admin_alfa
          { path: "usuarios", loader: requireRoles(["admin_alfa"]), Component: AdminUsuarios },

          // configurações: só admin_alfa (ou admin se quiser)
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

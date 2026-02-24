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
import { AdminMaterias as AdminMateriasAlias } from "@/app/pages/admin/AdminMaterias";
import { AdminProjetos } from "@/app/pages/admin/AdminProjetos";
import { AdminLogin } from "@/app/pages/admin/AdminLogin";
import { AdminMateriaForm } from "@/app/pages/admin/AdminMateriaForm";
import { AdminProjetoForm } from "@/app/pages/admin/AdminProjetoForm";
import { AdminUsuarios } from "@/app/pages/admin/AdminUsuarios";
import { AdminConfiguracoes } from "@/app/pages/admin/AdminConfiguracoes";
import { AdminEquipe } from "@/app/pages/admin/AdminEquipe";
import { AdminEquipeForm } from "@/app/pages/admin/AdminEquipeForm";
import { AdminNewsletter } from "@/app/pages/admin/AdminNewsletter";
import { FinanceiroHome } from "@/app/pages/admin/Financeiro/FinanceiroHome";
import { FinanceiroNovoProjeto } from "@/app/pages/admin/Financeiro/FinanceiroNovoProjeto";
import { FinanceiroProjeto } from "@/app/pages/admin/Financeiro/FinanceiroProjeto";
import { FinanceiroProjetos } from "@/app/pages/admin/Financeiro/FinanceiroProjetos";
import { FinanceiroFundos } from "@/app/pages/admin/Financeiro/FinanceiroFundos";
import { FinanceiroFundoDetalhes } from "@/app/pages/admin/Financeiro/FinanceiroFundoDetalhes";

// ✅ NOVO: Admin Quem Somos
import { AdminQuemSomos } from "@/app/pages/admin/AdminQuemSomos";

type RoleName = "admin_alfa" | "admin" | "editor" | "autor";

async function getMyRoles(): Promise<RoleName[]> {
  const { data: sessionRes } = await supabase.auth.getSession();
  const session = sessionRes.session;
  if (!session) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", session.user.id);

  if (error) return [];
  return (data || []).map((r: any) => r?.role?.name).filter(Boolean) as RoleName[];
}

function hasAnyRole(userRoles: RoleName[], required: RoleName[]) {
  if (userRoles.includes("admin_alfa")) return true;
  return required.some((r) => userRoles.includes(r));
}

async function adminRootLoader() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect("/admin/login");

  const roles = await getMyRoles();
  if (!roles.length) throw redirect("/admin/login");

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

          // ✅ NOVO: Quem Somos (admin/editor)
          { path: "quem-somos", loader: requireRoles(["admin", "editor"]), Component: AdminQuemSomos },

          // ✅ Newsletter (admin/editor)
          { path: "newsletter", loader: requireRoles(["admin", "editor"]), Component: AdminNewsletter },

          { path: "financeiro", loader: requireRoles(["admin", "editor"]), Component: FinanceiroHome },
          { path: "financeiro/novo", loader: requireRoles(["admin", "editor"]), Component: FinanceiroNovoProjeto },
          { path: "financeiro/projetos/:id", loader: requireRoles(["admin", "editor"]), Component: FinanceiroProjeto },
          { path: "financeiro/projetos", loader: requireRoles(["admin", "editor"]), Component: FinanceiroProjetos },
          { path: "financeiro/fundos", loader: requireRoles(["admin", "editor"]), Component: FinanceiroFundos },
          { path: "financeiro/fundos/:id", loader: requireRoles(["admin", "editor"]), Component: FinanceiroFundoDetalhes },

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

import { supabase } from "@/lib/supabase";

export async function getMyRoles(): Promise<string[]> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", uid);

  if (error) return [];
  return (data || []).map((row: any) => row.role?.name).filter(Boolean);
}

export function canAccess(pathname: string, roles: string[]) {
  if (roles.includes("admin_alfa")) return true;

  // regras por área
  if (pathname.startsWith("/admin/materias")) return roles.includes("editor") || roles.includes("autor");
  if (pathname.startsWith("/admin/projetos")) return roles.includes("projetos");
  if (pathname.startsWith("/admin/equipe")) return roles.includes("editor");
  if (pathname.startsWith("/admin/configuracoes")) return roles.includes("config");
  if (pathname.startsWith("/admin/usuarios")) return roles.includes("usuarios");

  // dashboard (admin home)
  if (pathname === "/admin" || pathname === "/admin/") return roles.length > 0;

  return false;
}

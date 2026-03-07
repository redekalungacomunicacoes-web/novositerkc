import { getCurrentUserRoles } from "@/lib/rbac";

export async function getMyRoles(): Promise<string[]> {
  const { roles } = await getCurrentUserRoles();
  return roles;
}

export function canAccess(pathname: string, roles: string[]) {
  if (roles.includes("admin_alfa")) return true;

  if (pathname.startsWith("/admin/materias")) return roles.some((r) => ["admin", "editor", "autor"].includes(r));
  if (pathname.startsWith("/admin/projetos")) return roles.some((r) => ["admin", "editor"].includes(r));
  if (pathname.startsWith("/admin/equipe")) return roles.some((r) => ["admin", "editor"].includes(r));
  if (pathname.startsWith("/admin/quem-somos")) return roles.some((r) => ["admin", "editor"].includes(r));
  if (pathname.startsWith("/admin/newsletter")) return roles.some((r) => ["admin", "editor"].includes(r));
  if (pathname.startsWith("/admin/financeiro")) return roles.some((r) => ["admin", "editor"].includes(r));
  if (pathname.startsWith("/admin/configuracoes")) return false;
  if (pathname.startsWith("/admin/usuarios")) return false;
  if (pathname.startsWith("/admin/perfil")) return roles.length > 0;

  if (pathname === "/admin" || pathname === "/admin/") return roles.length > 0;

  return false;
}

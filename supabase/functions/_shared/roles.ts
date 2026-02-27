import { supabaseAdmin } from "./supabase.ts";

export type RoleName = "admin_alfa" | "admin" | "editor" | "autor";

export async function getUserFromRequest(req: Request) {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth) return null;

  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const token = m[1].trim();
  if (!token) return null;

  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);

  if (error || !data?.user) return null;
  return data.user;
}

export async function getRolesForUser(userId: string): Promise<RoleName[]> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", userId);

  if (error) return [];
  return (data ?? [])
    .map((r: any) => r?.role?.name)
    .filter(Boolean) as RoleName[];
}

export function hasAnyRole(userRoles: RoleName[], required: RoleName[]) {
  if (userRoles.includes("admin_alfa")) return true;
  return required.some((r) => userRoles.includes(r));
}

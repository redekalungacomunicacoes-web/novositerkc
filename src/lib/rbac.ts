import { supabase } from "./supabase";

export const ADMIN_PANEL_ROLES = ["admin_alfa", "admin", "editor", "autor"] as const;
export type RoleName = (typeof ADMIN_PANEL_ROLES)[number];

export type RoleRow = { id: string; name: string };

type UserRoleJoinRow = {
  role_id: string;
  roles: {
    name: string;
  } | null;
};

export async function listRoles() {
  return supabase.from("roles").select("id,name").order("name", { ascending: true });
}

export async function getUserRoles(userId: string): Promise<{ roles: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id,roles(name)")
    .eq("user_id", userId);

  if (error) return { roles: [], error: error.message };

  const roleNames = ((data || []) as UserRoleJoinRow[])
    .map((row) => row.roles?.name)
    .filter((name): name is string => Boolean(name));

  return { roles: [...new Set(roleNames)], error: null };
}

export async function getCurrentUserRoles(): Promise<{ roles: string[]; error: string | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { roles: [], error: error.message };

  const userId = data.session?.user.id;
  if (!userId) return { roles: [], error: null };

  return getUserRoles(userId);
}

export function hasAdminPanelRole(roles: string[]) {
  return roles.some((role) => ADMIN_PANEL_ROLES.includes(role as RoleName));
}

export async function addRoleToUser(userId: string, roleName: string) {
  const normalizedRole = roleName.trim().toLowerCase();
  const { data: role, error: roleErr } = await supabase
    .from("roles")
    .select("id,name")
    .eq("name", normalizedRole)
    .maybeSingle();

  if (roleErr) return { data: null, error: new Error(roleErr.message) };
  if (!role) return { data: null, error: new Error(`Role não encontrada: ${normalizedRole}`) };

  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role_id: role.id }, { onConflict: "user_id,role_id" });

  if (error) return { data: null, error: new Error(error.message) };

  return { data: { user_id: userId, role_id: role.id }, error: null };
}

export async function removeRoleFromUser(userId: string, roleName: string) {
  const normalizedRole = roleName.trim().toLowerCase();
  const { data: role, error: roleErr } = await supabase
    .from("roles")
    .select("id,name")
    .eq("name", normalizedRole)
    .maybeSingle();

  if (roleErr) return { data: null, error: new Error(roleErr.message) };
  if (!role) return { data: null, error: new Error(`Role não encontrada: ${normalizedRole}`) };

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", role.id);

  if (error) return { data: null, error: new Error(error.message) };

  return { data: { user_id: userId, role_id: role.id }, error: null };
}

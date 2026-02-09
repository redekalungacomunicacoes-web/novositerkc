import { supabase } from "./supabase";

export type RoleRow = { id: string; name: string };
export type UserRoleRow = { user_id: string; role_id: string };

export async function listRoles() {
  return supabase.from("roles").select("id,name").order("name", { ascending: true });
}

export async function listUserRoles() {
  // Tenta trazer o nome da role via relacionamento FK (roles)
  return supabase.from("user_roles").select("user_id, role_id, role:roles(name)").order("user_id", { ascending: true });
}

export async function addRoleToUser(userId: string, roleName: string) {
  const { data: roles, error: roleErr } = await supabase.from("roles").select("id,name").eq("name", roleName).limit(1);
  if (roleErr) return { data: null as any, error: roleErr };
  const role = roles && roles[0];
  if (!role) return { data: null as any, error: new Error("Role não encontrada: " + roleName) as any };

  return supabase.from("user_roles").insert({ user_id: userId, role_id: role.id });
}

export async function removeRoleFromUser(userId: string, roleName: string) {
  const { data: roles, error: roleErr } = await supabase.from("roles").select("id,name").eq("name", roleName).limit(1);
  if (roleErr) return { data: null as any, error: roleErr };
  const role = roles && roles[0];
  if (!role) return { data: null as any, error: new Error("Role não encontrada: " + roleName) as any };

  return supabase.from("user_roles").delete().eq("user_id", userId).eq("role_id", role.id);
}

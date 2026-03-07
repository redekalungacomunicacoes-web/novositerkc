import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Trash2, Edit, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addRoleToUser, listRoles, removeRoleFromUser, RoleRow } from "@/lib/rbac";

type UIUser = {
  user_id: string;
  equipe_id: string;
  name: string;
  email: string;
  roles: string[];
  status: "Ativo" | "Inativo";
};

type UserRoleRow = {
  user_id: string;
  roles?: {
    name?: string;
  } | null;
};

export function AdminUsuarios() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UIUser[]>([]);

  async function load() {
    setLoading(true);

    const [rolesRes, equipeRes, userRolesRes] = await Promise.all([
      listRoles(),
      supabase
        .from("equipe")
        .select("id,nome,email_login,ativo,user_id")
        .not("email_login", "is", null)
        .order("nome", { ascending: true }),
      supabase.from("user_roles").select("user_id,roles(name)"),
    ]);

    if (rolesRes.error) {
      alert(`Erro ao carregar roles: ${rolesRes.error.message}`);
    } else {
      setRoles((rolesRes.data || []) as RoleRow[]);
    }

    if (equipeRes.error) {
      alert(`Erro ao carregar equipe: ${equipeRes.error.message}`);
      setLoading(false);
      return;
    }

    if (userRolesRes.error) {
      alert(`Erro ao carregar permissões: ${userRolesRes.error.message}`);
      setLoading(false);
      return;
    }

    const rolesByUser = new Map<string, string[]>();

    for (const row of (userRolesRes.data || []) as UserRoleRow[]) {
      const uid = row.user_id;
      const roleName = row.roles?.name;
      if (!uid || !roleName) continue;

      const current = rolesByUser.get(uid) || [];
      if (!current.includes(roleName)) current.push(roleName);
      rolesByUser.set(uid, current);
    }

    const ui: UIUser[] = (equipeRes.data || []).map((row: any) => ({
      equipe_id: row.id,
      user_id: row.user_id || "",
      name: row.nome || "—",
      email: row.email_login || "—",
      roles: row.user_id ? rolesByUser.get(row.user_id) || [] : [],
      status: row.ativo ? "Ativo" : "Inativo",
    }));

    setUsers(ui);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        u.roles.join(", ").toLowerCase().includes(needle),
    );
  }, [users, q]);

  const handleNewUser = async () => {
    alert("Crie o acesso pela tela de Equipe > Editar integrante.");
  };

  const handleEdit = async (userId: string) => {
    if (!userId) {
      alert("Este integrante ainda não está vinculado a um usuário Auth.");
      return;
    }

    const action = prompt("Digite: add ou remove", "add");
    if (!action) return;

    const roleName = prompt(
      `Role (ex: admin, editor, autor):\n\nRoles disponíveis: ${roles.length ? roles.map((r) => r.name).join(", ") : "carregando..."}`,
    );
    if (!roleName) return;

    const normalizedRole = roleName.trim().toLowerCase();
    const fn = action.toLowerCase().startsWith("r") ? removeRoleFromUser : addRoleToUser;
    const res = await fn(userId, normalizedRole);

    if (res.error) {
      alert(res.error.message);
      return;
    }

    await load();
  };

  const handleDelete = async (userId: string) => {
    if (!userId) {
      alert("Este integrante não possui user_id vinculado.");
      return;
    }

    if (!confirm("Remover todas as roles deste usuário?")) return;

    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerencie quem tem acesso ao painel administrativo.</p>
        </div>
        <button
          onClick={handleNewUser}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      <div className="flex items-center gap-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar usuários..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Função</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={5}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.equipe_id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user.name.charAt(0)}
                      </div>
                      {user.name}
                    </td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        {user.roles.length ? user.roles.join(", ") : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            void handleEdit(user.user_id);
                          }}
                          className="p-2 hover:bg-muted rounded-full text-blue-600"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            void handleDelete(user.user_id);
                          }}
                          className="p-2 hover:bg-muted rounded-full text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

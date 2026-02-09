import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Trash2, Edit, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addRoleToUser, listRoles, listUserRoles, removeRoleFromUser, RoleRow } from "@/lib/rbac";

type UIUser = {
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: "Ativo";
};

export function AdminUsuarios() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UIUser[]>([]);

  async function load() {
    setLoading(true);

    const [rolesRes, urRes] = await Promise.all([
      listRoles(),
      listUserRoles(),
    ]);

    if (!rolesRes.error && rolesRes.data) setRoles(rolesRes.data as RoleRow[]);

    if (!urRes.error && urRes.data) {
      // agrupa por user_id
      const grouped = new Map<string, string[]>();
      for (const row of urRes.data as any[]) {
        const uid = row.user_id as string;
        const roleName = row.role?.name || row.role_name || row.role || "—";
        const arr = grouped.get(uid) || [];
        if (roleName && roleName !== "—") arr.push(roleName);
        grouped.set(uid, arr);
      }

      const ui: UIUser[] = Array.from(grouped.entries()).map(([uid, rnames]) => {
        const short = uid.slice(0, 8);
        return {
          user_id: uid,
          name: short,
          email: uid,
          role: rnames.length ? rnames.join(", ") : "—",
          status: "Ativo",
        };
      });

      setUsers(ui);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) =>
      u.user_id.toLowerCase().includes(needle) ||
      u.role.toLowerCase().includes(needle)
    );
  }, [users, q]);

  const handleNewUser = async () => {
    const userId = prompt("Cole o UUID do usuário (Supabase Auth user_id):");
    if (!userId) return;

    const roleName = prompt(
      "Digite a role para atribuir (ex: admin, editor, autor):\n\nRoles disponíveis: " +
        (roles.length ? roles.map((r) => r.name).join(", ") : "carregando...")
    );
    if (!roleName) return;

    const res = await addRoleToUser(userId.trim(), roleName.trim());
    if (res.error) {
      alert(res.error.message);
      return;
    }
    await load();
  };

  const handleEdit = async (userId: string) => {
    const action = prompt(
      "Digite: add ou remove\nDepois você vai escolher a role.\n\nExemplo: add",
      "add"
    );
    if (!action) return;

    const roleName = prompt(
      "Role (ex: admin, editor, autor):\n\nRoles disponíveis: " +
        (roles.length ? roles.map((r) => r.name).join(", ") : "carregando...")
    );
    if (!roleName) return;

    const fn = action.toLowerCase().startsWith("r") ? removeRoleFromUser : addRoleToUser;
    const res = await fn(userId, roleName.trim());
    if (res.error) {
      alert(res.error.message);
      return;
    }
    await load();
  };

  const handleDelete = async (userId: string) => {
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
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                <tr><td className="px-6 py-4 text-muted-foreground" colSpan={5}>Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-6 py-4 text-muted-foreground" colSpan={5}>Nenhum usuário encontrado.</td></tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.user_id} className="hover:bg-muted/50 transition-colors">
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
                        {user.role}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.status === 'Ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(user.user_id)} className="p-2 hover:bg-muted rounded-full text-blue-600 hover:text-blue-700 transition-colors" title="Editar">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(user.user_id)} className="p-2 hover:bg-muted rounded-full text-red-600 hover:text-red-700 transition-colors" title="Excluir">
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

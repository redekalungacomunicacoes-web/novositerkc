import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Trash2, Edit } from "lucide-react";
import { supabase } from "@/lib/supabase";

type EquipeRow = {
  id: string;
  nome: string;
  cargo: string | null;
  foto_url: string | null;
  instagram: string | null;
  slug: string | null;
  is_public: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
};

export function AdminEquipe() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EquipeRow[]>([]);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("equipe")
      .select("id, nome, cargo, foto_url, instagram, slug, is_public, ativo, ordem, created_at")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setRows((data || []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        (r.nome || "").toLowerCase().includes(needle) ||
        (r.cargo || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  async function toggleAtivo(id: string, next: boolean) {
    const { error } = await supabase.from("equipe").update({ ativo: next }).eq("id", id);
    if (error) return alert(error.message);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ativo: next } : r)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este membro da equipe?")) return;
    const { error } = await supabase.from("equipe").delete().eq("id", id);
    if (error) return alert(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os perfis públicos (Quem Somos) e a lista de autores para matérias.
          </p>
        </div>

        <Link
          to="/admin/equipe/novo"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo membro
        </Link>
      </div>

      <div className="flex items-center gap-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar por nome ou cargo..."
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
                <th className="px-6 py-3 font-medium">Pessoa</th>
                <th className="px-6 py-3 font-medium">Cargo</th>
                <th className="px-6 py-3 font-medium">Ordem</th>
                <th className="px-6 py-3 font-medium">Ativo</th>
                <th className="px-6 py-3 font-medium">Público</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={6}>
                    Nenhum membro encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                          {r.foto_url ? (
                            <img src={r.foto_url} alt={r.nome} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold">{r.nome}</div>
                          {r.instagram && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{r.instagram}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">{r.cargo || "—"}</td>
                    <td className="px-6 py-4">{r.ordem ?? 0}</td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleAtivo(r.id, !r.ativo)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.ativo
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                        }`}
                        title="Clique para alternar"
                      >
                        {r.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>

                    <td className="px-6 py-4">{r.is_public ? "Publicado" : "Rascunho"}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.slug && <a href={`/equipe/${r.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Abrir perfil</a>}
                        <Link
                          to={`/admin/equipe/editar/${r.id}`}
                          className="p-2 hover:bg-muted rounded-full text-blue-600 hover:text-blue-700 transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>

                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-2 hover:bg-muted rounded-full text-red-600 hover:text-red-700 transition-colors"
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

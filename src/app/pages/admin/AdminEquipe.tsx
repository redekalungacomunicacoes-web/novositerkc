import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Trash2, Edit, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

type EquipeRow = {
  id: string;
  nome: string;
  cargo: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  avatar_thumb_path: string | null;
  instagram_url: string | null;
  is_public: boolean;
  is_active: boolean;
  order_index: number;
  created_at: string;
};

const TEMP_SWAP_VALUE = -999999;

function sortByOrderAndName(list: EquipeRow[]) {
  return [...list].sort(
    (a, b) => (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER) || a.nome.localeCompare(b.nome)
  );
}

export function AdminEquipe() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EquipeRow[]>([]);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("equipe")
      .select("id, nome, cargo, instagram_url, is_public, is_active, order_index, avatar_url, avatar_path, avatar_thumb_path, created_at")
      .order("order_index", { ascending: true })
      .order("nome", { ascending: true });

    setLoading(false);

    if (error) {
      const fallback = await supabase
        .from("equipe")
        .select("id, nome, cargo, instagram_url:instagram, is_public, is_active:ativo, order_index, avatar_url:foto_url, avatar_path, avatar_thumb_path, created_at")
        .order("order_index", { ascending: true })
        .order("nome", { ascending: true });

      if (fallback.error) {
        alert(fallback.error.message);
        return;
      }

      const normalized = (fallback.data || []) as EquipeRow[];
      setRows(sortByOrderAndName(normalized));
      setOrderDrafts(Object.fromEntries(normalized.map((row) => [row.id, String(row.order_index ?? "")])));
      return;
    }

    const normalized = (data || []) as EquipeRow[];
    setRows(sortByOrderAndName(normalized));
    setOrderDrafts(Object.fromEntries(normalized.map((row) => [row.id, String(row.order_index ?? "")])));
  }

  function updateLocalOrder(memberId: string, nextValue: number) {
    setRows((prev) => sortByOrderAndName(prev.map((row) => (row.id === memberId ? { ...row, order_index: nextValue } : row))));
    setOrderDrafts((prev) => ({ ...prev, [memberId]: String(nextValue) }));
  }

  async function saveOrder(memberId: string, rawValue: string) {
    const target = rows.find((row) => row.id === memberId);
    if (!target) return;
    if (rawValue.trim() === "") {
      setOrderDrafts((prev) => ({ ...prev, [memberId]: String(target.order_index ?? 1) }));
      return;
    }
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 1) {
      alert("A ordem deve ser um número inteiro maior ou igual a 1.");
      setOrderDrafts((prev) => ({ ...prev, [memberId]: String(target.order_index ?? 1) }));
      return;
    }
    if (parsed === target.order_index) return;

    const previousRows = rows;
    updateLocalOrder(memberId, parsed);

    const { error } = await supabase.from("equipe").update({ order_index: parsed }).eq("id", memberId);
    if (error) {
      setRows(previousRows);
      setOrderDrafts(Object.fromEntries(previousRows.map((row) => [row.id, String(row.order_index ?? "")])));
      alert(error.message);
      return;
    }

    alert("Ordem atualizada");
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
    const { error } = await supabase.from("equipe").update({ is_active: next }).eq("id", id);
    if (error) {
      const fallback = await supabase.from("equipe").update({ ativo: next }).eq("id", id);
      if (fallback.error) return alert(fallback.error.message);
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
  }

  async function moveOrder(index: number, direction: -1 | 1) {
    const ordered = filtered;
    const neighborIndex = index + direction;
    if (neighborIndex < 0 || neighborIndex >= ordered.length) return;

    const current = ordered[index];
    const neighbor = ordered[neighborIndex];
    const currentOld = current.order_index;
    const neighborOld = neighbor.order_index;
    const snapshot = rows;

    const swapped = rows.map((row) => {
      if (row.id === current.id) return { ...row, order_index: neighborOld };
      if (row.id === neighbor.id) return { ...row, order_index: currentOld };
      return row;
    });
    setRows(sortByOrderAndName(swapped));
    setOrderDrafts((prev) => ({ ...prev, [current.id]: String(neighborOld), [neighbor.id]: String(currentOld) }));

    const stepA = await supabase.from("equipe").update({ order_index: TEMP_SWAP_VALUE }).eq("id", neighbor.id);
    if (stepA.error) {
      setRows(snapshot);
      setOrderDrafts(Object.fromEntries(snapshot.map((row) => [row.id, String(row.order_index ?? "")])));
      alert(stepA.error.message);
      return;
    }

    const stepB = await supabase.from("equipe").update({ order_index: neighborOld }).eq("id", current.id);
    if (stepB.error) {
      await supabase.from("equipe").update({ order_index: neighborOld }).eq("id", neighbor.id);
      setRows(snapshot);
      setOrderDrafts(Object.fromEntries(snapshot.map((row) => [row.id, String(row.order_index ?? "")])));
      alert(stepB.error.message);
      return;
    }

    const stepC = await supabase.from("equipe").update({ order_index: currentOld }).eq("id", neighbor.id);
    if (stepC.error) {
      await supabase.from("equipe").update({ order_index: currentOld }).eq("id", current.id);
      await supabase.from("equipe").update({ order_index: neighborOld }).eq("id", neighbor.id);
      setRows(snapshot);
      setOrderDrafts(Object.fromEntries(snapshot.map((row) => [row.id, String(row.order_index ?? "")])));
      alert(stepC.error.message);
      return;
    }

    alert("Ordem atualizada");
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
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt={r.nome} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold">{r.nome}</div>
                          {r.instagram_url && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{r.instagram_url}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">{r.cargo || "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={orderDrafts[r.id] ?? String(r.order_index ?? "")}
                          onChange={(e) => setOrderDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          onBlur={(e) => saveOrder(r.id, e.target.value)}
                          className="h-9 w-20 rounded border px-2"
                        />
                        <button type="button" className="p-1.5 border rounded" onClick={() => moveOrder(filtered.findIndex((x) => x.id === r.id), -1)}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="p-1.5 border rounded" onClick={() => moveOrder(filtered.findIndex((x) => x.id === r.id), 1)}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleAtivo(r.id, !r.is_active)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                        }`}
                        title="Clique para alternar"
                      >
                        {r.is_active ? "Ativo" : "Inativo"}
                      </button>
                    </td>

                    <td className="px-6 py-4">{r.is_public ? "Publicado" : "Rascunho"}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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

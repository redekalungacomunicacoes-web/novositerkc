import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { deleteProjeto, listProjetos, ProjetoRow } from "@/lib/cms";

function statusLabel(p: ProjetoRow) {
  // Mantém o layout (status textual), inferindo pelo publicado_transparencia
  return p.publicado_transparencia ? "Publicado" : "Planejamento";
}

export function AdminProjetos() {
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await listProjetos();
    if (!error && data) setProjetos(data as ProjetoRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const base = !needle
      ? projetos
      : projetos.filter(
          (p) =>
            (p.titulo || "").toLowerCase().includes(needle) ||
            (p.resumo || "").toLowerCase().includes(needle) ||
            (p.descricao || "").toLowerCase().includes(needle)
        );

    // ✅ Ordena por sort_order (asc), null/undefined vão pro final
    // fallback: updated_at desc (pra ficar “certinho” quando não tem ordem)
    return [...base].sort((a, b) => {
      const ao = (a as any).sort_order;
      const bo = (b as any).sort_order;

      const aHas = typeof ao === "number" && Number.isFinite(ao);
      const bHas = typeof bo === "number" && Number.isFinite(bo);

      if (aHas && bHas) return ao - bo;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;

      const ad = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bd = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bd - ad;
    });
  }, [projetos, q]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este projeto?")) return;
    const { error } = await deleteProjeto(id);
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
          <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground mt-1">Gerencie os projetos cadastrados no site.</p>
        </div>
        <Link
          to="/admin/projetos/novo"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Projeto
        </Link>
      </div>

      <div className="flex items-center gap-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar projetos..."
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
                {/* ✅ NOVO */}
                <th className="px-6 py-3 font-medium w-[90px]">Ordem</th>

                <th className="px-6 py-3 font-medium">Projeto</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Beneficiários</th>
                <th className="px-6 py-3 font-medium">Última atualização</th>
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
                    Nenhum projeto encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const status = statusLabel(p);
                  const lastUpdate = p.updated_at ? new Date(p.updated_at).toLocaleDateString("pt-BR") : "—";

                  // Campos extras não existem no schema sem meta; mantemos layout mostrando “—”
                  const beneficiaries = (p as any).meta?.beneficiaries ? (p as any).meta.beneficiaries : "—";

                  // ✅ NOVO
                  const ordem =
                    typeof (p as any).sort_order === "number" && Number.isFinite((p as any).sort_order)
                      ? String((p as any).sort_order)
                      : "—";

                  return (
                    <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                      {/* ✅ NOVO */}
                      <td className="px-6 py-4 text-muted-foreground">{ordem}</td>

                      <td className="px-6 py-4 font-medium text-foreground">{p.titulo}</td>
                      <td className="px-6 py-4">{status}</td>
                      <td className="px-6 py-4">{beneficiaries}</td>
                      <td className="px-6 py-4">{lastUpdate}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/projetos/${p.id}`}
                            className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/admin/projetos/editar/${p.id}`}
                            className="p-2 hover:bg-muted rounded-full text-blue-600 hover:text-blue-700 transition-colors"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-2 hover:bg-muted rounded-full text-red-600 hover:text-red-700 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

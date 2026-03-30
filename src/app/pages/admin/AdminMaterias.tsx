import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { createMateriaCategoria, deleteMateria, listMateriaCategoryNames, listMaterias, MateriaRow } from "@/lib/cms";

function statusLabel(status: MateriaRow["status"]) {
  if (status === "published") return "Publicado";
  if (status === "archived") return "Arquivado";
  return "Rascunho";
}

export function AdminMaterias() {
  const [materias, setMaterias] = useState<MateriaRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const [{ data, error }, categoriesRes] = await Promise.all([listMaterias(), listMateriaCategoryNames()]);
    if (!error && data) setMaterias(data as MateriaRow[]);
    setCategories(categoriesRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return materias.filter((m) => {
      const category = (m.tags && m.tags[0]) ? m.tags[0] : "";
      const matchesCategory = activeCategory === "Todas" || category === activeCategory;
      if (!matchesCategory) return false;
      if (!needle) return true;
      return (m.titulo || "").toLowerCase().includes(needle) ||
        (m.resumo || "").toLowerCase().includes(needle) ||
        (m.tags || []).join(" ").toLowerCase().includes(needle);
    });
  }, [activeCategory, materias, q]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      alert("Informe o nome da nova categoria.");
      return;
    }

    const duplicated = categories.some(
      (category) => category.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0
    );
    if (duplicated) {
      alert("Essa categoria já existe.");
      return;
    }

    setAddingCategory(true);
    try {
      const { data, error } = await createMateriaCategoria(name);
      if (error) {
        if ((error as any).code === "23505") {
          alert("Essa categoria já existe.");
          return;
        }
        if (/materia_categorias/i.test(error.message || "") && /does not exist/i.test(error.message || "")) {
          alert("A tabela de categorias ainda não existe. Execute o SQL de criação e tente novamente.");
          return;
        }
        alert(error.message || "Não foi possível criar a categoria.");
        return;
      }

      const nextName = data?.nome || name;
      const nextOptions = [...categories, nextName].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" })
      );
      setCategories(nextOptions);
      setActiveCategory(nextName);
      setNewCategoryName("");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta matéria?")) return;
    const { error } = await deleteMateria(id);
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
          <h1 className="text-3xl font-bold tracking-tight">Matérias</h1>
          <p className="text-muted-foreground mt-1">Gerencie as matérias publicadas no site.</p>
        </div>
        <Link
          to="/admin/materias/nova"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Matéria
        </Link>
      </div>

      <div className="flex items-center gap-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar matérias..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      <div className="bg-card p-4 rounded-lg border shadow-sm space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["Todas", ...categories].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                activeCategory === category
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="w-full h-10 px-3 rounded-md border bg-background"
            placeholder="+ Adicionar categoria"
          />
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={addingCategory}
            className="inline-flex items-center justify-center gap-2 rounded-md border px-4 h-10 text-sm hover:bg-muted disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {addingCategory ? "Salvando..." : "Adicionar categoria"}
          </button>
        </div>
      </div>

      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Título</th>
                <th className="px-6 py-3 font-medium">Categoria</th>
                <th className="px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td className="px-6 py-4 text-muted-foreground" colSpan={5}>Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-6 py-4 text-muted-foreground" colSpan={5}>Nenhuma matéria encontrada.</td></tr>
              ) : (
                filtered.map((m) => {
                  const category = (m.tags && m.tags[0]) ? m.tags[0] : "—";
                  const dateSrc = m.published_at || m.created_at;
                  const date = dateSrc ? new Date(dateSrc).toLocaleDateString("pt-BR") : "—";
                  const status = statusLabel(m.status);
                  return (
                    <tr key={m.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{m.titulo}</td>
                      <td className="px-6 py-4">{category}</td>
                      <td className="px-6 py-4">{date}</td>
                      <td className="px-6 py-4">{status}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/materias/${m.id}`} className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors" title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link to={`/admin/materias/editar/${m.id}`} className="p-2 hover:bg-muted rounded-full text-blue-600 hover:text-blue-700 transition-colors" title="Editar">
                            <Edit className="h-4 w-4" />
                          </Link>
                          <button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-muted rounded-full text-red-600 hover:text-red-700 transition-colors" title="Excluir">
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

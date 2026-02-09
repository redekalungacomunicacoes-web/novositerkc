import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { createMateria, getMateria, slugify, updateMateria } from "@/lib/cms";
import { supabase } from "@/lib/supabase";

type EquipeOption = {
  id: string;
  nome: string;
  cargo?: string | null;
  foto_url?: string | null;
  ativo?: boolean;
  ordem?: number;
};

type MateriaFormData = {
  title: string;
  subtitle: string;
  authorId: string; // ✅ agora é ID da equipe
  category: string;
  date: string;
  content: string;
  coverImage: string;
  status: "published" | "draft" | "archived";
};

// Garante slug único (evita erro: materias_slug_key)
async function ensureUniqueMateriaSlug(baseSlug: string, currentId?: string) {
  let slug = baseSlug || `materia-${Date.now()}`;
  let i = 1;

  while (true) {
    const { data, error } = await supabase
      .from("materias")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) return slug;

    if (currentId && data[0]?.id === currentId) return slug;

    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

export function AdminMateriaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<MateriaFormData>({
    defaultValues: {
      status: "draft",
      date: today,
      title: "",
      subtitle: "",
      authorId: "",
      category: "",
      content: "",
      coverImage: "",
    }
  });

  const [loading, setLoading] = useState(false);
  const [equipe, setEquipe] = useState<EquipeOption[]>([]);
  const selectedAuthorId = watch("authorId");

  // Carrega equipe ativa (para dropdown)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("equipe")
        .select("id, nome, cargo, foto_url, ativo, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }
      setEquipe((data || []) as any);
    })();
  }, []);

  // Carrega matéria (edição)
  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      const { data, error } = await getMateria(id);
      setLoading(false);

      if (error || !data) {
        alert(error?.message || "Não foi possível carregar a matéria.");
        return;
      }

      const d: any = data;

      reset({
        title: d.titulo || "",
        subtitle: d.resumo || "",
        authorId: d.autor_id || "", // ✅
        category: (d.tags && d.tags[0]) ? d.tags[0] : "",
        date: (d.published_at ? new Date(d.published_at) : new Date(d.created_at)).toISOString().split("T")[0],
        content: d.conteudo || "",
        coverImage: d.capa_url || "",
        status: d.status || "draft",
      });

      // fallback: se não tiver autor_id mas tiver autor_nome, tenta achar na equipe
      if (!d.autor_id && d.autor_nome && (equipe?.length || 0) > 0) {
        const match = equipe.find((p) => (p.nome || "").toLowerCase() === String(d.autor_nome).toLowerCase());
        if (match) setValue("authorId", match.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reset]);

  const onSubmit = async (data: MateriaFormData) => {
    setLoading(true);

    try {
      const tags = data.category ? [data.category] : [];

      const baseSlug = slugify(data.title);
      const uniqueSlug = await ensureUniqueMateriaSlug(baseSlug, id);

      const autor = equipe.find((p) => p.id === data.authorId);
      const autor_nome = autor?.nome || null;

      const payload: any = {
        titulo: data.title,
        slug: uniqueSlug,
        resumo: data.subtitle || null,
        conteudo: data.content || null,
        capa_url: data.coverImage || null,
        tags,
        status: data.status,
        published_at: data.status === "published" ? new Date(data.date).toISOString() : null,

        // ✅ autor ligado à equipe
        autor_id: data.authorId || null,
        autor_nome, // mantém compatível com o público
      };

      const res = isEditing && id
        ? await updateMateria(id, payload)
        : await createMateria(payload);

      setLoading(false);

      if (res.error) {
        alert(res.error.message);
        return;
      }

      navigate("/admin/materias");
    } catch (err: any) {
      setLoading(false);
      alert(err?.message || "Erro ao salvar matéria.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/materias" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? "Editar Matéria" : "Nova Matéria"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isEditing ? "Atualize os detalhes da publicação." : "Preencha os campos para criar uma nova publicação."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate("/admin/materias")}
            className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
            disabled={loading}
          >
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Informações Principais</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <input
                {...register("title", { required: "Título é obrigatório" })}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Digite o título da matéria"
              />
              {errors.title && <span className="text-destructive text-xs">{errors.title.message}</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Subtítulo (Linha fina)</label>
              <textarea
                {...register("subtitle")}
                className="w-full h-20 p-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                placeholder="Um breve resumo que aparece abaixo do título"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ✅ Autor dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Autor</label>
                <select
                  {...register("authorId")}
                  className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  <option value="">
                    {equipe.length ? "Selecione um autor..." : "Carregando equipe..."}
                  </option>
                  {equipe.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.cargo ? ` — ${p.cargo}` : ""}
                    </option>
                  ))}
                </select>
                {!equipe.length && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre membros em <b>Admin → Equipe</b> para aparecerem aqui.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Publicação</label>
                <input
                  type="date"
                  {...register("date")}
                  className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Conteúdo</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Texto da Matéria</label>
              <textarea
                {...register("content", { required: "Conteúdo é obrigatório" })}
                className="w-full min-h-[400px] p-4 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm leading-relaxed"
                placeholder="Escreva o conteúdo da matéria aqui usando Markdown ou HTML simples..."
              />
              {errors.content && <span className="text-destructive text-xs">{errors.content.message}</span>}
              <p className="text-xs text-muted-foreground text-right">Suporta Markdown básico.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Publicação</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                {...register("status")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <select
                {...register("category")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                <option value="Cultura">Cultura</option>
                <option value="Política">Política</option>
                <option value="Educação">Educação</option>
                <option value="Meio Ambiente">Meio Ambiente</option>
                <option value="Projetos">Projetos</option>
                <option value="Agenda">Agenda</option>
              </select>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Imagem de Capa</h3>

            {/* mantém seu bloco de upload visual (o upload já está funcionando no seu projeto) */}
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10">
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Clique para fazer upload</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG até 5MB</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ou URL da imagem</label>
              <input
                {...register("coverImage")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="https://..."
              />
            </div>

            {/* (opcional) info rápida do autor escolhido */}
            {selectedAuthorId && (
              <p className="text-xs text-muted-foreground">
                Autor selecionado:{" "}
                <b>{equipe.find((p) => p.id === selectedAuthorId)?.nome || "—"}</b>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

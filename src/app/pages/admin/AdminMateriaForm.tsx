import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save, ArrowLeft, Image as ImageIcon, Trash2 } from "lucide-react";
import { createMateria, getMateria, slugify, updateMateria } from "@/lib/cms";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  authorId: string;
  category: string;
  date: string;
  content: string;
  coverImage: string;
  status: "published" | "draft" | "archived";
};

type MateriaGaleriaItem = {
  id: string;
  materia_id: string;
  url: string;
  legenda: string | null;
  ordem: number | null;
  created_at?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeFilename(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.\-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || `arquivo-${Date.now()}`
  );
}

async function uploadToStorage(params: {
  bucket: string;
  folder: string;
  file: File;
  upsert?: boolean;
}) {
  const { bucket, folder, file, upsert = true } = params;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const base = safeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const path = `${folder}/${Date.now()}-${base}.${ext}`;

  const { error: upError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert, contentType: file.type });

  if (upError) throw upError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Não foi possível obter a URL pública.");

  return { publicUrl: data.publicUrl, path };
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminMateriaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<MateriaFormData>({
    defaultValues: {
      status: "draft",
      date: today,
      title: "",
      subtitle: "",
      authorId: "",
      category: "",
      content: "",
      coverImage: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [equipe, setEquipe] = useState<EquipeOption[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Galeria
  const [galeria, setGaleria] = useState<MateriaGaleriaItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const coverUrl = watch("coverImage");
  const selectedAuthorId = watch("authorId");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Galeria só disponível após a matéria ter sido salva (tem id)
  const canUseGallery = useMemo(() => !!id, [id]);

  // ── Load equipe ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("equipe")
        .select("id, nome, cargo, foto_url, ativo, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

      if (!error) setEquipe((data || []) as any);
    })();
  }, []);

  // ── Load matéria (edição) ────────────────────────────────────────────────────
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
        authorId: d.autor_id || "",
        category: (d.tags && d.tags[0]) ? d.tags[0] : "",
        date: (d.published_at
          ? new Date(d.published_at)
          : new Date(d.created_at)
        )
          .toISOString()
          .split("T")[0],
        content: d.conteudo || "",
        coverImage: d.capa_url || "",
        status: d.status || "draft",
      });

      await loadGaleria(id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reset]);

  // ── Galeria helpers ──────────────────────────────────────────────────────────

  async function loadGaleria(materiaId: string) {
    const { data, error } = await supabase
      .from("materia_galeria")
      .select("id, materia_id, url, legenda, ordem, created_at")
      .eq("materia_id", materiaId)
      .order("ordem", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Erro ao carregar galeria:", error.message);
      setGaleria([]);
      return;
    }

    setGaleria((data || []) as MateriaGaleriaItem[]);
  }

  const handleGalleryFilesChange = async (files?: FileList | null) => {
    if (!id || !files || files.length === 0) return;

    setUploadingGallery(true);
    try {
      const baseOrder = galeria.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const { publicUrl } = await uploadToStorage({
          bucket: "materias",
          folder: `galeria/${id}`,
          file,
          upsert: false,
        });

        const { error: insErr } = await supabase.from("materia_galeria").insert({
          materia_id: id,
          url: publicUrl,
          legenda: null,
          ordem: baseOrder + i,
        });

        if (insErr) throw insErr;
      }

      await loadGaleria(id);
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem para a galeria.");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleDeleteGalleryItem = async (itemId: string) => {
    if (!id) return;
    const ok = confirm("Remover esta foto da galeria?");
    if (!ok) return;

    const { error } = await supabase.from("materia_galeria").delete().eq("id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadGaleria(id);
  };

  // ── Cover upload ─────────────────────────────────────────────────────────────

  const handleCoverUpload = async (file?: File) => {
    if (!file) return;

    setUploadingCover(true);
    try {
      const { publicUrl } = await uploadToStorage({
        bucket: "materias",
        folder: "capas",
        file,
        upsert: true,
      });

      setValue("coverImage", publicUrl, { shouldDirty: true, shouldValidate: true });
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem de capa.");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

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
        autor_id: data.authorId || null,
        autor_nome,
      };

      const res = isEditing && id
        ? await updateMateria(id, payload)
        : await createMateria(payload);

      if (res.error) {
        alert(res.error.message);
        return;
      }

      navigate("/admin/materias");
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar matéria.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
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
              {isEditing
                ? "Atualize os detalhes da publicação."
                : "Preencha os campos para criar uma nova publicação."}
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

        {/* ── Coluna principal ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Informações Principais */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Informações Principais</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <input
                {...register("title", { required: "Título é obrigatório" })}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Digite o título da matéria"
              />
              {errors.title && (
                <span className="text-destructive text-xs">{errors.title.message}</span>
              )}
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
                {selectedAuthorId && (
                  <p className="text-xs text-muted-foreground">
                    Autor: <b>{equipe.find((p) => p.id === selectedAuthorId)?.nome || "—"}</b>
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

          {/* Conteúdo */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Conteúdo</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Texto da Matéria</label>
              <textarea
                {...register("content", { required: "Conteúdo é obrigatório" })}
                className="w-full min-h-[400px] p-4 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm leading-relaxed"
                placeholder="Escreva o conteúdo da matéria aqui usando Markdown ou HTML simples..."
              />
              {errors.content && (
                <span className="text-destructive text-xs">{errors.content.message}</span>
              )}
              <p className="text-xs text-muted-foreground text-right">Suporta HTML básico.</p>
            </div>
          </div>

          {/* Galeria de Fotos */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="font-semibold text-lg">Galeria de Fotos</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {canUseGallery
                    ? "Adicione fotos que ilustram esta matéria."
                    : "Salve a matéria primeiro para liberar a galeria."}
                </p>
              </div>

              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                id="gallery-input"
                disabled={!canUseGallery}
                onChange={(e) => handleGalleryFilesChange(e.target.files)}
              />

              <label
                htmlFor="gallery-input"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors ${
                  !canUseGallery ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                {uploadingGallery ? "Enviando..." : "Adicionar fotos"}
              </label>
            </div>

            {galeria.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                <ImageIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Nenhuma foto na galeria ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {galeria.map((item) => (
                  <div key={item.id} className="rounded-xl border overflow-hidden group relative">
                    <img
                      src={item.url}
                      alt="Foto da matéria"
                      className="w-full h-40 object-cover"
                    />
                    <div className="p-2 flex items-center justify-between bg-background">
                      <span className="text-xs text-muted-foreground truncate">
                        {item.legenda || "Sem legenda"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteGalleryItem(item.id)}
                        className="p-1.5 rounded-lg border hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                        title="Remover foto"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna lateral ── */}
        <div className="space-y-6">

          {/* Publicação */}
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

          {/* Capa */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-2">
              <h3 className="font-semibold text-lg">Capa da Matéria</h3>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                id="cover-input"
                onChange={(e) => handleCoverUpload(e.target.files?.[0])}
              />

              <label
                htmlFor="cover-input"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                {uploadingCover ? "Enviando..." : "Enviar capa"}
              </label>
            </div>

            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Capa"
                className="w-full h-44 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-full h-44 rounded-lg border-2 border-dashed flex items-center justify-center text-sm text-muted-foreground">
                Nenhuma capa definida
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ou cole a URL</label>
              <input
                {...register("coverImage")}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="https://..."
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

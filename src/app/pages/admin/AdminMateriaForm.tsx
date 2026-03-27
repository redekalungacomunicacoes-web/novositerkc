import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save, ArrowLeft, Image as ImageIcon, Trash2, ChevronUp, ChevronDown, Plus, Bold, Italic } from "lucide-react";
import { createMateria, getMateria, MateriaContentBlock, MateriaTextBlockType, slugify, updateMateria } from "@/lib/cms";
import { supabase } from "@/lib/supabase";

type EquipeOption = {
  id: string;
  nome: string;
  cargo?: string | null;
  order_index?: number | null;
  is_public?: boolean | null;
  is_active?: boolean | null;
  ativo?: boolean | null;
};

type MateriaFormData = {
  title: string;
  subtitle: string;
  authorId: string;
  category: string;
  date: string;
  content: string;
  coverImage: string;
  bannerImage: string;
  hashtags: string;
  audioUrl: string;
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

type TextBlock = Extract<MateriaContentBlock, { type: "paragraph" | "heading" | "quote" | "highlight" }>;

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

function uid(prefix = "block") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHashtags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => {
          const clean = tag.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
          return clean ? `#${clean}` : "";
        })
        .filter(Boolean)
    )
  );
}

function normalizeBlocks(raw: any): MateriaContentBlock[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((block: any) => {
      if (!block || typeof block !== "object") return null;
      if (block.type === "image") {
        if (!block.url) return null;
        return {
          id: block.id || uid("img"),
          type: "image" as const,
          url: String(block.url),
          caption: block.caption ? String(block.caption) : "",
          credit: block.credit ? String(block.credit) : "",
        };
      }

      if (block.type === "image-text") {
        return {
          id: block.id || uid("imgtxt"),
          type: "image-text" as const,
          url: String(block.url || ""),
          text: String(block.text || ""),
          caption: block.caption || "",
          credit: block.credit || "",
          align: block.align === "right" ? "right" : "left",
          width: ["sm", "md", "lg"].includes(block.width) ? block.width : "md",
        };
      }

      if (["paragraph", "heading", "quote", "highlight"].includes(block.type)) {
        return {
          id: block.id || uid("txt"),
          type: block.type as TextBlock["type"],
          text: block.text ? String(block.text) : "",
          size: block.size === "sm" || block.size === "lg" ? block.size : "md",
          author: block.author ? String(block.author) : "",
        };
      }

      return null;
    })
    .filter(Boolean) as MateriaContentBlock[];
}

function buildLegacyHtml(blocks: MateriaContentBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "image") {
        const caption = block.caption ? `<figcaption>${block.caption}</figcaption>` : "";
        return `<figure><img src="${block.url}" alt="${block.caption || "Imagem da matéria"}"/>${caption}</figure>`;
      }
      if (block.type === "image-text") {
        const caption = block.caption ? `<figcaption>${block.caption}</figcaption>` : "";
        return `<section><figure><img src="${block.url}" alt="${block.caption || "Imagem da matéria"}"/>${caption}</figure><div>${block.text || ""}</div></section>`;
      }

      if (block.type === "heading") return `<h2>${block.text || ""}</h2>`;
      if (block.type === "quote") {
        const author = block.author ? `<cite>${block.author}</cite>` : "";
        return `<blockquote><p>${block.text || ""}</p>${author}</blockquote>`;
      }
      if (block.type === "highlight") return `<aside>${block.text || ""}</aside>`;
      return `<p>${block.text || ""}</p>`;
    })
    .join("\n");
}

async function uploadToStorage(params: {
  bucket: string;
  folder: string;
  file: File;
  upsert?: boolean;
  timeoutMs?: number;
}) {
  const { bucket, folder, file, upsert = true, timeoutMs } = params;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const base = safeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const path = `${folder}/${Date.now()}-${base}.${ext}`;

  console.log("[uploadToStorage] Iniciando upload", {
    bucket,
    folder,
    path,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    timeoutMs: timeoutMs ?? null,
  });

  try {
    const uploadPromise = supabase.storage
      .from(bucket)
      .upload(path, file, { upsert, contentType: file.type || undefined });

    const timeoutPromise = new Promise<never>((_, reject) => {
      if (!timeoutMs) return;
      setTimeout(() => {
        reject(new Error("O envio do arquivo demorou mais que o esperado. Tente novamente."));
      }, timeoutMs);
    });

    const { data: uploadData, error: upError } = await (timeoutMs
      ? Promise.race([uploadPromise, timeoutPromise])
      : uploadPromise);

    console.log("[uploadToStorage] Resposta do upload", { path, uploadData, upError });

    if (upError) {
      throw new Error(
        `Falha no upload para ${bucket}/${path}: ${upError.message || "erro desconhecido"}`
      );
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    console.log("[uploadToStorage] Resposta do getPublicUrl", { path, data });
    if (!data?.publicUrl) throw new Error("Não foi possível obter a URL pública.");

    return { publicUrl: data.publicUrl, path };
  } catch (err) {
    console.error("[uploadToStorage] Erro no fluxo de upload", { bucket, folder, path, err });
    throw err;
  }
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
      category: "Cultura",
      content: "",
      coverImage: "",
      bannerImage: "",
      hashtags: "",
      audioUrl: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [equipe, setEquipe] = useState<EquipeOption[]>([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [selectedAudioFileName, setSelectedAudioFileName] = useState("");

  const [galeria, setGaleria] = useState<MateriaGaleriaItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [blocks, setBlocks] = useState<MateriaContentBlock[]>([]);
  const [uploadingBlockImageId, setUploadingBlockImageId] = useState<string | null>(null);

  const coverUrl = watch("coverImage");
  const bannerUrl = watch("bannerImage");
  const selectedAuthorId = watch("authorId");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const canUseGallery = useMemo(() => !!id, [id]);

  useEffect(() => {
    (async () => {
      setLoadingEquipe(true);

      const detailedQuery = supabase
        .from("equipe")
        .select("id, nome, cargo, order_index")
        .order("order_index", { ascending: true })
        .order("nome", { ascending: true });

      const { data: detailedData, error: detailedError } = await detailedQuery;

      if (!detailedError) {
        setEquipe((detailedData || []) as EquipeOption[]);
        setLoadingEquipe(false);
        return;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("equipe")
        .select("id, nome, cargo")
        .order("nome", { ascending: true });

      if (fallbackError) {
        alert(`Não foi possível carregar os integrantes da equipe. ${fallbackError.message}`);
        setEquipe([]);
        setLoadingEquipe(false);
        return;
      }

      setEquipe((fallbackData || []) as EquipeOption[]);
      setLoadingEquipe(false);
    })();
  }, []);

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
      const parsedBlocks = normalizeBlocks(d.content_blocks || d.contentBlocks);

      setBlocks(parsedBlocks);
      reset({
        title: d.titulo || "",
        subtitle: d.resumo || "",
        authorId: d.autor_equipe_id || d.autor_id || "",
        category: (d.tags && d.tags[0]) ? d.tags[0] : "Cultura",
        date: (d.published_at ? new Date(d.published_at) : new Date(d.created_at)).toISOString().split("T")[0],
        content: d.conteudo || "",
        coverImage: d.capa_url || "",
        bannerImage: d.banner_url || "",
        status: d.status || "draft",
        hashtags: Array.isArray(d.hashtags) ? d.hashtags.join(", ") : "",
        audioUrl: d.audio_url || "",
      });

      await loadGaleria(id);
    })();
  }, [id, reset]);

  async function loadGaleria(materiaId: string) {
    const { data, error } = await supabase
      .from("materia_galeria")
      .select("id, materia_id, url, legenda, ordem, created_at")
      .eq("materia_id", materiaId)
      .order("ordem", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (error) {
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
        const { publicUrl } = await uploadToStorage({
          bucket: "materias",
          folder: `galeria/${id}`,
          file: files[i],
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
    if (!confirm("Remover esta foto da galeria?")) return;

    const { error } = await supabase.from("materia_galeria").delete().eq("id", itemId);
    if (error) return alert(error.message);

    await loadGaleria(id);
  };

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

  const handleAudioUpload = async (file?: File) => {
    setUploadingAudio(true);
    try {
      setSelectedAudioFileName("");

      if (!file) {
        alert("Nenhum arquivo de áudio foi selecionado.");
        return;
      }

      const allowedAudioTypes = new Set([
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/mp4",
        "audio/x-m4a",
      ]);
      const maxAudioSizeBytes = 20 * 1024 * 1024;

      console.log("[audio-upload] Início do upload de áudio", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      if (!allowedAudioTypes.has(file.type)) {
        alert("Formato de áudio não suportado. Use MP3, WAV, OGG ou M4A.");
        return;
      }

      if (file.size > maxAudioSizeBytes) {
        alert("Arquivo muito grande. O tamanho máximo permitido é 20MB.");
        return;
      }

      setSelectedAudioFileName(file.name);

      const { publicUrl } = await uploadToStorage({
        bucket: "materias",
        folder: "audios",
        file,
        upsert: false,
        timeoutMs: 45000,
      });

      setValue("audioUrl", publicUrl, { shouldDirty: true, shouldValidate: true });
      console.log("[audio-upload] Upload concluído com sucesso", { publicUrl });
    } catch (err: any) {
      console.error("[audio-upload] Erro no upload de áudio", err);
      setSelectedAudioFileName("");
      alert(err?.message || "Erro ao enviar áudio.");
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  const handleBannerUpload = async (file?: File) => {
    if (!file) return;

    setUploadingBanner(true);
    try {
      const { publicUrl } = await uploadToStorage({
        bucket: "materias",
        folder: "banners",
        file,
        upsert: true,
      });

      setValue("bannerImage", publicUrl, { shouldDirty: true, shouldValidate: true });
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem de banner.");
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const addBlock = (type: MateriaTextBlockType | "image" | "image-text") => {
    if (type === "image") {
      setBlocks((prev) => [...prev, { id: uid("img"), type: "image", url: "", caption: "", credit: "" }]);
      return;
    }

    if (type === "image-text") {
      setBlocks((prev) => [...prev, { id: uid("imgtxt"), type: "image-text", url: "", text: "", caption: "", credit: "", align: "left", width: "md" }]);
      return;
    }

    setBlocks((prev) => [...prev, { id: uid("txt"), type, text: "", size: "md", author: "" }]);
  };

  const updateBlock = (id: string, patch: Partial<MateriaContentBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } as MateriaContentBlock : b)));
  };

  const removeBlock = (blockId: string) => setBlocks((prev) => prev.filter((b) => b.id !== blockId));

  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const clone = [...prev];
      const [item] = clone.splice(index, 1);
      clone.splice(target, 0, item);
      return clone;
    });
  };

  const handleUploadBlockImage = async (blockId: string, file?: File) => {
    if (!file) return;

    setUploadingBlockImageId(blockId);
    try {
      const { publicUrl } = await uploadToStorage({
        bucket: "materias",
        folder: `blocos/${id || "draft"}`,
        file,
        upsert: false,
      });
      updateBlock(blockId, { url: publicUrl });
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem do bloco.");
    } finally {
      setUploadingBlockImageId(null);
    }
  };

  const applyInlineTag = (blockId: string, tag: "strong" | "em") => {
    const el = document.getElementById(`block-text-${blockId}`) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = el.value || "";
    const selected = value.slice(start, end) || "texto";
    const wrapped = `<${tag}>${selected}</${tag}>`;
    const next = `${value.slice(0, start)}${wrapped}${value.slice(end)}`;
    updateBlock(blockId, { text: next });
  };

  const submitWithCompat = async (payload: any) => {
    const response = isEditing && id
      ? await updateMateria(id, payload)
      : await createMateria(payload);

    if (!response.error) return response;

    if (!/column .* does not exist/i.test(response.error.message || "")) return response;

    const { content_blocks, hashtags, audio_url, banner_url, ...legacyPayload } = payload;
    return isEditing && id
      ? await updateMateria(id, legacyPayload)
      : await createMateria(legacyPayload);
  };

  const onSubmit = async (data: MateriaFormData) => {
    setLoading(true);
    try {
      const tags = data.category ? [data.category] : [];
      const baseSlug = slugify(data.title);
      const uniqueSlug = await ensureUniqueMateriaSlug(baseSlug, id);
      const autor = equipe.find((p) => p.id === data.authorId);
      const autor_nome = autor?.nome || null;

      const sanitizedBlocks = normalizeBlocks(blocks);
      const legacyContent = sanitizedBlocks.length > 0 ? buildLegacyHtml(sanitizedBlocks) : (data.content || null);

      const payload: any = {
        titulo: data.title,
        slug: uniqueSlug,
        resumo: data.subtitle || null,
        conteudo: legacyContent,
        content_blocks: sanitizedBlocks.length ? sanitizedBlocks : null,
        hashtags: normalizeHashtags(data.hashtags),
        audio_url: data.audioUrl || null,
        capa_url: data.coverImage || null,
        banner_url: data.bannerImage || null,
        tags,
        status: data.status,
        published_at: data.status === "published" ? new Date(data.date).toISOString() : null,
        autor_equipe_id: data.authorId || null,
        autor_id: data.authorId || null,
        autor_nome,
      };

      const res = await submitWithCompat(payload);
      if (res.error) return alert(res.error.message);

      navigate("/admin/materias");
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar matéria.");
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Editar Matéria" : "Nova Matéria"}</h1>
            <p className="text-muted-foreground text-sm">
              {isEditing ? "Atualize os detalhes da publicação." : "Preencha os campos para criar uma nova publicação."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate("/admin/materias")} className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors" disabled={loading}>Cancelar</button>
          <button onClick={handleSubmit(onSubmit)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm" disabled={loading}>
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
              <input {...register("title", { required: "Título é obrigatório" })} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="Digite o título da matéria" />
              {errors.title && <span className="text-destructive text-xs">{errors.title.message}</span>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subtítulo (Linha fina)</label>
              <textarea {...register("subtitle")} className="w-full h-20 p-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none" placeholder="Um breve resumo que aparece abaixo do título" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Autor</label>
                <select {...register("authorId")} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                  <option value="">{loadingEquipe ? "Carregando equipe..." : equipe.length ? "Selecione um autor..." : "Nenhum integrante cadastrado"}</option>
                  {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cargo ? ` — ${p.cargo}` : ""}</option>)}
                </select>
                {selectedAuthorId && <p className="text-xs text-muted-foreground">Autor: <b>{equipe.find((p) => p.id === selectedAuthorId)?.nome || "—"}</b></p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Publicação</label>
                <input type="date" {...register("date")} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="font-semibold text-lg">Conteúdo em blocos</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => addBlock("paragraph")} className="px-2 py-1 text-xs rounded-md border hover:bg-muted">+ Parágrafo</button>
                <button type="button" onClick={() => addBlock("heading")} className="px-2 py-1 text-xs rounded-md border hover:bg-muted">+ Subtítulo</button>
                <button type="button" onClick={() => addBlock("quote")} className="px-2 py-1 text-xs rounded-md border hover:bg-muted">+ Citação</button>
                <button type="button" onClick={() => addBlock("highlight")} className="px-2 py-1 text-xs rounded-md border hover:bg-muted">+ Destaque</button>
                <button type="button" onClick={() => addBlock("image")} className="px-2 py-1 text-xs rounded-md border hover:bg-muted">+ Imagem</button>
                <button type="button" onClick={() => addBlock("image-text")} className="px-2 py-1 text-xs rounded-md border hover:bg-muted">+ Imagem + Texto</button>
              </div>
            </div>

            {blocks.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-sm text-muted-foreground">
                Nenhum bloco ainda. Use os botões acima para montar a matéria em formato de blog.
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map((block, index) => (
                  <div key={block.id} className="border rounded-lg p-4 space-y-3 bg-background/60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{block.type}</div>
                      <div className="flex gap-1">
                        <button type="button" className="p-1 rounded border hover:bg-muted" disabled={index === 0} onClick={() => moveBlock(index, -1)}><ChevronUp className="w-3 h-3" /></button>
                        <button type="button" className="p-1 rounded border hover:bg-muted" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}><ChevronDown className="w-3 h-3" /></button>
                        <button type="button" className="p-1 rounded border hover:bg-destructive/10" onClick={() => removeBlock(block.id)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                      </div>
                    </div>

                    {block.type === "image" ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input value={block.url || ""} onChange={(e) => updateBlock(block.id, { url: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="https://..." />
                          <label className="px-3 h-10 inline-flex items-center rounded-md border text-sm cursor-pointer hover:bg-muted">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadBlockImage(block.id, e.target.files?.[0])} />
                            {uploadingBlockImageId === block.id ? "Enviando..." : "Upload"}
                          </label>
                        </div>
                        {block.url ? <img src={block.url} alt="Preview" className="w-full max-h-56 object-cover rounded-md border" /> : null}
                        <input value={block.caption || ""} onChange={(e) => updateBlock(block.id, { caption: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Legenda (opcional)" />
                        <input value={block.credit || ""} onChange={(e) => updateBlock(block.id, { credit: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Crédito (opcional)" />
                      </div>
                    ) : block.type === "image-text" ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input value={block.url || ""} onChange={(e) => updateBlock(block.id, { url: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="https://..." />
                          <label className="px-3 h-10 inline-flex items-center rounded-md border text-sm cursor-pointer hover:bg-muted">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadBlockImage(block.id, e.target.files?.[0])} />
                            {uploadingBlockImageId === block.id ? "Enviando..." : "Upload"}
                          </label>
                        </div>

                        <div className={`flex flex-col md:flex-row gap-4 ${block.align === "right" ? "md:flex-row-reverse" : ""}`}>
                          <figure className={`${block.width === "sm" ? "md:w-[30%]" : block.width === "lg" ? "md:w-[50%]" : "md:w-[40%]"} w-full`}>
                            {block.url ? (
                              <img src={block.url} alt={block.caption || "Preview"} className="w-full max-h-56 object-cover rounded-md border" />
                            ) : (
                              <div className="w-full h-40 rounded-md border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
                            )}
                            {(block.caption || block.credit) ? (
                              <figcaption className="text-xs text-muted-foreground mt-2">
                                {block.caption || ""}
                                {block.caption && block.credit ? " • " : ""}
                                {block.credit ? `Crédito: ${block.credit}` : ""}
                              </figcaption>
                            ) : null}
                          </figure>
                          <div className="flex-1 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: block.text || "<p>Texto ao lado da imagem</p>" }} />
                        </div>

                        <textarea
                          id={`block-text-${block.id}`}
                          value={block.text || ""}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          className="w-full min-h-[120px] p-3 rounded-md border font-mono text-sm"
                          placeholder="Texto ao lado da imagem"
                        />
                        <input value={block.caption || ""} onChange={(e) => updateBlock(block.id, { caption: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Legenda (opcional)" />
                        <input value={block.credit || ""} onChange={(e) => updateBlock(block.id, { credit: e.target.value })} className="w-full h-10 px-3 rounded-md border" placeholder="Crédito (opcional)" />
                        <select value={block.align || "left"} onChange={(e) => updateBlock(block.id, { align: e.target.value === "right" ? "right" : "left" })} className="w-full h-10 px-3 rounded-md border bg-background">
                          <option value="left">Imagem à esquerda</option>
                          <option value="right">Imagem à direita</option>
                        </select>
                        <select value={block.width || "md"} onChange={(e) => updateBlock(block.id, { width: e.target.value === "sm" || e.target.value === "lg" ? e.target.value : "md" })} className="w-full h-10 px-3 rounded-md border bg-background">
                          <option value="sm">Pequena</option>
                          <option value="md">Média</option>
                          <option value="lg">Grande</option>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => applyInlineTag(block.id, "strong")} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-muted"><Bold className="w-3 h-3" /> Negrito</button>
                          <button type="button" onClick={() => applyInlineTag(block.id, "em")} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-muted"><Italic className="w-3 h-3" /> Itálico</button>
                          <select value={block.size || "md"} onChange={(e) => updateBlock(block.id, { size: e.target.value as TextBlock["size"] })} className="h-8 px-2 rounded-md border text-xs">
                            <option value="sm">Texto pequeno</option>
                            <option value="md">Texto normal</option>
                            <option value="lg">Texto grande</option>
                          </select>
                        </div>

                        <textarea
                          id={`block-text-${block.id}`}
                          value={block.text || ""}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          className="w-full min-h-[120px] p-3 rounded-md border font-mono text-sm"
                          placeholder={block.type === "heading" ? "Subtítulo da seção" : "Texto do bloco"}
                        />

                        {block.type === "quote" && (
                          <input
                            value={block.author || ""}
                            onChange={(e) => updateBlock(block.id, { author: e.target.value })}
                            className="w-full h-10 px-3 rounded-md border"
                            placeholder="Autor/Fonte da citação (opcional)"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-3 border-t">
              <label className="text-sm font-medium">Conteúdo legado (fallback)</label>
              <textarea
                {...register("content")}
                className="w-full min-h-[140px] p-3 rounded-md border bg-background text-sm"
                placeholder="Se necessário, mantenha aqui o conteúdo HTML legado para compatibilidade."
              />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="font-semibold text-lg">Galeria de Fotos</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{canUseGallery ? "Adicione fotos que ilustram esta matéria." : "Salve a matéria primeiro para liberar a galeria."}</p>
              </div>

              <input ref={galleryInputRef} type="file" multiple accept="image/*" className="hidden" id="gallery-input" disabled={!canUseGallery} onChange={(e) => handleGalleryFilesChange(e.target.files)} />
              <label htmlFor="gallery-input" className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors ${!canUseGallery ? "opacity-40 pointer-events-none" : ""}`}>
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
                    <img src={item.url} alt="Foto da matéria" className="w-full h-40 object-cover" />
                    <div className="p-2 flex items-center justify-between bg-background">
                      <span className="text-xs text-muted-foreground truncate">{item.legenda || "Sem legenda"}</span>
                      <button type="button" onClick={() => handleDeleteGalleryItem(item.id)} className="p-1.5 rounded-lg border hover:bg-destructive/10 hover:border-destructive/30 transition-colors" title="Remover foto">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg border-b pb-4 mb-4">Publicação</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select {...register("status")} className="w-full h-10 px-3 rounded-md border bg-background">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <select {...register("category")} className="w-full h-10 px-3 rounded-md border bg-background">
                <option value="Cultura">Cultura</option>
                <option value="Política">Política</option>
                <option value="Educação">Educação</option>
                <option value="Meio Ambiente">Meio Ambiente</option>
                <option value="Projetos">Projetos</option>
                <option value="Agenda">Agenda</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hashtags</label>
              <input {...register("hashtags")} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="#quilombo, #cultura, #reportagem" />
              <p className="text-xs text-muted-foreground">Separe por vírgula. Normalização automática no salvamento.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Áudio da matéria</label>
              <input {...register("audioUrl")} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="https://..." />
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${uploadingAudio ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted"}`}>
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" disabled={uploadingAudio} onChange={(e) => handleAudioUpload(e.target.files?.[0])} />
                <Plus className="w-4 h-4" />
                {uploadingAudio ? "Enviando áudio..." : "Upload de áudio"}
              </label>
              {!!selectedAudioFileName && <p className="text-xs text-muted-foreground">Arquivo selecionado: {selectedAudioFileName}</p>}
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-2">
              <h3 className="font-semibold text-lg">Capa da Matéria</h3>

              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" id="cover-input" onChange={(e) => handleCoverUpload(e.target.files?.[0])} />
              <label htmlFor="cover-input" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors">
                <ImageIcon className="w-4 h-4" />
                {uploadingCover ? "Enviando..." : "Enviar capa"}
              </label>
            </div>

            {coverUrl ? <img src={coverUrl} alt="Capa" className="w-full h-44 object-cover rounded-lg border" /> : <div className="w-full h-44 rounded-lg border-2 border-dashed flex items-center justify-center text-sm text-muted-foreground">Nenhuma capa definida</div>}
            <p className="text-xs text-muted-foreground">
              Usada na listagem e nos cards. Recomendado: formato quadrado 1:1 (ex.: 800x800 ou 960x960).
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ou cole a URL</label>
              <input {...register("coverImage")} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="https://..." />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-2">
              <h3 className="font-semibold text-lg">Banner da Matéria</h3>

              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" id="banner-input" onChange={(e) => handleBannerUpload(e.target.files?.[0])} />
              <label htmlFor="banner-input" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted transition-colors">
                <ImageIcon className="w-4 h-4" />
                {uploadingBanner ? "Enviando..." : "Enviar banner"}
              </label>
            </div>

            {bannerUrl ? <img src={bannerUrl} alt="Banner" className="w-full h-44 object-cover rounded-lg border" /> : <div className="w-full h-44 rounded-lg border-2 border-dashed flex items-center justify-center text-sm text-muted-foreground">Nenhum banner definido</div>}
            <p className="text-xs text-muted-foreground">
              Usado no topo da matéria publicada. Recomendado: formato horizontal (ex.: 1600x900, 1440x810 ou 1280x720).
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ou cole a URL</label>
              <input {...register("bannerImage")} className="w-full h-10 px-3 rounded-md border bg-background" placeholder="https://..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

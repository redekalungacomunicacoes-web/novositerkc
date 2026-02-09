import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save, ArrowLeft, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { createProjeto, getProjeto, slugify, updateProjeto } from "@/lib/cms";
import { supabase } from "@/lib/supabase";
import { uploadImageToStorage } from "@/lib/storage";

type ProjetoFormData = {
  title: string;
  shortDescription: string;
  description: string;
  status: "Em andamento" | "Planejamento" | "Concluído" | "Pausado";
  beneficiaries: string;
  location: string;
  startDate: string;
  endDate?: string;
  coverImage: string;

  // Listas (campos repetíveis)
  objectives: { value: string }[];
  results: { value: string }[];
};

type ProjetoGaleriaItem = {
  id: string;
  projeto_id: string;
  tipo: "image" | "video";
  url: string;
  ordem: number | null;
  created_at?: string;
};

// Garante slug único (evita erro: projetos_slug_key)
async function ensureUniqueProjetoSlug(baseSlug: string, currentId?: string) {
  let slug = baseSlug || `projeto-${Date.now()}`;
  let i = 1;

  while (true) {
    const { data, error } = await supabase.from("projetos").select("id").eq("slug", slug).limit(1);
    if (error) throw error;

    if (!data || data.length === 0) return slug;

    // se for edição e o slug encontrado é do próprio registro, mantém
    if (currentId && data[0]?.id === currentId) return slug;

    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

/**
 * Upload de mídia (imagem/vídeo) para o bucket "projetos".
 * Mantém a capa separada (capas/...) e a galeria em (galeria/<projetoId>/...).
 */
async function uploadMediaToStorage(params: { projetoId: string; file: File }) {
  const { projetoId, file } = params;

  const isVideo = file.type.startsWith("video/");
  const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase();
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || (isVideo ? "mp4" : "jpg");

  const path = `galeria/${projetoId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

  const { error: upErr } = await supabase.storage.from("projetos").upload(path, file, {
    upsert: false,
    cacheControl: "3600",
    contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
  });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("projetos").getPublicUrl(path);
  const publicUrl = data?.publicUrl;

  if (!publicUrl) throw new Error("Não foi possível obter a URL pública do arquivo.");

  return { publicUrl, tipo: (isVideo ? "video" : "image") as "video" | "image" };
}

export function AdminProjetoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control,
  } = useForm<ProjetoFormData>({
    defaultValues: {
      title: "",
      shortDescription: "",
      description: "",
      status: "Planejamento",
      beneficiaries: "",
      location: "",
      startDate: "",
      endDate: "",
      coverImage: "",
      objectives: [{ value: "" }],
      results: [{ value: "" }],
    },
  });

  const objectivesFA = useFieldArray({ control, name: "objectives" });
  const resultsFA = useFieldArray({ control, name: "results" });

  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [galeria, setGaleria] = useState<ProjetoGaleriaItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const coverImage = watch("coverImage");

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const canUseGallery = useMemo(() => !!id, [id]);

  async function loadGaleria(projetoId: string) {
    const { data, error } = await supabase
      .from("projeto_galeria")
      .select("id, projeto_id, tipo, url, ordem, created_at")
      .eq("projeto_id", projetoId)
      .order("ordem", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Erro ao carregar galeria do projeto:", error.message);
      setGaleria([]);
      return;
    }

    setGaleria((data || []) as ProjetoGaleriaItem[]);
  }

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      const { data, error } = await getProjeto(id);
      setLoading(false);

      if (error || !data) {
        alert(error?.message || "Não foi possível carregar o projeto.");
        return;
      }

      const p: any = data;

      // ✅ objetivos/resultados ficam dentro de projetos.meta (jsonb)
      const objetivos: string[] = Array.isArray(p?.meta?.objetivos) ? p.meta.objetivos : [];
      const resultados: string[] = Array.isArray(p?.meta?.resultados) ? p.meta.resultados : [];

      reset({
        title: p.titulo || "",
        shortDescription: p.resumo || "",
        description: p.descricao || "",
        status: p.publicado_transparencia ? "Em andamento" : "Planejamento",
        beneficiaries: p?.meta?.beneficiaries || "",
        location: p?.meta?.location || "",
        startDate: p?.meta?.startDate || "",
        endDate: p?.meta?.endDate || "",
        coverImage: p.capa_url || "",
        objectives: (objetivos.length ? objetivos : [""]).map((v) => ({ value: v })),
        results: (resultados.length ? resultados : [""]).map((v) => ({ value: v })),
      });

      await loadGaleria(id);
    })();
  }, [id, reset]);

  const handleCoverFileChange = async (file?: File) => {
    if (!file) return;

    setUploadingCover(true);
    try {
      const { publicUrl } = await uploadImageToStorage({
        bucket: "projetos",
        folder: "capas",
        file,
        upsert: true,
        validate: true,
      });

      setValue("coverImage", publicUrl, { shouldDirty: true, shouldValidate: true });
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem de capa.");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleGalleryFilesChange = async (files?: FileList | null) => {
    if (!id) return;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    try {
      const baseOrder = galeria.length;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];

        const { publicUrl, tipo } = await uploadMediaToStorage({ projetoId: id, file });

        const { error: insErr } = await supabase.from("projeto_galeria").insert({
          projeto_id: id,
          tipo,
          url: publicUrl,
          ordem: baseOrder + i,
        });

        if (insErr) throw insErr;
      }

      await loadGaleria(id);
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar mídia para a galeria.");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleDeleteGalleryItem = async (itemId: string) => {
    if (!id) return;
    const ok = confirm("Remover este item da galeria?");
    if (!ok) return;

    const { error } = await supabase.from("projeto_galeria").delete().eq("id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadGaleria(id);
  };

  const onSubmit = async (data: ProjetoFormData) => {
    setLoading(true);

    try {
      const publicado_transparencia = data.status !== "Planejamento";

      const baseSlug = slugify(data.title);
      const uniqueSlug = await ensureUniqueProjetoSlug(baseSlug, id);

      const objetivos = (data.objectives || []).map((o) => (o?.value || "").trim()).filter(Boolean);
      const resultados = (data.results || []).map((r) => (r?.value || "").trim()).filter(Boolean);

      const payload: any = {
        titulo: data.title,
        slug: uniqueSlug,
        resumo: data.shortDescription || null,
        descricao: data.description || null,

        // ✅ capa separada
        capa_url: data.coverImage || null,

        publicado_transparencia,
        published_at: publicado_transparencia ? new Date().toISOString() : null,

        // ✅ campos extras e listas ficam no meta (jsonb)
        meta: {
          beneficiaries: (data.beneficiaries || "").trim() || null,
          location: (data.location || "").trim() || null,
          startDate: (data.startDate || "").trim() || null,
          endDate: (data.endDate || "").trim() || null,
          objetivos,
          resultados,
        },
      };

      const res = isEditing && id ? await updateProjeto(id, payload) : await createProjeto(payload);

      setLoading(false);

      if (res.error) {
        alert(res.error.message);
        return;
      }

      navigate("/admin/projetos");
    } catch (err: any) {
      setLoading(false);
      alert(err?.message || "Erro ao salvar projeto.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/projetos" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{isEditing ? "Editar Projeto" : "Novo Projeto"}</h1>
            <p className="text-sm text-muted-foreground">Gerencie os dados do projeto e a galeria.</p>
          </div>
        </div>

        <button
          onClick={handleSubmit(onSubmit)}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {loading ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {/* Capa */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Capa do Projeto</h2>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            id="cover-input"
            onChange={(e) => handleCoverFileChange(e.target.files?.[0])}
          />
          <label
            htmlFor="cover-input"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted"
          >
            <ImageIcon className="w-4 h-4" />
            {uploadingCover ? "Enviando..." : "Enviar capa"}
          </label>
        </div>

        {coverImage ? (
          <img src={coverImage} alt="Capa" className="w-full h-56 object-cover rounded-lg border" />
        ) : (
          <div className="w-full h-56 rounded-lg border flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma capa definida
          </div>
        )}
      </div>

      {/* Form */}
      <div className="rounded-xl border p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Título</label>
          <input
            {...register("title", { required: "Título é obrigatório" })}
            className="w-full mt-1 px-3 py-2 rounded-lg border"
          />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium">Resumo</label>
          <input {...register("shortDescription")} className="w-full mt-1 px-3 py-2 rounded-lg border" />
        </div>

        <div>
          <label className="text-sm font-medium">Descrição (Sobre o Projeto)</label>
          <textarea {...register("description")} className="w-full mt-1 px-3 py-2 rounded-lg border min-h-[120px]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Status</label>
            <select {...register("status")} className="w-full mt-1 px-3 py-2 rounded-lg border">
              <option value="Planejamento">Planejamento</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Concluído">Concluído</option>
              <option value="Pausado">Pausado</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Localização</label>
            <input {...register("location")} className="w-full mt-1 px-3 py-2 rounded-lg border" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Beneficiários</label>
            <input {...register("beneficiaries")} className="w-full mt-1 px-3 py-2 rounded-lg border" />
          </div>

          <div>
            <label className="text-sm font-medium">Início</label>
            <input {...register("startDate")} className="w-full mt-1 px-3 py-2 rounded-lg border" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Fim (opcional)</label>
          <input {...register("endDate")} className="w-full mt-1 px-3 py-2 rounded-lg border" />
        </div>

        {/* Objetivos */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Objetivos</h3>
            <button
              type="button"
              onClick={() => objectivesFA.append({ value: "" })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
              Adicionar objetivo
            </button>
          </div>

          {objectivesFA.fields.map((f, idx) => (
            <div key={f.id} className="flex items-center gap-2">
              <input
                {...register(`objectives.${idx}.value` as const)}
                className="w-full px-3 py-2 rounded-lg border"
                placeholder={`Objetivo ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => objectivesFA.remove(idx)}
                className="p-2 rounded-lg border hover:bg-muted"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Resultados */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Resultados Alcançados</h3>
            <button
              type="button"
              onClick={() => resultsFA.append({ value: "" })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
              Adicionar resultado
            </button>
          </div>

          {resultsFA.fields.map((f, idx) => (
            <div key={f.id} className="flex items-center gap-2">
              <input
                {...register(`results.${idx}.value` as const)}
                className="w-full px-3 py-2 rounded-lg border"
                placeholder={`Resultado ${idx + 1}`}
              />
              <button type="button" onClick={() => resultsFA.remove(idx)} className="p-2 rounded-lg border hover:bg-muted">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Galeria */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Galeria do Projeto</h3>

            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              id="gallery-input"
              disabled={!canUseGallery}
              onChange={(e) => handleGalleryFilesChange(e.target.files)}
            />

            <label
              htmlFor="gallery-input"
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted ${
                !canUseGallery ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              {uploadingGallery ? "Enviando..." : "Adicionar imagens/vídeos"}
            </label>
          </div>

          <p className="text-sm text-muted-foreground">
            Os itens aparecem apenas neste projeto (página pública).
          </p>

          {galeria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item na galeria ainda.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {galeria.map((it) => (
                <div key={it.id} className="rounded-xl border overflow-hidden">
                  {it.tipo === "video" ? (
                    <video src={it.url} controls className="w-full h-40 object-cover" />
                  ) : (
                    <img src={it.url} alt="Imagem" className="w-full h-40 object-cover" />
                  )}
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{it.tipo === "video" ? "Vídeo" : "Imagem"}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryItem(it.id)}
                      className="px-3 py-1 rounded-lg border hover:bg-muted text-sm"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

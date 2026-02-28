import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Save,
  ArrowLeft,
  Image as ImageIcon,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { getProjeto, slugify } from "@/lib/cms";
import { supabase } from "@/lib/supabase";
import { uploadImageToStorage } from "@/lib/storage";
import { createThumbnail } from "@/lib/imageThumbnail";

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
  releaseYear?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  spotifyUrl?: string;
  objectives: { value: string }[];
  results: { value: string }[];
};

type ProjectImageItem = {
  id: string;
  project_id: string;
  image_path: string;
  thumb_path: string | null;
  caption: string | null;
  order_index: number;
  is_public: boolean;
  created_at: string;
};

async function ensureUniqueProjetoSlug(baseSlug: string, currentId?: string) {
  let slug = baseSlug || `projeto-${Date.now()}`;
  let i = 1;

  while (true) {
    const { data, error } = await supabase
      .from("projetos")
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

function normalizeOptionalUrl(value?: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getStorageUrl(path: string) {
  const { data } = supabase.storage.from("projetos").getPublicUrl(path);
  return data.publicUrl;
}

function fileExtension(file: File) {
  const ext = file.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
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
      releaseYear: "",
      instagramUrl: "",
      youtubeUrl: "",
      spotifyUrl: "",
      objectives: [{ value: "" }],
      results: [{ value: "" }],
    },
  });

  const objectivesFA = useFieldArray({ control, name: "objectives" });
  const resultsFA = useFieldArray({ control, name: "results" });

  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [imagens, setImagens] = useState<ProjectImageItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const coverImage = watch("coverImage");
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const canUseGallery = useMemo(() => !!id, [id]);

  async function loadImages(projectId: string) {
    const { data, error } = await supabase
      .from("project_images")
      .select(
        "id, project_id, image_path, thumb_path, caption, order_index, is_public, created_at"
      )
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Erro ao carregar imagens do projeto:", error.message);
      setImagens([]);
      return;
    }

    setImagens((data || []) as ProjectImageItem[]);
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
      const objetivos: string[] = Array.isArray(p?.meta?.objetivos)
        ? p.meta.objetivos
        : [];
      const resultados: string[] = Array.isArray(p?.meta?.resultados)
        ? p.meta.resultados
        : [];

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
        releaseYear: p.ano_lancamento ? String(p.ano_lancamento) : "",
        instagramUrl: p.instagram_url || "",
        youtubeUrl: p.youtube_url || "",
        spotifyUrl: p.spotify_url || "",
        objectives: (objetivos.length ? objetivos : [""]).map((v) => ({
          value: v,
        })),
        results: (resultados.length ? resultados : [""]).map((v) => ({
          value: v,
        })),
      });

      await loadImages(id);
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
      setValue("coverImage", publicUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagem de capa.");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleGalleryFilesChange = async (files?: FileList | null) => {
    if (!id || !files?.length) return;

    setUploadingGallery(true);
    try {
      const { data: maxData } = await supabase
        .from("project_images")
        .select("order_index")
        .eq("project_id", id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextOrder = (maxData?.order_index ?? -1) + 1;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        const imageId = crypto.randomUUID();
        const ext = fileExtension(file);
        const imagePath = `projects/${id}/images/${imageId}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("projetos")
          .upload(imagePath, file, {
            upsert: true,
            cacheControl: "31536000",
            contentType: file.type,
          });
        if (uploadError) throw uploadError;

        let thumbPath: string | null = null;
        try {
          const thumbBlob = await createThumbnail(file, 480, 0.78);
          const thumbExt = thumbBlob.type.includes("webp") ? "webp" : "jpg";
          thumbPath = `projects/${id}/images/thumbs/${imageId}.${thumbExt}`;

          const { error: thumbError } = await supabase.storage
            .from("projetos")
            .upload(thumbPath, thumbBlob, {
              upsert: true,
              cacheControl: "31536000",
              contentType: thumbBlob.type || "image/jpeg",
            });

          if (thumbError) {
            console.warn("Falha ao gerar/upload thumbnail:", thumbError.message);
            thumbPath = null;
          }
        } catch (thumbErr: any) {
          console.warn(
            "Falha ao processar thumbnail:",
            thumbErr?.message || thumbErr
          );
        }

        const { error: insertError } = await supabase
          .from("project_images")
          .insert({
            id: imageId,
            project_id: id,
            image_path: imagePath,
            thumb_path: thumbPath,
            order_index: nextOrder,
            is_public: true,
          });

        if (insertError) throw insertError;
        nextOrder += 1;
      }

      await loadImages(id);
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagens para a galeria.");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const reorderImage = async (index: number, direction: -1 | 1) => {
    if (!id) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= imagens.length) return;

    const current = imagens[index];
    const target = imagens[targetIndex];

    const { error: errorA } = await supabase
      .from("project_images")
      .update({ order_index: -1 })
      .eq("id", current.id);
    if (errorA) return alert(errorA.message);

    const { error: errorB } = await supabase
      .from("project_images")
      .update({ order_index: current.order_index })
      .eq("id", target.id);
    if (errorB) return alert(errorB.message);

    const { error: errorC } = await supabase
      .from("project_images")
      .update({ order_index: target.order_index })
      .eq("id", current.id);
    if (errorC) return alert(errorC.message);

    await loadImages(id);
  };

  const handleDeleteGalleryItem = async (item: ProjectImageItem) => {
    if (!id) return;
    const ok = confirm("Remover esta imagem da galeria?");
    if (!ok) return;

    const pathsToRemove = [item.image_path, item.thumb_path].filter(
      Boolean
    ) as string[];
    if (pathsToRemove.length) {
      await supabase.storage.from("projetos").remove(pathsToRemove);
    }

    const { error } = await supabase
      .from("project_images")
      .delete()
      .eq("id", item.id);
    if (error) return alert(error.message);

    await loadImages(id);
  };

  const onSubmit = async (form: ProjetoFormData) => {
    setLoading(true);
    try {
      const publicado_transparencia = form.status !== "Planejamento";
      const baseSlug = slugify(form.title);
      const uniqueSlug = await ensureUniqueProjetoSlug(baseSlug, id);

      const objetivos = (form.objectives || [])
        .map((o) => (o?.value || "").trim())
        .filter(Boolean);

      const resultados = (form.results || [])
        .map((r) => (r?.value || "").trim())
        .filter(Boolean);

      const year = (form.releaseYear || "").trim();
      const yearNumber = year ? Number(year) : null;

      if (year && (!/^\d{4}$/.test(year) || Number.isNaN(yearNumber))) {
        alert("Ano de lançamento deve ter 4 dígitos.");
        return;
      }

      const payload: any = {
        titulo: form.title,
        slug: uniqueSlug,
        resumo: form.shortDescription || null,
        descricao: form.description || null,
        capa_url: form.coverImage || null,
        ano_lancamento: yearNumber,
        instagram_url: normalizeOptionalUrl(form.instagramUrl),
        youtube_url: normalizeOptionalUrl(form.youtubeUrl),
        spotify_url: normalizeOptionalUrl(form.spotifyUrl),
        publicado_transparencia,
        published_at: publicado_transparencia ? new Date().toISOString() : null,
        meta: {
          beneficiaries: (form.beneficiaries || "").trim() || null,
          location: (form.location || "").trim() || null,
          startDate: (form.startDate || "").trim() || null,
          endDate: (form.endDate || "").trim() || null,
          objetivos,
          resultados,
        },
      };

      // ✅ FIX PRINCIPAL: UPDATE usa maybeSingle para não quebrar com 0/múltiplas linhas.
      let saved: any = null;

      if (id) {
        const { data, error } = await supabase
          .from("projetos")
          .update(payload)
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          // Aqui é o caso clássico: o update não retornou 1 linha (0 ou múltiplas).
          // Evita o crash e te dá uma mensagem clara.
          throw new Error(
            "Falha ao salvar: o update não retornou um único registro. Verifique se o ID do projeto está correto e se não há duplicidade/rota errada."
          );
        }

        saved = data;
      } else {
        const { data, error } = await supabase
          .from("projetos")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;
        saved = data;
      }

      // navegação
      if (id) {
        navigate("/admin/projetos");
      } else {
        navigate(`/admin/projetos/${saved.id}`);
      }
    } catch (err: any) {
      alert(`Erro ao salvar projeto: ${err?.message || "Falha inesperada."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/projetos"
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">
              {isEditing ? "Editar Projeto" : "Novo Projeto"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os dados do projeto e a galeria de imagens.
            </p>
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
          <img
            src={coverImage}
            alt="Capa"
            className="w-full h-56 object-cover rounded-lg border"
          />
        ) : (
          <div className="w-full h-56 rounded-lg border flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma capa definida
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Título</label>
          <input
            {...register("title", { required: "Título é obrigatório" })}
            className="w-full mt-1 px-3 py-2 rounded-lg border"
          />
          {errors.title && (
            <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Resumo</label>
          <input
            {...register("shortDescription")}
            className="w-full mt-1 px-3 py-2 rounded-lg border"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Descrição (Sobre o Projeto)</label>
          <textarea
            {...register("description")}
            className="w-full mt-1 px-3 py-2 rounded-lg border min-h-[120px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Status</label>
            <select
              {...register("status")}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
            >
              <option value="Planejamento">Planejamento</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Concluído">Concluído</option>
              <option value="Pausado">Pausado</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Localização</label>
            <input
              {...register("location")}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Beneficiários</label>
            <input
              {...register("beneficiaries")}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Início</label>
            <input
              {...register("startDate")}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Fim (opcional)</label>
          <input
            {...register("endDate")}
            className="w-full mt-1 px-3 py-2 rounded-lg border"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Ano de lançamento</label>
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              placeholder="Ex: 2026"
              {...register("releaseYear", {
                validate: (value) =>
                  !value || /^\d{4}$/.test(value) || "Informe um ano com 4 dígitos",
              })}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
            />
            {errors.releaseYear && (
              <p className="text-xs text-red-600 mt-1">
                {errors.releaseYear.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Instagram URL</label>
            <input
              type="url"
              {...register("instagramUrl")}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              placeholder="https://instagram.com/..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">YouTube URL</label>
            <input
              type="url"
              {...register("youtubeUrl")}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              placeholder="https://youtube.com/..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Spotify URL</label>
            <input
              type="url"
              {...register("spotifyUrl")}
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              placeholder="https://open.spotify.com/..."
            />
          </div>
        </div>

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
              <button
                type="button"
                onClick={() => resultsFA.remove(idx)}
                className="p-2 rounded-lg border hover:bg-muted"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Galeria de imagens</h3>
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
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted ${
                !canUseGallery ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              {uploadingGallery ? "Enviando..." : "Adicionar imagens"}
            </label>
          </div>

          {!canUseGallery && (
            <p className="text-sm text-muted-foreground">
              Salve o projeto primeiro para habilitar upload da galeria.
            </p>
          )}

          {imagens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma imagem na galeria ainda.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {imagens.map((item, index) => (
                <div key={item.id} className="rounded-xl border overflow-hidden">
                  <img
                    src={getStorageUrl(item.thumb_path || item.image_path)}
                    alt={item.caption || "Imagem"}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                  <div className="p-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      #{item.order_index}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => reorderImage(index, -1)}
                        className="p-1 rounded border hover:bg-muted"
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderImage(index, 1)}
                        className="p-1 rounded border hover:bg-muted"
                        disabled={index === imagens.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGalleryItem(item)}
                        className="p-1 rounded border hover:bg-muted"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

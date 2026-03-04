import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Save, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import {
  PROJECTS_BUCKET,
  createProjetoMidia,
  deleteProjetoMidia,
  getProjetoById,
  getProjetoGaleria,
  resolveProjectMediaUrl,
} from "@/app/repositories/projectRepository";
import { getVideoEmbedUrl, normalizeVideoUrl } from "@/lib/video";

type ProjetoFormData = {
  titulo: string;
  descricao: string;
  anoFundacao: string;
  capaUrl: string;
  status: "ativo" | "rascunho";
  instagramUrl: string;
  youtubeUrl: string;
  spotifyUrl: string;
};

type ProjetoRecord = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  ano_lancamento: number | null;
  capa_url: string | null;
  publicado_transparencia: boolean | null;
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
};

type ProjetoFoto = {
  id: string;
  projeto_id: string;
  url: string;
};

type TabKey = "informacoes" | "fotos" | "videos";

function normalizeOptionalUrl(value?: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function fileExtension(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

function toProjectStoragePath(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return null;
  const marker = `/storage/v1/object/public/${PROJECTS_BUCKET}/`;
  const markerIdx = raw.indexOf(marker);
  if (markerIdx >= 0) return raw.slice(markerIdx + marker.length);
  return raw;
}

export function AdminProjetoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProjetoFormData>({
    defaultValues: {
      titulo: "",
      descricao: "",
      anoFundacao: "",
      capaUrl: "",
      status: "rascunho",
      instagramUrl: "",
      youtubeUrl: "",
      spotifyUrl: "",
    },
  });

  const [activeTab, setActiveTab] = useState<TabKey>("informacoes");
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [projectDbId, setProjectDbId] = useState<string | null>(id || null);
  const [fotos, setFotos] = useState<ProjetoFoto[]>([]);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const coverUrl = watch("capaUrl");

  const canManageMedia = useMemo(() => Boolean(projectDbId), [projectDbId]);

  const loadFotos = async (projetoId: string) => {
    const { data, error } = await getProjetoGaleria(projetoId, "image");

    if (error) {
      toast.error(error.message || "Erro ao carregar fotos.");
      setFotos([]);
      return;
    }

    setFotos(((data || []) as ProjetoFoto[]).map((item) => ({ ...item, url: resolveProjectMediaUrl(item.url) })));
  };

  useEffect(() => {
    if (!id) {
      setProjectDbId(null);
      setFotos([]);
      return;
    }

    (async () => {
      setIsLoadingProject(true);
      const { data, error } = await getProjetoById(id);
      setIsLoadingProject(false);

      if (error || !data) {
        toast.error(error?.message || "Não foi possível carregar o projeto.");
        return;
      }

      const projeto = data as ProjetoRecord;
      reset({
        titulo: projeto.titulo || "",
        descricao: projeto.descricao || "",
        anoFundacao: projeto.ano_lancamento ? String(projeto.ano_lancamento) : "",
        capaUrl: resolveProjectMediaUrl(projeto.capa_url),
        status: projeto.publicado_transparencia ? "ativo" : "rascunho",
        instagramUrl: projeto.instagram_url || "",
        youtubeUrl: projeto.youtube_url || "",
        spotifyUrl: projeto.spotify_url || "",
      });

      if (projeto.id) {
        const dbId = String(projeto.id);
        setProjectDbId(dbId);
        await loadFotos(dbId);
      }
    })();
  }, [id, reset]);

  const handleCoverUpload = async (file?: File) => {
    if (!file) return;
    if (!projectDbId) {
      toast.error("Salve o projeto antes de enviar a capa.");
      return;
    }

    setIsUploadingCover(true);
    try {
      const ext = fileExtension(file);
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const filePath = `projects/${projectDbId}/cover/${fileName}`;

      const { error: uploadError } = await supabase.storage.from(PROJECTS_BUCKET).upload(filePath, file, {
        upsert: true,
        cacheControl: "31536000",
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      setValue("capaUrl", resolveProjectMediaUrl(filePath), { shouldDirty: true, shouldValidate: true });
      toast.success("Capa enviada com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar capa.");
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handlePhotosUpload = async (files?: FileList | null) => {
    if (!projectDbId || !files?.length) return;

    setIsUploadingPhotos(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        const fotoId = crypto.randomUUID();
        const ext = fileExtension(file);
        const path = `projects/${projectDbId}/gallery/${fotoId}.${ext}`;

        const { error: uploadError } = await supabase.storage.from(PROJECTS_BUCKET).upload(path, file, {
          upsert: true,
          cacheControl: "31536000",
          contentType: file.type,
        });
        if (uploadError) throw uploadError;

        const { error: insertError } = await createProjetoMidia({
          id: fotoId,
          projeto_id: projectDbId,
          tipo: "image",
          url: path,
        });
        if (insertError) throw insertError;
      }

      await loadFotos(projectDbId);
      toast.success("Fotos adicionadas com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao adicionar fotos.");
    } finally {
      setIsUploadingPhotos(false);
      if (photosInputRef.current) photosInputRef.current.value = "";
    }
  };

  const removeFoto = async (foto: ProjetoFoto) => {
    if (!projectDbId) return;

    const storagePath = toProjectStoragePath(foto.url);

    if (storagePath) await supabase.storage.from(PROJECTS_BUCKET).remove([storagePath]);

    const { error } = await deleteProjetoMidia(foto.id);
    if (error) {
      toast.error(error.message || "Erro ao remover foto.");
      return;
    }

    setFotos((prev) => prev.filter((item) => item.id !== foto.id));
    toast.success("Foto removida.");
  };

  const onSubmit = async (form: ProjetoFormData) => {
    if (isSaving) return;

    const parsedYear = Number.parseInt((form.anoFundacao || "").trim(), 10);
    const anoFundacao = Number.isInteger(parsedYear) && parsedYear >= 1000 && parsedYear <= 9999 ? parsedYear : null;

    const normalizedVideoUrl = normalizeVideoUrl(form.youtubeUrl);
    if (form.youtubeUrl.trim() && !normalizedVideoUrl) {
      toast.error("URL de vídeo inválida.");
      return;
    }

    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      ano_lancamento: anoFundacao,
      capa_url: toProjectStoragePath(form.capaUrl),
      publicado_transparencia: form.status === "ativo",
      instagram_url: normalizeOptionalUrl(form.instagramUrl),
      youtube_url: normalizedVideoUrl,
      spotify_url: normalizeOptionalUrl(form.spotifyUrl),
    };

    setIsSaving(true);
    try {
      let data: { id: string } | null = null;
      let error: any = null;

      if (projectDbId) {
        const response = await supabase.from("projetos").update(payload).eq("id", projectDbId).select("id").single();
        data = response.data;
        error = response.error;
      } else {
        const response = await supabase
          .from("projetos")
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select("id")
          .single();
        data = response.data;
        error = response.error;
      }

      if (error || !data?.id) {
        toast.error(error?.message || "Erro ao salvar. Nenhum registro retornado pelo banco.");
        return;
      }

      const savedId = String(data.id);
      setProjectDbId(savedId);
      await loadFotos(savedId);
      toast.success("Projeto salvo com sucesso.");

      if (!projectDbId) {
        navigate(`/admin/projetos/editar/${savedId}`, { replace: true });
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro inesperado ao salvar projeto.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/admin/projetos" className="rounded-full p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{isEditing ? "Editar Projeto" : "Novo Projeto"}</h1>
            <p className="text-sm text-muted-foreground">Informações, fotos e vídeos no mesmo formulário.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving || isLoadingProject}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div className="rounded-2xl border bg-card p-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "informacoes", label: "Informações" },
            { key: "fotos", label: "Fotos" },
            { key: "videos", label: "Vídeos" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "informacoes" && (
        <div className="space-y-6 rounded-2xl border p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Capa do Projeto</h2>
              <input
                ref={coverInputRef}
                type="file"
                id="capa-projeto"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleCoverUpload(e.target.files?.[0])}
              />
              <label htmlFor="capa-projeto" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted">
                <ImageIcon className="h-4 w-4" />
                {isUploadingCover ? "Enviando..." : "Enviar capa"}
              </label>
            </div>

            {coverUrl ? (
              <img src={coverUrl} alt="Capa do projeto" className="h-56 w-full rounded-xl border object-cover" />
            ) : (
              <div className="flex h-56 w-full items-center justify-center rounded-xl border text-sm text-muted-foreground">Nenhuma capa enviada.</div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="text-sm font-medium">Título *</label>
              <input
                {...register("titulo", { required: "Título é obrigatório" })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Digite o título do projeto"
              />
              {errors.titulo && <p className="mt-1 text-xs text-red-600">{errors.titulo.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium">Ano de Fundação</label>
              <input
                type="number"
                min={1000}
                max={9999}
                {...register("anoFundacao")}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="2020"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Status</label>
              <select {...register("status")} className="mt-1 w-full rounded-lg border px-3 py-2">
                <option value="ativo">ativo</option>
                <option value="rascunho">rascunho</option>
              </select>
            </div>

            <div className="xl:col-span-4">
              <label className="text-sm font-medium">Descrição (Sobre o Projeto)</label>
              <textarea {...register("descricao")} className="mt-1 min-h-[140px] w-full rounded-lg border px-3 py-2" />
            </div>

            <div>
              <label className="text-sm font-medium">Instagram URL</label>
              <input type="url" {...register("instagramUrl")} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://instagram.com/..." />
            </div>

            <div>
              <label className="text-sm font-medium">YouTube URL</label>
              <input type="url" {...register("youtubeUrl")} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://youtube.com/..." />
            </div>

            <div>
              <label className="text-sm font-medium">Spotify URL</label>
              <input type="url" {...register("spotifyUrl")} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://open.spotify.com/..." />
            </div>

            <div>
              <label className="text-sm font-medium">URL da Capa</label>
              <input {...register("capaUrl")} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://..." />
            </div>
          </div>
        </div>
      )}

      {activeTab === "fotos" && (
        <div className="space-y-4 rounded-2xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Fotos do Projeto</h2>
            <input
              ref={photosInputRef}
              type="file"
              id="fotos-projeto"
              className="hidden"
              accept="image/*"
              multiple
              disabled={!canManageMedia}
              onChange={(e) => handlePhotosUpload(e.target.files)}
            />
            <label
              htmlFor="fotos-projeto"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${
                canManageMedia ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-60"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              {isUploadingPhotos ? "Enviando..." : "Adicionar fotos"}
            </label>
          </div>

          {!canManageMedia && <p className="text-sm text-muted-foreground">Salve o projeto para habilitar upload de fotos.</p>}

          {fotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma foto cadastrada.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {fotos.map((foto) => (
                <div key={foto.id} className="group relative overflow-hidden rounded-xl border">
                      <img src={foto.url} alt="Foto do projeto" className="aspect-square w-full object-cover" loading="lazy" />
                  <button
                    type="button"
                    onClick={() => removeFoto(foto)}
                    className="absolute right-2 top-2 rounded-md bg-black/70 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "videos" && (
        <div className="space-y-4 rounded-2xl border p-5">
          <div>
            <label className="text-sm font-medium">URL de vídeo (YouTube, Vimeo ou Google Drive)</label>
            <input
              type="url"
              {...register("youtubeUrl")}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="https://..."
            />
            <p className="mt-2 text-xs text-muted-foreground">Este valor é salvo em <code>projetos.youtube_url</code> e usado na página pública.</p>
          </div>

          {(() => {
            const embedUrl = getVideoEmbedUrl(watch("youtubeUrl"));
            if (!watch("youtubeUrl")?.trim()) {
              return <p className="text-sm text-muted-foreground">Nenhum vídeo configurado.</p>;
            }

            if (!embedUrl) {
              return (
                <div className="flex aspect-video w-full max-w-2xl flex-col items-center justify-center gap-2 rounded-xl border text-sm text-muted-foreground">
                  <Video className="h-5 w-5" />
                  Prévia indisponível para esta URL.
                </div>
              );
            }

            return (
              <iframe
                src={embedUrl}
                title="Prévia de vídeo"
                className="aspect-video w-full max-w-2xl rounded-xl border"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            );
          })()}
        </div>
      )}
    </form>
  );
}

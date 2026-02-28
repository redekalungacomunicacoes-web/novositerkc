// src/app/pages/admin/Projetos/AdminProjetoForm.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Save, Trash2 } from "lucide-react";

import { slugify } from "@/lib/cms";
import { supabase } from "@/lib/supabase";
import { uploadImageToStorage } from "@/lib/storage";

type ProjetoFormData = {
  title: string;
  description: string;
  foundationYear: string;
  status: "Ativo" | "Rascunho";
  coverImage: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  spotifyUrl?: string;
};

type ProjetoGaleriaItem = {
  id: string;
  projeto_id: string;
  tipo: string;
  url: string;
};

type YoutubeFeedItem = {
  id: string;
  title: string;
  link: string;
  thumbnail: string;
  published: string;
};

type YoutubeCachePayload = { ts: number; items: YoutubeFeedItem[] };

const YOUTUBE_CACHE_TTL_MS = 10 * 60 * 1000;
const youtubeFeedMemoryCache = new Map<string, YoutubeCachePayload>();

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

async function getProjetoForEdit(param: string) {
  const byId = await supabase.from("projetos").select("*").eq("id", param).maybeSingle();
  if (!byId.error && byId.data) return { data: byId.data, error: null as any };

  const bySlug = await supabase.from("projetos").select("*").eq("slug", param).maybeSingle();
  if (bySlug.error) return { data: null, error: bySlug.error };

  return { data: bySlug.data || null, error: null as any };
}

async function ensureUniqueProjetoSlug(baseSlug: string, currentId?: string) {
  let slug = baseSlug || `projeto-${Date.now()}`;
  let i = 1;

  while (true) {
    const { data, error } = await supabase.from("projetos").select("id").eq("slug", slug).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return slug;
    if (currentId && data[0]?.id === currentId) return slug;

    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

function formatDateBR(isoDate?: string) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function extractYoutubeChannelIdFromUrl(url: string) {
  const byChannelPath = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{10,})/);
  if (byChannelPath?.[1]) return byChannelPath[1];
  return null;
}

async function resolveYoutubeChannelId(youtubeUrl: string) {
  const directId = extractYoutubeChannelIdFromUrl(youtubeUrl);
  if (directId) return directId;

  if (!/(\/(@|c\/|user\/))/i.test(youtubeUrl)) {
    throw new Error("URL do YouTube inválida. Use /channel/UC..., /@handle, /c/... ou /user/...");
  }

  const resp = await fetch(youtubeUrl, { method: "GET" });
  if (!resp.ok) {
    throw new Error("Não foi possível carregar a página do canal do YouTube.");
  }

  const html = await resp.text();
  const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{10,})"/);
  if (!match?.[1]) {
    throw new Error("Não foi possível identificar o channelId no YouTube URL informado.");
  }

  return match[1];
}

function readYoutubeCache(channelId: string): YoutubeFeedItem[] | null {
  const now = Date.now();
  const mem = youtubeFeedMemoryCache.get(channelId);
  if (mem && now - mem.ts < YOUTUBE_CACHE_TTL_MS) return mem.items;

  const lsKey = `youtube_feed_${channelId}`;
  const raw = localStorage.getItem(lsKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as YoutubeCachePayload;
    if (!parsed?.ts || !Array.isArray(parsed?.items)) return null;
    if (now - parsed.ts > YOUTUBE_CACHE_TTL_MS) return null;
    youtubeFeedMemoryCache.set(channelId, parsed);
    return parsed.items;
  } catch {
    return null;
  }
}

function writeYoutubeCache(channelId: string, items: YoutubeFeedItem[]) {
  const payload: YoutubeCachePayload = { ts: Date.now(), items };
  youtubeFeedMemoryCache.set(channelId, payload);
  localStorage.setItem(`youtube_feed_${channelId}`, JSON.stringify(payload));
}

async function loadYoutubeFeed(youtubeUrl: string, maxItems = 9) {
  const channelId = await resolveYoutubeChannelId(youtubeUrl.trim());
  const cached = readYoutubeCache(channelId);
  if (cached) return cached.slice(0, maxItems);

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const response = await fetch(feedUrl, { method: "GET" });
  if (!response.ok) throw new Error("Não foi possível carregar o feed RSS do YouTube.");

  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const entries = Array.from(doc.getElementsByTagName("entry"));

  const items = entries
    .map((entry) => {
      const videoId = entry.getElementsByTagName("yt:videoId")[0]?.textContent?.trim() || "";
      const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || "Sem título";
      const published = entry.getElementsByTagName("published")[0]?.textContent?.trim() || "";
      const link = entry.getElementsByTagName("link")[0]?.getAttribute("href") || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
      const thumbnail =
        entry.getElementsByTagName("media:thumbnail")[0]?.getAttribute("url") ||
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");

      return {
        id: videoId || link || `${title}-${published}`,
        title,
        link,
        thumbnail,
        published,
      };
    })
    .filter((item) => item.link);

  writeYoutubeCache(channelId, items);
  return items.slice(0, maxItems);
}

function YoutubeVideoGallery({ youtubeUrl }: { youtubeUrl?: string }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<YoutubeFeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = (youtubeUrl || "").trim();
    if (!url) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    loadYoutubeFeed(url, 9)
      .then((feedItems) => {
        if (!alive) return;
        setItems(feedItems);
      })
      .catch((err: any) => {
        if (!alive) return;
        setItems([]);
        setError(err?.message || "Não foi possível carregar os vídeos do YouTube.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [youtubeUrl]);

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Galeria de vídeos (YouTube)</h3>

      {!(youtubeUrl || "").trim() && <p className="text-sm text-muted-foreground">Informe o YouTube URL para carregar vídeos.</p>}

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={`video-skeleton-${idx}`} className="rounded-xl border p-2 animate-pulse">
              <div className="w-full aspect-video bg-muted rounded" />
              <div className="h-4 bg-muted rounded mt-2" />
              <div className="h-3 w-2/3 bg-muted rounded mt-1" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((video) => (
            <a
              key={video.id}
              href={video.link}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border overflow-hidden hover:bg-muted/40 transition-colors"
            >
              {video.thumbnail ? (
                <img src={video.thumbnail} alt={video.title} className="w-full aspect-video object-cover" loading="lazy" />
              ) : (
                <div className="w-full aspect-video bg-muted" />
              )}
              <div className="p-2">
                <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDateBR(video.published)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminProjetoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = !!id;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProjetoFormData>({
    defaultValues: {
      title: "",
      description: "",
      foundationYear: "",
      status: "Rascunho",
      coverImage: "",
      instagramUrl: "",
      youtubeUrl: "",
      spotifyUrl: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [projectDbId, setProjectDbId] = useState<string | null>(null);
  const [galeria, setGaleria] = useState<ProjetoGaleriaItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const coverImage = watch("coverImage");
  const youtubeUrl = watch("youtubeUrl");
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const canUseGallery = useMemo(() => !!projectDbId, [projectDbId]);

  async function loadGallery(projetoId: string) {
    const { data, error } = await supabase
      .from("projeto_galeria")
      .select("id, projeto_id, tipo, url")
      .eq("projeto_id", projetoId)
      .eq("tipo", "image")
      .order("id", { ascending: true });

    if (error) {
      console.warn("Erro ao carregar galeria:", error.message);
      setGaleria([]);
      return;
    }

    setGaleria((data || []) as ProjetoGaleriaItem[]);
  }

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      const { data, error } = await getProjetoForEdit(id);
      setLoading(false);

      if (error || !data) {
        alert(error?.message || "Não foi possível carregar o projeto.");
        return;
      }

      const p: any = data;
      reset({
        title: p.titulo || "",
        description: p.descricao || "",
        foundationYear: p.ano_lancamento ? String(p.ano_lancamento) : "",
        status: p.publicado_transparencia ? "Ativo" : "Rascunho",
        coverImage: p.capa_url || "",
        instagramUrl: p.instagram_url || "",
        youtubeUrl: p.youtube_url || "",
        spotifyUrl: p.spotify_url || "",
      });

      if (p?.id) {
        setProjectDbId(String(p.id));
        await loadGallery(String(p.id));
      } else {
        setProjectDbId(null);
        setGaleria([]);
      }
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
    if (!projectDbId || !files?.length) return;

    setUploadingGallery(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        const imageId = crypto.randomUUID();
        const ext = fileExtension(file);
        const imagePath = `projects/${projectDbId}/galeria/${imageId}.${ext}`;

        const { error: uploadError } = await supabase.storage.from("projetos").upload(imagePath, file, {
          upsert: true,
          cacheControl: "31536000",
          contentType: file.type,
        });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from("projetos").getPublicUrl(imagePath);
        const { error: insertError } = await supabase.from("projeto_galeria").insert({
          id: imageId,
          projeto_id: projectDbId,
          tipo: "image",
          url: publicData.publicUrl,
        });
        if (insertError) throw insertError;
      }

      await loadGallery(projectDbId);
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar imagens para a galeria.");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleDeleteGalleryItem = async (item: ProjetoGaleriaItem) => {
    if (!projectDbId) return;

    if (!confirm("Remover esta imagem da galeria?")) return;

    const storagePrefix = "/storage/v1/object/public/projetos/";
    const pathFromUrl = item.url.includes(storagePrefix) ? item.url.split(storagePrefix)[1] : null;
    if (pathFromUrl) {
      await supabase.storage.from("projetos").remove([pathFromUrl]);
    }

    const { error } = await supabase.from("projeto_galeria").delete().eq("id", item.id);
    if (error) {
      alert(error.message);
      return;
    }

    await loadGallery(projectDbId);
  };

  const onSubmit = async (form: ProjetoFormData) => {
    setLoading(true);
    try {
      const nowISO = new Date().toISOString();
      const publicado_transparencia = form.status === "Ativo";
      const baseSlug = slugify(form.title);
      const uniqueSlug = await ensureUniqueProjetoSlug(baseSlug, projectDbId || undefined);
      const parsedYear = Number.parseInt((form.foundationYear || "").trim(), 10);
      const yearNumber = Number.isInteger(parsedYear) && parsedYear >= 1000 && parsedYear <= 9999 ? parsedYear : null;

      const payload: any = {
        titulo: form.title,
        slug: uniqueSlug,
        descricao: form.description || null,
        ano_lancamento: yearNumber,
        capa_url: form.coverImage || null,
        instagram_url: normalizeOptionalUrl(form.instagramUrl),
        youtube_url: normalizeOptionalUrl(form.youtubeUrl),
        spotify_url: normalizeOptionalUrl(form.spotifyUrl),
        publicado_transparencia,
        published_at: publicado_transparencia ? nowISO : null,
      };

      let saved: any = null;
      let expectedId = projectDbId;

      if (projectDbId) {
        const { data, error } = await supabase.from("projetos").update(payload).eq("id", projectDbId).select("id").maybeSingle();
        if (error) throw error;
        if (!data?.id) {
          const fallbackById = await supabase.from("projetos").select("id").eq("id", projectDbId).maybeSingle();
          if (fallbackById.error) throw fallbackById.error;
          if (!fallbackById.data?.id) {
            throw new Error("Sem permissão para ler o registro após salvar (RLS). Rode a migration de RLS.");
          }
          saved = fallbackById.data;
        } else {
          saved = data;
        }
      } else {
        const { data, error } = await supabase.from("projetos").insert(payload).select("id").maybeSingle();
        if (error) throw error;
        saved = data;
        if (!saved?.id) {
          const bySlug = await supabase.from("projetos").select("id").eq("slug", uniqueSlug).maybeSingle();
          if (bySlug.error) throw bySlug.error;
          saved = bySlug.data;
        }
        if (saved?.id) {
          expectedId = String(saved.id);
          setProjectDbId(expectedId);
        } else {
          expectedId = null;
        }
      }

      if (!saved) {
        if (expectedId) {
          const byId = await supabase.from("projetos").select("id, slug").eq("id", expectedId).maybeSingle();
          if (byId.error) throw byId.error;
          if (byId.data) saved = byId.data;
        }

        if (!saved) {
          const bySlug = await supabase.from("projetos").select("id, slug").eq("slug", uniqueSlug).maybeSingle();
          if (bySlug.error) throw bySlug.error;
          if (bySlug.data) saved = bySlug.data;
        }
      }

      if (!saved?.id) {
        throw new Error("Projeto persistido, mas não foi possível confirmar o registro salvo (RLS/SELECT).");
      }

      const savedId = String(saved.id);
      setProjectDbId(savedId);
      await loadGallery(savedId);
      alert("Salvo com sucesso.");

      if (!projectDbId) {
        const nextRoute = location.pathname.includes("/editar/")
          ? `/admin/projetos/editar/${savedId}`
          : `/admin/projetos/${savedId}`;
        navigate(nextRoute, { replace: true });
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
          <Link to="/admin/projetos" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{isEditing ? "Editar Projeto" : "Novo Projeto"}</h1>
            <p className="text-sm text-muted-foreground">Gerencie os dados mínimos do projeto, galeria de imagens e vídeos.</p>
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

          <label htmlFor="cover-input" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted">
            <ImageIcon className="w-4 h-4" />
            {uploadingCover ? "Enviando..." : "Enviar capa"}
          </label>
        </div>

        {coverImage ? (
          <img src={coverImage} alt="Capa" className="w-full h-56 object-cover rounded-lg border" />
        ) : (
          <div className="w-full h-56 rounded-lg border flex items-center justify-center text-sm text-muted-foreground">Nenhuma capa definida</div>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Título</label>
          <input {...register("title", { required: "Título é obrigatório" })} className="w-full mt-1 px-3 py-2 rounded-lg border" />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium">Descrição (Sobre o Projeto)</label>
          <textarea {...register("description")} className="w-full mt-1 px-3 py-2 rounded-lg border min-h-[120px]" />
        </div>

        <div>
          <label className="text-sm font-medium">Ano de fundação</label>
          <input
            type="number"
            inputMode="numeric"
            min={1000}
            max={9999}
            {...register("foundationYear")}
            className="w-full mt-1 px-3 py-2 rounded-lg border"
            placeholder="Ex.: 2008"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Status</label>
          <select {...register("status")} className="w-full mt-1 px-3 py-2 rounded-lg border">
            <option value="Ativo">Ativo</option>
            <option value="Rascunho">Rascunho</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Instagram URL</label>
          <input type="url" {...register("instagramUrl")} className="w-full mt-1 px-3 py-2 rounded-lg border" placeholder="https://instagram.com/..." />
        </div>

        <div>
          <label className="text-sm font-medium">YouTube URL</label>
          <input type="url" {...register("youtubeUrl")} className="w-full mt-1 px-3 py-2 rounded-lg border" placeholder="https://youtube.com/..." />
        </div>

        <div>
          <label className="text-sm font-medium">Spotify URL</label>
          <input type="url" {...register("spotifyUrl")} className="w-full mt-1 px-3 py-2 rounded-lg border" placeholder="https://open.spotify.com/..." />
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

          {!canUseGallery && <p className="text-sm text-muted-foreground">Salve o projeto primeiro para habilitar upload da galeria.</p>}

          {galeria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma imagem na galeria ainda.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {galeria.map((item, index) => (
                <div key={item.id} className="rounded-xl border overflow-hidden">
                  <img src={item.url} alt={`Imagem ${index + 1}`} className="w-full h-40 object-cover" loading="lazy" />
                  <div className="p-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">Imagem {index + 1}</div>
                    <button type="button" onClick={() => handleDeleteGalleryItem(item)} className="p-1 rounded border hover:bg-muted">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <YoutubeVideoGallery youtubeUrl={youtubeUrl} />
      </div>
    </div>
  );
}

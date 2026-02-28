import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RKCTag } from "@/app/components/RKCTag";
import { RKCCard, RKCCardContent } from "@/app/components/RKCCard";
import { ArrowLeft, Calendar, X, Image as ImageIcon, Instagram, Youtube, Music, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackPageView } from "@/lib/analytics";

type ProjectImage = {
  id: string;
  projeto_id: string;
  tipo: string;
  url: string;
};

type ProjetoUI = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  descricaoCompleta: string;
  imagem: string;
  tag: string;
  anoLancamento: number | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  imagens: ProjectImage[];
};

type YoutubeVideo = {
  id: string;
  title: string;
  thumbnail: string;
};

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;


function parseYoutubeUrl(url: string) {
  const fallback = { kind: "url" as const, sourceUrl: url };
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");

    if (!(host.includes("youtube.com") || host.includes("youtu.be"))) return fallback;

    const playlistId = u.searchParams.get("list");
    if (playlistId) return { kind: "playlist" as const, playlistId, sourceUrl: url };

    if (host === "youtu.be") {
      const videoId = u.pathname.replace("/", "");
      if (videoId) return { kind: "video" as const, videoId, sourceUrl: url };
    }

    const videoId = u.searchParams.get("v");
    if (videoId) return { kind: "video" as const, videoId, sourceUrl: url };

    const path = u.pathname;
    const handle = path.match(/\/@([a-zA-Z0-9._-]+)/)?.[1];
    if (handle) return { kind: "handle" as const, handle, sourceUrl: url };

    const channelId = path.match(/\/channel\/([a-zA-Z0-9_-]+)/)?.[1];
    if (channelId) return { kind: "channelId" as const, channelId, sourceUrl: url };

    const channelName = path.match(/\/(c|user)\/([^/]+)/)?.[2];
    if (channelName) return { kind: "channelName" as const, channelName, sourceUrl: url };

    return fallback;
  } catch {
    return fallback;
  }
}

async function fetchYouTubeVideos(youtubeUrl: string, limit = 12): Promise<YoutubeVideo[]> {
  if (!YOUTUBE_API_KEY) return [];

  const parsed = parseYoutubeUrl(youtubeUrl);
  const apiBase = "https://www.googleapis.com/youtube/v3";

  if (parsed.kind === "playlist") {
    const playlistUrl = `${apiBase}/playlistItems?part=snippet&maxResults=${limit}&playlistId=${parsed.playlistId}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(playlistUrl);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || [])
      .map((item: any) => ({
        id: item?.snippet?.resourceId?.videoId,
        title: item?.snippet?.title || "Vídeo",
        thumbnail: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url || "",
      }))
      .filter((item: YoutubeVideo) => Boolean(item.id));
  }

  let channelId: string | null = null;

  if (parsed.kind === "channelId") channelId = parsed.channelId;

  if (!channelId && parsed.kind === "handle") {
    const byHandle = await fetch(`${apiBase}/channels?part=id&forHandle=${encodeURIComponent(parsed.handle)}&key=${YOUTUBE_API_KEY}`);
    if (byHandle.ok) {
      const byHandleJson = await byHandle.json();
      channelId = byHandleJson?.items?.[0]?.id || null;
    }
  }

  if (!channelId && parsed.kind === "channelName") {
    const bySearch = await fetch(`${apiBase}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(parsed.channelName)}&key=${YOUTUBE_API_KEY}`);
    if (bySearch.ok) {
      const bySearchJson = await bySearch.json();
      channelId = bySearchJson?.items?.[0]?.snippet?.channelId || null;
    }
  }

  if (!channelId) return [];

  const searchVideos = await fetch(`${apiBase}/search?part=snippet&type=video&order=date&maxResults=${limit}&channelId=${channelId}&key=${YOUTUBE_API_KEY}`);
  if (!searchVideos.ok) return [];

  const json = await searchVideos.json();
  return (json.items || [])
    .map((item: any) => ({
      id: item?.id?.videoId,
      title: item?.snippet?.title || "Vídeo",
      thumbnail: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url || "",
    }))
    .filter((item: YoutubeVideo) => Boolean(item.id));
}

function getYoutubeFallbackEmbed(url: string) {
  const parsed = parseYoutubeUrl(url);
  if (parsed.kind === "playlist") return `https://www.youtube.com/embed/videoseries?list=${parsed.playlistId}`;
  if (parsed.kind === "video") return `https://www.youtube.com/embed/${parsed.videoId}`;
  return null;
}

function parseSpotifyUrl(url: string): { type: string; id: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "intl-pt") parts.shift();
    if (parts[0] === "embed") parts.shift();
    const [type, rawId] = parts;
    if (!type || !rawId) return null;
    const id = rawId.split("?")[0];
    if (!["playlist", "album", "show", "track", "artist"].includes(type)) return null;
    return { type, id };
  } catch {
    return null;
  }
}

export function ProjetoDetalhes() {
  const params = useParams();
  const paramValue = (params as any).slug || (params as any).id;

  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<ProjetoUI | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<YoutubeVideo[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!paramValue) return;

    (async () => {
      setLoading(true);
      const PUBLIC_FILTER = "publicado_transparencia.eq.true,publicado_transparencia.is.null";

      let found: any = null;
      const bySlug = await supabase
        .from("projetos")
        .select("id, slug, titulo, resumo, descricao, capa_url, ano_lancamento, instagram_url, youtube_url, spotify_url, publicado_transparencia")
        .eq("slug", paramValue)
        .or(PUBLIC_FILTER)
        .limit(1);

      if (!bySlug.error && bySlug.data?.length) {
        found = bySlug.data[0];
      } else {
        const byId = await supabase
          .from("projetos")
          .select("id, slug, titulo, resumo, descricao, capa_url, ano_lancamento, instagram_url, youtube_url, spotify_url, publicado_transparencia")
          .eq("id", paramValue)
          .or(PUBLIC_FILTER)
          .limit(1);
        if (!byId.error && byId.data?.length) found = byId.data[0];
      }

      if (!found) {
        setProjeto(null);
        setLoading(false);
        return;
      }

      const { data: imagesData } = await supabase
        .from("projeto_galeria")
        .select("id, projeto_id, tipo, url")
        .eq("projeto_id", found.id)
        .eq("tipo", "image")
        .order("id", { ascending: true });

      const imagens = (imagesData || []) as ProjectImage[];
      const fallbackCapa = imagens[0]?.url || "";

      const mapped: ProjetoUI = {
        id: found.id,
        slug: found.slug,
        titulo: found.titulo || "",
        descricao: found.resumo || "",
        descricaoCompleta: found.descricao || found.resumo || "",
        imagem: found.capa_url || fallbackCapa,
        tag: "Projeto",
        anoLancamento: found.ano_lancamento ?? null,
        instagramUrl: found.instagram_url ?? null,
        youtubeUrl: found.youtube_url ?? null,
        spotifyUrl: found.spotify_url ?? null,
        imagens,
      };

      setProjeto(mapped);

      if (mapped.youtubeUrl && YOUTUBE_API_KEY) {
        const vids = await fetchYouTubeVideos(mapped.youtubeUrl, 12);
        setYoutubeVideos(vids);
      } else {
        setYoutubeVideos([]);
      }

      await trackPageView({ pageType: "projeto", path: `/projetos/${mapped.slug || mapped.id}`, contentId: mapped.id, contentSlug: mapped.slug });
      setLoading(false);
    })();
  }, [paramValue]);

  const infoItems = useMemo(() => {
    if (!projeto) return [];
    return [
      projeto.instagramUrl ? { key: "instagram", label: "Instagram", url: projeto.instagramUrl, icon: Instagram } : null,
      projeto.youtubeUrl ? { key: "youtube", label: "YouTube", url: projeto.youtubeUrl, icon: Youtube } : null,
      projeto.spotifyUrl ? { key: "spotify", label: "Spotify", url: projeto.spotifyUrl, icon: Music } : null,
    ].filter(Boolean) as { key: string; label: string; url: string; icon: typeof Instagram }[];
  }, [projeto]);

  const hasInfoCard = Boolean(projeto?.anoLancamento || infoItems.length);
  const spotify = projeto?.spotifyUrl ? parseSpotifyUrl(projeto.spotifyUrl) : null;
  const spotifyEmbed = spotify ? `https://open.spotify.com/embed/${spotify.type}/${spotify.id}` : null;
  const youtubeFallbackEmbed = projeto?.youtubeUrl ? getYoutubeFallbackEmbed(projeto.youtubeUrl) : null;

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="text-center text-sm text-gray-500">Carregando projeto...</div></div>;
  if (!projeto) return <div className="min-h-[60vh] flex items-center justify-center"><div className="text-center text-sm text-gray-500">Projeto não encontrado.</div></div>;

  const selectedImage = selectedImageIndex !== null ? projeto.imagens[selectedImageIndex] : null;

  return (
    <div className="w-full">
      <section className="relative h-[70vh] md:h-[80vh] min-h-[520px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {projeto.imagem ? <img src={projeto.imagem} alt={projeto.titulo || "Projeto"} className="w-full h-full object-cover" fetchPriority="high" decoding="async" /> : <div className="w-full h-full bg-black/20" />}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 w-full"><div className="max-w-3xl"><Link to="/projetos" className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white"><ArrowLeft className="w-4 h-4" />Voltar para Projetos</Link><div className="mt-6"><RKCTag>{projeto.tag}</RKCTag></div><div className="mt-3 min-h-[200px]"><h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">{projeto.titulo || ""}</h1><p className="text-lg sm:text-xl text-gray-200 leading-relaxed">{projeto.descricao || ""}</p></div></div></div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-white" style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }} />
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <section>
            <h2 className="text-2xl font-semibold">Sobre o Projeto</h2>
            <p className="mt-3 text-base text-gray-700">{projeto.descricaoCompleta}</p>
          </section>

          {hasInfoCard ? (
            <aside>
              <RKCCard className="rounded-xl border p-4">
                <RKCCardContent className="p-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Informações</h3>

                  <div className="mt-4 space-y-4 text-sm text-gray-700">
                    {projeto.anoLancamento ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-green-700" />
                          Ano de fundação
                        </span>
                        <span className="font-medium">{projeto.anoLancamento}</span>
                      </div>
                    ) : null}

                    {infoItems.length ? (
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Redes sociais</p>
                        <div className="space-y-2">
                          {infoItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <a
                                key={item.key}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 hover:underline"
                              >
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </RKCCardContent>
              </RKCCard>
            </aside>
          ) : null}
        </div>

        <section>
          <h2 className="text-2xl font-semibold">Galeria</h2>
          {projeto.imagens.length === 0 ? (
            <div className="mt-4 rounded-xl border p-4 text-sm text-gray-600 flex items-center gap-2"><ImageIcon className="w-4 h-4" />Sem imagens cadastradas.</div>
          ) : (
            <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
              {projeto.imagens.map((item, index) => (
                <button key={item.id} type="button" onClick={() => setSelectedImageIndex(index)} className="rounded-2xl overflow-hidden border text-left group">
                  <img src={item.url} alt="Imagem do projeto" className="h-36 md:h-40 w-full object-cover group-hover:scale-[1.02] transition-transform" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </section>

        {projeto.youtubeUrl ? (
          <section>
            <h2 className="text-2xl font-semibold">Vídeos</h2>
            {youtubeVideos.length > 0 ? (
              <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
                {youtubeVideos.map((video, index) => (
                  <button key={video.id} type="button" onClick={() => setSelectedVideoIndex(index)} className="rounded-2xl overflow-hidden border text-left group">
                    <div className="relative">
                      <img src={video.thumbnail} alt={video.title} className="h-36 md:h-40 w-full object-cover" loading="lazy" decoding="async" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><Play className="w-10 h-10 text-white" /></div>
                    </div>
                    <div className="p-2 text-sm line-clamp-2">{video.title}</div>
                  </button>
                ))}
              </div>
            ) : youtubeFallbackEmbed ? (
              <div className="mt-4 rounded-xl overflow-hidden border">
                <iframe src={youtubeFallbackEmbed} title="YouTube" className="w-full h-[320px] md:h-[420px]" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : (
              <a href={projeto.youtubeUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-muted">Abrir no YouTube</a>
            )}
          </section>
        ) : null}

        {projeto.spotifyUrl ? (
          <section>
            <h2 className="text-2xl font-semibold">Spotify</h2>
            {spotifyEmbed ? (
              <div className="mt-4 rounded-xl overflow-hidden border">
                <iframe src={spotifyEmbed} title="Spotify" className="w-full h-[352px]" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
              </div>
            ) : (
              <a href={projeto.spotifyUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-muted">Abrir no Spotify</a>
            )}
          </section>
        ) : null}
      </div>

      {selectedImage ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={() => setSelectedImageIndex(null)}>
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-2 right-2 p-2 rounded-full bg-white/90" onClick={() => setSelectedImageIndex(null)}><X className="w-4 h-4" /></button>
            <button className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90" onClick={() => setSelectedImageIndex((prev) => (prev === null ? prev : (prev - 1 + projeto.imagens.length) % projeto.imagens.length))}><ChevronLeft className="w-5 h-5" /></button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90" onClick={() => setSelectedImageIndex((prev) => (prev === null ? prev : (prev + 1) % projeto.imagens.length))}><ChevronRight className="w-5 h-5" /></button>
            <img src={selectedImage.url} alt="Imagem" className="w-full max-h-[80vh] object-contain rounded-2xl" />
          </div>
        </div>
      ) : null}

      {selectedVideoIndex !== null ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={() => setSelectedVideoIndex(null)}>
          <div className="relative max-w-5xl w-full bg-black rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-2 right-2 p-2 rounded-full bg-white/90" onClick={() => setSelectedVideoIndex(null)}><X className="w-4 h-4" /></button>
            <button className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90" onClick={() => setSelectedVideoIndex((prev) => (prev === null ? prev : (prev - 1 + youtubeVideos.length) % youtubeVideos.length))}><ChevronLeft className="w-5 h-5" /></button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90" onClick={() => setSelectedVideoIndex((prev) => (prev === null ? prev : (prev + 1) % youtubeVideos.length))}><ChevronRight className="w-5 h-5" /></button>
            <iframe src={`https://www.youtube.com/embed/${youtubeVideos[selectedVideoIndex].id}?autoplay=1`} title={youtubeVideos[selectedVideoIndex].title} className="w-full aspect-video rounded-xl" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </div>
      ) : null}
    </div>
  );
}

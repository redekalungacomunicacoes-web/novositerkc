import { useEffect, useMemo, useState } from "react";

type YoutubeGridItem = {
  id: string;
  title: string;
  link: string;
  videoId: string;
  published: string;
};

type YoutubeCachePayload = { ts: number; items: YoutubeGridItem[] };

type YouTubeSource =
  | { type: "playlist"; id: string }
  | { type: "channel"; id: string };

type ProjectYouTubeGridProps = {
  youtubeUrl?: string | null;
  heading?: string;
  showOpenLink?: boolean;
  emptyMessage?: string;
  className?: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cacheMemory = new Map<string, YoutubeCachePayload>();

function getChannelIdFromPath(url: string) {
  return url.match(/\/channel\/(UC[a-zA-Z0-9_-]{10,})/)?.[1] ?? null;
}

function getPlaylistIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("list");
  } catch {
    return null;
  }
}

async function resolveChannelId(url: string) {
  const channelByPath = getChannelIdFromPath(url);
  if (channelByPath) return channelByPath;

  if (!/(\/@|\/c\/|\/user\/)/i.test(url)) {
    throw new Error("URL do YouTube inválida.");
  }

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error("Não foi possível carregar a página do canal do YouTube.");
  }

  const html = await response.text();
  const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{10,})"/);
  if (!match?.[1]) {
    throw new Error("Não foi possível identificar o channelId no YouTube URL informado.");
  }

  return match[1];
}

async function detectSource(youtubeUrl: string): Promise<YouTubeSource> {
  const playlistId = getPlaylistIdFromUrl(youtubeUrl);
  if (playlistId) return { type: "playlist", id: playlistId };
  const channelId = await resolveChannelId(youtubeUrl);
  return { type: "channel", id: channelId };
}

function getVideoIdFromLink(link: string) {
  const byParam = link.match(/[?&]v=([a-zA-Z0-9_-]{6,})/i)?.[1];
  if (byParam) return byParam;
  return link.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/i)?.[1] ?? "";
}

function parseFeedItems(xmlText: string) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const entries = Array.from(doc.getElementsByTagName("entry"));

  return entries
    .map((entry) => {
      const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || "Sem título";
      const published = entry.getElementsByTagName("published")[0]?.textContent?.trim() || "";
      const link = entry.getElementsByTagName("link")[0]?.getAttribute("href") || "";
      const ytVideoId = entry.getElementsByTagName("yt:videoId")[0]?.textContent?.trim() || "";
      const videoId = ytVideoId || getVideoIdFromLink(link);

      return {
        id: videoId || link || `${title}-${published}`,
        title,
        link,
        videoId,
        published,
      };
    })
    .filter((item) => item.videoId);
}

function readCache(cacheKey: string) {
  const now = Date.now();
  const mem = cacheMemory.get(cacheKey);
  if (mem && now - mem.ts < CACHE_TTL_MS) return mem.items;

  const raw = localStorage.getItem(cacheKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as YoutubeCachePayload;
    if (!parsed?.ts || !Array.isArray(parsed?.items)) return null;
    if (now - parsed.ts > CACHE_TTL_MS) return null;
    cacheMemory.set(cacheKey, parsed);
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, items: YoutubeGridItem[]) {
  const payload: YoutubeCachePayload = { ts: Date.now(), items };
  cacheMemory.set(cacheKey, payload);
  localStorage.setItem(cacheKey, JSON.stringify(payload));
}

async function loadYouTubeGridItems(youtubeUrl: string, limit = 4) {
  const source = await detectSource(youtubeUrl.trim());
  const cacheKey = `yt_feed_${source.id}`;
  const cached = readCache(cacheKey);
  if (cached) return cached.slice(0, limit);

  const feedUrl =
    source.type === "playlist"
      ? `https://www.youtube.com/feeds/videos.xml?playlist_id=${source.id}`
      : `https://www.youtube.com/feeds/videos.xml?channel_id=${source.id}`;

  const response = await fetch(feedUrl, { method: "GET" });
  if (!response.ok) throw new Error("Não foi possível carregar vídeos do YouTube.");

  const xml = await response.text();
  const items = parseFeedItems(xml);
  writeCache(cacheKey, items);
  return items.slice(0, limit);
}

export function ProjectYouTubeGrid({
  youtubeUrl,
  heading = "Vídeos",
  showOpenLink = false,
  emptyMessage,
  className,
}: ProjectYouTubeGridProps) {
  const [items, setItems] = useState<YoutubeGridItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedUrl = useMemo(() => (youtubeUrl || "").trim(), [youtubeUrl]);

  useEffect(() => {
    if (!normalizedUrl) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    loadYouTubeGridItems(normalizedUrl, 4)
      .then((nextItems) => {
        if (!alive) return;
        setItems(nextItems);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        setError("Não foi possível carregar vídeos do YouTube.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [normalizedUrl]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{heading}</h2>
        {showOpenLink && normalizedUrl ? (
          <a href={normalizedUrl} target="_blank" rel="noreferrer" className="text-sm text-green-700 hover:underline">
            Abrir no YouTube
          </a>
        ) : null}
      </div>

      {!normalizedUrl && emptyMessage ? <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p> : null}

      {loading ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`yt-skeleton-${idx}`} className="rounded-xl border p-3 animate-pulse">
              <div className="w-full aspect-video rounded-lg bg-muted" />
              <div className="mt-2 h-4 rounded bg-muted" />
              <div className="mt-1 h-4 w-2/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {!loading && !error && items.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((video) => (
            <article key={video.id} className="space-y-2">
              <iframe
                src={`https://www.youtube.com/embed/${video.videoId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                loading="lazy"
                className="rounded-xl border w-full aspect-video"
                allowFullScreen
              />
              <p className="text-sm font-medium line-clamp-2">{video.title}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

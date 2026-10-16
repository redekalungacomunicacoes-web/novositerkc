import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Playlist = { id: string; title: string; count: number };
export type YouTubeChoice = { id: string; title: string; thumbnail: string; visibility: string; url: string };
async function youtubeApi(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Faça login novamente.");
  const { data, error } = await supabase.functions.invoke("youtube-oauth", {
    body: { action, ...params },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Não foi possível consultar o canal.");
  return data;
}
export function YouTubeVideoPicker({ onChoose, publicOnly = false }: {
  onChoose: (item: YouTubeChoice) => void | Promise<void>;
  publicOnly?: boolean;
}) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistId, setPlaylistId] = useState("");
  const [videos, setVideos] = useState<YouTubeChoice[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    youtubeApi("playlists").then(data => {
      if (active) { setPlaylists(data.items || []); setLoaded(true); }
    }).catch(e => { if (active) { setError(e.message); setLoaded(true); } });
    return () => { active = false; };
  }, []);
  async function fetchVideos(selectedId: string, pageToken?: string) {
    setError(""); setBusy(true);
    try {
      const result = await youtubeApi("videos", { playlistId: selectedId, ...(pageToken ? { pageToken } : {}) });
      const items = (result.items || []).map((v: YouTubeChoice) => ({ ...v, url: `https://www.youtube.com/watch?v=${v.id}` }));
      setVideos(old => pageToken ? [...old, ...items] : items);
      setNext(result.nextPageToken || null);
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao carregar vídeos."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border bg-card p-4" onClick={e => e.stopPropagation()}>
    <div><h3 className="font-semibold text-sm">Escolher vídeo do YouTube</h3><p className="text-xs text-muted-foreground">Canal oficial RKC — selecione a playlist e o vídeo.</p></div>
    <select aria-label="Playlist do YouTube" className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={playlistId} onChange={e => { setPlaylistId(e.target.value); setVideos([]); setNext(null); if(e.target.value) void fetchVideos(e.target.value); }}>
      <option value="">{loaded ? "Selecione a playlist" : "Carregando playlists..."}</option>
      {playlists.map(p => <option value={p.id} key={p.id}>{p.title}{p.count ? ` (${p.count})` : ""}</option>)}
    </select>
    {loaded && !playlists.length && !error && <p className="text-sm text-muted-foreground">Nenhuma playlist disponível.</p>}
    {videos.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
      {videos.map(v => <button type="button" key={v.id} disabled={busy || (publicOnly && v.visibility !== "public")} onClick={async () => { setBusy(true); setError(""); try { await onChoose(v); } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível escolher o vídeo."); } finally { setBusy(false); } }} className="flex items-center gap-2 rounded-lg border p-2 text-left hover:border-green-700 disabled:opacity-50">
        {v.thumbnail && <img src={v.thumbnail} alt="" className="h-14 w-20 shrink-0 rounded object-cover"/>}
        <span className="min-w-0"><span className="line-clamp-2 text-sm font-medium">{v.title}</span><span className="text-xs text-muted-foreground">{v.visibility === "public" ? "Público" : v.visibility === "unlisted" ? "Não listado" : "Privado"}</span></span>
      </button>)}
    </div>}
    {playlistId && !busy && !videos.length && <p className="text-sm text-muted-foreground">Não há vídeos nesta playlist.</p>}
    {next && <button type="button" disabled={busy} className="rounded-md border px-3 py-2 text-sm" onClick={() => void fetchVideos(playlistId,next)}>Carregar mais</button>}
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    {busy && <p className="text-xs text-muted-foreground" role="status">Aguarde...</p>}
  </div>;
}

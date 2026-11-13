import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Playlist = { id: string; title: string; count: number };
type Video = { id: string; title: string; thumbnail: string; visibility: string };

async function youtubeApi(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Faça login novamente no painel.");
  const { data, error } = await supabase.functions.invoke("youtube-oauth", {
    body: { action, ...params },
    headers: { Authorization: "Bearer " + session.access_token },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Não foi possível consultar o YouTube.");
  return data;
}

type Props = {
  value: string;
  onSelect: (url: string) => void;
};

export function YouTubeVideoPicker({ value, onSelect }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistId, setPlaylistId] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    youtubeApi("playlists")
      .then((result) => {
        if (!active) return;
        const availablePlaylists = (result.items || []) as Playlist[];
        setPlaylists(availablePlaylists);
        const interviewPlaylist = availablePlaylists.find((item) => item.title.trim().toLocaleLowerCase("pt-BR") === "entrevistas");
        if (interviewPlaylist) void selectPlaylist(interviewPlaylist.id);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar o canal."); })
      .finally(() => { if (active) setLoadingPlaylists(false); });
    return () => { active = false; };
  }, []);

  async function selectPlaylist(id: string) {
    setPlaylistId(id);
    setVideos([]);
    setError("");
    if (!id) return;
    setLoadingVideos(true);
    try {
      const result = await youtubeApi("videos", { playlistId: id });
      setVideos(result.items || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar os vídeos.");
    } finally {
      setLoadingVideos(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <p className="text-sm font-medium">Selecionar do canal RKC</p>
      <label className="block text-sm">Playlist do canal
        <select value={playlistId} onChange={(event) => void selectPlaylist(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3">
          <option value="">{loadingPlaylists ? "Carregando biblioteca..." : playlists.length ? "Escolha uma playlist" : "Nenhuma playlist encontrada"}</option>
          {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.title}{playlist.count ? " (" + playlist.count + ")" : ""}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">A playlist “Entrevistas” será pré-selecionada se já existir. Você também pode escolher outra playlist do canal.</p>
      {loadingVideos && <p className="text-sm text-muted-foreground">Carregando vídeos...</p>}
      {playlistId && !loadingVideos && videos.length === 0 && !error && <p className="text-sm text-muted-foreground">Nenhum vídeo encontrado nesta playlist.</p>}
      {videos.length > 0 && (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {videos.map((video) => {
            const url = "https://www.youtube.com/watch?v=" + video.id;
            return (
              <button key={video.id} type="button" aria-pressed={value === url} onClick={() => onSelect(url)} className={"flex w-full items-center gap-3 rounded-md border bg-background p-2 text-left " + (value === url ? "border-green-700 ring-1 ring-green-700" : "hover:bg-muted")}>
                {video.thumbnail ? <img src={video.thumbnail} alt="" className="h-14 w-24 shrink-0 rounded object-cover" /> : <span className="h-14 w-24 shrink-0 rounded bg-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-2 text-sm font-medium">{video.title}</span>
                  <span className="text-xs text-muted-foreground">{video.visibility === "public" ? "Público" : video.visibility === "unlisted" ? "Não listado" : video.visibility === "private" ? "Privado" : ""}</span>
                </span>
                {value === url && <span className="text-xs font-semibold text-green-700">Selecionado</span>}
              </button>
            );
          })}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

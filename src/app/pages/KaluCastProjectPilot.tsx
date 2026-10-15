import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Instagram, Youtube, Music2, Play, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getVideoEmbedUrl } from "@/lib/video";

type Image = { id: string; url: string; tipo: string };
type Project = { id: string; slug: string; titulo: string; descricao: string; descricaoCompleta: string; imagem: string; anoLancamento: number | null; instagramUrl: string | null; youtubeUrl: string | null; spotifyUrl: string | null; imagens: Image[] };
type Video = { id: string; titulo: string | null; url: string; thumb_url: string | null; ordem: number | null };
function editionOf(title: string) {
  const match = title.match(/(?:^|\s)(\d{1,2})\s*(?:ª|a|º|o)?\s*edi[cç][aã]o\b/i);
  return match ? Number(match[1]) : null;
}
function episodeTitle(title: string | null, index: number) {
  return title?.replace(/(?:^|\s)\d{1,2}\s*(?:ª|a|º|o)?\s*edi[cç][aã]o\s*[:—-]?\s*/i, "").trim() || `Vídeo ${index + 1}`;
}
export function KaluCastProjectPilot({ project }: { project: Project }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [album, setAlbum] = useState<number | "all" | "general">("all");
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    supabase.from("projeto_galeria").select("id,titulo,url,thumb_url,ordem").eq("projeto_id", project.id).eq("tipo", "video").order("ordem", { ascending: true })
      .then(({ data, error }) => { if (active && !error) setVideos(data || []); });
    return () => { active = false; };
  }, [project.id]);
  // Existing gallery video titles may include an edition marker, e.g. "2ª edição — Episódio 1".
  // Untagged videos remain in the first edition; do not infer additional editions.
  const editions = useMemo(() => {
    const groups = new Map<number, Video[]>();
    for (const v of videos) {
      const number = editionOf(v.titulo || "") || 1;
      groups.set(number, [...(groups.get(number) || []), v]);
    }
    // Show the editorial structure even before video files are attached.
    if (!groups.size) groups.set(1, []);
    return [...groups].sort(([a], [b]) => a - b).map(([number, values]) => ({ number, videos: values }));
  }, [videos]);
  const visibleImages = project.imagens; // Legacy images are retained in the general album; no unverified album assignments.
  const links = [
    project.instagramUrl && { label: "Instagram", url: project.instagramUrl, Icon: Instagram },
    project.youtubeUrl && { label: "YouTube", url: project.youtubeUrl, Icon: Youtube },
    project.spotifyUrl && { label: "Spotify", url: project.spotifyUrl, Icon: Music2 },
  ].filter(Boolean) as { label: string; url: string; Icon: typeof Instagram }[];
  const editionCols = editions.length === 1 ? "lg:grid-cols-1" : editions.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  const currentVideo = selected ? videos.find(v => v.id === selected) : null;
  const embed = currentVideo ? getVideoEmbedUrl(currentVideo.url) : "";
  return <main className="bg-white">
    <section className="relative isolate min-h-[420px] overflow-hidden bg-zinc-900 text-white">
      {project.imagem && <img src={project.imagem} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/45 to-black/60" />
      <div className="mx-auto flex min-h-[420px] max-w-7xl flex-col justify-end gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <Link to="/projetos" className="mb-6 inline-flex items-center gap-2 text-sm text-white/90 hover:underline"><ArrowLeft size={16}/> Projetos</Link>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{project.titulo}</h1>
          {project.descricao && <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/95">{project.descricao}</p>}
        </div>
        {(project.anoLancamento || links.length > 0) && <aside className="w-full rounded-2xl border border-white/25 bg-black/40 p-5 backdrop-blur-md lg:w-80 lg:shrink-0">
          <h2 className="font-semibold">Informações do projeto</h2>
          {project.anoLancamento && <div className="mt-4 flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2"><CalendarDays size={17}/> Ano de fundação</span><strong>{project.anoLancamento}</strong></div>}
          {links.map(({label,url,Icon}) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-3 text-sm hover:underline"><span className="flex items-center gap-2"><Icon size={17}/>{label}</span><ArrowRight size={16}/></a>)}
        </aside>}
      </div>
    </section>
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
      <section aria-label="Edições do KaluCast">
        <h2 className="text-3xl font-bold tracking-tight">Edições do KaluCast</h2>
        <div className={`mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 ${editionCols}`}>
          {editions.map(ed => <article key={ed.number} className="min-w-0 rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b pb-4">
              <div><h3 className="text-2xl font-bold">{ed.number}ª edição</h3><p className="mt-1 text-sm text-zinc-500">{ed.videos.length} {ed.videos.length === 1 ? "vídeo" : "vídeos"}</p></div>
              <a href={`#edicao-${ed.number}`} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-zinc-50">Ver edição ↗</a>
            </div>
            <div id={`edicao-${ed.number}`} className={`mt-4 grid gap-3 ${editions.length === 1 ? "sm:grid-cols-3" : "grid-cols-1"}`}>
              {ed.videos.slice(0,3).map((v,i) => <button key={v.id} type="button" onClick={() => setSelected(v.id)} className="flex min-w-0 items-center gap-3 text-left">
                <span className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-white">{v.thumb_url && <img src={v.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover"/>}<Play className="relative" size={22}/></span>
                <span className="line-clamp-2 text-sm font-medium">{episodeTitle(v.titulo,i)}</span>
              </button>)}
              {!ed.videos.length && <p className="text-sm text-zinc-500">Nenhum vídeo publicado nesta edição.</p>}
            </div>
            {ed.videos.length > 3 && <p className="mt-3 text-xs text-zinc-500">Mais {ed.videos.length - 3} vídeos nesta edição</p>}
          </article>)}
        </div>
      </section>
      {project.descricaoCompleta && <section className="max-w-4xl"><h2 className="text-2xl font-bold">Sobre o projeto</h2><p className="mt-4 whitespace-pre-line leading-7 text-zinc-700">{project.descricaoCompleta}</p></section>}
      <section aria-label="Galeria">
        <div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-bold">Galeria</h2><span className="text-sm text-zinc-500">{visibleImages.length} imagens</span></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {([{value:"all",label:"Todas"},{value:"general",label:"Geral"}] as const).map(option => <button key={option.value} onClick={() => setAlbum(option.value)} className={`rounded-full border px-4 py-2 text-sm ${album===option.value ? "bg-zinc-900 text-white" : "bg-white"}`}>{option.label}</button>)}
        </div>
        {/* Existing images have no edition identifier; showing them in 'Geral' prevents false attribution. */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {visibleImages.slice(0,8).map((image,index) => <button key={image.id} onClick={() => setGalleryIndex(index)} className="aspect-[4/3] overflow-hidden rounded-xl border"><img src={image.url} alt={`Registro ${index+1} do projeto`} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105"/></button>)}
        </div>
        {!visibleImages.length && <p className="mt-4 text-sm text-zinc-500">Nenhuma imagem cadastrada.</p>}
      </section>
      {project.spotifyUrl && <section className="border-t pt-8"><h2 className="text-2xl font-bold">Ouça também</h2><a className="mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-medium hover:bg-zinc-50" href={project.spotifyUrl} target="_blank" rel="noopener noreferrer"><Music2 size={20}/> Abrir no Spotify <ArrowRight size={17}/></a></section>}
    </div>
    {currentVideo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Assistir vídeo" onClick={() => setSelected(null)}>
      <div className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}><button onClick={() => setSelected(null)} aria-label="Fechar vídeo" className="absolute -top-11 right-0 text-white"><X/></button>{embed ? <iframe title={currentVideo.titulo || "Vídeo"} src={embed} className="aspect-video w-full rounded-xl bg-black" allow="fullscreen; picture-in-picture" allowFullScreen/> : <a href={currentVideo.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-white p-6 text-center">Abrir vídeo na origem</a>}</div>
    </div>}
    {galleryIndex !== null && visibleImages[galleryIndex] && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Galeria de fotos" onClick={() => setGalleryIndex(null)}>
      <button onClick={e=>{e.stopPropagation();setGalleryIndex(null)}} aria-label="Fechar galeria" className="absolute right-5 top-5 text-white"><X/></button>
      <button onClick={e=>{e.stopPropagation();setGalleryIndex((galleryIndex-1+visibleImages.length)%visibleImages.length)}} aria-label="Imagem anterior" className="absolute left-3 text-white"><ChevronLeft/></button>
      <img src={visibleImages[galleryIndex].url} alt="Imagem da galeria" className="max-h-[85vh] max-w-[85vw] object-contain" onClick={e=>e.stopPropagation()}/>
      <button onClick={e=>{e.stopPropagation();setGalleryIndex((galleryIndex+1)%visibleImages.length)}} aria-label="Próxima imagem" className="absolute right-3 text-white"><ChevronRight/></button>
    </div>}
  </main>;
}

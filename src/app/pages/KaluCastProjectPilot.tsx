import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Instagram, Youtube, Music2, Play, X, ChevronLeft, ChevronRight, ArrowUpRight, Images, Maximize2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getVideoEmbedUrl } from "@/lib/video";

type Image = { id: string; url: string; tipo: string; titulo?: string | null };
type Project = { id: string; slug: string; titulo: string; descricao: string; descricaoCompleta: string; imagem: string; anoLancamento: number | null; instagramUrl: string | null; youtubeUrl: string | null; spotifyUrl: string | null; spotifyLatestEpisodeUrl: string | null; imagens: Image[] };
type Video = { id: string; titulo: string | null; url: string; thumb_url: string | null; ordem: number | null };
function editionOf(title: string) {
  const match = title.match(/(?:^|\s)(\d{1,2})\s*(?:ª|a|º|o)?\s*(?:edi[cç][aã]o|temporada)\b/i);
  return match ? Number(match[1]) : null;
}
function spotifyEmbedUrl(link: string | null) {
  if (!link) return null;
  try {
    const uri = new URL(link);
    if (uri.protocol !== "https:" || uri.hostname !== "open.spotify.com") return null;
    const path = uri.pathname.split("/").filter(Boolean).filter(part => !/^intl-[a-z]{2}$/i.test(part));
    if (path[0] === "embed") path.shift();
    const [kind,id] = path;
    if (!["show", "episode"].includes(kind) || !/^[A-Za-z0-9]{22}$/.test(id || "")) return null;
    return `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`;
  } catch { return null; }
}
function episodeTitle(title: string | null, index: number) {
  return title?.replace(/(?:^|\s)\d{1,2}\s*(?:ª|a|º|o)?\s*(?:edi[cç][aã]o|temporada)\s*[:—-]?\s*/i, "").trim() || `Vídeo ${index + 1}`;
}
export function KaluCastProjectPilot({ project }: { project: Project }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [params,setParams] = useSearchParams();
  const editionNumber = Number(params.get("temporada") || params.get("edicao"));
  const activeEdition = Number.isInteger(editionNumber) && editionNumber >= 1 && editionNumber <= 99 ? editionNumber : null;
  useEffect(() => {
    let active = true;
    supabase.from("projeto_galeria").select("id,titulo,url,thumb_url,ordem").eq("projeto_id", project.id).eq("tipo", "video").order("ordem", { ascending: true })
      .then(({ data, error }) => { if (active && !error) setVideos(data || []); });
    return () => { active = false; };
  }, [project.id]);
  // Existing gallery video titles may include a season or legacy edition marker, e.g. "2ª temporada — Episódio 1".
  // Untagged videos remain in the first season; do not infer additional seasons.
  const editions = useMemo(() => {
    const groups = new Map<number, Video[]>();
    for (const v of videos) {
      const number = editionOf(v.titulo || "") || 1;
      groups.set(number, [...(groups.get(number) || []), v]);
    }

    return [...groups].sort(([a], [b]) => a - b).map(([number, values]) => ({ number, videos: values }));
  }, [videos]);
  const editionForImage = (image: Image) => editionOf(image.titulo || "");
  const imageEditions = [...new Set(project.imagens.map(editionForImage).filter((n): n is number => n !== null))].sort((a,b)=>a-b);
  const albumParam = params.get("album");
  const albumEdition = Number(albumParam);
  const selectedAlbum = albumParam === "general" ? "general" : albumParam && Number.isInteger(albumEdition) && albumEdition > 0 ? albumEdition : "all";
  const visibleImages = project.imagens.filter(img => selectedAlbum === "all" || (selectedAlbum === "general" ? editionForImage(img) === null : editionForImage(img) === selectedAlbum));
  useEffect(() => {
    if (galleryIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGalleryIndex(null);
      if (event.key === "ArrowLeft") setGalleryIndex(i => i === null ? null : (i - 1 + visibleImages.length) % visibleImages.length);
      if (event.key === "ArrowRight") setGalleryIndex(i => i === null ? null : (i + 1) % visibleImages.length);
    };
    window.addEventListener("keydown",onKey);
    return () => window.removeEventListener("keydown",onKey);
  }, [galleryIndex,visibleImages.length]);
    const detailEdition = editions.find(e=>e.number===activeEdition);
  const openEdition = (number: number) => {const next=new URLSearchParams(params);next.set("temporada",String(number));next.delete("edicao");setParams(next);window.scrollTo({top:0,behavior:"smooth"});};
  const closeEdition = () => {const next=new URLSearchParams(params);next.delete("temporada");next.delete("edicao");setParams(next);};
  const links = [
    project.instagramUrl && { label: "Instagram", url: project.instagramUrl, Icon: Instagram },
    project.youtubeUrl && { label: "YouTube", url: project.youtubeUrl, Icon: Youtube },
    project.spotifyUrl && { label: "Spotify", url: project.spotifyUrl, Icon: Music2 },
  ].filter(Boolean) as { label: string; url: string; Icon: typeof Instagram }[];
  const spotifyEpisodeEmbed = spotifyEmbedUrl(project.spotifyLatestEpisodeUrl);
  const spotifyEmbed = spotifyEpisodeEmbed || spotifyEmbedUrl(project.spotifyUrl);
  const editionCols = editions.length === 1 ? "lg:grid-cols-1" : editions.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  const currentVideo = selected ? videos.find(v => v.id === selected) : null;
  const embed = currentVideo ? getVideoEmbedUrl(currentVideo.url) : "";
  return <main className="bg-white">
    <section className="relative isolate min-h-[420px] overflow-hidden bg-zinc-900 text-white">
      {(activeEdition && detailEdition?.videos.find(v=>v.thumb_url)?.thumb_url || project.imagem) && <img src={activeEdition && detailEdition?.videos.find(v=>v.thumb_url)?.thumb_url || project.imagem} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" fetchPriority="high" decoding="async" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/45 to-black/60" />
      <div className="mx-auto flex min-h-[420px] max-w-7xl flex-col justify-end gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          {activeEdition ? <button type="button" onClick={closeEdition} className="mb-6 inline-flex items-center gap-2 text-sm text-white/90 hover:underline"><ArrowLeft size={16}/> Voltar ao KaluCast</button> : <Link to="/projetos" className="mb-6 inline-flex items-center gap-2 text-sm text-white/90 hover:underline"><ArrowLeft size={16}/> Projetos</Link>}
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{activeEdition ? `KaluCast ${activeEdition}ª Temporada` : project.titulo}</h1>
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
      {activeEdition ? <section aria-label="Página da temporada" className="space-y-5">
        <button type="button" onClick={closeEdition} className="inline-flex items-center gap-2 text-sm font-medium text-green-800"><ArrowLeft size={16}/> Todas as temporadas</button>
        <div className="flex items-center justify-between gap-3"><h2 className="text-3xl font-bold">KaluCast {activeEdition}ª Temporada</h2><span className="text-sm text-zinc-500">{detailEdition?.videos.length || 0} episódios</span></div>
        {detailEdition?.videos.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{detailEdition.videos.map((v,i)=><button key={v.id} type="button" onClick={()=>setSelected(v.id)} className="overflow-hidden rounded-xl border text-left"><span className="relative flex aspect-video items-center justify-center bg-zinc-900 text-white">{v.thumb_url && <img src={v.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async"/>}<Play className="relative" size={32}/></span><span className="block p-4 font-medium">{episodeTitle(v.titulo,i)}</span></button>)}</div> : <p className="rounded-xl border p-5 text-sm text-zinc-600">Nenhum episódio publicado nesta temporada.</p>}
        {project.imagens.some(img=>editionForImage(img)===activeEdition) && <a href={`?temporada=${activeEdition}&album=${activeEdition}#galeria`} className="text-sm text-green-800">Ver fotografias desta temporada →</a>}
      </section> : <section aria-label="Temporadas do KaluCast">
        <h2 className="text-3xl font-bold tracking-tight">Temporadas do KaluCast</h2>
        <div className={`mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 ${editionCols}`}>
          {editions.map(ed => <article key={ed.number} className="min-w-0 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-green-50/80 to-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:from-emerald-100/70">
            <div className="flex items-start justify-between gap-3 border-b border-emerald-200/70 pb-4">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-bold text-zinc-900">KaluCast {ed.number}ª Temporada</h3></div><p className="mt-1 text-sm text-zinc-600">{ed.videos.length} {ed.videos.length === 1 ? "vídeo" : "vídeos"}</p></div>
              <button type="button" onClick={() => openEdition(ed.number)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition-colors hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Ver temporada <ArrowUpRight aria-hidden="true" size={16} className="text-emerald-700" /></button>
            </div>
            <div id={`temporada-${ed.number}`} className={`mt-4 grid gap-3 ${editions.length === 1 ? "sm:grid-cols-3" : "grid-cols-1"}`}>
              {ed.videos.slice(0,3).map((v,i) => <button key={v.id} type="button" onClick={() => setSelected(v.id)} className="flex min-w-0 items-center gap-3 text-left">
                <span className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-white">{v.thumb_url && <img src={v.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover"/>}<Play className="relative" size={22}/></span>
                <span className="line-clamp-2 text-sm font-medium">{episodeTitle(v.titulo,i)}</span>
              </button>)}
              {!ed.videos.length && <p className="text-sm text-zinc-500">Nenhum vídeo publicado nesta temporada.</p>}
            </div>
            {ed.videos.length > 3 && <p className="mt-3 text-xs text-zinc-500">Mais {ed.videos.length - 3} vídeos nesta temporada</p>}
          </article>)}
        </div>
        {!editions.length && <p className="mt-5 rounded-xl border p-5 text-sm text-zinc-600">As temporadas aparecerão conforme os episódios forem publicados.</p>}
      </section>}
      {project.descricaoCompleta && <section className="max-w-4xl"><h2 className="text-2xl font-bold">Sobre o projeto</h2><p className="mt-4 whitespace-pre-line leading-7 text-zinc-700">{project.descricaoCompleta}</p></section>}
      <section id="galeria" aria-label="Galeria de fotografias" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"><Images size={15} aria-hidden="true"/> Memórias em imagens</span>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Galeria do KaluCast</h2>
            <p className="max-w-xl text-sm text-zinc-600">Registros visuais do projeto, organizados por temporada.</p>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">{visibleImages.length} {visibleImages.length === 1 ? "foto" : "fotos"}</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar fotografias">
          {([{value:"all",label:"Todas"},{value:"general",label:"Geral"},...imageEditions.map(n=>({value:String(n),label:`${n}ª Temporada`}))]).map(option=><button key={option.value} type="button" aria-pressed={String(selectedAlbum)===option.value} onClick={()=>{const next=new URLSearchParams(params); if(option.value==="all")next.delete("album");else next.set("album",option.value);setParams(next,{replace:true});setGalleryIndex(null);}} className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${String(selectedAlbum)===option.value ? "border-emerald-800 bg-emerald-800 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50"}`}>{option.label}</button>)}
        </div>
        {/* Historical images without season metadata remain in Geral. */}
        {visibleImages.length > 0 ? <div className="mt-5 grid auto-rows-[104px] grid-cols-2 gap-3 sm:auto-rows-[128px] md:grid-cols-4 md:auto-rows-[124px] lg:auto-rows-[136px]">
          {visibleImages.map((image,index) => <button key={image.id} type="button" onClick={() => setGalleryIndex(index)} aria-label={`Ampliar fotografia ${index+1} de ${visibleImages.length}`} className={`group relative min-h-0 overflow-hidden rounded-2xl bg-zinc-100 text-left ring-1 ring-zinc-200/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${index===0 && visibleImages.length>2 ? "col-span-2 row-span-2" : index%7===4 && visibleImages.length>5 ? "row-span-2" : "row-span-2 md:row-span-1"}`}>
            <img src={image.url} alt={image.titulo || `Registro fotográfico ${index+1} do KaluCast`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"/>
            <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-50 transition-opacity group-hover:opacity-100" aria-hidden="true"/>
            <span className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-xs font-semibold text-white">
              <span className="truncate">{image.titulo || `Registro ${String(index+1).padStart(2,"0")}`}</span>
              <Maximize2 size={16} className="shrink-0 opacity-80" aria-hidden="true"/>
            </span>
          </button>)}
        </div> : <div className="mt-5 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-12 text-center text-sm text-zinc-500">Nenhuma fotografia neste álbum.</div>}
      </section>
      {project.spotifyUrl && <section aria-label="KaluCast no Spotify" className="border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-bold">Ouça o KaluCast no Spotify</h2><p className="mt-1 text-sm text-zinc-600">{spotifyEpisodeEmbed ? "Ouça o episódio em destaque." : "Ouça os episódios disponíveis diretamente aqui."}</p></div>
          <a className="inline-flex items-center gap-2 text-sm font-medium text-green-800 hover:underline" href={project.spotifyUrl} target="_blank" rel="noopener noreferrer"><Music2 size={17}/> Ver no Spotify <ArrowRight size={16}/></a>
        </div>
        {spotifyEmbed ? <div className="mt-5 overflow-hidden rounded-2xl border bg-zinc-100">
          <iframe title="Player oficial do KaluCast no Spotify" src={spotifyEmbed} className="block h-[352px] w-full" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"/>
        </div> : <p className="mt-4 text-sm text-zinc-600">Ouça os episódios pelo link do Spotify acima.</p>}
      </section>}
    </div>
    {currentVideo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Assistir vídeo" onClick={() => setSelected(null)}>
      <div className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}><button onClick={() => setSelected(null)} aria-label="Fechar vídeo" className="absolute -top-11 right-0 text-white"><X/></button>{embed ? <iframe title={currentVideo.titulo || "Vídeo"} src={embed} className="aspect-video w-full rounded-xl bg-black" allow="fullscreen; picture-in-picture" allowFullScreen/> : <a href={currentVideo.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-white p-6 text-center">Abrir vídeo na origem</a>}</div>
    </div>}
    {galleryIndex !== null && visibleImages[galleryIndex] && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Galeria de fotos" onClick={() => setGalleryIndex(null)}>
      <button onClick={e=>{e.stopPropagation();setGalleryIndex(null)}} aria-label="Fechar galeria" className="absolute right-5 top-5 text-white"><X/></button>
      <button onClick={e=>{e.stopPropagation();setGalleryIndex((galleryIndex-1+visibleImages.length)%visibleImages.length)}} aria-label="Imagem anterior" className="absolute left-3 text-white"><ChevronLeft/></button>
      <div className="flex max-w-[90vw] flex-col items-center gap-3" onClick={e=>e.stopPropagation()}><img src={visibleImages[galleryIndex].url} alt={visibleImages[galleryIndex].titulo || "Fotografia do KaluCast"} className="max-h-[78vh] max-w-[90vw] rounded-lg object-contain"/><div className="flex max-w-full flex-wrap items-center justify-center gap-3 text-center text-xs text-white/80"><span>{galleryIndex+1} / {visibleImages.length}</span>{visibleImages[galleryIndex].titulo && <span className="max-w-xl truncate">{visibleImages[galleryIndex].titulo}</span>}</div></div>
      <button onClick={e=>{e.stopPropagation();setGalleryIndex((galleryIndex+1)%visibleImages.length)}} aria-label="Próxima imagem" className="absolute right-3 text-white"><ChevronRight/></button>
    </div>}
  </main>;
}

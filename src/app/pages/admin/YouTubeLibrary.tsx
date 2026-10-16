import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
type Playlist = { id:string; title:string; count:number; thumbnail:string };
type Video = { id:string; title:string; thumbnail:string; visibility:string };
type Destination = "academy" | "project";
async function api(action:string,params:Record<string,unknown>={}) {
  const {data:{session}}=await supabase.auth.getSession();
  if(!session) throw Error("Faça login novamente.");
  const {data,error}=await supabase.functions.invoke("youtube-oauth",{body:{action,...params},headers:{Authorization:"Bearer "+session.access_token}});
  if(error || data?.error) throw Error(data?.error||error?.message||"Não foi possível consultar o YouTube.");
  return data;
}
export function YouTubeLibrary() {
  const [playlists,setPlaylists]=useState<Playlist[]>([]);
  const [playlist,setPlaylist]=useState("");
  const [videos,setVideos]=useState<Video[]>([]);
  const [video,setVideo]=useState("");
  const [courses,setCourses]=useState<{id:string;title:string}[]>([]);
  const [lessons,setLessons]=useState<{id:string;title:string;course_id:string}[]>([]);
  const [projects,setProjects]=useState<{id:string;titulo:string}[]>([]);
  const [destination,setDestination]=useState<Destination>("academy");
  const [course,setCourse]=useState("");
  const [lesson,setLesson]=useState("");
  const [project,setProject]=useState("");
  const [edition,setEdition]=useState(1);
  const [next,setNext]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{let active=true;(async()=>{
    try {
      const [p,c,l,pr]=await Promise.all([api("playlists"),supabase.from("academy_courses").select("id,title").order("title"),supabase.from("academy_lessons").select("id,title,course_id").order("title"),supabase.from("projetos").select("id,titulo").order("titulo")]);
      if(!active)return;
      setPlaylists(p.items||[]);
      if(c.error || l.error || pr.error) throw Error("Não foi possível carregar os destinos.");
      setCourses(c.data||[]);setLessons(l.data||[]);setProjects(pr.data||[]);
    }catch(e){if(active)setError(e instanceof Error?e.message:"Falha ao carregar biblioteca.");}
  })();return()=>{active=false;};},[]);
  async function loadVideos(id:string,pageToken?:string) {
    setError("");setNotice("");setBusy(true);
    try{const response=await api("videos",{playlistId:id,...pageToken?{pageToken}:{}});
      setVideos(current=>pageToken?[...current,...response.items]:response.items);
      setNext(response.nextPageToken||null);if(!pageToken)setVideo("");
    }catch(e){setError(e instanceof Error?e.message:"Erro ao listar vídeos.");}finally{setBusy(false);}
  }
  async function link() {
    setError("");setNotice("");setBusy(true);
    try{
      if(!video)throw Error("Escolha um vídeo.");
      if(destination==="academy") {if(!lesson)throw Error("Selecione uma aula."); await api("link_lesson",{videoId:video,lessonId:lesson});}
      else {if(!project)throw Error("Selecione um projeto.");await api("link_project",{videoId:video,projectId:project,edition});}
      setNotice("Vídeo vinculado. Atualize a página do conteúdo para conferir.");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao vincular.");}finally{setBusy(false);}
  }
  const field="w-full rounded-lg border bg-background px-3 py-2 text-sm";
  return <section className="rounded-xl border bg-card p-5 space-y-4" aria-label="Biblioteca do YouTube">
    <div><h2 className="text-lg font-semibold">Biblioteca YouTube</h2><p className="text-sm text-muted-foreground">Escolha uma playlist e vincule um vídeo existente sem duplicar arquivos. Nenhum conteúdo é publicado automaticamente.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm space-y-1">Playlist
        <select className={field} value={playlist} onChange={e=>{setPlaylist(e.target.value);if(e.target.value)void loadVideos(e.target.value);else setVideos([]);}}>
          <option value="">Selecione uma playlist</option>{playlists.map(p=><option key={p.id} value={p.id}>{p.title} ({p.count})</option>)}
        </select>
      </label>
      <label className="text-sm space-y-1">Vincular a
        <select className={field} value={destination} onChange={e=>setDestination(e.target.value as Destination)}><option value="academy">Aula da Academia</option><option value="project">Projeto / edição</option></select>
      </label>
    </div>
    {videos.length>0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{videos.map(v=><button type="button" key={v.id} onClick={()=>setVideo(v.id)} aria-pressed={video===v.id} className={`flex gap-3 rounded-lg border p-2 text-left ${video===v.id?"border-green-700 ring-1 ring-green-700":""}`}>
      {v.thumbnail?<img src={v.thumbnail} alt="" className="h-16 w-24 rounded-md object-cover"/>:<span className="h-16 w-24 shrink-0 rounded-md bg-muted"/>}
      <span className="min-w-0"><span className="line-clamp-2 text-sm font-medium">{v.title}</span><span className="text-xs text-muted-foreground">{v.visibility==="public"?"Público":v.visibility==="unlisted"?"Não listado":"Privado"}</span></span>
    </button>)}</div>}
    {playlist&&!videos.length&&!busy&&<p className="text-sm text-muted-foreground">Nenhum vídeo disponível nesta playlist.</p>}
    {next&&<button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={()=>void loadVideos(playlist,next)}>Carregar mais vídeos</button>}
    {destination==="academy"?<div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Curso<select className={field} value={course} onChange={e=>{setCourse(e.target.value);setLesson("");}}><option value="">Selecione o curso</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="space-y-1 text-sm">Aula<select className={field} value={lesson} onChange={e=>setLesson(e.target.value)}><option value="">Selecione a aula</option>{lessons.filter(l=>l.course_id===course).map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
    </div>:<div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Projeto<select className={field} value={project} onChange={e=>setProject(e.target.value)}><option value="">Selecione o projeto</option>{projects.map(p=><option key={p.id} value={p.id}>{p.titulo}</option>)}</select></label>
      <label className="space-y-1 text-sm">Edição<input type="number" min={1} max={99} className={field} value={edition} onChange={e=>setEdition(Number(e.target.value))}/></label>
    </div>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
    <button type="button" disabled={busy||!video||(destination==="academy"?!lesson:!project)} onClick={()=>void link()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy?"Aguarde...":"Vincular vídeo selecionado"}</button>
  </section>;
}

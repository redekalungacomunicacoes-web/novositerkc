import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button, Badge, Meter, Empty, Asset, labels } from "./components";
import { Textarea } from "@/app/components/ui/textarea";
import { rpc, safeContextRoute, message } from "./service";
import type { AcademyData, Activity, Course, Question } from "./types";

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: Record<string, unknown>) => { getDuration: () => number; getCurrentTime: () => number; seekTo: (seconds: number, allowSeekAhead: boolean) => void; destroy: () => void } };
    onYouTubeIframeAPIReady?: () => void;
  }
}
function youtubeVideoId(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const match = u.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/);
      return match?.[1] || null;
    }
  } catch {}
  return null;
}

function StudyHeader({ course }: { course: Course }) {
  return <div className="mb-5"><Link to="/admin/academia" className="text-sm text-neutral-500 hover:text-neutral-900">← Voltar para Academia</Link><h1 className="mt-2 text-2xl font-semibold">{course.title}</h1></div>;
}

export function Study({ data, reload }: { data: AcademyData; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const course = data.course;
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(data.lesson?.activities?.[0]?.id || null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const playerHost = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<InstanceType<NonNullable<Window["YT"]>["Player"]> | null>(null);
  const selected = data.lesson?.activities?.find((item) => item.id === selectedActivityId) || data.lesson?.activities?.[0] || null;

  useEffect(() => { if (data.lesson?.activities?.length && !data.lesson.activities.some((item) => item.id === selectedActivityId)) setSelectedActivityId(data.lesson.activities[0].id); }, [data.lesson?.activities, selectedActivityId]);
  useEffect(() => {
    const id = selected?.type === "video" ? youtubeVideoId(selected.url) : null;
    if (!id || !playerHost.current) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !window.YT?.Player || !playerHost.current) return;
      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(playerHost.current, { videoId: id, width: "100%", height: "100%", playerVars: { rel: 0 } });
    };
    if (window.YT?.Player) mount(); else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) { const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true; document.head.appendChild(script); }
      const previous = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { previous?.(); mount(); };
    }
    return () => { cancelled = true; playerRef.current?.destroy(); playerRef.current = null; };
  }, [selected?.id, selected?.type, selected?.url]);

  if (!course) return <Empty title="Curso não encontrado" />;
  const lesson = data.lesson;
  const activities = lesson?.activities || [];
  async function complete(activity: Activity) { setBusy(true); try { await rpc("academy_complete_activity", { activity_id: activity.id }); await reload(); message("Atividade concluída."); } finally { setBusy(false); } }
  async function submit(question: Question) { if (!answer.trim()) return; setBusy(true); try { await rpc("academy_submit_answer", { question_id: question.id, answer }); setAnswer(""); await reload(); message("Resposta enviada."); } finally { setBusy(false); } }
  return <div className="mx-auto max-w-7xl p-4 md:p-6"><StudyHeader course={course} /><div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><Card><div className="space-y-2">{data.courseLessons?.map((item) => <button key={item.id} onClick={() => navigate(safeContextRoute(`/admin/academia/cursos/${course.id}/aulas/${item.id}`))} className={`w-full rounded-lg p-3 text-left text-sm ${item.id === lesson?.id ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}>{item.title}</button>)}</div></Card><div className="space-y-5">{lesson ? <><Card><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{lesson.title}</h2>{lesson.description && <p className="mt-1 text-sm text-neutral-600">{lesson.description}</p>}</div><Badge>{labels.lesson}</Badge></div>{lesson.progress != null && <div className="mt-4"><Meter value={lesson.progress} /></div>}</Card><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]"><Card>{selected ? <div>{selected.type === "video" && youtubeVideoId(selected.url) ? <div className="aspect-video overflow-hidden rounded-xl bg-black"><div ref={playerHost} className="h-full w-full" /></div> : selected.url ? <Asset activity={selected} /> : null}<h3 className="mt-4 text-lg font-semibold">{selected.title}</h3>{selected.description && <p className="mt-2 text-sm text-neutral-600">{selected.description}</p>}{selected.questions?.map((question) => <div key={question.id} className="mt-5 space-y-3"><p className="font-medium">{question.prompt}</p><Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Sua resposta" /><Button disabled={busy || !answer.trim()} onClick={() => submit(question)}>Enviar resposta</Button></div>)}<div className="mt-5"><Button disabled={busy || selected.completed} onClick={() => complete(selected)}>{selected.completed ? "Concluída" : "Marcar como concluída"}</Button></div></div> : <Empty title="Nenhuma atividade nesta aula" />}</Card><Card><h3 className="mb-3 font-semibold">Atividades</h3><div className="space-y-2">{activities.map((activity) => <button key={activity.id} onClick={() => setSelectedActivityId(activity.id)} className={`w-full rounded-lg p-3 text-left text-sm ${activity.id === selected?.id ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}><span className="block">{activity.title}</span><span className="mt-1 block text-xs text-neutral-500">{activity.completed ? "Concluída" : labels[activity.type] || activity.type}</span></button>)}</div></Card></div></> : <Empty title="Selecione uma aula" />}</div></div></div>;
}

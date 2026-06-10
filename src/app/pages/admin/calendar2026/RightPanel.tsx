import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { BellRing, CalendarClock, FileUp } from "lucide-react";
import { useMemo } from "react";
import { useNotificationsQuery } from "./useTaskQueries";
import { useCalendarStore } from "./store";

export function RightPanel() {
  const { tasks, teamMembers } = useCalendarStore();
  const notifications = useNotificationsQuery();
  const today = new Date().toISOString().slice(0, 10);
  const totals = {
    total: tasks.length,
    concluido: tasks.filter((t) => t.status === "concluida").length,
    andamento: tasks.filter((t) => t.status === "em_andamento").length,
    atrasado: tasks.filter((t) => t.status !== "concluida" && t.status !== "cancelada" && t.endDate < today).length,
  };
  const nextTasks = [...tasks].filter((task) => task.status !== "concluida" && task.endDate >= today).sort((a, b) => `${a.endDate}${a.startTime}`.localeCompare(`${b.endDate}${b.startTime}`)).slice(0, 4);
  const productivity = useMemo(() => teamMembers.map((member) => ({ name: member.name.split(" ")[0], concluidas: tasks.filter((task) => task.assigneeId === member.id && task.status === "concluida").length })), [tasks, teamMembers]);

  return <aside className="space-y-3">
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
      <h4 className="mb-3 font-semibold">Notificações</h4>
      <div className="space-y-2 text-sm">{(notifications.data ?? []).map((n) => <div key={n.id} className="flex items-start gap-2 rounded-xl bg-white/5 p-2">{n.type === "meeting" ? <CalendarClock size={14} /> : n.type === "attachment" ? <FileUp size={14} /> : <BellRing size={14} />}<div><p>{n.message}</p><span className="text-xs text-slate-400">{n.status}</span></div></div>)}</div>
    </div>
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 text-sm"><h4 className="mb-3 font-semibold">Resumo do mês</h4><p>Total: {totals.total}</p><p>Concluídas: {totals.concluido}</p><p>Em andamento: {totals.andamento}</p><p>Atrasadas: {totals.atrasado}</p></div>
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 text-sm"><h4 className="mb-3 font-semibold">Produtividade</h4><div className="h-32"><ResponsiveContainer width="100%" height="100%"><BarChart data={productivity}><XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} /><Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} /><Bar dataKey="concluidas" fill="#38bdf8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 text-sm"><h4 className="mb-3 font-semibold">Próximos compromissos</h4><div className="space-y-2">{nextTasks.map((t) => <div key={t.id} className="border-l-2 border-sky-500 pl-3"><p>{t.title}</p><p className="text-xs text-slate-400">{t.endDate} · {t.startTime}</p></div>)}</div></div>
  </aside>;
}

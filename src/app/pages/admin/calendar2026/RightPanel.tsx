import { BellRing, CalendarClock, FileUp } from "lucide-react";
import { sharedData, useCalendarStore } from "./store";

export function RightPanel() {
  const { tasks } = useCalendarStore();
  const totals = {
    total: tasks.length,
    concluido: tasks.filter((t) => t.status === "concluido").length,
    andamento: tasks.filter((t) => t.status === "andamento").length,
    atrasado: tasks.filter((t) => t.status === "atrasado").length,
  };
  const nextTasks = [...tasks].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)).slice(0, 4);

  return <aside className="space-y-3">
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
      <h4 className="mb-3 font-semibold">Notificações</h4>
      <div className="space-y-2 text-sm">{sharedData.notifications.map((n) => <div key={n.id} className="flex items-start gap-2 rounded-xl bg-white/5 p-2">{n.type === "meeting" ? <CalendarClock size={14} /> : n.type === "task" ? <BellRing size={14} /> : <FileUp size={14} />}<div><p>{n.message}</p><span className="text-xs text-slate-400">{n.status}</span></div></div>)}</div>
    </div>
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 text-sm"><h4 className="mb-3 font-semibold">Resumo do mês</h4><p>Total: {totals.total}</p><p>Concluídas: {totals.concluido}</p><p>Em andamento: {totals.andamento}</p><p>Atrasadas: {totals.atrasado}</p></div>
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 text-sm"><h4 className="mb-3 font-semibold">Próximos compromissos</h4><div className="space-y-2">{nextTasks.map((t) => <div key={t.id} className="border-l-2 border-sky-500 pl-3"><p>{t.title}</p><p className="text-xs text-slate-400">{t.date} · {t.startTime}</p></div>)}</div></div>
  </aside>;
}

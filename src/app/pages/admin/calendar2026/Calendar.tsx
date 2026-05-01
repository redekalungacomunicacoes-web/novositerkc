import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useCalendarStore } from "./store";

const statusColor = { concluido: "bg-emerald-500", andamento: "bg-amber-500", pendente: "bg-sky-500", atrasado: "bg-rose-500" };

export function Calendar({ onSelectDay }: { onSelectDay: () => void }) {
  const { month, setMonth, setSelectedDate, tasks, view, setView, filters } = useCalendarStore();
  const monthLabel = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }).map((_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1));
  }, [month]);

  const visibleTasks = tasks.filter((t) => (filters.status === "all" || t.status === filters.status) && (filters.priority === "all" || t.priority === filters.priority) && t.title.toLowerCase().includes(filters.search.toLowerCase()));

  return <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur-xl">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button><h2 className="text-lg font-semibold capitalize">{monthLabel}</h2><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button><button onClick={() => setMonth(new Date())} className="ml-2 rounded-xl border border-white/10 px-3 py-1 text-sm">Hoje</button></div>
      <div className="flex gap-1 rounded-xl bg-slate-800 p-1 text-sm">{(["month", "week", "day"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1 ${view === v ? "bg-sky-500 text-white" : "text-slate-300"}`}>{v}</button>)}</div>
    </div>
    <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">{"DSTQQSS".split("").map((d, i) => <p key={i} className="px-2">{d}</p>)}</div>
    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-7">
      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const dayTasks = visibleTasks.filter((t) => t.date === key);
        return <motion.button whileHover={{ scale: 1.01 }} key={key} onClick={() => { setSelectedDate(key); onSelectDay(); }} className="min-h-32 rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-left hover:border-sky-500/40">
          <div className="mb-2 flex items-center justify-between"><span className="text-sm text-white">{day.getDate()}</span><span className="rounded-full bg-white/10 px-2 text-[10px]">{dayTasks.length}</span></div>
          <div className="space-y-1">{dayTasks.slice(0, 3).map((t) => <div key={t.id} className="flex items-center gap-1 text-[11px]"><span className={`h-2 w-2 rounded-full ${statusColor[t.status]}`} />{t.title}</div>)}</div>
        </motion.button>;
      })}
    </div>
  </section>;
}

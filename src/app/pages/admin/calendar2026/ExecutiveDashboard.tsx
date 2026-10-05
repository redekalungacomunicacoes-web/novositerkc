import { BarChart3, AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, ListChecks, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useCalendarStore } from "./store";

const kpiIcons = [ListChecks, CheckCircle2, Clock3, AlertTriangle, CalendarCheck2, TrendingUp];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ExecutiveDashboard() {
  const { tasks, teamMembers } = useCalendarStore();
  const today = localDateKey(new Date());
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "concluida").length;
  const inProgress = tasks.filter((task) => task.status === "em_andamento" || task.status === "revisao").length;
  const overdue = tasks.filter((task) => task.status !== "concluida" && task.status !== "cancelada" && task.endDate < today).length;
  const dueToday = tasks.filter((task) => task.status !== "concluida" && task.endDate === today).length;
  const productivityRate = total ? Math.round((done / total) * 100) : 0;

  const kpis = [
    { label: "Total", value: total, tone: "text-slate-900 dark:text-white" },
    { label: "Concluídas", value: done, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Em andamento", value: inProgress, tone: "text-amber-700 dark:text-amber-300" },
    { label: "Atrasadas", value: overdue, tone: "text-rose-700 dark:text-rose-300" },
    { label: "Prazo hoje", value: dueToday, tone: "text-teal-700 dark:text-teal-300" },
    { label: "Produtividade", value: `${productivityRate}%`, tone: "text-emerald-800 dark:text-emerald-200" },
  ];

  const workload = useMemo(() => teamMembers.map((member) => ({
    name: member.name,
    open: tasks.filter((task) => task.assigneeId === member.id && task.status !== "concluida" && task.status !== "cancelada").length,
  })).filter((item) => item.open > 0).sort((a, b) => b.open - a.open).slice(0, 5), [tasks, teamMembers]);

  return (
    <section className="mb-3">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-1.5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
        {kpis.map((kpi, index) => {
          const Icon = kpiIcons[index];
          return (
            <article key={kpi.label} className="flex min-w-[132px] flex-1 items-center gap-2.5 rounded-xl px-3 py-2 transition hover:bg-emerald-50/70 dark:hover:bg-emerald-900/40">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-800/70 dark:text-emerald-100"><Icon size={15}/></span>
              <div className="min-w-0"><p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-emerald-100/55">{kpi.label}</p><p className={`text-lg font-bold leading-5 ${kpi.tone}`}>{kpi.value}</p></div>
            </article>
          );
        })}
      </div>
      {workload.length ? (
        <details className="mt-2 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-2 text-xs shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/60">
          <summary className="cursor-pointer select-none font-semibold text-slate-600 dark:text-emerald-100"><span className="inline-flex items-center gap-2"><BarChart3 size={14} className="text-emerald-700"/> Carga da equipe</span></summary>
          <div className="mt-3 grid gap-3 pb-2 md:grid-cols-2 xl:grid-cols-3">{workload.map((item) => { const max=Math.max(...workload.map((entry)=>entry.open),1); return <div key={item.name}><div className="mb-1 flex justify-between"><span className="truncate text-slate-500">{item.name}</span><strong>{item.open}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-emerald-50 dark:bg-emerald-900"><div className="h-full rounded-full bg-emerald-600" style={{width:`${Math.max(8,Math.round((item.open/max)*100))}%`}}/></div></div>;})}</div>
        </details>
      ) : null}
    </section>
  );
}

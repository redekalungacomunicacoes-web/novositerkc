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
    <section className="mb-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi, index) => {
          const Icon = kpiIcons[index];
          return (
            <article key={kpi.label} className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-500 dark:text-emerald-100/70">{kpi.label}</p>
                <span className="rounded-2xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-800/70 dark:text-emerald-100"><Icon size={17} /></span>
              </div>
              <p className={`mt-3 text-3xl font-bold ${kpi.tone}`}>{kpi.value}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex items-center gap-2"><BarChart3 size={18} className="text-emerald-700"/><h3 className="font-semibold text-slate-900 dark:text-white">Carga atual da equipe</h3></div>
          <div className="mt-4 space-y-3">
            {workload.length ? workload.map((item) => {
              const max = Math.max(...workload.map((entry) => entry.open), 1);
              return <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span className="truncate text-slate-600 dark:text-emerald-100/70">{item.name}</span><strong>{item.open}</strong></div><div className="h-2 overflow-hidden rounded-full bg-emerald-50 dark:bg-emerald-900"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(8, Math.round((item.open / max) * 100))}%` }}/></div></div>;
            }) : <p className="text-sm text-slate-500">Nenhuma tarefa aberta no período.</p>}
          </div>
        </article>
        <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <h3 className="font-semibold text-slate-900 dark:text-white">Leitura rápida</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-emerald-100/70">O painel usa somente os dados já carregados do calendário. Gráficos pesados foram removidos desta tela para reduzir custo de renderização e tornar a entrada em Tarefas mais imediata.</p>
        </article>
      </div>
    </section>
  );
}

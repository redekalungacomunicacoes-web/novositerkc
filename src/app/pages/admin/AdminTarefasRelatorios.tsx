import { useMemo } from "react";
import { BarChart3, Download, FileSpreadsheet, FileText } from "lucide-react";

import { CalendarProvider, useCalendarStore } from "./calendar2026/store";
import { TasksPageShell } from "./calendar2026/TasksShell";
import { priorityLabels } from "./calendar2026/tasksApi";
import type { TaskPriority } from "./calendar2026/types";

const priorities: TaskPriority[] = ["baixa", "media", "alta", "urgente"];

function ManagerDashboard() {
  const { tasks, teamMembers, setPeriod } = useCalendarStore();
  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "concluida").length;
    const cancelled = tasks.filter((task) => task.status === "cancelada").length;
    const inProgress = tasks.filter((task) => task.status === "em_andamento" || task.status === "revisao").length;
    const overdue = tasks.filter((task) => !["concluida", "cancelada"].includes(task.status) && task.endDate < today).length;
    return { total: tasks.length, completed, cancelled, inProgress, overdue, completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 };
  }, [tasks, today]);
  const byMember = teamMembers.map((member) => ({ member, count: tasks.filter((task) => task.assigneeId === member.id || task.assigneeId === member.userId).length })).sort((a, b) => b.count - a.count).slice(0, 8);
  const maxMemberCount = Math.max(1, ...byMember.map((item) => item.count));

  function setQuickPeriod(period: "today" | "week" | "month") {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (period === "week") { start.setDate(now.getDate() - now.getDay()); end.setDate(start.getDate() + 6); }
    if (period === "month") { start.setDate(1); end.setMonth(now.getMonth() + 1, 0); }
    setPeriod(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  }

  return (
    <TasksPageShell>
      <main className="space-y-4">
        <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300"><BarChart3 size={22} /><span className="text-sm font-medium uppercase tracking-[0.2em]">Relatórios</span></div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Dashboard gerencial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-emerald-100/70">Resumo operacional do módulo de tarefas com indicadores de produtividade, prioridades e períodos.</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[{ label: "Total de tarefas", value: stats.total }, { label: "Concluídas", value: stats.completed }, { label: "Em andamento", value: stats.inProgress }, { label: "Canceladas", value: stats.cancelled }, { label: "Atrasadas", value: stats.overdue }].map((item) => <article key={item.label} className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{item.label}</p><p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{item.value}</p></article>)}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
            <h2 className="font-semibold text-slate-950 dark:text-white">Produtividade</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/70">Taxa de conclusão: <strong>{stats.completionRate}%</strong></p>
            <div className="mt-4 space-y-3">{byMember.length ? byMember.map(({ member, count }) => <div key={member.id}><div className="mb-1 flex justify-between text-sm"><span>{member.name}</span><span>{count} tarefas</span></div><div className="h-2 rounded-full bg-emerald-50 dark:bg-emerald-900"><div className="h-2 rounded-full bg-emerald-700 dark:bg-emerald-400" style={{ width: `${Math.max(6, (count / maxMemberCount) * 100)}%` }} /></div></div>) : <p className="text-sm text-slate-500">Sem dados de colaboradores.</p>}</div>
          </article>
          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
            <h2 className="font-semibold text-slate-950 dark:text-white">Prioridades</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{priorities.map((priority) => <div key={priority} className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/40"><p className="text-sm text-emerald-800 dark:text-emerald-100">{priorityLabels[priority]}</p><p className="mt-1 text-2xl font-bold">{tasks.filter((task) => task.priority === priority).length}</p></div>)}</div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
            <h2 className="font-semibold text-slate-950 dark:text-white">Períodos</h2>
            <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setQuickPeriod("today")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Hoje</button><button onClick={() => setQuickPeriod("week")} className="rounded-xl border border-emerald-100 px-4 py-2 text-sm dark:border-emerald-800/60">Semana</button><button onClick={() => setQuickPeriod("month")} className="rounded-xl border border-emerald-100 px-4 py-2 text-sm dark:border-emerald-800/60">Mês</button><span className="rounded-xl border border-dashed border-emerald-200 px-4 py-2 text-sm text-slate-500 dark:border-emerald-800/60 dark:text-emerald-100/70">Personalizado pelos filtros do topo</span></div>
          </article>
          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
            <h2 className="font-semibold text-slate-950 dark:text-white">Exportação</h2>
            <div className="mt-4 flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white"><FileText size={16} /> PDF</button><button className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 px-4 py-2 text-sm dark:border-emerald-800/60"><FileSpreadsheet size={16} /> Excel</button><span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-emerald-100/70"><Download size={16} /> Pronto para integração de exportadores.</span></div>
          </article>
        </section>
      </main>
    </TasksPageShell>
  );
}

export function AdminTarefasRelatorios() {
  return <CalendarProvider><ManagerDashboard /></CalendarProvider>;
}

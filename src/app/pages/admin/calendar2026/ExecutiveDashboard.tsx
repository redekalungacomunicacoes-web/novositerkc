import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, ListChecks, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useCalendarStore } from "./store";

const kpiIcons = [ListChecks, CheckCircle2, Clock3, AlertTriangle, CalendarCheck2, TrendingUp];

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ExecutiveDashboard() {
  const { tasks, teamMembers } = useCalendarStore();
  const today = new Date().toISOString().slice(0, 10);
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "concluida").length;
  const inProgress = tasks.filter((task) => task.status === "em_andamento" || task.status === "revisao").length;
  const overdue = tasks.filter((task) => task.status !== "concluida" && task.status !== "cancelada" && task.endDate < today).length;
  const dueToday = tasks.filter((task) => task.status !== "concluida" && task.endDate === today).length;
  const eligible = tasks.filter((task) => task.status !== "cancelada").length;
  const productivityRate = eligible ? Math.round((done / eligible) * 100) : 0;
  const averageProgress = total ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / total) : 0;
  const projectTasks = tasks.filter((task) => task.contextType === "project").length;
  const materiaTasks = tasks.filter((task) => task.contextType === "materia").length;
  const internalTasks = tasks.filter((task) => task.contextType === "internal").length;

  const kpis = [
    { label: "Total", value: total, tone: "text-slate-900 dark:text-white" },
    { label: "Concluídas", value: done, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Em andamento", value: inProgress, tone: "text-amber-700 dark:text-amber-300" },
    { label: "Atrasadas", value: overdue, tone: "text-rose-700 dark:text-rose-300" },
    { label: "Prazo hoje", value: dueToday, tone: "text-teal-700 dark:text-teal-300" },
    { label: "Progresso médio", value: `${averageProgress}%`, tone: "text-emerald-800 dark:text-emerald-200" },
  ];

  const byCollaborator = useMemo(() => teamMembers.slice(0, 8).map((member) => {
    const related = tasks.filter((task) => task.assigneeId === member.id || task.direcionamento.includes(member.id));
    return {
      nome: member.name.split(" ")[0],
      total: related.length,
      concluidas: related.filter((task) => task.status === "concluida").length,
      atrasadas: related.filter((task) => !["concluida", "cancelada"].includes(task.status) && task.endDate < today).length,
    };
  }).filter((item) => item.total || item.concluidas || item.atrasadas), [tasks, teamMembers, today]);

  const monthly = useMemo(() => {
    const grouped = new Map<string, { mes: string; concluidas: number; total: number }>();
    tasks.forEach((task) => {
      const key = task.endDate.slice(0, 7);
      const current = grouped.get(key) ?? { mes: key.split("-").reverse().join("/"), concluidas: 0, total: 0 };
      current.total += 1;
      if (task.status === "concluida") current.concluidas += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6);
  }, [tasks]);

  const byDate = useMemo(() => {
    const grouped = new Map<string, { data: string; concluidas: number; atrasadas: number }>();
    tasks.forEach((task) => {
      const current = grouped.get(task.endDate) ?? { data: shortDate(task.endDate), concluidas: 0, atrasadas: 0 };
      if (task.status === "concluida") current.concluidas += 1;
      if (task.status !== "concluida" && task.endDate < today) current.atrasadas += 1;
      grouped.set(task.endDate, current);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).slice(-10);
  }, [tasks, today]);

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70"><span className="text-slate-500 dark:text-emerald-100/70">Projetos</span><strong className="ml-2 text-emerald-800 dark:text-emerald-200">{projectTasks}</strong></article>
        <article className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70"><span className="text-slate-500 dark:text-emerald-100/70">Matérias</span><strong className="ml-2 text-emerald-800 dark:text-emerald-200">{materiaTasks}</strong></article>
        <article className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70"><span className="text-slate-500 dark:text-emerald-100/70">Internas</span><strong className="ml-2 text-emerald-800 dark:text-emerald-200">{internalTasks}</strong></article>
        <article className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70"><span className="text-slate-500 dark:text-emerald-100/70">Taxa de conclusão</span><strong className="ml-2 text-emerald-800 dark:text-emerald-200">{productivityRate}%</strong></article>
      </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <article className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <h3 className="font-semibold text-slate-900 dark:text-white">Tarefas por colaborador</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={byCollaborator}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1fae5" /><XAxis dataKey="nome" tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} /><Tooltip /><Bar dataKey="total" name="Total" fill="#047857" radius={[8, 8, 0, 0]} /><Bar dataKey="concluidas" name="Concluídas" fill="#34d399" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </article>
        <article className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <h3 className="font-semibold text-slate-900 dark:text-white">Concluídas x atrasadas</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={byDate}><XAxis dataKey="data" tick={{ fill: "#64748b", fontSize: 10 }} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} /><Tooltip /><Bar dataKey="concluidas" name="Concluídas" fill="#10b981" radius={[8, 8, 0, 0]} /><Bar dataKey="atrasadas" name="Atrasadas" fill="#ef4444" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </article>
        <article className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <h3 className="font-semibold text-slate-900 dark:text-white">Produtividade mensal</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={monthly}><XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="concluidas" name="Concluídas" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: "#059669" }} /></LineChart></ResponsiveContainer>
          </div>
        </article>
      </div>
    </section>
  );
}

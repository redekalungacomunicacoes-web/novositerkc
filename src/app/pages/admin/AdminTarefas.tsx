import { useMemo, useState } from "react";
import { Calendar } from "./calendar2026/Calendar";
import { ExecutiveDashboard } from "./calendar2026/ExecutiveDashboard";
import { Header } from "./calendar2026/Header";
import { TaskModal } from "./calendar2026/TaskModal";
import { CalendarProvider, useCalendarStore } from "./calendar2026/store";
import { TasksPageShell } from "./calendar2026/TasksShell";
import type { CalendarTask } from "./calendar2026/types";
import { ArrowRight, CheckCircle2, Clock3, Plus, X } from "lucide-react";

const statusLabel = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  revisao: "Em revisão",
  concluida: "Concluída",
  cancelada: "Cancelada",
} as const;

const statusStyle = {
  pendente: "bg-slate-100 text-slate-700",
  em_andamento: "bg-sky-100 text-sky-700",
  revisao: "bg-amber-100 text-amber-800",
  concluida: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-rose-100 text-rose-700",
} as const;

function DayAgenda({ open, onClose, onNewTask, onOpenTask }: { open: boolean; onClose: () => void; onNewTask: () => void; onOpenTask: (task: CalendarTask) => void }) {
  const { selectedDate, tasks, teamMembers } = useCalendarStore();
  const members = useMemo(() => new Map(teamMembers.map((member) => [member.id, member])), [teamMembers]);
  const dayTasks = useMemo(() => tasks.filter((task) => task.date <= selectedDate && task.endDate >= selectedDate), [tasks, selectedDate]);
  if (!open) return null;
  const date = new Date(`${selectedDate}T00:00:00`);
  const title = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-emerald-100 bg-white shadow-2xl dark:border-emerald-800 dark:bg-[#062f28]" onClick={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 border-b border-emerald-100 bg-white/95 p-5 backdrop-blur-xl dark:border-emerald-800 dark:bg-[#062f28]/95">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Agenda do dia</p><h2 className="mt-1 text-xl font-bold capitalize text-slate-950 dark:text-white">{title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/65">{dayTasks.length} {dayTasks.length === 1 ? "tarefa" : "tarefas"}</p></div>
            <button type="button" onClick={onClose} aria-label="Fechar agenda" className="rounded-2xl border border-emerald-100 p-2 text-slate-500 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100"><X size={18}/></button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-emerald-50 p-1 dark:bg-emerald-900/50">
            <button type="button" className="rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-emerald-900 shadow-sm dark:bg-emerald-800 dark:text-white">Tarefas do dia <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] dark:bg-emerald-700">{dayTasks.length}</span></button>
            <button type="button" onClick={onNewTask} className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-white dark:text-emerald-100 dark:hover:bg-emerald-800"><Plus size={15}/> Nova tarefa</button>
          </div>
        </header>
        <div className="space-y-3 p-4">
          {dayTasks.length ? dayTasks.map((task) => {
            const assignee = members.get(task.assigneeId);\n            const creator = task.creatorId ? members.get(task.creatorId) : undefined;\n            const progress = task.checklistTotal ? Math.round(((task.checklistCompleted ?? 0) / task.checklistTotal) * 100) : 0;
            return (
              <button type="button" key={task.id} onClick={() => onOpenTask(task)} className="w-full rounded-3xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/60 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60">
                <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-900 dark:text-white">{task.title}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle[task.status]}`}>{statusLabel[task.status]}</span></div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-emerald-100/65">
                  <span className="flex items-center gap-1"><Clock3 size={13}/>{task.startTime || "Dia todo"}{task.endTime ? ` – ${task.endTime}` : ""}</span>
                  <span className="flex items-center gap-1.5" aria-label={`Criada por ${creator?.name ?? "não identificado"} para ${assignee?.name ?? "não definido"}`}>
                    <span className="flex -space-x-1">
                      <img src={creator?.avatar || "/avatar-placeholder.svg"} alt={creator?.name ? `Criador: ${creator.name}` : "Criador não identificado"} title={creator?.name ? `Criado por ${creator.name}` : "Criador não identificado"} className="h-6 w-6 rounded-full border-2 border-white object-cover dark:border-emerald-950"/>
                    </span>
                    <ArrowRight size={12} className="text-emerald-600"/>
                    <img src={assignee?.avatar || "/avatar-placeholder.svg"} alt={assignee?.name ? `Responsável: ${assignee.name}` : "Responsável não definido"} title={assignee?.name ? `Para ${assignee.name}` : "Responsável não definido"} className="h-6 w-6 rounded-full border-2 border-white object-cover dark:border-emerald-950"/>
                  </span>
                  {task.checklistTotal ? <span className="flex items-center gap-1"><CheckCircle2 size={13}/>{task.checklistCompleted ?? 0}/{task.checklistTotal} · {progress}%</span> : null}
                </div>
                {task.checklistTotal ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-emerald-900"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }}/></div> : null}
              </button>
            );
          }) : <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40"><CalendarIcon/><p className="mt-3 font-semibold text-slate-800 dark:text-white">Nenhuma tarefa neste dia</p><p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/60">Use o botão acima para adicionar a primeira tarefa.</p></div>}
        </div>
      </aside>
    </div>
  );
}

function CalendarIcon() { return <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm dark:bg-emerald-900"><CheckCircle2 size={22}/></div>; }

function AdminTarefasContent() {
  const [openModal, setOpenModal] = useState(false);
  const [openAgenda, setOpenAgenda] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  function createTask() { setOpenAgenda(false); setSelectedTask(null); setOpenModal(true); }
  function openTask(task: CalendarTask) { setOpenAgenda(false); setSelectedTask(task); setOpenModal(true); }

  return (
    <TasksPageShell>
      <Header onNewTask={() => { setSelectedTask(null); setOpenModal(true); }} />
      <ExecutiveDashboard />
      <Calendar onSelectDay={() => setOpenAgenda(true)} onSelectTask={openTask} />
      <DayAgenda open={openAgenda} onClose={() => setOpenAgenda(false)} onNewTask={createTask} onOpenTask={openTask} />
      <TaskModal open={openModal} initialTask={selectedTask} onClose={() => { setOpenModal(false); setSelectedTask(null); }} />
    </TasksPageShell>
  );
}

export function AdminTarefas() {
  return <CalendarProvider><AdminTarefasContent /></CalendarProvider>;
}

import { useMemo, useState } from "react";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";

import { TaskModal } from "./calendar2026/TaskModal";
import { TasksPageShell } from "./calendar2026/TasksShell";
import { CalendarProvider, useCalendarStore } from "./calendar2026/store";
import { priorityLabels, statusLabels } from "./calendar2026/tasksApi";
import { useCurrentMemberQuery, usePermissionQuery, useTaskStatusMutation } from "./calendar2026/useTaskQueries";
import type { CalendarTask, TaskStatus } from "./calendar2026/types";

const columns: TaskStatus[] = ["pendente", "em_andamento", "revisao", "concluida"];
const allowedResponsibleMoves: Partial<Record<TaskStatus, TaskStatus[]>> = {
  pendente: ["em_andamento"],
  em_andamento: ["concluida"],
};

function canMoveTask(task: CalendarTask, targetStatus: TaskStatus, currentMemberId?: string | null, isAdmin?: boolean) {
  if (task.status === targetStatus) return false;
  if (targetStatus === "cancelada") return isAdmin || task.creatorId === currentMemberId;
  if (isAdmin || task.creatorId === currentMemberId) return true;
  if (task.assigneeId === currentMemberId) return allowedResponsibleMoves[task.status]?.includes(targetStatus) ?? false;
  return false;
}

function KanbanCard({ task, onOpen }: { task: CalendarTask; onOpen: (task: CalendarTask) => void }) {
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/task-id", task.id);
      }}
      onClick={() => onOpen(task)}
      className="min-h-[132px] cursor-grab rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm transition active:cursor-grabbing hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 font-semibold text-slate-900 dark:text-white">{task.title}</p>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">{priorityLabels[task.priority]}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-emerald-100/60">{task.description || "Sem descrição."}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-emerald-100/60">
        <span>{new Date(`${task.endDate}T00:00:00`).toLocaleDateString("pt-BR")}</span>
        <span>{task.comments.length} comentários · {task.attachments.length} anexos</span>
      </div>
    </article>
  );
}

function Column({ status, tasks, draggingId, highlighted, onDragOver, onDrop, onOpen }: { status: TaskStatus; tasks: CalendarTask[]; draggingId: string | null; highlighted: boolean; onDragOver: (status: TaskStatus) => void; onDrop: (status: TaskStatus) => void; onOpen: (task: CalendarTask) => void }) {
  return (
    <section
      onDragOver={(event) => { event.preventDefault(); onDragOver(status); }}
      onDragLeave={() => onDragOver(status)}
      onDrop={(event) => { event.preventDefault(); onDrop(status); }}
      className={`min-h-[520px] rounded-3xl border p-4 transition ${highlighted ? "border-emerald-500 bg-emerald-100/80 shadow-lg shadow-emerald-900/10 dark:bg-emerald-900/70" : "border-emerald-100 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/70"}`}
    >
      <h2 className="mb-3 flex items-center justify-between font-semibold text-slate-900 dark:text-white">
        {statusLabels[status]}
        <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs text-white dark:bg-emerald-500 dark:text-emerald-950">{tasks.length}</span>
      </h2>
      <div className="space-y-3">
        {tasks.map((task) => <KanbanCard key={task.id} task={task} onOpen={onOpen} />)}
        {tasks.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-200 p-6 text-center text-xs text-slate-500 dark:border-emerald-800/60 dark:text-emerald-100/60">Arraste cards para esta coluna.</div> : null}
        {highlighted && draggingId ? <div className="rounded-2xl border border-emerald-400 bg-white/70 p-4 text-center text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">Solte para mover para {statusLabels[status]}</div> : null}
      </div>
    </section>
  );
}

function KanbanBoard() {
  const { tasks } = useCalendarStore();
  const statusMutation = useTaskStatusMutation();
  const currentMember = useCurrentMemberQuery();
  const permission = usePermissionQuery();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const currentMemberId = currentMember.data?.id ?? currentMember.data?.user_id ?? null;
  const isAdmin = permission.data === "admin";

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  async function handleDrop(status: TaskStatus) {
    const taskId = draggingId;
    setDraggingId(null);
    setTargetStatus(null);
    if (!taskId) return;
    const task = taskById.get(taskId);
    if (!task) return;
    if (!canMoveTask(task, status, currentMemberId, isAdmin)) {
      setFeedback("Movimentação não permitida para seu perfil.");
      setTimeout(() => setFeedback(null), 2600);
      return;
    }
    await statusMutation.mutateAsync({ taskId, status });
    setFeedback(`Tarefa movida para ${statusLabels[status]}.`);
    setTimeout(() => setFeedback(null), 2600);
  }

  return (
    <TasksPageShell>
      <div>
        <div className="mb-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Tarefas</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">Kanban de tarefas</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/70">Clique para abrir a tarefa ou arraste para atualizar o status em tempo real.</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">
              <p className="flex items-center gap-2 font-semibold"><Sparkles size={14} /> Regras ativas</p>
              <p className="mt-1">Responsáveis avançam etapas autorizadas; criadores e administradores controlam o fluxo completo.</p>
            </div>
          </div>
          {feedback ? <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-800 dark:text-emerald-50"><CheckCircle2 size={14} /> {feedback}</p> : null}
          {statusMutation.error ? <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700"><Lock size={14} /> {statusMutation.error.message}</p> : null}
        </div>
        <div onDragStart={(event) => setDraggingId(event.dataTransfer.getData("text/task-id"))}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((status) => (
              <Column key={status} status={status} draggingId={draggingId} highlighted={targetStatus === status} onDragOver={setTargetStatus} onDrop={(dropStatus) => void handleDrop(dropStatus)} onOpen={setSelectedTask} tasks={tasks.filter((task) => task.status === status)} />
            ))}
          </div>
        </div>
        <TaskModal open={Boolean(selectedTask)} onClose={() => setSelectedTask(null)} initialTask={selectedTask} />
      </div>
    </TasksPageShell>
  );
}

export function AdminTarefasKanban() {
  return (
    <CalendarProvider>
      <KanbanBoard />
    </CalendarProvider>
  );
}

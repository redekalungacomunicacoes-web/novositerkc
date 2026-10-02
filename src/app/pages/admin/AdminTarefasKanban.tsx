import { useMemo, useState } from "react";
import { CheckCircle2, Lock, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";

import { TaskModal } from "./calendar2026/TaskModal";
import { TaskDeleteDialog } from "./calendar2026/TaskDeleteDialog";
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

function KanbanCard({ task, assigneeName, onOpen }: { task: CalendarTask; assigneeName: string; onOpen: (task: CalendarTask) => void }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/task-id", task.id);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button,[role=menuitem],[data-slot=alert-dialog-content]")) return;
        onOpen(task);
      }}
      className="min-h-[132px] cursor-grab rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm transition active:cursor-grabbing hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 font-semibold text-slate-900 dark:text-white">{task.title}</p>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">{priorityLabels[task.priority]}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" aria-label={`Ações de ${task.title}`} onClick={(event) => event.stopPropagation()} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-800"><MoreVertical size={18} /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-emerald-950" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onSelect={() => onOpen(task)}><Pencil /> Editar</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteDialogOpen(true)}><Trash2 /> Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-emerald-100/60">{task.description || "Sem descrição."}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-emerald-100/60">
        <span>Prazo {new Date(`${task.endDate}T00:00:00`).toLocaleDateString("pt-BR")}</span>
        <span className="font-medium">{assigneeName}</span>
      </div>
      <TaskDeleteDialog taskId={task.id} open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </article>
  );
}

function Column({ status, tasks, teamMembers, draggingId, highlighted, onDragOver, onDrop, onOpen }: { status: TaskStatus; tasks: CalendarTask[]; teamMembers: Array<{ id: string; name: string }>; draggingId: string | null; highlighted: boolean; onDragOver: (status: TaskStatus) => void; onDrop: (status: TaskStatus) => void; onOpen: (task: CalendarTask) => void }) {
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
        {tasks.map((task) => <KanbanCard key={task.id} task={task} assigneeName={teamMembers.find((member) => member.id === task.assigneeId)?.name || "Equipe"} onOpen={onOpen} />)}
        {tasks.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-200 p-6 text-center text-xs text-slate-500 dark:border-emerald-800/60 dark:text-emerald-100/60">Arraste cards para esta coluna.</div> : null}
        {highlighted && draggingId ? <div className="rounded-2xl border border-emerald-400 bg-white/70 p-4 text-center text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">Solte para mover para {statusLabels[status]}</div> : null}
      </div>
    </section>
  );
}

function KanbanBoard() {
  const { tasks, filters, setSearch, setPriority, setAssignee, teamMembers } = useCalendarStore();
  const statusMutation = useTaskStatusMutation();
  const currentMember = useCurrentMemberQuery();
  const permission = usePermissionQuery();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<TaskStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const currentMemberId = currentMember.data?.id ?? null;
  const isAdmin = permission.data === "admin";

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) ?? null : null;

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
    try {
      await statusMutation.mutateAsync({ taskId, status, oldStatus: task.status });
      setFeedback(`Tarefa movida para ${statusLabels[status]}.`);
      setTimeout(() => setFeedback(null), 2600);
    } catch {
      setFeedback(null);
    }
  }

  return (
    <TasksPageShell>
      <div>
        <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Fluxo de trabalho</p><h1 className="mt-1 text-2xl font-bold">Tarefas</h1><p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/70">Acompanhe o trabalho da equipe por etapa. Abra um card para detalhes ou arraste para avançar.</p></div>
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Plus size={17}/> Nova tarefa</button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_220px]">
            <label className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input value={filters.search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar tarefa..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-900/50"/></label>
            <select value={filters.priority} onChange={(e)=>setPriority(e.target.value as any)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/50"><option value="all">Todas prioridades</option><option value="urgente">Urgente</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select>
            <select value={filters.assignee} onChange={(e)=>setAssignee(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/50"><option value="all">Toda a equipe</option>{teamMembers.map((m)=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
          {feedback ? <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 size={14}/>{feedback}</p> : null}
          {statusMutation.error ? <p className="inline-flex items-center gap-2 text-sm font-medium text-rose-700"><Lock size={14}/>{statusMutation.error.message}</p> : null}
        </div>
        <div onDragStart={(event) => setDraggingId(event.dataTransfer.getData("text/task-id"))}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((status) => (
              <Column teamMembers={teamMembers} key={status} status={status} draggingId={draggingId} highlighted={targetStatus === status} onDragOver={setTargetStatus} onDrop={(dropStatus) => void handleDrop(dropStatus)} onOpen={(task) => setSelectedTaskId(task.id)} tasks={tasks.filter((task) => task.status === status)} />
            ))}
          </div>
        </div>
        <TaskModal open={Boolean(selectedTask)} onClose={() => setSelectedTaskId(null)} initialTask={selectedTask} />
        <TaskModal open={createOpen} onClose={() => setCreateOpen(false)} />
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

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarProvider, useCalendarStore } from "./calendar2026/store";
import { statusLabels } from "./calendar2026/tasksApi";
import { useTaskStatusMutation } from "./calendar2026/useTaskQueries";
import type { CalendarTask, TaskStatus } from "./calendar2026/types";

const columns: TaskStatus[] = ["pendente", "em_andamento", "revisao", "concluida"];

function KanbanCard({ task }: { task: CalendarTask }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id, data: { status: task.status } });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
    <p className="font-medium text-white">{task.title}</p><p className="mt-1 text-xs text-slate-400">{task.endDate}</p>
  </article>;
}

function Column({ status, tasks }: { status: TaskStatus; tasks: CalendarTask[] }) {
  return <section id={status} className="min-h-96 rounded-3xl border border-white/10 bg-slate-900/70 p-4"><h2 className="mb-3 font-semibold text-white">{statusLabels[status]} <span className="text-xs text-slate-400">{tasks.length}</span></h2><SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{tasks.map((task) => <KanbanCard key={task.id} task={task} />)}</div></SortableContext></section>;
}

function KanbanBoard() {
  const { tasks } = useCalendarStore();
  const statusMutation = useTaskStatusMutation();
  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const targetStatus = String(event.over?.id ?? "") as TaskStatus;
    if (columns.includes(targetStatus)) void statusMutation.mutateAsync({ taskId, status: targetStatus });
  }
  return <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6"><div className="mx-auto max-w-[1700px]"><h1 className="mb-4 text-xl font-semibold">Kanban de tarefas</h1><DndContext onDragEnd={handleDragEnd}><div className="grid gap-4 md:grid-cols-4">{columns.map((status) => <Column key={status} status={status} tasks={tasks.filter((task) => task.status === status)} />)}</div></DndContext></div></div>;
}

export function AdminTarefasKanban() {
  return <CalendarProvider><KanbanBoard /></CalendarProvider>;
}

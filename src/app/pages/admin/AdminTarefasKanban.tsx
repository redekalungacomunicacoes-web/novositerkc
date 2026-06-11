import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Sidebar } from "./calendar2026/Sidebar";
import { CalendarProvider, useCalendarStore } from "./calendar2026/store";
import { statusLabels } from "./calendar2026/tasksApi";
import { useTaskStatusMutation } from "./calendar2026/useTaskQueries";
import type { CalendarTask, TaskStatus } from "./calendar2026/types";

const columns: TaskStatus[] = ["pendente", "em_andamento", "revisao", "concluida"];

function KanbanCard({ task }: { task: CalendarTask }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm transition-colors hover:border-sky-500/30 hover:bg-sky-500/10"
    >
      <p className="font-medium text-white">{task.title}</p>
      <p className="mt-1 text-xs text-slate-400">{task.endDate}</p>
    </article>
  );
}

function Column({ status, tasks }: { status: TaskStatus; tasks: CalendarTask[] }) {
  return (
    <section id={status} className="min-h-96 rounded-3xl border border-white/10 bg-slate-900 p-4">
      <h2 className="mb-3 flex items-center justify-between font-semibold text-white">
        {statusLabels[status]}
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
          {tasks.length}
        </span>
      </h2>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function KanbanBoard() {
  const { tasks } = useCalendarStore();
  const statusMutation = useTaskStatusMutation();

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const targetStatus = String(event.over?.id ?? "") as TaskStatus;
    if (columns.includes(targetStatus)) {
      void statusMutation.mutateAsync({ taskId, status: targetStatus });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <main>
          <div className="mb-4 rounded-3xl border border-white/10 bg-slate-900 p-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Tarefas</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Kanban de tarefas</h1>
            <p className="mt-1 text-sm text-slate-300">Acompanhe o andamento operacional por status.</p>
          </div>
          <DndContext onDragEnd={handleDragEnd}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {columns.map((status) => (
                <Column key={status} status={status} tasks={tasks.filter((task) => task.status === status)} />
              ))}
            </div>
          </DndContext>
        </main>
      </div>
    </div>
  );
}

export function AdminTarefasKanban() {
  return (
    <CalendarProvider>
      <KanbanBoard />
    </CalendarProvider>
  );
}

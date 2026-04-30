import { useMemo, useState } from "react";
import { Bell, CalendarClock, Plus } from "lucide-react";
import CalendarPro from "./CalendarPro";

function EmptyState({ title, subtitle }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500"><p className="font-medium text-slate-700">{title}</p><p>{subtitle}</p></div>;
}

export default function Dashboard({ tasks = [], notifications = [], loading = false, onCreateTask, onSaveTask, onMonthChange }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [drawerTask, setDrawerTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const tasksByDay = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter((task) => task.data_tarefa === selectedDate);
  }, [tasks, selectedDate]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Calendário Administrativo</h1>
          <p className="text-sm text-slate-500">Planejamento com visual moderno, foco e produtividade.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Nova tarefa</button>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <CalendarPro
            tasks={tasks}
            loading={loading}
            onMonthChange={onMonthChange}
            onDateClick={(arg) => setSelectedDate(arg.dateStr)}
            onEventClick={(arg) => setDrawerTask(arg.event.id)}
            onEventHover={() => {}}
          />
        </div>

        <aside className="space-y-4 xl:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><Bell className="h-4 w-4" />Notificações</h2>
            {notifications.length === 0 ? <EmptyState title="Sem notificações" subtitle="Tudo em dia por aqui." /> : <ul className="space-y-2 text-sm">{notifications.slice(0, 5).map((item) => <li key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">{item.titulo}</li>)}</ul>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarClock className="h-4 w-4" />Tarefas do dia</h2>
            {!selectedDate ? <EmptyState title="Selecione um dia" subtitle="Clique em uma data para ver os detalhes." /> : tasksByDay.length === 0 ? <EmptyState title="Dia livre" subtitle="Nenhuma tarefa cadastrada para esta data." /> : <ul className="space-y-2">{tasksByDay.map((task) => <li key={task.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><p className="font-medium text-slate-800">{task.titulo}</p><p className="text-xs text-slate-500">{task.status}</p></li>)}</ul>}
          </div>
        </aside>
      </div>

      {selectedDate ? <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-slate-200 bg-white p-5 shadow-2xl"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("pt-BR")}</h3><button onClick={() => setSelectedDate(null)} className="text-sm text-slate-500">Fechar</button></div>{tasksByDay.length === 0 ? <EmptyState title="Sem tarefas" subtitle="Aproveite para planejar o dia." /> : <ul className="space-y-2">{tasksByDay.map((task) => <li key={task.id} className="rounded-lg border border-slate-200 p-3"><p className="font-medium">{task.titulo}</p><p className="text-xs text-slate-500">{task.descricao || "Sem descrição"}</p></li>)}</ul>}</div> : null}

      {isModalOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><h3 className="mb-3 text-lg font-semibold">Nova tarefa</h3><p className="mb-4 text-sm text-slate-500">Formulário pronto para integração com Supabase.</p><div className="flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button onClick={() => { onCreateTask?.(); onSaveTask?.(); setIsModalOpen(false); }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Salvar</button></div></div></div> : null}

      {drawerTask ? <div className="hidden">{drawerTask}</div> : null}
    </section>
  );
}

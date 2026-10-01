import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useCalendarStore } from "./store";
import type { CalendarTask, TaskPriority } from "./types";

const priorityStyles: Record<TaskPriority, string> = {
  urgente: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-100",
  alta: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-100",
  media: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100",
  baixa: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100",
};

const priorityDot: Record<TaskPriority, string> = {
  urgente: "bg-rose-500",
  alta: "bg-rose-500",
  media: "bg-amber-400",
  baixa: "bg-emerald-500",
};

const viewLabels = { month: "Mês", week: "Semana", day: "Dia" } as const;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function taskTime(task: CalendarTask) {
  return task.startTime ? `${task.startTime}${task.endTime ? `–${task.endTime}` : ""}` : "Dia todo";
}

export function Calendar({ onSelectDay }: { onSelectDay: () => void }) {
  const { month, setMonth, setSelectedDate, selectedDate, tasks, view, setView, isLoading, teamMembers } = useCalendarStore();
  const monthLabel = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const offset = first.getDay();
    const cellCount = Math.ceil((offset + count) / 7) * 7;
    return Array.from({ length: cellCount }, (_, i) => {
      const day = i - offset + 1;
      return day < 1 || day > count ? null : new Date(first.getFullYear(), first.getMonth(), day);
    });
  }, [month]);

  const selected = selectedDate || dateKey(new Date());
  const selectedDateObject = new Date(`${selected}T00:00:00`);
  const weekDays = useMemo(() => {
    const start = new Date(selectedDateObject);
    start.setDate(selectedDateObject.getDate() - selectedDateObject.getDay());
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [selected]);

  const visibleDays = view === "month" ? days : view === "week" ? weekDays : [selectedDateObject];
  const columnsClass = view === "month" ? "grid-cols-7" : view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1";

  function getAssignee(task: CalendarTask) {
    return teamMembers.find((member) => member.id === task.assigneeId);
  }

  function openDay(key: string) {
    setSelectedDate(key);
    onSelectDay();
  }

  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70 md:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-2xl border border-emerald-100 p-2 text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60"><ChevronLeft /></button>
          <h2 className="min-w-48 text-lg font-bold capitalize text-slate-950 dark:text-white">{monthLabel}</h2>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-2xl border border-emerald-100 p-2 text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60"><ChevronRight /></button>
          <button type="button" onClick={() => { const today = new Date(); setMonth(today); setSelectedDate(dateKey(today)); }} className="ml-2 rounded-2xl border border-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60">Hoje</button>
        </div>
        <div className="flex gap-1 rounded-2xl bg-emerald-50 p-1 text-sm dark:bg-emerald-900/60">
          {(["month", "week", "day"] as const).map((value) => <button key={value} type="button" onClick={() => setView(value)} className={`rounded-xl px-4 py-2 font-semibold transition ${view === value ? "bg-white text-emerald-900 shadow-sm dark:bg-emerald-700 dark:text-white" : "text-emerald-700 hover:text-emerald-950 dark:text-emerald-100/70 dark:hover:text-white"}`}>{viewLabels[value]}</button>)}
        </div>
      </div>

      {view !== "day" ? <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:gap-2 sm:text-xs md:text-left md:tracking-[0.16em] md:text-slate-400 dark:text-emerald-100/60 md:dark:text-emerald-100/50">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <p key={day} className="px-2">{day}</p>)}
      </div> : null}
      <div className={`mt-2 grid gap-1 sm:gap-2 ${columnsClass}`}>
        {visibleDays.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} aria-hidden="true" className="min-h-[72px] rounded-2xl md:min-h-40" />;
          const key = dateKey(day);
          const dayTasks = tasks.filter((task) => task.date <= key && task.endDate >= key);
          const isToday = key === dateKey(new Date());
          const isSelected = key === selected;
          return (
            <motion.button
              whileHover={{ y: -2 }}
              key={key}
              type="button"
              onClick={() => openDay(key)}
              className={`min-h-[72px] rounded-2xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:min-h-40 md:rounded-3xl md:p-3 ${isSelected ? "border-emerald-500 bg-emerald-50/80 shadow-lg shadow-emerald-900/10 dark:bg-emerald-900/60" : "border-emerald-100 bg-slate-50/80 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/50 dark:bg-[#07352d]/70 dark:hover:bg-emerald-900/50"} ${view === "day" ? "min-h-[520px]" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold md:h-8 md:w-8 md:rounded-2xl md:text-sm ${isToday ? "bg-emerald-700 text-white" : "text-slate-700 dark:text-emerald-50"}`}>{day.getDate()}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-sm dark:bg-emerald-950 dark:text-emerald-100">{dayTasks.length}</span>
              </div>
              {view === "month" ? <div className="mt-2 flex min-h-3 items-center gap-1 md:hidden" aria-label={`${dayTasks.length} tarefas`}>{dayTasks.slice(0, 3).map((task) => <span key={task.id} title={task.title} className={`h-1.5 w-1.5 rounded-full ${priorityDot[task.priority]}`} />)}{dayTasks.length > 3 ? <span className="text-[9px] font-semibold text-slate-500">+{dayTasks.length - 3}</span> : null}</div> : null}
              <div className={`${view === "month" ? "hidden md:block" : "space-y-2"} ${view === "day" ? "grid gap-2 md:grid-cols-2 xl:grid-cols-3" : ""}`}>
                {dayTasks.slice(0, view === "month" ? 4 : 12).map((task) => {
                  const assignee = getAssignee(task);
                  return (
                    <div key={task.id} className={`group rounded-2xl border px-2.5 py-2 text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${priorityStyles[task.priority]}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot[task.priority]}`} />
                        <span className="truncate font-semibold">{task.title}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] opacity-80">
                        <span>{taskTime(task)}</span>
                        {assignee ? <img src={assignee.avatar} alt={assignee.name} title={assignee.name} className="h-5 w-5 rounded-full object-cover ring-2 ring-white dark:ring-emerald-950" /> : null}
                      </div>
                    </div>
                  );
                })}
                {dayTasks.length > (view === "month" ? 4 : 12) ? <p className="rounded-xl bg-white/70 px-2 py-1 text-xs font-medium text-slate-500 dark:bg-emerald-950/50 dark:text-emerald-100/70">+{dayTasks.length - (view === "month" ? 4 : 12)} tarefas</p> : null}
              </div>
            </motion.button>
          );
        })}
      </div>
      {isLoading ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100">Carregando tarefas...</p> : null}
    </section>
  );
}

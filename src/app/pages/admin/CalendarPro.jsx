import { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { Skeleton } from "@/app/components/ui/skeleton";

const PRIORITY_STYLES = {
  urgente: "border-l-4 border-rose-600 bg-rose-50 text-rose-900",
  alta: "border-l-4 border-orange-500 bg-orange-50 text-orange-900",
  media: "border-l-4 border-blue-500 bg-blue-50 text-blue-900",
  baixa: "border-l-4 border-emerald-500 bg-emerald-50 text-emerald-900",
};

export function renderTaskEventContent(arg) {
  const { prioridade = "media", hora_inicio, status } = arg.event.extendedProps;
  return (
    <div className={`rounded-md px-1.5 py-1 text-[11px] leading-tight shadow-sm ${PRIORITY_STYLES[prioridade] ?? PRIORITY_STYLES.media}`}>
      <p className="truncate font-semibold">{arg.event.title}</p>
      <p className="truncate opacity-80">{hora_inicio ? `${hora_inicio} • ` : ""}{status}</p>
    </div>
  );
}

export default function CalendarPro({ tasks, loading, onDateClick, onEventClick, onEventHover, onMonthChange }) {
  const events = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: task.titulo,
        date: task.data_tarefa,
        extendedProps: {
          prioridade: task.prioridade,
          status: task.status,
          hora_inicio: task.hora_inicio,
          hora_fim: task.hora_fim,
          assigned_to: task.assigned_to,
          direcionamento: task.direcionamento ?? [],
          descricao: task.descricao,
        },
      })),
    [tasks],
  );

  if (loading) {
    return <Skeleton className="h-[680px] w-full rounded-2xl" />;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={ptBrLocale}
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth" }}
        buttonText={{ today: "Hoje" }}
        events={events}
        eventContent={renderTaskEventContent}
        dateClick={onDateClick}
        eventClick={onEventClick}
        eventMouseEnter={onEventHover}
        dayMaxEvents={3}
        moreLinkText={(n) => `+${n} mais`}
        fixedWeekCount={false}
        datesSet={onMonthChange}
        height="auto"
      />
    </div>
  );
}

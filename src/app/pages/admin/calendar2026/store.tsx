import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CalendarTask, TaskFilters, TaskPriority, TaskStatus, TeamMember, ViewMode } from "./types";
import { useTasksQuery, useTeamMembersQuery } from "./useTaskQueries";

interface CalendarCtx {
  selectedTeam: string;
  selectedDate: string;
  month: Date;
  view: ViewMode;
  tasks: CalendarTask[];
  teamMembers: TeamMember[];
  isLoading: boolean;
  filters: TaskFilters;
  setView: (v: ViewMode) => void;
  setMonth: (d: Date) => void;
  setSelectedDate: (d: string) => void;
  setTeam: (id: string) => void;
  setSearch: (s: string) => void;
  setStatus: (s: TaskStatus | "all") => void;
  setPriority: (p: TaskPriority | "all") => void;
  setAssignee: (id: string | "all") => void;
  setPeriod: (start: string, end: string) => void;
}
const Ctx = createContext<CalendarCtx | null>(null);

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: dateKey(start), end: dateKey(end) };
}

function viewBounds(view: ViewMode, selectedDate: string, month: Date) {
  if (view === "month") return monthBounds(month);
  const selected = new Date(`${selectedDate}T00:00:00`);
  const start = new Date(selected);
  const end = new Date(selected);
  if (view === "week") {
    start.setDate(selected.getDate() - selected.getDay());
    end.setDate(selected.getDate() + (6 - selected.getDay()));
  }
  return { start: dateKey(start), end: dateKey(end) };
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [selectedTeam, setTeam] = useState("equipe");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const bounds = useMemo(() => monthBounds(month), [month]);
  const [filters, setFilters] = useState<TaskFilters>({ status: "all", priority: "all", assignee: "all", periodStart: bounds.start, periodEnd: bounds.end, search: "" });
  const effectiveStart = filters.periodStart || bounds.start;
  const effectiveEnd = filters.periodEnd || bounds.end;
  const tasksQuery = useTasksQuery(effectiveStart, effectiveEnd, filters.assignee);
  const membersQuery = useTeamMembersQuery();

  function updateMonth(nextMonth: Date) {
    setMonth(nextMonth);
    const selectedDay = Number(selectedDate.slice(-2)) || 1;
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextSelectedDate = dateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selectedDay, lastDay)));
    setSelectedDate(nextSelectedDate);
    const nextBounds = viewBounds(view, nextSelectedDate, nextMonth);
    setFilters((current) => ({ ...current, periodStart: nextBounds.start, periodEnd: nextBounds.end }));
  }

  function updateView(nextView: ViewMode) {
    setView(nextView);
    const nextBounds = viewBounds(nextView, selectedDate, month);
    setFilters((current) => ({ ...current, periodStart: nextBounds.start, periodEnd: nextBounds.end }));
  }

  function updateSelectedDate(nextDate: string) {
    setSelectedDate(nextDate);
    if (view !== "month") {
      const nextBounds = viewBounds(view, nextDate, month);
      setFilters((current) => ({ ...current, periodStart: nextBounds.start, periodEnd: nextBounds.end }));
    }
  }

  const tasks = useMemo(() => (tasksQuery.data ?? []).filter((task) => {
    const matchesStatus = filters.status === "all" || task.status === filters.status;
    const matchesPriority = filters.priority === "all" || task.priority === filters.priority;
    const search = filters.search.trim().toLowerCase();
    const matchesSearch = !search || task.title.toLowerCase().includes(search) || task.description.toLowerCase().includes(search);
    return matchesStatus && matchesPriority && matchesSearch;
  }), [tasksQuery.data, filters]);

  return <Ctx.Provider value={{ selectedTeam, selectedDate, month, view, tasks, teamMembers: membersQuery.data ?? [], isLoading: tasksQuery.isLoading || membersQuery.isLoading, filters, setView: updateView, setMonth: updateMonth, setSelectedDate: updateSelectedDate, setTeam, setSearch: (search) => setFilters((f) => ({ ...f, search })), setStatus: (status) => setFilters((f) => ({ ...f, status })), setPriority: (priority) => setFilters((f) => ({ ...f, priority })), setAssignee: (assignee) => setFilters((f) => ({ ...f, assignee })), setPeriod: (periodStart, periodEnd) => setFilters((f) => ({ ...f, periodStart, periodEnd })) }}>{tasksQuery.error || membersQuery.error ? <div role="alert" className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Não foi possível carregar as tarefas: {(tasksQuery.error || membersQuery.error)?.message} <button type="button" className="ml-2 underline" onClick={() => { void tasksQuery.refetch(); void membersQuery.refetch(); }}>Tentar novamente</button></div> : null}{children}</Ctx.Provider>;
}

export function useCalendarStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCalendarStore deve ser usado no CalendarProvider");
  return ctx;
}

export const sharedData = { teams: [{ id: "equipe", name: "Equipe" }], teamMembers: [], notifications: [] };

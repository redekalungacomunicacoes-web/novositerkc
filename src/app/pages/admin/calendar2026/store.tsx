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
    const nextBounds = monthBounds(nextMonth);
    const selectedDay = Number(selectedDate.slice(-2)) || 1;
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    setSelectedDate(dateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selectedDay, lastDay))));
    setFilters((current) => ({ ...current, periodStart: nextBounds.start, periodEnd: nextBounds.end }));
  }

  const tasks = useMemo(() => (tasksQuery.data ?? []).filter((task) => {
    const matchesStatus = filters.status === "all" || task.status === filters.status;
    const matchesPriority = filters.priority === "all" || task.priority === filters.priority;
    const search = filters.search.trim().toLowerCase();
    const matchesSearch = !search || task.title.toLowerCase().includes(search) || task.description.toLowerCase().includes(search);
    return matchesStatus && matchesPriority && matchesSearch;
  }), [tasksQuery.data, filters]);

  return <Ctx.Provider value={{ selectedTeam, selectedDate, month, view, tasks, teamMembers: membersQuery.data ?? [], isLoading: tasksQuery.isLoading || membersQuery.isLoading, filters, setView, setMonth: updateMonth, setSelectedDate, setTeam, setSearch: (search) => setFilters((f) => ({ ...f, search })), setStatus: (status) => setFilters((f) => ({ ...f, status })), setPriority: (priority) => setFilters((f) => ({ ...f, priority })), setAssignee: (assignee) => setFilters((f) => ({ ...f, assignee })), setPeriod: (periodStart, periodEnd) => setFilters((f) => ({ ...f, periodStart, periodEnd })) }}>{children}</Ctx.Provider>;
}

export function useCalendarStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCalendarStore deve ser usado no CalendarProvider");
  return ctx;
}

export const sharedData = { teams: [{ id: "equipe", name: "Equipe" }], teamMembers: [], notifications: [] };

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

function monthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [selectedTeam, setTeam] = useState("equipe");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const bounds = useMemo(() => monthBounds(month), [month]);
  const [filters, setFilters] = useState<TaskFilters>({ status: "all", priority: "all", assignee: "all", periodStart: bounds.start, periodEnd: bounds.end, search: "" });
  const effectiveStart = filters.periodStart || bounds.start;
  const effectiveEnd = filters.periodEnd || bounds.end;
  const tasksQuery = useTasksQuery(effectiveStart, effectiveEnd, filters.assignee);
  const membersQuery = useTeamMembersQuery();

  const tasks = useMemo(() => (tasksQuery.data ?? []).filter((task) => {
    const matchesStatus = filters.status === "all" || task.status === filters.status;
    const matchesPriority = filters.priority === "all" || task.priority === filters.priority;
    const search = filters.search.trim().toLowerCase();
    const matchesSearch = !search || task.title.toLowerCase().includes(search) || task.description.toLowerCase().includes(search);
    return matchesStatus && matchesPriority && matchesSearch;
  }), [tasksQuery.data, filters]);

  return <Ctx.Provider value={{ selectedTeam, selectedDate, month, view, tasks, teamMembers: membersQuery.data ?? [], isLoading: tasksQuery.isLoading || membersQuery.isLoading, filters, setView, setMonth, setSelectedDate, setTeam, setSearch: (search) => setFilters((f) => ({ ...f, search })), setStatus: (status) => setFilters((f) => ({ ...f, status })), setPriority: (priority) => setFilters((f) => ({ ...f, priority })), setAssignee: (assignee) => setFilters((f) => ({ ...f, assignee })), setPeriod: (periodStart, periodEnd) => setFilters((f) => ({ ...f, periodStart, periodEnd })) }}>{children}</Ctx.Provider>;
}

export function useCalendarStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCalendarStore deve ser usado no CalendarProvider");
  return ctx;
}

export const sharedData = { teams: [{ id: "equipe", name: "Equipe" }], teamMembers: [], notifications: [] };

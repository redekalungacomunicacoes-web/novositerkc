import { createContext, useContext, useState, type ReactNode } from "react";
import { notifications as mockNotifications, tasks as mockTasks, teamMembers, teams } from "./mockData";
import type { CalendarTask, TaskPriority, TaskStatus, ViewMode } from "./types";

interface CalendarCtx {
  selectedTeam: string;
  selectedDate: string;
  month: Date;
  view: ViewMode;
  tasks: CalendarTask[];
  filters: { status: TaskStatus | "all"; priority: TaskPriority | "all"; search: string };
  setView: (v: ViewMode) => void;
  setMonth: (d: Date) => void;
  setSelectedDate: (d: string) => void;
  setTeam: (id: string) => void;
  setSearch: (s: string) => void;
  setStatus: (s: TaskStatus | "all") => void;
  setPriority: (p: TaskPriority | "all") => void;
}
const Ctx = createContext<CalendarCtx | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [selectedTeam, setTeam] = useState(teams[0].id);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [tasks] = useState<CalendarTask[]>(mockTasks);
  const [filters, setFilters] = useState({ status: "all" as TaskStatus | "all", priority: "all" as TaskPriority | "all", search: "" });
  return <Ctx.Provider value={{ selectedTeam, selectedDate, month, view, tasks, filters, setView, setMonth, setSelectedDate, setTeam, setSearch: (search) => setFilters((f) => ({ ...f, search })), setStatus: (status) => setFilters((f) => ({ ...f, status })), setPriority: (priority) => setFilters((f) => ({ ...f, priority })) }}>{children}</Ctx.Provider>;
}

export function useCalendarStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCalendarStore deve ser usado no CalendarProvider");
  return ctx;
}

export const sharedData = { teams, teamMembers, notifications: mockNotifications };

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter, ListChecks } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { getCurrentUserRoles } from "@/lib/rbac";

type RoleName = "admin_alfa" | "admin" | "editor" | "autor" | "financeiro";
type TaskScope = "mine" | "all";

type TaskRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  status: string | null;
  prioridade: string | null;
  prazo: string | null;
  created_at: string;
};

type TeamMember = {
  id: string;
  nome: string;
  user_id: string | null;
};

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function normalizeDateOnly(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parsePrazoToDate(value: string | null) {
  if (!value) return null;
  const normalized = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(normalized.getTime())) return null;
  return normalizeDateOnly(normalized);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTaskCompleted(status: string | null) {
  const normalized = `${status ?? ""}`.trim().toLowerCase();
  return ["concluida", "concluído", "concluido", "done", "completed", "finalizada", "finalizado"].includes(normalized);
}

function getMonthLabel(monthDate: Date) {
  return monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function getUrgencyLabel(daysDiff: number) {
  if (daysDiff < 0) return `Atrasada há ${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? "dia" : "dias"}`;
  if (daysDiff === 0) return "Vence hoje";
  if (daysDiff === 1) return "Vence amanhã";
  return `Vence em ${daysDiff} dias`;
}

function getUrgencyClass(daysDiff: number) {
  if (daysDiff < 0) return "bg-red-50 text-red-700 border-red-200";
  if (daysDiff === 0) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

function canViewAllTasks(roles: RoleName[]) {
  return roles.includes("admin") || roles.includes("admin_alfa");
}

export function AdminTarefas() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => normalizeDateOnly(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [selectedDate, setSelectedDate] = useState(() => normalizeDateOnly(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [scope, setScope] = useState<TaskScope>("mine");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      const [{ data: authData }, rolesRes, tasksRes, teamRes] = await Promise.all([
        supabase.auth.getSession(),
        getCurrentUserRoles(),
        supabase
          .from("tarefas")
          .select("id,titulo,descricao,responsavel_id,status,prioridade,prazo,created_at")
          .order("prazo", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("equipe")
          .select("id,nome,user_id")
          .eq("ativo", true)
          .order("nome", { ascending: true }),
      ]);

      const userId = authData.session?.user.id ?? null;
      setCurrentUserId(userId);

      if (rolesRes.error) {
        setError(rolesRes.error);
      } else {
        const normalizedRoles = [...new Set((rolesRes.roles || []).map((role) => role.trim().toLowerCase()))] as RoleName[];
        setRoles(normalizedRoles);
      }

      if (tasksRes.error) {
        setError(tasksRes.error.message);
      } else {
        setTasks((tasksRes.data || []) as TaskRow[]);
      }

      if (teamRes.error) {
        setError(teamRes.error.message);
      } else {
        setTeamMembers((teamRes.data || []) as TeamMember[]);
      }

      setLoading(false);
    }

    void loadData();
  }, []);

  const teamByUserId = useMemo(() => {
    return new Map(teamMembers.filter((member) => member.user_id).map((member) => [member.user_id as string, member.nome]));
  }, [teamMembers]);

  const isAdminView = canViewAllTasks(roles);

  const visibleTasks = useMemo(() => {
    let filtered = [...tasks];

    if (scope === "mine" && currentUserId) {
      filtered = filtered.filter((task) => task.responsavel_id === currentUserId);
    }

    if (scope === "all" && selectedResponsible !== "all") {
      filtered = filtered.filter((task) => task.responsavel_id === selectedResponsible);
    }

    return filtered;
  }, [tasks, scope, currentUserId, selectedResponsible]);

  const tasksWithDeadline = useMemo(() => {
    return visibleTasks
      .map((task) => ({
        ...task,
        prazoDate: parsePrazoToDate(task.prazo),
      }))
      .filter((task) => task.prazoDate !== null)
      .sort((a, b) => (a.prazoDate as Date).getTime() - (b.prazoDate as Date).getTime());
  }, [visibleTasks]);

  const tasksPerDay = useMemo(() => {
    const map = new Map<string, typeof tasksWithDeadline>();

    for (const task of tasksWithDeadline) {
      const key = toDateKey(task.prazoDate as Date);
      map.set(key, [...(map.get(key) || []), task]);
    }

    return map;
  }, [tasksWithDeadline]);

  const selectedDayTasks = useMemo(() => {
    return tasksPerDay.get(toDateKey(selectedDate)) || [];
  }, [tasksPerDay, selectedDate]);

  const today = normalizeDateOnly(new Date());

  const tasksDueToday = useMemo(
    () => tasksWithDeadline.filter((task) => !isTaskCompleted(task.status) && toDateKey(task.prazoDate as Date) === toDateKey(today)),
    [tasksWithDeadline, today],
  );

  const tasksNext7Days = useMemo(() => {
    return tasksWithDeadline.filter((task) => {
      if (isTaskCompleted(task.status)) return false;
      const diff = Math.ceil(((task.prazoDate as Date).getTime() - today.getTime()) / 86_400_000);
      return diff >= 1 && diff <= 7;
    });
  }, [tasksWithDeadline, today]);

  const tasksOverdue = useMemo(() => {
    return tasksWithDeadline.filter((task) => {
      if (isTaskCompleted(task.status)) return false;
      return (task.prazoDate as Date).getTime() < today.getTime();
    });
  }, [tasksWithDeadline, today]);

  const calendarDays = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);

  function moveMonth(delta: number) {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const selectedTask = useMemo(() => visibleTasks.find((task) => task.id === selectedTaskId) || null, [visibleTasks, selectedTaskId]);

  function renderTaskCard(task: (typeof tasksWithDeadline)[number]) {
    const dueDate = task.prazoDate as Date;
    const diff = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
    const responsibleName = task.responsavel_id ? teamByUserId.get(task.responsavel_id) : null;

    return (
      <button
        key={task.id}
        type="button"
        onClick={() => setSelectedTaskId(task.id)}
        className="w-full rounded-lg border border-border bg-white p-3 text-left hover:bg-muted/40 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm text-foreground">{task.titulo}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dueDate.toLocaleDateString("pt-BR")} • {responsibleName || "Sem responsável"}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getUrgencyClass(diff)}`}>
            {getUrgencyLabel(diff)}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="h-7 w-7 text-primary" />
            Dashboard de Tarefas
          </h1>
          <p className="text-muted-foreground mt-1">Calendário mensal, prazos e foco em execução da equipe.</p>
        </div>

        <div className="rounded-lg border bg-card px-3 py-2 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>

          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as TaskScope)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="mine">Minhas tarefas</option>
            {isAdminView && <option value="all">Todas as tarefas</option>}
          </select>

          {isAdminView && scope === "all" ? (
            <select
              value={selectedResponsible}
              onChange={(event) => setSelectedResponsible(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Todos responsáveis</option>
              {teamMembers
                .filter((member) => member.user_id)
                .map((member) => (
                  <option key={member.id} value={member.user_id as string}>
                    {member.nome}
                  </option>
                ))}
            </select>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Erro ao carregar tarefas: {error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-muted/60"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <p className="font-semibold text-lg capitalize flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {getMonthLabel(selectedMonth)}
            </p>

            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-muted/60"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
            {WEEK_DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const isCurrentMonth = day.getMonth() === selectedMonth.getMonth();
              const dayKey = toDateKey(day);
              const tasksCount = (tasksPerDay.get(dayKey) || []).length;
              const isSelected = dayKey === toDateKey(selectedDate);
              const isToday = dayKey === toDateKey(today);

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDate(normalizeDateOnly(day))}
                  className={`rounded-lg border p-2 min-h-20 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : tasksCount > 0
                        ? "border-sky-200 bg-sky-50/80 hover:bg-sky-100/70"
                        : "border-border bg-background hover:bg-muted/50"
                  } ${!isCurrentMonth ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>{day.getDate()}</span>
                    {tasksCount > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-700">
                        {tasksCount}
                      </span>
                    ) : null}
                  </div>
                  {tasksCount > 0 ? <span className="mt-2 block h-1.5 w-1.5 rounded-full bg-sky-600" /> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-lg border bg-muted/20 p-3">
            <h3 className="font-semibold text-sm">Tarefas em {selectedDate.toLocaleDateString("pt-BR")}</h3>
            <div className="mt-3 space-y-2">
              {selectedDayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa com prazo nesta data.</p>
              ) : (
                selectedDayTasks.map((task) => renderTaskCard(task))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold">Resumo visual</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="text-xs text-amber-700">Hoje</p>
                <p className="text-xl font-bold text-amber-800">{tasksDueToday.length}</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-3 text-center">
                <p className="text-xs text-sky-700">7 dias</p>
                <p className="text-xl font-bold text-sky-800">{tasksNext7Days.length}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-xs text-red-700">Atrasadas</p>
                <p className="text-xl font-bold text-red-800">{tasksOverdue.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Vence hoje
            </h3>
            <div className="mt-3 space-y-2">
              {tasksDueToday.length ? tasksDueToday.map((task) => renderTaskCard(task)) : <p className="text-sm text-muted-foreground">Nenhuma tarefa vencendo hoje.</p>}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-sky-800">Próximas do vencimento</h3>
            <div className="mt-3 space-y-2">
              {tasksNext7Days.length ? tasksNext7Days.map((task) => renderTaskCard(task)) : <p className="text-sm text-muted-foreground">Sem tarefas para os próximos 7 dias.</p>}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Atrasadas
            </h3>
            <div className="mt-3 space-y-2">
              {tasksOverdue.length ? tasksOverdue.map((task) => renderTaskCard(task)) : <p className="text-sm text-muted-foreground">Sem tarefas atrasadas.</p>}
            </div>
          </div>
        </aside>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando tarefas...</p> : null}

      {selectedTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedTask.titulo}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Prazo: {selectedTask.prazo ? parsePrazoToDate(selectedTask.prazo)?.toLocaleDateString("pt-BR") : "Sem prazo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <p><span className="font-medium">Status:</span> {selectedTask.status || "—"}</p>
              <p><span className="font-medium">Prioridade:</span> {selectedTask.prioridade || "—"}</p>
              <p><span className="font-medium">Responsável:</span> {selectedTask.responsavel_id ? teamByUserId.get(selectedTask.responsavel_id) || "—" : "—"}</p>
              <p><span className="font-medium">Criada em:</span> {new Date(selectedTask.created_at).toLocaleDateString("pt-BR")}</p>
              <p><span className="font-medium">Descrição:</span></p>
              <p className="rounded-md border bg-muted/20 p-3">{selectedTask.descricao || "Sem descrição."}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

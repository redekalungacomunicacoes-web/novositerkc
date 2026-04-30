import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bell, CalendarDays } from "lucide-react";

import { getCurrentUserRoles } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";
import { TasksCalendarGrid, TasksDrawer } from "./tasksComponents";
import {
  createExternalAttachment,
  createTask,
  deleteTask,
  fetchTeamProfiles,
  fetchNotifications,
  fetchTasksInRange,
  isDuplicateTask,
  markNotificationAsRead,
  notifyUsers,
  userExistsById,
  updateTask,
  uploadTaskAttachment,
} from "./tasksService";
import type { Notification, Task, TaskFormValues, TeamProfile } from "./tasksTypes";

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function buildCalendarDays(monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEndDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: monthEndDay }, (_, index) => {
    const date = new Date(monthStart);
    date.setDate(index + 1);
    return date;
  });
}

function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function emptyForm(date: Date): TaskFormValues {
  return {
    id: undefined,
    titulo: "",
    descricao: "",
    data_inicial: toDateKey(new Date()),
    data_final: toDateKey(date),
    prioridade: "media",
    status: "pendente",
    assigned_to: "",
    direcionamento: [],
    observacoes: "",
  };
}

function validate(values: TaskFormValues) {
  if (!values.titulo.trim()) return "O título é obrigatório.";
  if (!values.data_inicial || !values.data_final) return "Datas inicial/final são obrigatórias.";
  if (!values.assigned_to) return "Responsável não identificado.";
  if (!values.direcionamento.length) return "Direcionamento é obrigatório.";
  if (values.data_final < values.data_inicial) return "Data final não pode ser anterior à inicial.";
  return null;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function AdminTarefas() {
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [tasksDayLoading, setTasksDayLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TeamProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState<TaskFormValues>(emptyForm(new Date()));

  const unreadCount = useMemo(() => notifications.filter((item) => !item.lida).length, [notifications]);
  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);
  const monthStartOffset = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1).getDay(), [month]);
  const userNameById = useMemo(() => new Map(users.map((user) => [user.id, user.nome || user.email || "Usuário sem nome"])), [users]);

  const taskCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    const uniqueById = new Map(tasks.map((task) => [task.id, task]));
    for (const task of uniqueById.values()) map.set(task.data_tarefa, (map.get(task.data_tarefa) ?? 0) + 1);
    return map;
  }, [tasks]);

  const selectedDateKey = toDateKey(selectedDate);
  const tasksOfDay = useMemo(
    () =>
      [...new Map(tasks.filter((task) => task.data_tarefa === selectedDateKey).map((task) => [task.id, task])).values()].sort((a, b) =>
        (a.hora_inicio ?? "23:59").localeCompare(b.hora_inicio ?? "23:59"),
      ),
    [tasks, selectedDateKey],
  );

  async function refreshTasksAndNotifications(referenceMonth: Date, userId: string, canManageTasks: boolean) {
    setCalendarLoading(true);
    try {
      const { start, end } = monthRange(referenceMonth);
      const [taskRows, notificationRows] = await Promise.all([fetchTasksInRange(start, end, userId, canManageTasks), fetchNotifications(userId, canManageTasks)]);
      setTasks(taskRows);
      setNotifications(notificationRows);
    } finally {
      setCalendarLoading(false);
    }
  }

  async function loadUsers() {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const profiles = await fetchTeamProfiles();
      setUsers([...new Map(profiles.map((user) => [user.id, user as TeamProfile])).values()]);
    } catch (caught) {
      console.error("Erro ao carregar equipe", caught);
      const message = caught instanceof Error ? caught.message : "Falha ao carregar integrantes.";
      setTeamError(message);
      setUsers([]);
    } finally {
      setTeamLoading(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        const [{ data: sessionData }, roleResult] = await Promise.all([supabase.auth.getSession(), getCurrentUserRoles()]);
        const userId = sessionData.session?.user.id;
        if (!userId) throw new Error("Sessão inválida. Faça login novamente.");

        const roles = roleResult.roles.map((role) => role.toLowerCase());
        const canManageTasks = roles.includes("admin_alfa") || roles.includes("admin");

        setCurrentUserId(userId);
        setForm((prev)=>({ ...prev, assigned_to: userId }));
        setCanManage(canManageTasks);

        await Promise.all([refreshTasksAndNotifications(month, userId, canManageTasks), loadUsers()]);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Falha ao carregar módulo de tarefas.";
        setGlobalError(message);
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    void refreshTasksAndNotifications(month, currentUserId, canManage).catch((caught) => {
      const message = caught instanceof Error ? caught.message : "Falha ao recarregar calendário.";
      setGlobalError(message);
    });
  }, [month, currentUserId, canManage]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, data_final: selectedDateKey, data_inicial: prev.data_inicial || toDateKey(new Date()) }));
  }, [selectedDateKey]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    setTasksDayLoading(calendarLoading);
  }, [calendarLoading, isDrawerOpen, selectedDateKey]);

  async function handleCreateTask(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!canManage) {
      setSaveError("Somente admin alpha/admin pode criar e atribuir tarefas.");
      return;
    }

    const assignedToFallback = form.assigned_to || currentUserId;
    const direcionamentoFinal = [...new Set(form.direcionamento)].filter((id) => id !== assignedToFallback);
    const validation = validate({ ...form, assigned_to: assignedToFallback, direcionamento: direcionamentoFinal });
    if (validation) {
      setSaveError(validation);
      return;
    }

    if (!isValidUuid(assignedToFallback)) {
      setSaveError("Selecione um responsável válido antes de salvar a tarefa.");
      return;
    }

    try {
      setSaving(true);
      const assignedUserExists = await userExistsById(assignedToFallback);
      if (!assignedUserExists) {
        setSaveError("O responsável selecionado não foi encontrado. Atualize a lista e tente novamente.");
        return;
      }

      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        data_tarefa: form.data_final,
        prioridade: form.prioridade,
        status: form.status,
        assigned_to: assignedToFallback,
        created_by: currentUserId,
        direcionamento: direcionamentoFinal,
        external_link: form.observacoes.trim() || null,
      } as const;

      const hasDuplicate = await isDuplicateTask({
        id: form.id ?? "",
        titulo: payload.titulo,
        data_tarefa: payload.data_tarefa,
        hora_inicio: null,
        hora_fim: null,
        assigned_to: payload.assigned_to,
      });
      if (hasDuplicate) {
        setSaveError("Já existe uma tarefa igual para esta data/horário e responsável.");
        return;
      }

      let taskId = form.id ?? "";
      if (form.id) {
        await updateTask(form.id, payload);
      } else {
        taskId = await createTask(payload);
      }

      let attachmentWarning: string | null = null;

      if (false) {
        try {
          await createExternalAttachment(taskId, form.external_attachment_link.trim(), currentUserId);
        } catch (attachmentError) {
          console.error("Erro ao vincular link externo", attachmentError);
          attachmentWarning = "Tarefa salva, mas houve erro ao vincular o link de anexo.";
        }
      }

      for (const file of files) {
        try {
          await uploadTaskAttachment(taskId, file, currentUserId);
        } catch (uploadError) {
          console.error("Erro de upload de anexo", uploadError);
          attachmentWarning = "Tarefa salva, mas um ou mais anexos não foram enviados.";
        }
      }

      try {
        await notifyUsers(
          { id: taskId, titulo: payload.titulo, data_tarefa: payload.data_tarefa, assigned_to: payload.assigned_to, direcionamento: payload.direcionamento },
          currentUserId,
          form.id ? "updated" : "created",
        );
      } catch (notifyError) {
        console.warn("Falha ao enviar notificação via /api/notify", notifyError);
      }

      await refreshTasksAndNotifications(month, currentUserId, canManage);
      setForm({ ...emptyForm(selectedDate), assigned_to: currentUserId });
      setFiles([]);
      setSaveSuccess(attachmentWarning ?? (form.id ? "Tarefa atualizada com sucesso." : "Tarefa salva com sucesso."));
    } catch (caught) {
      console.error("Erro ao salvar tarefa", caught);
      const message = caught instanceof Error ? caught.message : "Não foi possível salvar a tarefa.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditTask(task: Task) {
    setForm({
      id: task.id,
      titulo: task.titulo,
      descricao: task.descricao ?? "",
      data_inicial: task.data_tarefa,
      data_final: task.data_tarefa,
      prioridade: task.prioridade,
      status: task.status,
      assigned_to: task.assigned_to ?? "",
      direcionamento: (task.direcionamento as string[]) ?? [],
      observacoes: task.external_link ?? "",
    });
  }

  async function handleDeleteTask(taskId: string) {
    if (!canManage) return;
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await deleteTask(taskId);
      await refreshTasksAndNotifications(month, currentUserId, canManage);
      if (form.id === taskId) {
        setForm(emptyForm(selectedDate));
      }
      setSaveSuccess("Tarefa excluída com sucesso.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível excluir a tarefa.";
      setSaveError(message);
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, lida: true } : item)));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível marcar notificação como lida.";
      setGlobalError(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
            <CalendarDays className="h-7 w-7 text-emerald-700" /> Calendário Administrativo
          </h1>
          <p className="text-slate-600">Planejamento da equipe com tarefas por data, anexos e notificações.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <button type="button" className="relative inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
            <Bell className="h-4 w-4" /> Notificações
            {unreadCount > 0 ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs text-white">{unreadCount}</span> : null}
          </button>
        </div>
      </div>

      {globalError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{globalError}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <TasksCalendarGrid
          calendarDays={calendarDays}
          monthStartOffset={monthStartOffset}
          month={month}
          selectedDateKey={selectedDateKey}
          taskCountByDate={taskCountByDate}
          onSelectDate={(day) => {
            setSelectedDate(day);
            setIsDrawerOpen(true);
          }}
          onPrevMonth={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          onNextMonth={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          isLoading={calendarLoading}
        />

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Notificações da equipe</h2>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {notifications.length === 0 ? <p className="text-sm text-slate-500">Sem notificações.</p> : null}
            {notifications.map((notification) => (
              <article key={notification.id} className={`rounded-lg border p-3 ${notification.lida ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50"}`}>
                <p className="text-sm font-semibold text-slate-900">{notification.titulo}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {notification.recipient?.nome || notification.recipient?.email || userNameById.get(notification.user_id) || "Destinatário"} • {notification.tasks?.titulo ?? "Tarefa"} •{" "}
                  {notification.tasks?.data_tarefa ?? "Sem data"}
                </p>
                <p className="mt-2 text-sm text-slate-700">{notification.mensagem}</p>
                {!notification.lida ? (
                  <button type="button" onClick={() => void handleMarkRead(notification.id)} className="mt-2 text-xs font-semibold text-emerald-700 underline">
                    Marcar como lida
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </aside>
      </div>

      <TasksDrawer
        isOpen={isDrawerOpen}
        selectedDate={selectedDate}
        tasksOfDay={tasksOfDay}
        canManage={canManage}
        teamLoading={teamLoading}
        teamError={teamError}
        isSaving={saving}
        saveSuccess={saveSuccess}
        form={form}
        users={users}
        userNameById={userNameById}
        files={files}
        saveError={saveError}
        tasksDayLoading={tasksDayLoading}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={(event) => void handleCreateTask(event)}
        onFormChange={(values) => setForm((prev) => ({ ...prev, ...values }))}
        onFilesChange={setFiles}
        onEditTask={handleEditTask}
        onDeleteTask={(taskId) => void handleDeleteTask(taskId)}
        responsibleName={userNameById.get(currentUserId) || "Usuário logado"}
      />

      {loading ? <p className="text-sm text-slate-500">Carregando dados do calendário...</p> : null}
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Paperclip, Plus, X } from "lucide-react";

import { getCurrentUserRoles } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";
import {
  createExternalAttachment,
  createTask,
  fetchNotifications,
  fetchTasksInRange,
  fetchTeamProfiles,
  markNotificationAsRead,
  uploadTaskAttachment,
} from "./tasksService";
import type { Notification, Task, TaskFormValues, TeamProfile } from "./tasksTypes";

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
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

function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function emptyForm(date: Date): TaskFormValues {
  return {
    titulo: "",
    descricao: "",
    data_tarefa: toDateKey(date),
    hora_inicio: "",
    hora_fim: "",
    prioridade: "media",
    status: "pendente",
    assigned_to: "",
    external_link: "",
    external_attachment_link: "",
  };
}

function validate(values: TaskFormValues) {
  if (!values.titulo.trim()) return "O título é obrigatório.";
  if (!values.data_tarefa) return "A data é obrigatória.";
  if (!values.assigned_to) return "Selecione um responsável.";
  if (values.hora_inicio && values.hora_fim && values.hora_fim < values.hora_inicio) {
    return "A hora de fim deve ser maior que a hora de início.";
  }
  if (values.external_link && !/^https?:\/\//.test(values.external_link)) {
    return "O link externo da tarefa deve começar com http:// ou https://.";
  }
  if (values.external_attachment_link && !/^https?:\/\//.test(values.external_attachment_link)) {
    return "O link de anexo deve começar com http:// ou https://.";
  }
  return null;
}

export function AdminTarefas() {
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState<TaskFormValues>(emptyForm(new Date()));

  const unreadCount = useMemo(() => notifications.filter((item) => !item.lida).length, [notifications]);
  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);

  const taskCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      map.set(task.data_tarefa, (map.get(task.data_tarefa) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const selectedDateKey = toDateKey(selectedDate);
  const tasksOfDay = useMemo(() => tasks.filter((task) => task.data_tarefa === selectedDateKey), [tasks, selectedDateKey]);

  async function loadAll(referenceMonth: Date, userId: string, canManageTasks: boolean) {
    const { start, end } = monthRange(referenceMonth);
    const [taskRows, profileRows, notificationRows] = await Promise.all([
      fetchTasksInRange(start, end, userId, canManageTasks),
      fetchTeamProfiles(),
      fetchNotifications(userId, canManageTasks),
    ]);

    setTasks(taskRows);
    setProfiles(profileRows);
    setNotifications(notificationRows);
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
        setCanManage(canManageTasks);

        await loadAll(month, userId, canManageTasks);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Falha ao carregar módulo de tarefas.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    void loadAll(month, currentUserId, canManage).catch((caught) => {
      const message = caught instanceof Error ? caught.message : "Falha ao recarregar calendário.";
      setError(message);
    });
  }, [month]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, data_tarefa: selectedDateKey }));
  }, [selectedDateKey]);

  async function handleCreateTask(event: FormEvent) {
    event.preventDefault();
    if (!canManage) {
      setError("Somente admin alpha/admin pode criar e atribuir tarefas.");
      return;
    }

    const validation = validate(form);
    if (validation) {
      setError(validation);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const taskId = await createTask({
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        data_tarefa: form.data_tarefa,
        hora_inicio: form.hora_inicio || null,
        hora_fim: form.hora_fim || null,
        prioridade: form.prioridade,
        status: form.status,
        assigned_to: form.assigned_to,
        created_by: currentUserId,
        external_link: form.external_link.trim() || null,
      });

      if (form.external_attachment_link.trim()) {
        await createExternalAttachment(taskId, form.external_attachment_link.trim(), currentUserId);
      }

      for (const file of files) {
        await uploadTaskAttachment(taskId, file, currentUserId);
      }

      await loadAll(month, currentUserId, canManage);
      setForm(emptyForm(selectedDate));
      setFiles([]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível salvar a tarefa.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, lida: true } : item)));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível marcar notificação como lida.";
      setError(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <CalendarDays className="h-7 w-7 text-primary" /> Calendário Administrativo
          </h1>
          <p className="text-muted-foreground">Planejamento da equipe com tarefas por data, anexos e notificações.</p>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <button type="button" className="relative inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium">
            <Bell className="h-4 w-4" /> Notificações
            {unreadCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs text-white">{unreadCount}</span>
            ) : null}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="rounded-md border p-2">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-lg font-semibold capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
            <button type="button" onClick={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="rounded-md border p-2">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
            {WEEK_DAYS.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const key = toDateKey(day);
              const count = taskCountByDate.get(key) ?? 0;
              const selected = key === selectedDateKey;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day);
                    setIsDrawerOpen(true);
                  }}
                  className={`min-h-[84px] rounded-xl border p-2 text-left ${selected ? "border-primary bg-primary/10" : "bg-background hover:bg-muted/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{day.getDate()}</span>
                    {count > 0 ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">{count}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Notificações da equipe</h2>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {notifications.length === 0 ? <p className="text-sm text-muted-foreground">Sem notificações.</p> : null}
            {notifications.map((notification) => (
              <article key={notification.id} className={`rounded-lg border p-3 ${notification.lida ? "bg-background" : "bg-blue-50"}`}>
                <p className="text-sm font-semibold">{notification.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">{notification.recipient?.nome || notification.recipient?.email || "Destinatário"} • {notification.tasks?.titulo ?? "Tarefa"} • {notification.tasks?.data_tarefa ?? "Sem data"}</p>
                <p className="mt-2 text-sm">{notification.mensagem}</p>
                {!notification.lida ? (
                  <button type="button" onClick={() => void handleMarkRead(notification.id)} className="mt-2 text-xs font-medium text-blue-700">
                    Marcar como lida
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </aside>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-2xl overflow-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Tarefas de {selectedDate.toLocaleDateString("pt-BR")}</h2>
              <button type="button" onClick={() => setIsDrawerOpen(false)} className="rounded-md border p-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {tasksOfDay.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tarefa para esta data.</p> : null}
              {tasksOfDay.map((task) => (
                <article key={task.id} className="rounded-lg border p-3">
                  <p className="font-semibold">{task.titulo}</p>
                  <p className="text-xs text-muted-foreground">{task.hora_inicio ?? "--:--"} - {task.hora_fim ?? "--:--"} • {task.prioridade} • {task.status}</p>
                  <p className="mt-1 text-sm">{task.descricao || "Sem descrição"}</p>
                  {task.external_link ? <a className="mt-2 block text-xs text-blue-700" href={task.external_link} target="_blank" rel="noreferrer">Link externo</a> : null}
                  {(task.task_attachments ?? []).length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {(task.task_attachments ?? []).map((attachment) => (
                        <li key={attachment.id} className="flex items-center gap-1 text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          {attachment.external_url ? (
                            <a href={attachment.external_url} target="_blank" rel="noreferrer" className="text-blue-700">{attachment.external_url}</a>
                          ) : (
                            <span>{attachment.file_name} ({attachment.mime_type || "arquivo"})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>

            {canManage ? (
              <form onSubmit={handleCreateTask} className="mt-6 space-y-3 rounded-xl border bg-muted/20 p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold"><Plus className="h-4 w-4" /> Nova tarefa</h3>
                <input className="w-full rounded-md border bg-white p-2 text-sm" placeholder="Título" value={form.titulo} onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))} />
                <textarea className="w-full rounded-md border bg-white p-2 text-sm" placeholder="Descrição" value={form.descricao} onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="rounded-md border bg-white p-2 text-sm" value={form.data_tarefa} onChange={(event) => setForm((prev) => ({ ...prev, data_tarefa: event.target.value }))} />
                  <select className="rounded-md border bg-white p-2 text-sm" value={form.assigned_to} onChange={(event) => setForm((prev) => ({ ...prev, assigned_to: event.target.value }))}>
                    <option value="">Responsável</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.nome || profile.email || profile.id}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" className="rounded-md border bg-white p-2 text-sm" value={form.hora_inicio} onChange={(event) => setForm((prev) => ({ ...prev, hora_inicio: event.target.value }))} />
                  <input type="time" className="rounded-md border bg-white p-2 text-sm" value={form.hora_fim} onChange={(event) => setForm((prev) => ({ ...prev, hora_fim: event.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className="rounded-md border bg-white p-2 text-sm" value={form.prioridade} onChange={(event) => setForm((prev) => ({ ...prev, prioridade: event.target.value as TaskFormValues["prioridade"] }))}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                  <select className="rounded-md border bg-white p-2 text-sm" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as TaskFormValues["status"] }))}>
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <input className="w-full rounded-md border bg-white p-2 text-sm" placeholder="Link externo da tarefa (opcional)" value={form.external_link} onChange={(event) => setForm((prev) => ({ ...prev, external_link: event.target.value }))} />
                <input className="w-full rounded-md border bg-white p-2 text-sm" placeholder="Link para anexo (opcional)" value={form.external_attachment_link} onChange={(event) => setForm((prev) => ({ ...prev, external_attachment_link: event.target.value }))} />
                <input type="file" multiple className="w-full rounded-md border bg-white p-2 text-sm" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
                <button disabled={saving} type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar tarefa"}
                </button>
              </form>
            ) : (
              <p className="mt-6 rounded-lg border bg-amber-50 p-3 text-sm text-amber-800">Você tem acesso apenas para visualização das tarefas e notificações destinadas a você.</p>
            )}
          </div>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Carregando dados do calendário...</p> : null}
    </div>
  );
}

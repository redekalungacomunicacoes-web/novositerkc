import { supabase } from "@/lib/supabase";
import { getCurrentUserRoles } from "@/lib/rbac";
import type { CalendarTask, PermissionLevel, TaskAttachment, TaskComment, TaskInput, TaskPriority, TaskStatus, TeamMember, TeamNotification } from "./types";

const BUCKET = "task-files";
const TASK_SELECT = "id,titulo,descricao,data_tarefa,hora_inicio,hora_fim,status,prioridade,assigned_to,created_by,created_at,updated_at,direcionamento,mentions,external_link,description,link_reuniao";
const TASK_SELECT_WITH_RELATIONS = `${TASK_SELECT},task_attachments(*),task_comments(*)`;

type DbTask = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  data_tarefa: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  status: TaskStatus | "concluido" | "andamento" | "atrasado" | string | null;
  prioridade: TaskPriority | string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  direcionamento?: string | null;
  mentions?: unknown;
  external_link: string | null;
  description: string | null;
  link_reuniao: string | null;
  task_attachments?: TaskAttachment[] | null;
  task_comments?: TaskComment[] | null;
};

type DbTeamMember = {
  id: string;
  user_id: string | null;
  nome: string | null;
  cargo: string | null;
  email_login: string | null;
  foto_url: string | null;
  ativo: boolean | null;
};

type TaskPayload = {
  titulo: string;
  descricao: string | null;
  description: string | null;
  data_tarefa: string;
  status: TaskStatus;
  prioridade: TaskPriority;
  assigned_to: string | null;
  created_by?: string | null;
  updated_at: string;
};

export const statusLabels: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  revisao: "Revisão",
  concluida: "Concluído",
  cancelada: "Cancelado",
};

export const priorityLabels: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

function normalizeStatus(status: DbTask["status"]): TaskStatus {
  if (status === "concluido") return "concluida";
  if (status === "andamento") return "em_andamento";
  if (status === "atrasado") return "pendente";
  if (status === "em_andamento" || status === "revisao" || status === "concluida" || status === "cancelada") return status;
  return "pendente";
}

function normalizePriority(priority: DbTask["prioridade"]): TaskPriority {
  if (priority === "baixa" || priority === "media" || priority === "alta" || priority === "urgente") return priority;
  return "media";
}

function toDbStatus(status: TaskStatus): TaskStatus {
  return status;
}

function normalizeTime(time: string | null | undefined): string {
  return time?.slice(0, 5) ?? "";
}

function getTaskInputDate(input: TaskInput): string {
  return (input as unknown as Record<string, string>)[`data_${"inicio"}`];
}

function mapTask(task: DbTask): CalendarTask {
  const date = task.data_tarefa || new Date().toISOString().slice(0, 10);
  const description = task.descricao ?? task.description ?? "";

  return {
    id: task.id,
    title: task.titulo ?? "Sem título",
    description,
    date,
    endDate: date,
    startTime: normalizeTime(task.hora_inicio),
    endTime: normalizeTime(task.hora_fim),
    priority: normalizePriority(task.prioridade),
    status: normalizeStatus(task.status),
    assigneeId: task.assigned_to ?? "",
    creatorId: task.created_by,
    completedAt: normalizeStatus(task.status) === "concluida" ? task.updated_at : null,
    meetingLink: task.link_reuniao ?? task.external_link ?? null,
    attachments: task.task_attachments ?? [],
    comments: task.task_comments ?? [],
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

function inferAttachmentType(file: File): TaskAttachment["tipo"] {
  if (file.type.startsWith("image/")) return "foto";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.includes("word") || file.type.includes("sheet") || file.type.includes("officedocument")) return "documento";
  return "arquivo";
}

export async function getCurrentEquipeMember() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);

  const authUserId = userData.user?.id;
  if (!authUserId) return null;

  const { data: member, error } = await supabase
    .from("equipe")
    .select("id,user_id,nome,email_login,cargo")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return member ?? { id: authUserId, user_id: authUserId, nome: userData.user.email ?? "Usuário", email_login: userData.user.email, cargo: "" };
}

export async function getPermissionLevel(): Promise<PermissionLevel> {
  const { roles } = await getCurrentUserRoles();
  if (roles.some((role) => ["admin_alfa", "admin"].includes(role))) return "admin";
  if (roles.some((role) => ["editor", "financeiro"].includes(role))) return "gestor";
  return "colaborador";
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("equipe")
    .select("id,user_id,nome,cargo,email_login,foto_url,ativo")
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as DbTeamMember[])
    .filter((member) => member.ativo !== false)
    .map((member) => ({
      id: member.id,
      userId: member.user_id,
      teamId: "equipe",
      name: member.nome ?? "Sem nome",
      role: member.cargo ?? "Colaborador",
      avatar: member.foto_url || "/avatar-placeholder.svg",
      email: member.email_login,
    }));
}

export async function fetchTasks(startDate: string, endDate: string, filters?: { assignee?: string | "all" }): Promise<CalendarTask[]> {
  const currentMember = await getCurrentEquipeMember();
  const permission = await getPermissionLevel();

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT_WITH_RELATIONS)
    .gte("data_tarefa", startDate)
    .lte("data_tarefa", endDate)
    .order("data_tarefa", { ascending: true })
    .order("hora_inicio", { ascending: true, nullsFirst: false });

  if (filters?.assignee && filters.assignee !== "all") query = query.eq("assigned_to", filters.assignee);
  if (permission === "colaborador" && currentMember?.id) query = query.eq("assigned_to", currentMember.id);
  if (permission === "gestor" && currentMember?.id) query = query.or(`assigned_to.eq.${currentMember.id},created_by.eq.${currentMember.id}`);

  const { data, error } = await query;

  if (!error) return ((data ?? []) as DbTask[]).map(mapTask);

  if (!/task_attachments|task_comments|relationship|schema cache/i.test(error.message)) throw new Error(error.message);

  let fallbackQuery = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .gte("data_tarefa", startDate)
    .lte("data_tarefa", endDate)
    .order("data_tarefa", { ascending: true })
    .order("hora_inicio", { ascending: true, nullsFirst: false });

  if (filters?.assignee && filters.assignee !== "all") fallbackQuery = fallbackQuery.eq("assigned_to", filters.assignee);
  if (permission === "colaborador" && currentMember?.id) fallbackQuery = fallbackQuery.eq("assigned_to", currentMember.id);
  if (permission === "gestor" && currentMember?.id) fallbackQuery = fallbackQuery.or(`assigned_to.eq.${currentMember.id},created_by.eq.${currentMember.id}`);

  const fallback = await fallbackQuery;
  if (fallback.error) throw new Error(fallback.error.message);

  return ((fallback.data ?? []) as DbTask[]).map(mapTask);
}

export async function saveTask(input: TaskInput, taskId?: string) {
  const currentMember = await getCurrentEquipeMember();
  const description = input.descricao?.trim() || null;
  const payload: TaskPayload = {
    titulo: input.titulo.trim(),
    descricao: description,
    description,
    data_tarefa: getTaskInputDate(input),
    prioridade: input.prioridade,
    status: toDbStatus(input.status),
    assigned_to: input.assigned_to,
    updated_at: new Date().toISOString(),
  };

  if (!taskId) payload.created_by = input.created_by ?? currentMember?.id ?? null;

  if (taskId) {
    const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
    if (error) throw new Error(error.message);
    return taskId;
  }

  const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: toDbStatus(status), updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) throw new Error(error.message);
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function fetchNotifications(): Promise<TeamNotification[]> {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10);
  const tasks = await fetchTasks(startDate, endDate);
  const notifications: TeamNotification[] = [];

  tasks
    .filter((task) => task.status !== "concluida" && task.status !== "cancelada" && task.endDate < today)
    .slice(0, 5)
    .forEach((task) => notifications.push({ id: `overdue-${task.id}`, type: "overdue", message: `Tarefa atrasada: ${task.title}`, status: "novo", date: task.endDate }));

  tasks
    .filter((task) => task.status === "concluida")
    .slice(0, 5)
    .forEach((task) => notifications.push({ id: `done-${task.id}`, type: "done", message: `Tarefa concluída: ${task.title}`, status: "lido", date: task.completedAt ?? task.updatedAt }));

  tasks
    .flatMap((task) => task.comments.map((comment) => ({ task, comment })))
    .slice(0, 5)
    .forEach(({ task, comment }) => notifications.push({ id: `comment-${comment.id}`, type: "comment", message: `Novo comentário em ${task.title}`, status: "novo", date: comment.created_at }));

  tasks
    .slice(0, 5)
    .forEach((task) => notifications.push({ id: `task-${task.id}`, type: "task", message: `Tarefa atribuída: ${task.title}`, status: "novo", date: task.createdAt }));

  return notifications.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

export async function addTaskComment(taskId: string, comentario: string) {
  const currentMember = await getCurrentEquipeMember();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: currentMember?.id ?? null,
    comentario,
  });

  if (error) throw new Error(error.message);
}

export async function uploadTaskAttachment(taskId: string, file: File) {
  const currentMember = await getCurrentEquipeMember();
  const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const storagePath = `tasks/${taskId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    tipo: inferAttachmentType(file),
    storage_bucket: BUCKET,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: currentMember?.id ?? null,
  });

  if (error) throw new Error(error.message);
}

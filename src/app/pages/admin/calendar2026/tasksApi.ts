import { supabase } from "@/lib/supabase";
import { getCurrentUserRoles } from "@/lib/rbac";
import type { CalendarTask, PermissionLevel, TaskAttachment, TaskComment, TaskInput, TaskPriority, TaskStatus, TeamMember, TeamNotification } from "./types";

const BUCKET = "task-files";

type DbTask = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_tarefa?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  prioridade: TaskPriority;
  status: TaskStatus | "concluido" | "andamento" | "atrasado";
  assigned_to: string | null;
  created_by: string | null;
  data_conclusao?: string | null;
  external_link?: string | null;
  link_reuniao?: string | null;
  created_at: string;
  updated_at: string;
  task_attachments?: TaskAttachment[];
  task_comments?: TaskComment[];
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
  return status;
}

function toDbStatus(status: TaskStatus) {
  return status;
}

function mapTask(task: DbTask): CalendarTask {
  const date = task.data_inicio || task.data_tarefa || new Date().toISOString().slice(0, 10);
  return {
    id: task.id,
    title: task.titulo,
    description: task.descricao ?? "",
    date,
    endDate: task.data_fim || task.data_tarefa || date,
    startTime: task.hora_inicio?.slice(0, 5) ?? "",
    endTime: task.hora_fim?.slice(0, 5) ?? "",
    priority: task.prioridade,
    status: normalizeStatus(task.status),
    assigneeId: task.assigned_to ?? "",
    creatorId: task.created_by,
    completedAt: task.data_conclusao ?? null,
    meetingLink: task.external_link ?? task.link_reuniao ?? null,
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
  const { data } = await supabase.auth.getUser();
  const authUserId = data.user?.id;
  if (!authUserId) return null;
  const { data: member } = await supabase
    .from("equipe")
    .select("id,user_id,nome,email_login,cargo")
    .eq("user_id", authUserId)
    .maybeSingle();
  return member ?? { id: authUserId, user_id: authUserId, nome: data.user.email ?? "Usuário", email_login: data.user.email, cargo: "" };
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
    .select("id,user_id,nome,email_login,cargo,foto_url,avatar_url,avatar_path,ativo,is_active")
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((member) => (member.is_active ?? member.ativo ?? true) === true)
    .map((member) => ({
      id: member.id as string,
      userId: (member.user_id as string | null) ?? null,
      teamId: "equipe",
      name: (member.nome as string | null) ?? "Sem nome",
      role: (member.cargo as string | null) ?? "Colaborador",
      avatar: (member.avatar_url as string | null) || (member.foto_url as string | null) || "/avatar-placeholder.svg",
      email: (member.email_login as string | null) ?? null,
    }));
}

export async function fetchTasks(startDate: string, endDate: string, filters?: { assignee?: string | "all" }): Promise<CalendarTask[]> {
  const currentMember = await getCurrentEquipeMember();
  const permission = await getPermissionLevel();
  let query = supabase
    .from("tasks")
    .select("id,titulo,descricao,data_tarefa,data_inicio,data_fim,hora_inicio,hora_fim,prioridade,status,assigned_to,created_by,data_conclusao,external_link,link_reuniao,created_at,updated_at,task_attachments(*),task_comments(*)")
    .lte("data_inicio", endDate)
    .gte("data_fim", startDate)
    .order("data_inicio", { ascending: true });

  if (filters?.assignee && filters.assignee !== "all") query = query.eq("assigned_to", filters.assignee);
  if (permission === "colaborador" && currentMember?.id) query = query.eq("assigned_to", currentMember.id);
  if (permission === "gestor" && currentMember?.id) query = query.or(`assigned_to.eq.${currentMember.id},created_by.eq.${currentMember.id}`);

  let { data, error } = await query;
  if (error && /data_inicio|data_fim|task_comments/i.test(error.message)) {
    let fallback = supabase
      .from("tasks")
      .select("id,titulo,descricao,data_tarefa,hora_inicio,hora_fim,prioridade,status,assigned_to,created_by,external_link,link_reuniao,created_at,updated_at,task_attachments(*)")
      .gte("data_tarefa", startDate)
      .lte("data_tarefa", endDate)
      .order("data_tarefa", { ascending: true });
    if (filters?.assignee && filters.assignee !== "all") fallback = fallback.eq("assigned_to", filters.assignee);
    if (permission === "colaborador" && currentMember?.id) fallback = fallback.eq("assigned_to", currentMember.id);
    const result = await fallback;
    data = result.data as never;
    error = result.error;
  }
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbTask[]).map(mapTask);
}

export async function saveTask(input: TaskInput, taskId?: string) {
  const currentMember = await getCurrentEquipeMember();
  const payload = {
    titulo: input.titulo,
    descricao: input.descricao,
    data_tarefa: input.data_inicio,
    data_inicio: input.data_inicio,
    data_fim: input.data_fim,
    prioridade: input.prioridade,
    status: toDbStatus(input.status),
    assigned_to: input.assigned_to,
    created_by: input.created_by ?? currentMember?.id ?? null,
    data_conclusao: input.status === "concluida" ? input.data_conclusao ?? new Date().toISOString() : input.data_conclusao ?? null,
  };
  if (taskId) {
    const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
    if (error) throw new Error(error.message);
    return taskId;
  }
  const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: toDbStatus(status), data_conclusao: status === "concluida" ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function addTaskComment(taskId: string, comentario: string) {
  const currentMember = await getCurrentEquipeMember();
  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, author_id: currentMember?.id ?? null, comentario });
  if (error) throw new Error(error.message);
}

export async function uploadTaskAttachment(taskId: string, file: File) {
  const currentMember = await getCurrentEquipeMember();
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
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

export async function fetchNotifications(): Promise<TeamNotification[]> {
  const tasks = await fetchTasks(new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10), new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10));
  const today = new Date().toISOString().slice(0, 10);
  const notifications: TeamNotification[] = [];
  tasks.filter((task) => task.status !== "concluida" && task.endDate < today).slice(0, 5).forEach((task) => notifications.push({ id: `overdue-${task.id}`, type: "overdue", message: `Tarefa atrasada: ${task.title}`, status: "novo", date: task.endDate }));
  tasks.filter((task) => task.completedAt).slice(0, 5).forEach((task) => notifications.push({ id: `done-${task.id}`, type: "done", message: `Tarefa concluída: ${task.title}`, status: "lido", date: task.completedAt ?? task.endDate }));
  tasks.flatMap((task) => task.comments.map((comment) => ({ task, comment }))).slice(0, 5).forEach(({ task, comment }) => notifications.push({ id: `comment-${comment.id}`, type: "comment", message: `Novo comentário em ${task.title}`, status: "novo", date: comment.created_at }));
  tasks.slice(0, 5).forEach((task) => notifications.push({ id: `task-${task.id}`, type: "task", message: `Tarefa atribuída: ${task.title}`, status: "novo", date: task.createdAt }));
  return notifications.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

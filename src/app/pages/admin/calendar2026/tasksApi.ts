import { supabase } from "@/lib/supabase";
import { getCurrentUserRoles } from "@/lib/rbac";
import type { CalendarTask, PermissionLevel, TaskAttachment, TaskComment, TaskInput, TaskPriority, TaskStatus, TeamMember, TeamNotification } from "./types";

const BUCKET = "task-files";
const TASK_SELECT = "id,titulo,descricao,data_tarefa,data_inicio,data_fim,data_conclusao,hora_inicio,hora_fim,status,prioridade,assigned_to,created_by,created_at,updated_at,direcionamento,mentions,external_link,link_reuniao";

type DbTask = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  data_tarefa: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  data_conclusao: string | null;
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

export type TaskDatabaseInsert = {
  titulo: string;
  descricao: string | null;
  data_tarefa: string;
  data_inicio: string;
  data_fim: string;
  data_conclusao: string | null;
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
  return input.data_inicio;
}

function mapTask(task: DbTask): CalendarTask {
  const date = task.data_inicio ?? task.data_tarefa ?? new Date().toISOString().slice(0, 10);
  const description = task.descricao ?? "";

  return {
    id: task.id,
    title: task.titulo ?? "Sem título",
    description,
    date,
    endDate: task.data_fim ?? task.data_tarefa ?? date,
    startTime: normalizeTime(task.hora_inicio),
    endTime: normalizeTime(task.hora_fim),
    priority: normalizePriority(task.prioridade),
    status: normalizeStatus(task.status),
    assigneeId: task.assigned_to ?? "",
    creatorId: task.created_by,
    completedAt: task.data_conclusao ?? (normalizeStatus(task.status) === "concluida" ? task.updated_at : null),
    meetingLink: task.link_reuniao ?? task.external_link ?? null,
    attachments: task.task_attachments ?? [],
    comments: task.task_comments ?? [],
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

export async function getCurrentEquipeMember() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);

  const authUser = userData.user ?? null;
  console.log("AUTH USER", authUser);

  const authUserId = authUser?.id;
  if (!authUserId) {
    console.log("EQUIPE LOOKUP", { data: null, error: null, authUserId: null });
    console.log("CURRENT MEMBER", null);
    return null;
  }

  const lookupResult = await supabase
    .from("equipe")
    .select("id,user_id,nome,email_login,cargo,foto_url,ativo")
    .eq("user_id", authUserId);

  console.log("EQUIPE LOOKUP", lookupResult);

  if (lookupResult.error) throw new Error(lookupResult.error.message);

  const currentMember = (lookupResult.data ?? []).find((member) => member.ativo !== false) ?? null;
  console.log("CURRENT MEMBER", currentMember);

  return currentMember;
}

async function requireCurrentEquipeMember() {
  const currentMember = await getCurrentEquipeMember();

  if (!currentMember?.id) {
    throw new Error(
      "Seu usuário não está vinculado a um membro ativo da equipe. Verifique equipe.user_id."
    );
  }

  return currentMember;
}

async function ensureEquipeMemberExists(memberId: string | null | undefined, label: string) {
  if (!memberId) return null;

  const { data, error } = await supabase
    .from("equipe")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível validar ${label}: ${error.message}`);
  if (!data?.id) throw new Error(`${label} inválido: selecione um integrante ativo da equipe.`);

  return data.id as string;
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
    .select(TASK_SELECT)
    .gte("data_tarefa", startDate)
    .lte("data_tarefa", endDate)
    .order("data_tarefa", { ascending: true })
    .order("hora_inicio", { ascending: true, nullsFirst: false });

  if (filters?.assignee && filters.assignee !== "all") query = query.eq("assigned_to", filters.assignee);
  if (permission === "colaborador" && currentMember?.id) query = query.eq("assigned_to", currentMember.id);
  if (permission === "gestor" && currentMember?.id) query = query.or(`assigned_to.eq.${currentMember.id},created_by.eq.${currentMember.id}`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const dbTasks = (data ?? []) as DbTask[];
  const taskIds = dbTasks.map((task) => task.id);
  if (taskIds.length === 0) return [];

  // Uma consulta por relacionamento para toda a lista evita N+1 e não depende
  // de o relacionamento estar disponível no schema cache do PostgREST.
  const [attachmentsResult, commentsResult] = await Promise.all([
    supabase.from("task_attachments").select("id,task_id,file_url,file_name,created_at").in("task_id", taskIds),
    supabase.from("task_comments").select("id,task_id,author_id,comentario,created_at,updated_at").in("task_id", taskIds),
  ]);
  if (attachmentsResult.error) throw new Error(attachmentsResult.error.message);
  if (commentsResult.error) throw new Error(commentsResult.error.message);

  const attachmentsByTask = new Map<string, TaskAttachment[]>();
  for (const attachment of (attachmentsResult.data ?? []) as TaskAttachment[]) {
    attachmentsByTask.set(attachment.task_id, [...(attachmentsByTask.get(attachment.task_id) ?? []), attachment]);
  }
  const commentsByTask = new Map<string, TaskComment[]>();
  for (const comment of (commentsResult.data ?? []) as TaskComment[]) {
    commentsByTask.set(comment.task_id, [...(commentsByTask.get(comment.task_id) ?? []), comment]);
  }

  return dbTasks.map((task) => mapTask({
    ...task,
    task_attachments: attachmentsByTask.get(task.id) ?? [],
    task_comments: commentsByTask.get(task.id) ?? [],
  }));
}

export async function saveTask(input: TaskInput, taskId?: string) {
  const currentMember = await requireCurrentEquipeMember();
  const description = input.descricao?.trim() || null;
  const assignedTo = await ensureEquipeMemberExists(input.assigned_to, "responsável");

  const payload: TaskDatabaseInsert = {
    titulo: input.titulo.trim(),
    descricao: description,
    data_tarefa: getTaskInputDate(input),
    data_inicio: input.data_inicio,
    data_fim: input.data_fim,
    data_conclusao: input.data_conclusao,
    prioridade: input.prioridade,
    status: toDbStatus(input.status),
    assigned_to: assignedTo,
    updated_at: new Date().toISOString(),
  };

  if (!taskId) {
    payload.created_by = currentMember.id;
  }

  if (import.meta.env.DEV) console.log("[TASK CREATE] payload", payload);

  if (taskId) {
    const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
    if (error) throw new Error(error.message);
    return taskId;
  }

  const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
  if (error) {
    console.error("[TASK CREATE][DATABASE]", error);
    throw error;
  }
  if (!data) throw new Error("A tarefa não foi retornada após a criação.");
  return data.id as string;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  oldStatus?: TaskStatus,
) {
  const payload = {
    status: toDbStatus(status),
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId);

  console.log("KANBAN RESULT", result);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    id: taskId,
    status,
    updated_at: payload.updated_at,
  } as any;
}

export async function deleteTask(taskId: string) {
  const attachmentsResult = await supabase
    .from("task_attachments")
    .select("id,file_url")
    .eq("task_id", taskId);
  if (attachmentsResult.error) throw new Error(attachmentsResult.error.message);

  const storagePaths = (attachmentsResult.data ?? [])
    .map((attachment) => attachment.file_url as string | null)
    .filter((path): path is string => Boolean(path) && !/^https?:\/\//i.test(path));

  if (storagePaths.length > 0) {
    const storageResult = await supabase.storage.from(BUCKET).remove(storagePaths);
    if (storageResult.error) {
      console.error("[tarefas:excluir] falha ao remover anexos do Storage", storageResult.error);
      throw new Error("Não foi possível remover todos os anexos da tarefa.");
    }
  }

  // task_comments e task_attachments possuem ON DELETE CASCADE nas migrations.
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
  const currentMember = await requireCurrentEquipeMember();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: currentMember.id,
    comentario,
  });

  if (error) throw new Error(error.message);
}

export async function uploadTaskAttachment(taskId: string, file: File) {
  const safeFileName = file.name.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const filePath = `${taskId}/${crypto.randomUUID()}-${safeFileName}`;

  console.log("[tarefas:anexos] task_id", taskId);
  console.log("[tarefas:anexos] arquivo", { name: file.name, type: file.type, size: file.size });

  const uploadResult = await supabase.storage.from(BUCKET).upload(filePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
  console.log("[tarefas:anexos] upload", uploadResult);
  if (uploadResult.error) throw new Error(uploadResult.error.message);

  const metadata = {
    task_id: taskId,
    file_url: filePath,
    file_name: file.name,
  };

  const insertResult = await supabase.from("task_attachments").insert(metadata).select("*").single();
  console.log("[tarefas:anexos] insert", insertResult);
  if (insertResult.error) {
    const cleanupResult = await supabase.storage.from(BUCKET).remove([filePath]);
    if (cleanupResult.error) {
      console.error("[tarefas:anexos] falha ao remover upload após erro de insert", cleanupResult.error);
    }
    throw new Error(insertResult.error.message);
  }

  return insertResult.data as TaskAttachment;
}

export async function getTaskAttachmentSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function createExternalAttachment(taskId: string, url: string) {
  const payload = {
    task_id: taskId,
    file_url: url,
    file_name: url,
  };

  console.log("[tarefas:anexos] task_id", taskId);
  console.log("[tarefas:anexos] arquivo", { external_url: url });
  console.log("[tarefas:anexos] upload", "link externo sem storage");

  const insertResult = await supabase.from("task_attachments").insert(payload).select("*").single();
  console.log("[tarefas:anexos] insert", insertResult);
  if (insertResult.error) throw new Error(insertResult.error.message);

  return insertResult.data as TaskAttachment;
}

export async function deleteTaskAttachment(attachment: Pick<TaskAttachment, "id" | "file_url">) {
  if (attachment.file_url && !/^https?:\/\//i.test(attachment.file_url)) {
    const storageResult = await supabase.storage.from(BUCKET).remove([attachment.file_url]);
    if (storageResult.error) {
      console.error("[tarefas:anexos] falha ao remover arquivo do Storage", storageResult.error);
      throw new Error("Não foi possível remover o anexo da tarefa.");
    }
  }

  const { error } = await supabase.from("task_attachments").delete().eq("id", attachment.id);
  if (error) throw new Error(error.message);
}

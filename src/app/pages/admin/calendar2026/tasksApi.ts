import { TEAM_DRIVE_AVATAR_SELECT, teamAvatarUrl } from "@/lib/teamAvatar";
import type { ChecklistItem, FileLink, WorkflowHistory } from "./taskWorkflow";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRoles } from "@/lib/rbac";
import { downloadRkcDriveFile, deleteTaskWithFiles, listTaskDriveFiles, trashRkcDriveFile, uploadRkcDriveFile } from "@/services/driveFiles";
import type { CalendarTask, PermissionLevel, TaskAttachment, TaskComment, TaskInput, TaskPriority, TaskStatus, TeamMember, TeamNotification } from "./types";

const BUCKET = "task-files";
const TASK_SELECT = "id,titulo,descricao,data_tarefa,data_inicio,data_fim,hora_inicio,hora_fim,status,prioridade,assigned_to,created_by,created_at,updated_at,direcionamento,mentions,external_link,link_reuniao,reviewer_id,blocked_reason";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type DbTask = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  data_tarefa: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  status: TaskStatus | "concluido" | "andamento" | "atrasado" | string | null;
  prioridade: TaskPriority | string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  direcionamento?: string[] | null;
  mentions?: unknown;
  external_link: string | null;
  link_reuniao: string | null;
  reviewer_id?: string | null;
  blocked_reason?: string | null;
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

/** Payload persistido em public.tasks (não reutilizar CalendarTask neste ponto). */
export type TaskInsert = {
  titulo: string;
  descricao: string | null;
  data_tarefa: string;
  data_inicio: string;
  data_fim: string;
  status: TaskStatus;
  prioridade: TaskPriority;
  assigned_to: string | null;
  direcionamento: string[] | null;
  created_by: string;
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

function requireDatabaseDate(value: string, label: string): string {
  const brazilianDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const normalizedValue = brazilianDate
    ? `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`
    : value;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new Error(`${label} deve estar no formato AAAA-MM-DD.`);
  }

  const parsed = new Date(`${normalizedValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalizedValue) {
    throw new Error(`${label} inválida.`);
  }

  return normalizedValue;
}

function mapTask(task: DbTask): CalendarTask {
  const date = task.data_inicio ?? task.data_tarefa ?? localDateKey(new Date());
  const endDate = task.data_fim ?? task.data_tarefa ?? date;
  const description = task.descricao ?? "";

  return {
    id: task.id,
    title: task.titulo ?? "Sem título",
    description,
    date,
    endDate,
    startTime: normalizeTime(task.hora_inicio),
    endTime: normalizeTime(task.hora_fim),
    priority: normalizePriority(task.prioridade),
    status: normalizeStatus(task.status),
    assigneeId: task.assigned_to ?? "",
    direcionamento: Array.isArray(task.direcionamento) ? task.direcionamento : [],
    creatorId: task.created_by,
    reviewerId: task.reviewer_id,
    blockedReason: task.blocked_reason,
    completedAt: normalizeStatus(task.status) === "concluida" ? task.updated_at : null,
    meetingLink: task.link_reuniao ?? task.external_link ?? null,
    attachments: task.task_attachments ?? [],
    comments: task.task_comments ?? [],
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

export async function getCurrentEquipeMember() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: currentMember, error: memberError } = await supabase
    .from("equipe")
    .select(`id,user_id,nome,email_login,cargo,foto_url,ativo,${TEAM_DRIVE_AVATAR_SELECT}`)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    console.error("[TASK CREATE][CURRENT MEMBER]", memberError);
    throw memberError;
  }

  return currentMember ? {...currentMember, foto_url:teamAvatarUrl(currentMember)} : null;
}

async function requireCurrentEquipeMember() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuário não autenticado.");

  const { data: currentMember, error: memberError } = await supabase
    .from("equipe")
    .select("id,user_id,nome,cargo,ativo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    console.error("[TASK CREATE][CURRENT MEMBER]", memberError);
    throw memberError;
  }

  if (!currentMember?.id) {
    throw new Error("Seu usuário não possui um cadastro correspondente na equipe.");
  }

  if (currentMember.ativo === false) throw new Error("Seu cadastro na equipe está inativo.");
  return { user, currentMember };
}

async function ensureEquipeMemberExists(memberId: string | null | undefined, label: string) {
  if (!memberId) return null;

  const { data, error } = await supabase
    .from("equipe")
    .select("id")
    .or("ativo.eq.true,ativo.is.null")
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
    .select(`id,user_id,nome,cargo,email_login,foto_url,ativo,${TEAM_DRIVE_AVATAR_SELECT}`)
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
      avatar: teamAvatarUrl(member) || "/avatar-placeholder.svg",
      email: member.email_login,
    }));
}

export async function fetchTasks(startDate: string, endDate: string, filters?: { assignee?: string | "all" }): Promise<CalendarTask[]> {
  const pageSize = 500;
  const dbTasks: DbTask[] = [];

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("tasks")
      .select(TASK_SELECT)
      .lte("data_inicio", endDate)
      .gte("data_fim", startDate)
      .order("data_tarefa", { ascending: true })
      .order("hora_inicio", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (filters?.assignee && filters.assignee !== "all") query = query.eq("assigned_to", filters.assignee);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as DbTask[];
    dbTasks.push(...page);
    if (page.length < pageSize) break;
  }

  // Calendário/Kanban carregam somente os dados essenciais.
  // Comentários e anexos são buscados sob demanda ao abrir uma tarefa.
  const mapped = dbTasks.map((task) => mapTask(task));
  for (let offset = 0; offset < mapped.length; offset += 100) {
    const batch = mapped.slice(offset, offset + 100);
    const { data, error } = await supabase.from("task_checklist_progress").select("task_id,total,completed").in("task_id", batch.map(t => t.id));
    if (error) throw new Error(error.message);
    const progress = new Map((data ?? []).map(row => [row.task_id, row]));
    batch.forEach(task => { const row = progress.get(task.id); task.checklistTotal = row?.total ?? 0; task.checklistCompleted = row?.completed ?? 0; });
  }
  return mapped;
}

export async function fetchTaskDetails(taskId: string): Promise<{ attachments: TaskAttachment[]; comments: TaskComment[] }> {
  const [commentsResult, legacyResult, driveFiles] = await Promise.all([
    supabase.from("task_comments").select("id,task_id,author_id,comentario,created_at,updated_at").eq("task_id", taskId).order("created_at"),
    supabase.from("task_attachments").select("id,task_id,file_url,file_name,created_at").eq("task_id", taskId).order("created_at"),
    listTaskDriveFiles(taskId),
  ]);
  if (commentsResult.error) throw new Error(commentsResult.error.message);
  if (legacyResult.error) throw new Error(legacyResult.error.message);
  const attachments = driveFiles
    .filter((file) => file.task_id === taskId && file.status === "active")
    .map((file) => ({
      id: file.id,
      task_id: taskId,
      file_url: `drive:${file.id}`,
      file_name: file.name,
      created_at: file.created_at,
    } as TaskAttachment));
  const seen = new Set(attachments.map((item) => item.id));
  const allAttachments = [...attachments, ...((legacyResult.data ?? []) as TaskAttachment[]).filter((item) => !seen.has(item.id))].sort((a,b) => b.created_at.localeCompare(a.created_at));
  return { attachments: allAttachments, comments: (commentsResult.data ?? []) as TaskComment[] };
}

export async function fetchAttachmentCenter(): Promise<CalendarTask[]> {
  const tasks = await fetchTasks("1900-01-01", "9999-12-31");
  // Batch metadata queries; no downloads or comment requests in this view.
  for (let offset = 0; offset < tasks.length; offset += 100) {
    const batch = tasks.slice(offset, offset + 100);
    const ids = batch.map((task) => task.id);
    const readPages = async (table: string, columns: string, drive = false) => {
      const rows: any[] = [];
      for (let page = 0; ; page += 500) {
        let query = supabase.from(table).select(columns).in("task_id", ids).order("id").range(page, page + 499);
        if (drive) query = query.eq("module", "tasks").eq("status", "active");
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) return rows;
      }
    };
    const [legacy, drive] = await Promise.all([
      readPages("task_attachments", "id,task_id,file_url,file_name,created_at"),
      readPages("drive_files", "id,task_id,name,created_at", true),
    ]);
    const attachments: TaskAttachment[] = [...legacy, ...drive.map((file) => ({ id: file.id, task_id: file.task_id, file_url: `drive:${file.id}`, file_name: file.name, created_at: file.created_at }))];
    const grouped = new Map<string, TaskAttachment[]>();
    attachments.forEach((item) => grouped.set(item.task_id, [...(grouped.get(item.task_id) ?? []), item]));
    batch.forEach((task) => { task.attachments = grouped.get(task.id) ?? []; });
  }
  return tasks;
}

export async function saveTask(input: TaskInput, taskId?: string) {
  const { currentMember } = await requireCurrentEquipeMember();
  if (!input.titulo.trim()) throw new Error("Informe o título da tarefa.");
  const description = input.descricao?.trim() || null;
  if (!input.assigned_to) {
    throw new Error("Selecione o responsável pela tarefa.");
  }
  const assignedTo = await ensureEquipeMemberExists(input.assigned_to, "responsável");
  if (!assignedTo) throw new Error("Selecione o responsável pela tarefa.");

  // V3: existe um único destino da tarefa. O criador é sempre derivado
  // da sessão autenticada e não deve ser escolhido no formulário.
  const direcionamento = taskId ? Array.from(new Set([assignedTo, ...input.direcionamento])) : [assignedTo];

  const startDate = requireDatabaseDate(input.data_inicio, "Data inicial");
  const endDate = requireDatabaseDate(input.data_fim, "Data final");
  if (endDate < startDate) throw new Error("A data final não pode ser anterior à data inicial.");

  // Montado explicitamente para impedir que campos derivados de CalendarTask
  // (comentários, anexos e suas contagens) cheguem ao INSERT de public.tasks.
  const taskValues = {
    titulo: input.titulo.trim(),
    descricao: description,
    data_tarefa: startDate,
    data_inicio: startDate,
    data_fim: endDate,
    prioridade: input.prioridade,
    status: toDbStatus(input.status),
    assigned_to: assignedTo,
    direcionamento: direcionamento.length ? direcionamento : null,
    updated_at: new Date().toISOString(),
  };

  if (taskId) {
    const { data, error } = await supabase.from("tasks").update(taskValues).eq("id", taskId).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("A tarefa não foi atualizada. Confira sua permissão ou recarregue a lista.");
    return taskId;
  }

  const payload: TaskInsert = {
    ...taskValues,
    created_by: currentMember.id,
  };

  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("A tarefa não foi retornada após a criação.");
  const createdTaskId = data.id as string;
  return createdTaskId;
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
    .eq("id", taskId).select("id").maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) throw new Error("A tarefa não foi atualizada. Confira sua permissão.");
  return {
    id: taskId,
    status,
    updated_at: payload.updated_at,
  } as any;
}

export async function deleteTask(taskId: string) {
  return deleteTaskWithFiles(taskId);
}

export async function fetchNotifications(): Promise<TeamNotification[]> {
  const currentDate = new Date();
  const start = new Date(currentDate); start.setDate(start.getDate() - 60);
  const end = new Date(currentDate); end.setDate(end.getDate() + 60);
  const today = localDateKey(currentDate);
  let query = supabase
    .from("tasks")
    .select("id,titulo,data_inicio,data_fim,status,assigned_to,created_by,created_at,updated_at")
    .lte("data_inicio", localDateKey(end))
    .gte("data_fim", localDateKey(start))
    .order("updated_at", { ascending: false })
    .limit(30);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const notifications: TeamNotification[] = [];
  rows.filter((task) => normalizeStatus(task.status) !== "concluida" && normalizeStatus(task.status) !== "cancelada" && String(task.data_fim ?? "") < today)
    .slice(0, 5).forEach((task) => notifications.push({ id: `overdue-${task.id}`, type: "overdue", message: `Tarefa atrasada: ${task.titulo ?? "Sem título"}`, status: "novo", date: String(task.data_fim) }));
  rows.filter((task) => normalizeStatus(task.status) === "concluida")
    .slice(0, 5).forEach((task) => notifications.push({ id: `done-${task.id}`, type: "done", message: `Tarefa concluída: ${task.titulo ?? "Sem título"}`, status: "lido", date: task.updated_at }));
  rows.slice(0, 5).forEach((task) => notifications.push({ id: `task-${task.id}`, type: "task", message: `Tarefa atualizada: ${task.titulo ?? "Sem título"}`, status: "novo", date: task.updated_at ?? task.created_at }));
  return notifications.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

export async function addTaskComment(taskId: string, comentario: string) {
  const { currentMember } = await requireCurrentEquipeMember();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: currentMember.id,
    comentario,
  });

  if (error) throw new Error(error.message);
}

export async function uploadTaskAttachment(taskId: string, file: File) {
  const uploaded = await uploadRkcDriveFile({
    file,
    module: "tasks",
    category: "anexo",
    taskId,
    entityId: taskId,
    accessScope: "assignees",
    visibility: "private",
  });
  return {
    id: uploaded.id,
    task_id: taskId,
    file_url: `drive:${uploaded.id}`,
    file_name: uploaded.name,
    created_at: uploaded.created_at,
  } as TaskAttachment;
}

export async function openTaskAttachment(attachment: Pick<TaskAttachment, "file_url" | "file_name">) {
  if (/^https?:\/\//i.test(attachment.file_url)) {
    window.open(attachment.file_url, "_blank", "noopener,noreferrer");
    return attachment.file_url;
  }
  if (!attachment.file_url?.startsWith("drive:")) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) throw new Error("Permita pop-ups para abrir este arquivo.");
    tab.opener = null;
    try {
      const url = await getTaskAttachmentSignedUrl(attachment.file_url);
      tab.location.href = url;
      return url;
    } catch (error) { tab.close(); throw error; }
  }
  const id = attachment.file_url.slice("drive:".length);
  const blob = await downloadRkcDriveFile(id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  anchor.download = attachment.file_name || "anexo";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return url;
}

export async function getTaskAttachmentSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function createExternalAttachment(taskId: string, url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use um link http ou https.");
  const payload = {
    task_id: taskId,
    file_url: url,
    file_name: url,
  };

  const insertResult = await supabase.from("task_attachments").insert(payload).select("*").single();
  if (insertResult.error) throw new Error(insertResult.error.message);

  return insertResult.data as TaskAttachment;
}

export async function deleteTaskAttachment(attachment: Pick<TaskAttachment, "id" | "file_url">) {
  if (attachment.file_url?.startsWith("drive:")) {
    await trashRkcDriveFile(attachment.file_url.slice("drive:".length));
    return;
  }
  if (attachment.file_url && !/^https?:\/\//i.test(attachment.file_url)) {
    const storageResult = await supabase.storage.from(BUCKET).remove([attachment.file_url]);
    if (storageResult.error) throw new Error("Não foi possível remover o anexo legado da tarefa.");
  }
  const { error } = await supabase.from("task_attachments").delete().eq("id", attachment.id);
  if (error) throw new Error(error.message);
}

export interface TaskWorkflowDetails {
  task: { expected_delivery: string | null; completion_criteria: string | null; project_id: string | null; reviewer_id: string | null; blocked_reason: string | null; blocked_by: string | null; workflow_version: number; status: TaskStatus };
  items: ChecklistItem[]; links: FileLink[]; history: WorkflowHistory[]; members: string[];
}
export async function fetchTaskWorkflow(taskId: string): Promise<TaskWorkflowDetails> {
  const results = await Promise.all([
    supabase.from("tasks").select("expected_delivery,completion_criteria,project_id,reviewer_id,blocked_reason,blocked_by,workflow_version,status").eq("id", taskId).single(),
    supabase.from("task_checklist_items").select("*").eq("task_id", taskId).order("position").order("id"),
    supabase.from("task_file_links").select("*").eq("task_id", taskId),
    supabase.from("task_workflow_history").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(100),
    supabase.from("task_assignees").select("user_id").eq("task_id", taskId),
  ]);
  results.forEach(r => { if (r.error) throw new Error(r.error.message); });
  return { task: results[0].data, items: results[1].data ?? [], links: results[2].data ?? [], history: results[3].data ?? [], members: (results[4].data ?? []).map(row => row.user_id) } as TaskWorkflowDetails;
}
export async function mutateTaskWorkflow(taskId: string, action: string, payload: Record<string, unknown>, version: number, requestId: string) {
  const { data, error } = await supabase.rpc("mutate_task_workflow", { p_task: taskId, p_action: action, p_payload: payload, p_version: version, p_request: requestId });
  if (error) throw new Error(error.message);
  return data as { version: number; total: number; completed: number; percent: number | null; replayed?: boolean };
}

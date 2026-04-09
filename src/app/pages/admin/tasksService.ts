import { supabase } from "@/lib/supabase";
import type { AttachmentType, Notification, Task, TaskAttachment, TeamProfile } from "./tasksTypes";

const BUCKET = "task-files";

function inferAttachmentType(file: File): AttachmentType {
  if (file.type.startsWith("image/")) return "foto";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.includes("word") || file.type.includes("sheet") || file.type.includes("officedocument")) return "documento";
  return "arquivo";
}

export async function fetchTeamProfiles() {
  const { data, error } = await supabase.from("profiles").select("id,nome,email,ativo").eq("ativo", true).order("nome");
  if (error) {
    throw new Error(`Não foi possível carregar integrantes em public.profiles: ${error.message}`);
  }
  return (data ?? []) as TeamProfile[];
}

export async function fetchTasksInRange(startDate: string, endDate: string, userId: string, canManage: boolean) {
  let query = supabase
    .from("tasks")
    .select(
      "id,titulo,descricao,data_tarefa,hora_inicio,hora_fim,prioridade,status,assigned_to,created_by,external_link,mentions,created_at,updated_at,assigned_profile:profiles!tasks_assigned_to_fkey(nome,email),created_profile:profiles!tasks_created_by_fkey(nome,email),task_attachments(*)",
    )
    .gte("data_tarefa", startDate)
    .lte("data_tarefa", endDate)
    .order("data_tarefa", { ascending: true })
    .order("hora_inicio", { ascending: true, nullsFirst: false });

  if (!canManage) query = query.eq("assigned_to", userId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Partial<Task>[]).map((task) => ({
    ...task,
    mentions: Array.isArray(task.mentions) ? task.mentions.filter((id): id is string => typeof id === "string") : [],
  })) as Task[];
}

export async function createTask(payload: Omit<Task, "id" | "created_at" | "updated_at" | "task_attachments" | "assigned_profile" | "created_profile">) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...payload,
      id: crypto.randomUUID(),
      mentions: [...new Set(payload.mentions ?? [])],
    })
    .select("id")
    .single();
  if (error) throw new Error(`Erro ao inserir tarefa: ${error.message}`);
  return data.id as string;
}

export async function updateTask(
  taskId: string,
  payload: Omit<Task, "id" | "created_at" | "updated_at" | "task_attachments" | "assigned_profile" | "created_profile">,
) {
  const { error } = await supabase
    .from("tasks")
    .update({
      ...payload,
      mentions: [...new Set(payload.mentions ?? [])],
    })
    .eq("id", taskId);
  if (error) throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(`Erro ao excluir tarefa: ${error.message}`);
}

export async function isDuplicateTask(payload: Pick<Task, "id" | "titulo" | "data_tarefa" | "hora_inicio" | "hora_fim" | "assigned_to">) {
  let query = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("titulo", payload.titulo)
    .eq("data_tarefa", payload.data_tarefa)
    .eq("assigned_to", payload.assigned_to ?? "");
  if (payload.hora_inicio) query = query.eq("hora_inicio", payload.hora_inicio);
  if (payload.hora_fim) query = query.eq("hora_fim", payload.hora_fim);
  if (payload.id) query = query.neq("id", payload.id);

  const { count, error } = await query;
  if (error) throw new Error(`Erro ao validar duplicidade da tarefa: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function uploadTaskAttachment(taskId: string, file: File, uploadedBy: string) {
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const path = `tasks/${taskId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw new Error(`Erro no upload para storage: ${uploadError.message}`);

  const metadata: Omit<TaskAttachment, "id" | "created_at"> = {
    task_id: taskId,
    tipo: inferAttachmentType(file),
    external_url: null,
    storage_bucket: BUCKET,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: uploadedBy,
  };

  const { error: insertError } = await supabase.from("task_attachments").insert(metadata);
  if (insertError) throw new Error(`Arquivo enviado, mas falhou ao salvar metadados: ${insertError.message}`);
}

export async function createExternalAttachment(taskId: string, url: string, uploadedBy: string) {
  const payload = {
    task_id: taskId,
    tipo: "link" as AttachmentType,
    external_url: url,
    uploaded_by: uploadedBy,
  };
  const { error } = await supabase.from("task_attachments").insert(payload);
  if (error) throw new Error(`Erro ao salvar anexo externo: ${error.message}`);
}

export async function fetchNotifications(userId: string, canManage: boolean) {
  let query = supabase
    .from("notifications")
    .select("id,user_id,task_id,tipo,titulo,mensagem,lida,created_at,read_at,tasks(titulo,data_tarefa,assigned_to),recipient:profiles!notifications_user_id_fkey(nome,email)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!canManage) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase.from("notifications").update({ lida: true, read_at: new Date().toISOString() }).eq("id", notificationId);
  if (error) throw new Error(error.message);
}

export async function notifyUsers(task: Pick<Task, "id" | "titulo" | "data_tarefa" | "assigned_to" | "mentions">, actorUserId: string, action: "created" | "updated") {
  const userIds = [...new Set([task.assigned_to, ...(task.mentions ?? [])].filter(Boolean) as string[])];
  if (userIds.length === 0) return;

  const payload = {
    taskId: task.id,
    actorUserId,
    userIds,
    action,
    taskTitle: task.titulo,
    taskDate: task.data_tarefa,
  };

  const response = await fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao notificar usuários (${response.status}): ${body || response.statusText}`);
  }
}

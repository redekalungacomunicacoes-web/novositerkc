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
    throw new Error("Seu usuário autenticado não possui vínculo ativo com a equipe. Solicite ao administrador para vincular seu acesso antes de criar tarefas ou anexos.");
  }
  return currentMember;
}

export async function fetchTeamProfiles() {
  const equipeQuery = await supabase
    .from("equipe")
    .select("id,user_id,nome,email_login,ativo,is_active")
    .order("nome", { ascending: true });

  if (!equipeQuery.error) {
    const mapped = (equipeQuery.data ?? [])
      .filter((member) => !!member.user_id)
      .filter((member) => (member.is_active ?? member.ativo ?? true) === true)
      .map(
        (member) =>
          ({
            id: member.id as string,
            equipe_id: member.id as string,
            nome: member.nome ?? null,
            email: member.email_login ?? null,
            ativo: true,
          }) satisfies TeamProfile,
      );

    if (mapped.length > 0) return mapped;
  }

  const profilesQuery = await supabase.from("profiles").select("id,nome,email,ativo").eq("ativo", true).order("nome");
  if (profilesQuery.error) {
    throw new Error(`Não foi possível carregar integrantes em equipe/profiles: ${profilesQuery.error.message}`);
  }
  return (profilesQuery.data ?? []) as TeamProfile[];
}

export async function fetchTasksInRange(startDate: string, endDate: string, userId: string, canManage: boolean) {
  const buildQuery = (includeProfileRelations: boolean) => {
    const selectWithRelations =
      "id,titulo,descricao,data_tarefa,prioridade,status,assigned_to,created_by,external_link,direcionamento,created_at,updated_at,assigned_profile:equipe!tasks_assigned_to_fkey(nome,email_login),created_profile:equipe!tasks_created_by_fkey(nome,email_login),task_attachments(*)";
    const selectPlain = "id,titulo,descricao,data_tarefa,prioridade,status,assigned_to,created_by,external_link,direcionamento,created_at,updated_at,task_attachments(*)";

    let query = supabase
    .from("tasks")
      .select(includeProfileRelations ? selectWithRelations : selectPlain)
      .gte("data_tarefa", startDate)
      .lte("data_tarefa", endDate)
      .order("data_tarefa", { ascending: true })
      ;

    if (!canManage) query = query.eq("assigned_to", userId);
    return query;
  };

  let { data, error } = await buildQuery(true);
  if (error && /relationship|tasks_.*_fkey|profiles|equipe/i.test(error.message)) {
    const fallbackResult = await buildQuery(false);
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) throw new Error(error.message);
  return ((data ?? []) as Partial<Task>[]).map((task) => ({
    ...task,
    direcionamento: Array.isArray(task.direcionamento) ? task.direcionamento.filter((id): id is string => typeof id === "string") : [],
  })) as Task[];
}

export async function createTask(payload: Omit<Task, "id" | "created_at" | "updated_at" | "task_attachments" | "assigned_profile" | "created_profile">) {
  const currentMember = await requireCurrentEquipeMember();

  if (payload.assigned_to && !payload.direcionamento.includes(payload.assigned_to)) {
    throw new Error("Responsável deve estar no direcionamento");
  }

  if (payload.assigned_to) {
    const exists = await equipeMemberExistsById(payload.assigned_to);
    if (!exists) {
      throw new Error("Responsável inválido: selecione um integrante da equipe.");
    }
  }

  const finalPayload = {
    ...payload,
    created_by: currentMember.id,
    assigned_to: payload.assigned_to ?? null,
    direcionamento: [...new Set(payload.direcionamento ?? [])],
  };

  console.log("[tarefas:create] currentMember", currentMember);
  console.log("[tarefas:create] created_by", finalPayload.created_by);
  console.log("[tarefas:create] assigned_to", finalPayload.assigned_to);
  console.log("[tarefas:create] payload final", finalPayload);

  const { data, error } = await supabase
    .from("tasks")
    .insert(finalPayload)
    .select("id")
    .single();
  if (error) throw new Error(`Erro ao inserir tarefa: ${error.message}`);
  return data.id as string;
}

export async function equipeMemberExistsById(memberId: string) {
  const equipeResult = await supabase.from("equipe").select("id").eq("id", memberId).maybeSingle();
  if (equipeResult.error) {
    throw new Error(`Não foi possível validar o integrante da tarefa: ${equipeResult.error.message}`);
  }
  return Boolean(equipeResult.data?.id);
}

export async function updateTask(
  taskId: string,
  payload: Omit<Task, "id" | "created_at" | "updated_at" | "task_attachments" | "assigned_profile" | "created_profile">,
) {
  if (payload.assigned_to && !payload.direcionamento.includes(payload.assigned_to)) {
    throw new Error("Responsável deve estar no direcionamento");
  }

  if (payload.assigned_to) {
    const exists = await equipeMemberExistsById(payload.assigned_to);
    if (!exists) {
      throw new Error("Responsável inválido: selecione um integrante da equipe.");
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      ...payload,
      assigned_to: payload.assigned_to ?? null,
      direcionamento: [...new Set(payload.direcionamento ?? [])],
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
  
  if (payload.id) query = query.neq("id", payload.id);

  const { count, error } = await query;
  if (error) throw new Error(`Erro ao validar duplicidade da tarefa: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function uploadTaskAttachment(taskId: string, file: File, uploadedBy: string) {
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const path = `tasks/${taskId}/${crypto.randomUUID()}-${safeName}`;

  console.log("[tarefas:anexos] task_id", taskId);
  console.log("[tarefas:anexos] arquivo", { name: file.name, type: file.type, size: file.size });

  const uploadResult = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  console.log("[tarefas:anexos] upload", uploadResult);
  if (uploadResult.error) throw new Error(`Erro no upload para storage: ${uploadResult.error.message}`);

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

  const insertResult = await supabase.from("task_attachments").insert(metadata).select("*").single();
  console.log("[tarefas:anexos] insert", insertResult);
  if (insertResult.error) throw new Error(`Arquivo enviado, mas falhou ao salvar metadados: ${insertResult.error.message}`);
}

export async function createExternalAttachment(taskId: string, url: string, uploadedBy: string) {
  const payload = {
    task_id: taskId,
    tipo: "link" as AttachmentType,
    external_url: url,
    uploaded_by: uploadedBy,
  };
  console.log("[tarefas:anexos] task_id", taskId);
  console.log("[tarefas:anexos] arquivo", { external_url: url });
  console.log("[tarefas:anexos] upload", "link externo sem storage");
  const insertResult = await supabase.from("task_attachments").insert(payload).select("*").single();
  console.log("[tarefas:anexos] insert", insertResult);
  if (insertResult.error) throw new Error(`Erro ao salvar anexo externo: ${insertResult.error.message}`);
}

export async function fetchNotifications(userId: string, canManage: boolean) {
  const buildQuery = (withRecipientRelation: boolean) => {
    const selectWithRecipient =
      "id,user_id,task_id,tipo,titulo,mensagem,lida,created_at,read_at,tasks(titulo,data_tarefa,assigned_to),recipient:profiles!notifications_user_id_fkey(nome,email)";
    const selectWithoutRecipient = "id,user_id,task_id,tipo,titulo,mensagem,lida,created_at,read_at,tasks(titulo,data_tarefa,assigned_to)";

    let query = supabase
      .from("notifications")
      .select(withRecipientRelation ? selectWithRecipient : selectWithoutRecipient)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!canManage) query = query.eq("user_id", userId);
    return query;
  };

  let { data, error } = await buildQuery(true);
  if (error && /relationship|notifications_user_id_fkey|profiles/i.test(error.message)) {
    const fallbackResult = await buildQuery(false);
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase.from("notifications").update({ lida: true, read_at: new Date().toISOString() }).eq("id", notificationId);
  if (error) throw new Error(error.message);
}

export async function notifyUsers(task: Pick<Task, "id" | "titulo" | "data_tarefa" | "assigned_to" | "direcionamento">, actorUserId: string, action: "created" | "updated") {
  const userIds = [...new Set([task.assigned_to, ...(task.direcionamento ?? [])].filter(Boolean) as string[])];
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

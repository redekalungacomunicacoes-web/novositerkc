import { ensureDrivePath, createDriveFolder, getDriveFileMetadata, renameDriveFile } from "./google-drive.ts";

type Client = any;

// All entry points share the same persisted destination and a database lease.
// The creator identifies the logged-in member at creation, even if reassigned later.
export async function prepareTaskFolder(taskId: string, root: string, admin: Client) {
  const read = async () => {
    const { data, error } = await admin.from("tasks")
      .select("id,titulo,created_by,drive_folder_id").eq("id", taskId).single();
    if (error || !data) throw new Error("Tarefa não encontrada.");
    return data;
  };
  const title = (task: any) => String(task.titulo || "Tarefa").replace(/[\\/\r\n"]/g, "_").trim().slice(0, 120) || "Tarefa";
  const reuse = async (task: any) => {
    const folder = await getDriveFileMetadata(String(task.drive_folder_id));
    if (folder.trashed || folder.mimeType !== "application/vnd.google-apps.folder")
      throw new Error("A pasta da tarefa foi removida ou está indisponível.");
    if (folder.name !== title(task)) await renameDriveFile(folder.id, title(task));
    return String(folder.id);
  };
  let task = await read();
  if (task.drive_folder_id) return reuse(task);
  const token = crypto.randomUUID();
  const { error: insertError } = await admin.from("task_drive_locks")
    .upsert({ task_id: taskId, token, locked_at: new Date().toISOString() }, { onConflict: "task_id", ignoreDuplicates: true });
  if (insertError) throw insertError;
  const { data: lease, error: leaseError } = await admin.from("task_drive_locks")
    .update({ token, locked_at: new Date().toISOString() }).eq("task_id", taskId)
    .or(`token.eq.${token},locked_at.lt.${new Date(Date.now() - 120_000).toISOString()}`).select("token").maybeSingle();
  if (leaseError) throw leaseError;
  if (!lease) {
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      task = await read();
      if (task.drive_folder_id) return reuse(task);
    }
    throw new Error("A pasta da tarefa está sendo preparada. Tente novamente em alguns segundos.");
  }
  let rootLease = false;
  try {
    // Different tasks share the root/member/TAREFAS parents. Serialize initial
    // path discovery too, so first creations cannot duplicate shared parents.
    const { error: rootInsertError } = await admin.from("task_drive_root_locks")
      .upsert({ root_folder_id: root, token, locked_at: new Date().toISOString() }, { onConflict: "root_folder_id", ignoreDuplicates: true });
    if (rootInsertError) throw rootInsertError;
    for (let attempt = 0; attempt < 30; attempt++) {
      const result = await admin.from("task_drive_root_locks")
        .update({ token, locked_at: new Date().toISOString() }).eq("root_folder_id", root)
        .or(`token.eq.${token},locked_at.lt.${new Date(Date.now() - 120_000).toISOString()}`).select("token").maybeSingle();
      if (result.error) throw result.error;
      if (result.data) { rootLease = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!rootLease) throw new Error("O Drive está preparando outra pasta. Tente novamente em alguns segundos.");
    task = await read();
    if (task.drive_folder_id) return reuse(task);
    if (!task.created_by) throw new Error("A tarefa não possui um criador vinculado à equipe.");
    const { data: member, error } = await admin.from("equipe").select("id,nome").eq("id", task.created_by).single();
    if (error || !member) throw new Error("O criador da tarefa não foi encontrado na equipe.");
    const safe = (name: string) => name.replace(/[\\/\r\n"]/g, "_").trim().slice(0, 120);
    // Reuse the canonical team root, not the obsolete 05_INTEGRANTES tree.
    const path = await ensureDrivePath(root, ["04_EQUIPE", safe(member.nome || member.id), "TAREFAS"]);
    const folder = await createDriveFolder(title(task), path.folderId);
    const result = await admin.from("tasks").update({ drive_folder_id: folder.id }).eq("id", taskId).select("id").single();
    if (result.error) throw result.error;
    return folder.id as string;
  } finally {
    if (rootLease) {
      const { error } = await admin.from("task_drive_root_locks").update({ locked_at: "1970-01-01T00:00:00Z" }).eq("root_folder_id", root).eq("token", token);
      if (error) console.error("[task-drive] release root lease", error);
    }
    const { error } = await admin.from("task_drive_locks").delete().eq("task_id", taskId).eq("token", token);
    if (error) console.error("[task-drive] release lease", error);
  }
}

export async function requireTaskDeletion(taskId: string, userClient: Client, admin: Client, authUserId: string) {
  const { data: task, error } = await userClient.from("tasks").select("id,created_by,drive_folder_id").eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!task) throw new Error("Tarefa não encontrada ou sem permissão.");
  const [member, role] = await Promise.all([
    admin.from("equipe").select("user_id").eq("id", task.created_by).maybeSingle(),
    userClient.rpc("is_team_admin"),
  ]);
  if (member.error || role.error) throw new Error("Não foi possível verificar a permissão para excluir.");
  if (member.data?.user_id !== authUserId && role.data !== true)
    throw new Error("Somente o criador ou um administrador pode excluir esta tarefa.");
  return task;
}

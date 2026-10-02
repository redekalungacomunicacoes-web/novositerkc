import { trashDriveFile } from "./google-drive.ts";
import { requireTaskDeletion } from "./task-drive.ts";

type Client = any;

// Durable outbox: confirm database deletion before touching physical files.
// Jobs survive Drive/network failures and are writable only by the backend.
export async function deleteTaskAndQueueCleanup(taskId: string, userClient: Client, admin: Client, userId: string) {
  let task;
  try {
    task = await requireTaskDeletion(taskId, userClient, admin, userId);
  } catch (error) {
    const existing = await admin.from("tasks").select("id").eq("id", taskId).maybeSingle();
    if (!existing.error && !existing.data) return retryTaskCleanup(taskId, userClient, admin, userId);
    throw error;
  }
  const [files, legacy, lock] = await Promise.all([
    admin.from("drive_files").select("id,drive_file_id").eq("task_id", taskId).eq("module", "tasks").neq("status", "trashed"),
    admin.from("task_attachments").select("file_url").eq("task_id", taskId),
    admin.from("task_drive_locks").select("locked_at").eq("task_id", taskId).maybeSingle(),
  ]);
  if (files.error || legacy.error || lock.error) throw files.error || legacy.error || lock.error;
  if (lock.data && Date.parse(lock.data.locked_at) > Date.now() - 120_000)
    throw new Error("A pasta está sendo preparada. Aguarde alguns segundos antes de excluir.");
  const payload = {
    folder_id: task.drive_folder_id,
    files: files.data || [],
    storage_paths: (legacy.data || []).map((item: { file_url: string }) => item.file_url)
      .filter((path: string) => path && !/^(https?:\/\/|drive:)/i.test(path)),
  };
  const job = await admin.from("task_cleanup_jobs").upsert({ task_id: taskId, requested_by: userId, payload, status: "pending" });
  if (job.error) throw job.error;
  const { data: deleted, error } = await userClient.from("tasks").delete().eq("id", taskId).select("id").maybeSingle();
  if (error) throw error;
  if (!deleted) throw new Error("A exclusão não foi confirmada. Confira sua permissão.");
  return retryTaskCleanup(taskId, userClient, admin, userId);
}

export async function retryTaskCleanup(taskId: string, userClient: Client, admin: Client, userId: string) {
  const { data: job, error } = await admin.from("task_cleanup_jobs").select("*").eq("task_id", taskId).single();
  if (error || !job) throw new Error("Limpeza da tarefa não encontrada.");
  if (job.requested_by !== userId) {
    const role = await userClient.rpc("is_team_admin");
    if (role.error || role.data !== true) throw new Error("Sem permissão para concluir a limpeza.");
  }
  // A failed DELETE must never dispatch the previously prepared job.
  const task = await admin.from("tasks").select("id").eq("id", taskId).maybeSingle();
  if (task.error) throw task.error;
  if (task.data) throw new Error("A tarefa ainda existe. Nenhum arquivo foi removido.");
  try {
    if (job.status === "done") return { ok: true, task_id: taskId, cleanup_pending: false };
    for (const file of job.payload.files) {
      await trashDriveFile(file.drive_file_id);
      const result = await admin.from("drive_files").update({ status: "trashed", deleted_at: new Date().toISOString() }).eq("id", file.id);
      if (result.error) throw result.error;
    }
    if (job.payload.storage_paths.length) {
      const result = await admin.storage.from("task-files").remove(job.payload.storage_paths);
      if (result.error) throw result.error;
    }
    if (job.payload.folder_id) await trashDriveFile(job.payload.folder_id);
    const result = await admin.from("task_cleanup_jobs").update({ status: "done", last_error: null, updated_at: new Date().toISOString() }).eq("task_id", taskId);
    if (result.error) throw result.error;
    return { ok: true, task_id: taskId, cleanup_pending: false };
  } catch (error) {
    console.error("[task-cleanup] pending", taskId, error);
    await admin.from("task_cleanup_jobs").update({ last_error: error instanceof Error ? error.message : "Falha na limpeza", updated_at: new Date().toISOString() }).eq("task_id", taskId);
    return { ok: true, task_id: taskId, cleanup_pending: true };
  }
}

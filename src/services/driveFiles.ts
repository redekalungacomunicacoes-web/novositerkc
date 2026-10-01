import { supabase } from "../lib/supabase";

export type DriveFileRecord = {
  id: string;
  drive_file_id: string;
  drive_folder_id: string | null;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  module: string;
  entity_id: string | null;
  task_id?: string | null;
  access_scope?: "assignees" | "team";
  category: string | null;
  web_view_link: string | null;
  uploaded_by: string | null;
  created_at: string;
  visibility: "private" | "public";
  status: "active" | "archived" | "trashed";
  public_slug: string | null;
  sort_order: number;
  caption: string | null;
  alt_text: string | null;
};

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("drive-files", { body });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Falha na operação do Drive RKC.");
  return data;
}

export async function checkRkcDrive() {
  return (await invoke({ action: "health" })).drive;
}

export async function uploadRkcDriveFile(input: {
  file: File;
  module: string;
  category?: string;
  entityId?: string;
  taskId?: string;
  folderId?: string;
  accessScope?: "assignees" | "team";
  visibility?: "private" | "public";
}) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("module", input.module);
  form.append("category", input.category || "arquivo");
  form.append("visibility", input.visibility || "private");
  if (input.entityId) form.append("entity_id", input.entityId);
  if (input.taskId) form.append("task_id", input.taskId);
  if (input.folderId) form.append("folder_id", input.folderId);
  if (input.accessScope) form.append("access_scope", input.accessScope);
  const { data, error } = await supabase.functions.invoke("drive-files", { body: form });
  if (error) throw error;
  if (!data?.ok || !data?.file) throw new Error(data?.error || "Falha no upload ao Drive da RKC.");
  return data.file as DriveFileRecord;
}

export async function downloadRkcDriveFile(id: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("drive-files", { body: { action: "download", id } });
  if (error) throw error;
  if (!(data instanceof Blob)) throw new Error("O Drive não retornou o arquivo.");
  return data;
}

export async function renameRkcDriveFile(id: string, name: string) {
  return (await invoke({ action: "rename", id, name })).file as DriveFileRecord;
}
export async function moveRkcDriveFile(id: string, folderId: string) {
  return (await invoke({ action: "move", id, folder_id: folderId })).file as DriveFileRecord;
}
export async function setRkcDriveFileVisibility(id: string, visibility: "private" | "public") {
  return (await invoke({ action: "visibility", id, visibility })).file as DriveFileRecord;
}
export async function trashRkcDriveFile(id: string) {
  return (await invoke({ action: "trash", id })).file as DriveFileRecord;
}

export function publicRkcDriveMediaUrl(file: Pick<DriveFileRecord, "public_slug">) {
  if (!file.public_slug) return null;
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/drive-media?id=${encodeURIComponent(file.public_slug)}`;
}

export async function listRkcDriveFiles(module: string, entityId?: string) {
  let query = supabase.from("drive_files").select("*").eq("module", module).neq("status", "trashed").order("sort_order").order("created_at", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DriveFileRecord[];
}

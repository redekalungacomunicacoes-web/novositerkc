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
  category: string | null;
  web_view_link: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export async function checkRkcDrive() {
  const { data, error } = await supabase.functions.invoke("drive-files", {
    body: { action: "health" },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Drive RKC indisponivel.");
  return data.drive;
}

export async function uploadRkcDriveFile(input: {
  file: File;
  module: string;
  category?: string;
  entityId?: string;
  folderId?: string;
}) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("module", input.module);
  form.append("category", input.category || "arquivo");
  if (input.entityId) form.append("entity_id", input.entityId);
  if (input.folderId) form.append("folder_id", input.folderId);

  const { data, error } = await supabase.functions.invoke("drive-files", { body: form });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Falha no upload ao Drive da RKC.");
  return data.file as DriveFileRecord;
}

export async function listRkcDriveFiles(module: string, entityId?: string) {
  let query = supabase
    .from("drive_files")
    .select("*")
    .eq("module", module)
    .order("created_at", { ascending: false });

  if (entityId) query = query.eq("entity_id", entityId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DriveFileRecord[];
}

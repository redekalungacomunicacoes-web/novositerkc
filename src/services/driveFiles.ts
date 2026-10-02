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
  academy_course_id?: string | null;
  academy_lesson_id?: string | null;
  academy_kind?: "cover" | "media" | "material" | null;
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

async function driveError(error: unknown): Promise<Error> {
  const context = (error as { context?: Response })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body.error) return new Error(body.error);
    } catch {
      /* use original network error */
    }
  }
  return error instanceof Error ? error : new Error("Drive RKC indisponível.");
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("drive-files", {
    body,
  });
  if (error) throw await driveError(error);
  if (!data?.ok)
    throw new Error(data?.error || "Falha na operação do Drive RKC.");
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
  const { data, error } = await supabase.functions.invoke("drive-files", {
    body: form,
  });
  if (error) throw await driveError(error);
  if (!data?.ok || !data?.file)
    throw new Error(data?.error || "Falha no upload ao Drive da RKC.");
  return data.file as DriveFileRecord;
}

export async function downloadRkcDriveFile(id: string): Promise<Blob> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new Error("Sua sessão expirou. Entre novamente.");
  // Preserve exact bytes for every MIME type; functions.invoke parses JSON/text downloads.
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "download", id }),
    },
  );
  if (!response.ok) {
    let detail = "Não foi possível abrir o arquivo privado no Drive RKC.";
    try {
      const body = await response.json();
      if (body.error) detail = body.error;
    } catch {
      /* use fallback when backend is unavailable */
    }
    throw new Error(detail);
  }
  return response.blob();
}

export async function renameRkcDriveFile(id: string, name: string) {
  return (await invoke({ action: "rename", id, name })).file as DriveFileRecord;
}
export async function moveRkcDriveFile(id: string, folderId: string) {
  return (await invoke({ action: "move", id, folder_id: folderId }))
    .file as DriveFileRecord;
}
export async function setRkcDriveFileVisibility(
  id: string,
  visibility: "private" | "public",
) {
  return (await invoke({ action: "visibility", id, visibility }))
    .file as DriveFileRecord;
}
export async function trashRkcDriveFile(id: string) {
  return (await invoke({ action: "trash", id })).file as DriveFileRecord;
}

export function publicRkcDriveMediaUrl(
  file: Pick<DriveFileRecord, "public_slug">,
) {
  if (!file.public_slug) return null;
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/drive-media?id=${encodeURIComponent(file.public_slug)}`;
}

export async function listRkcDriveFiles(module: string, entityId?: string) {
  let query = supabase
    .from("drive_files")
    .select("*")
    .eq("module", module)
    .neq("status", "trashed")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  const { data, error } = await query;
  if (error) throw await driveError(error);
  return (data || []) as DriveFileRecord[];
}

export async function checkAcademyDrive() {
  return (await invoke({ action: "academy-health" })).drive;
}
export async function removeAcademyFile(id: string) {
  return invoke({ action: "academy-trash", id });
}
export async function uploadAcademyFile(input: {
  file: File;
  courseId: string;
  lessonId?: string;
  kind: "cover" | "media" | "material";
  uploadId: string;
  replaceMaterialId?: string;
  onProgress: (percent: number) => void;
}): Promise<DriveFileRecord> {
  const limit = input.kind === "cover" ? 25 * 1024 * 1024 : 15 * 1024 * 1024 * 1024;
  if (input.file.size > limit)
    throw new Error(input.kind === "cover" ? "A capa deve ter no máximo 25 MB." : "O limite por arquivo é 15 GB.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new Error("Sua sessão expirou. Entre novamente.");
  const form = new FormData();
  form.append("file", input.file);
  form.append("module", "academy");
  form.append("course_id", input.courseId);
  form.append("kind", input.kind);
  form.append("upload_id", input.uploadId);
  if (input.lessonId) form.append("lesson_id", input.lessonId);
  if (input.replaceMaterialId)
    form.append("replace_material_id", input.replaceMaterialId);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-files`,
    );
    xhr.setRequestHeader(
      "Authorization",
      `Bearer ${data.session!.access_token}`,
    );
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY);
    xhr.timeout = 240000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        input.onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () =>
      reject(
        new Error("Falha de conexão com o Drive. O arquivo continua pendente."),
      );
    xhr.ontimeout = () =>
      reject(
        new Error(
          "O envio excedeu o tempo de espera. Tente novamente para conferir se foi concluído.",
        ),
      );
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && result.ok && result.file)
          resolve(result.file);
        else
          reject(
            new Error(
              result.error || "O envio não foi confirmado pelo Drive RKC.",
            ),
          );
      } catch {
        reject(new Error("O backend não retornou confirmação do envio."));
      }
    };
    xhr.send(form);
  });
}

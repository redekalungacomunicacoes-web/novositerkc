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
  central_folder_id?: string | null;
  academy_course_id?: string | null;
  academy_lesson_id?: string | null;
  academy_kind?: "cover" | "banner" | "thumbnail" | "media" | "material" | null;
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

const taskUploadIds = new WeakMap<File, string>();

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
  if (input.taskId) {
    form.append("task_id", input.taskId);
    let uploadId = taskUploadIds.get(input.file);
    if (!uploadId) { uploadId = crypto.randomUUID(); taskUploadIds.set(input.file, uploadId); }
    form.append("upload_id", uploadId);
  }
  if (input.module === "file-center") {
    let uploadId = taskUploadIds.get(input.file);
    if (!uploadId) { uploadId = crypto.randomUUID(); taskUploadIds.set(input.file, uploadId); }
    form.append("upload_id", uploadId);
  }
  if (input.folderId) form.append("folder_id", input.folderId);
  if (input.accessScope) form.append("access_scope", input.accessScope);
  if (input.file.size > 50 * 1024 * 1024) throw new Error("O limite por arquivo é 50 MB.");
  const invocation = supabase.functions.invoke("drive-files", { body: form });
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("O Drive demorou demais para responder. A tarefa foi salva; tente reenviar somente o arquivo.")), 45_000);
  });
  const { data, error } = await Promise.race([invocation, timeout]).finally(() => clearTimeout(timer));
  if (error) throw await driveError(error);
  if (!data?.ok || !data?.file)
    throw new Error(data?.error || "Falha no upload ao Drive da RKC.");
  return data.file as DriveFileRecord;
}

export function rkcDriveMediaUrl(id: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/drive-files?action=stream&id=${encodeURIComponent(id)}`;
}

export async function createRkcDriveMediaTicket(id: string): Promise<string> {
  const data = await invoke({ action: "academy-stream-ticket", id });
  if (!data?.url) throw new Error("Não foi possível preparar o streaming da aula.");
  return String(data.url);
}

export async function rkcDriveMediaResponse(id: string, range?: string): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        ...(range ? { Range: range } : {}),
      },
      body: JSON.stringify({ action: "stream", id }),
    },
  );
  if (!response.ok && response.status !== 206) {
    let detail = "Não foi possível abrir a mídia privada no Drive RKC.";
    try {
      const body = await response.clone().json();
      if (body.error) detail = body.error;
    } catch { /* binary/network response */ }
    throw new Error(detail);
  }
  return response;
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

export async function ensureTaskDriveFolder(taskId: string) {
  const { data, error } = await supabase.functions.invoke("drive-files", {
    body: { action: "task-ensure-folder", task_id: taskId },
  });
  if (error) throw await driveError(error);
  if (!data?.ok || !data?.folder_id) throw new Error(data?.error || "Não foi possível preparar a pasta da tarefa no Drive RKC.");
  return data.folder_id as string;
}

export async function listTaskDriveFiles(taskId: string) {
  const { data, error } = await supabase
    .from("drive_files")
    .select("*")
    .eq("module", "tasks")
    .eq("task_id", taskId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
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
  kind: "cover" | "banner" | "thumbnail" | "media" | "material";
  uploadId: string;
  replaceMaterialId?: string;
  onProgress: (percent: number) => void;
}): Promise<DriveFileRecord> {
  const limit = ["cover", "banner", "thumbnail"].includes(input.kind) ? 25 * 1024 * 1024 : 15 * 1024 * 1024 * 1024;
  if (input.file.size > limit)
    throw new Error(["cover", "banner", "thumbnail"].includes(input.kind) ? "A imagem deve ter no máximo 25 MB." : "O limite por arquivo é 15 GB.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sua sessão expirou. Entre novamente.");

  // Course artwork is small enough to travel through our authenticated backend.
  // This avoids browser -> Google resumable-session CORS/network inconsistencies.
  if (["cover", "banner", "thumbnail"].includes(input.kind)) {
    const form = new FormData();
    form.append("module", input.kind === "banner" ? "academy-banner" : "academy");
    form.append("file", input.file);
    form.append("course_id", input.courseId);
    form.append("kind", input.kind);
    form.append("upload_id", input.uploadId);
    if (input.replaceMaterialId) form.append("replace_material_id", input.replaceMaterialId);
    input.onProgress(10);
    const { data: uploaded, error: uploadError } = await supabase.functions.invoke("drive-files", { body: form });
    if (uploadError) throw await driveError(uploadError);
    if (!uploaded?.ok || !uploaded?.file) throw new Error(uploaded?.error || "O Drive não confirmou a imagem.");
    input.onProgress(100);
    return uploaded.file as DriveFileRecord;
  }

  const start = await invoke({
    action: "academy-upload-start",
    course_id: input.courseId,
    lesson_id: input.lessonId || null,
    kind: input.kind,
    name: input.file.name,
    mime_type: input.file.type || "application/octet-stream",
    size: input.file.size,
  });

  const uploadUrl = String(start.upload_url || "");
  const folderId = String(start.folder_id || "");
  if (!uploadUrl || !folderId) throw new Error("O Drive não iniciou a sessão de upload.");

  const mimeType = input.file.type || "application/octet-stream";
  const chunkSize = 8 * 1024 * 1024; // Google requires chunk sizes to be multiples of 256 KiB.
  const parseConfirmedByte = (range: string | null) => {
    const match = range?.match(/bytes=0-(\d+)/i);
    return match ? Number(match[1]) : -1;
  };
  const sendChunk = (startByte: number, endByte: number) =>
    new Promise<{ status: number; range: string | null; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", mimeType);
      xhr.setRequestHeader("Content-Range", `bytes ${startByte}-${endByte}/${input.file.size}`);
      xhr.timeout = 0;
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const sent = Math.min(input.file.size, startByte + event.loaded);
        input.onProgress(Math.min(99, Math.floor((sent / input.file.size) * 99)));
      };
      xhr.onerror = () => reject(new Error("Falha de rede durante o envio."));
      xhr.onload = () => resolve({
        status: xhr.status,
        range: xhr.getResponseHeader("Range"),
        body: xhr.responseText || "",
      });
      xhr.send(input.file.slice(startByte, endByte + 1));
    });
  // Google can accept a browser PUT and still hide the response from XHR because
  // the resumable session endpoint does not consistently expose CORS headers.
  // Query the same session through our authenticated Edge Function instead.
  const querySession = async (): Promise<{ status: number; range: string | null; body: string }> => {
    const status = await invoke({
      action: "academy-upload-status",
      upload_url: uploadUrl,
      size: input.file.size,
    });
    return {
      status: Number(status.upload_status),
      range: typeof status.range === "string" ? status.range : null,
      body: typeof status.body === "string" ? status.body : "",
    };
  };

  let offset = 0;
  let uploaded: Record<string, unknown> | null = null;
  let retries = 0;
  while (offset < input.file.size) {
    const end = Math.min(input.file.size - 1, offset + chunkSize - 1);
    try {
      const response = await sendChunk(offset, end);
      if (response.status >= 200 && response.status < 300) {
        try {
          uploaded = JSON.parse(response.body) as Record<string, unknown>;
        } catch {
          throw new Error("O Google Drive finalizou o envio sem retornar metadados válidos.");
        }
        offset = input.file.size;
        break;
      }
      if (response.status === 308) {
        const confirmed = parseConfirmedByte(response.range);
        offset = confirmed >= offset ? confirmed + 1 : end + 1;
        retries = 0;
        continue;
      }
      throw new Error(`O Google Drive recusou o bloco de upload (${response.status}).`);
    } catch (error) {
      // A direct browser PUT may have succeeded while CORS hides the response.
      // Check the resumable session immediately before treating it as a network failure.
      let status: { status: number; range: string | null; body: string };
      try {
        status = await querySession();
      } catch (statusError) {
        if (++retries > 4) {
          throw new Error(
            `${error instanceof Error ? error.message : "Falha no upload"} ${statusError instanceof Error ? statusError.message : ""} O arquivo continua selecionado para nova tentativa.`.trim(),
          );
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 500 * 2 ** retries)));
        continue;
      }
      if (status.status >= 200 && status.status < 300) {
        try {
          uploaded = JSON.parse(status.body) as Record<string, unknown>;
        } catch {
          throw new Error("O Drive concluiu o upload, mas os metadados não puderam ser lidos.");
        }
        offset = input.file.size;
        break;
      }
      if (status.status === 308) {
        offset = parseConfirmedByte(status.range) + 1;
        if (offset < 0) offset = 0;
        retries = 0;
        continue;
      }
      if (++retries > 4) {
        throw new Error(
          `${error instanceof Error ? error.message : "Falha no upload"} O arquivo continua selecionado para nova tentativa.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 500 * 2 ** retries)));
      throw new Error(`A sessão resumível expirou ou foi recusada (${status.status}).`);
    }
  }
  const driveFileId = String(uploaded?.id || "");
  if (!driveFileId) throw new Error("O Drive não retornou o identificador do arquivo.");
  input.onProgress(100);
  const committed = await invoke({
    action: "academy-upload-commit",
    course_id: input.courseId,
    lesson_id: input.lessonId || null,
    kind: input.kind,
    upload_id: input.uploadId,
    replace_material_id: input.replaceMaterialId || null,
    drive_file_id: driveFileId,
    folder_id: folderId,
    expected_name: input.file.name,
    expected_mime_type: mimeType,
    expected_size: input.file.size,
  });
  return committed.file as DriveFileRecord;
}

export async function deleteTaskWithFiles(taskId: string) {
  return invoke({ action: "task-delete", task_id: taskId });
}

export async function retryPendingTaskCleanup() {
  return invoke({ action: "task-cleanup-pending" });
}

export type CenterFolder = { id:string; name:string; parent_id:string|null; owner_user_id:string; drive_folder_id:string; created_at:string };
export async function listCenterFolders():Promise<CenterFolder[]>{
 const rows:CenterFolder[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await supabase.from("file_center_folders").select("*").order("id").range(offset,offset+499);
  if(error)throw await driveError(error);
  rows.push(...(data || []));if((data?.length || 0)<500)return rows;
 }
}
export async function listCenterFolderFiles(folderId:string):Promise<DriveFileRecord[]>{
 const rows:DriveFileRecord[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await supabase.from("drive_files").select("*").eq("module","file-center").eq("central_folder_id",folderId).eq("status","active").order("id").range(offset,offset+499);
  if(error)throw await driveError(error);rows.push(...(data || []));if((data?.length || 0)<500)return rows;
 }
}
export async function createCenterFolder(name:string,parentId?:string|null){
 return (await invoke({action:"center-folder-create",name,parent_id:parentId || null})).folder as CenterFolder;
}
export async function renameCenterFolder(id:string,name:string){return invoke({action:"center-folder-rename",id,name});}
export async function deleteCenterFolder(id:string){return invoke({action:"center-folder-delete",id});}
export async function moveCenterFile(id:string,destination:{folderId?:string;taskId?:string}){
 return (await invoke({action:"center-file-move",id,folder_id:destination.folderId || null,task_id:destination.taskId || null})).file as DriveFileRecord;
}

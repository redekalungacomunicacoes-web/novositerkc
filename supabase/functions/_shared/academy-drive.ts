import {
  assertPrivateDriveFile,
  ensureDrivePath,
  resolveAcademyFolder,
  trashDriveFile,
  uploadDriveFile,
} from "./google-drive.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function uploadAcademyDrive(
  form: FormData,
  rootId: string,
  user: SupabaseClient,
  admin: SupabaseClient,
  actor: string,
) {
  const file = form.get("file");
  const course = String(form.get("course_id") || "");
  const lesson = String(form.get("lesson_id") || "") || null;
  const kind = String(form.get("kind") || "");
  const upload = String(form.get("upload_id") || "");
  const material = String(form.get("replace_material_id") || "") || null;
  if (
    !(file instanceof File) ||
    !uuid(course) ||
    !uuid(upload) ||
    (lesson && !uuid(lesson)) ||
    (material && !uuid(material))
  )
    throw new Error("Arquivo e identificadores válidos são obrigatórios.");
  if (file.size > 50 * 1024 * 1024)
    throw new Error("O limite por arquivo é 50 MB.");
  if (
    !["cover", "media", "material"].includes(kind) ||
    (kind === "cover" && lesson) ||
    (kind === "media" && !lesson) ||
    (material && kind !== "material")
  )
    throw new Error("Destino acadêmico inválido.");
  if (
    kind === "cover" &&
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("A capa precisa ser uma imagem JPEG, PNG, WebP ou GIF.");
  const { data: editable, error: permissionError } = await user.rpc(
    "academy_can_edit",
    { p_course: course },
  );
  if (permissionError || !editable)
    throw new Error("Sem permissão para editar este curso.");
  let module: string | null = null;
  if (lesson) {
    const { data, error } = await user
      .from("academy_lessons")
      .select("id,module_id")
      .eq("id", lesson)
      .eq("course_id", course)
      .single();
    if (error || !data) throw new Error("Aula não encontrada neste curso.");
    module = data.module_id;
  }
  const { data: already, error: lookupError } = await admin
    .from("drive_files")
    .select("*")
    .eq("academy_upload_id", upload)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (already) {
    if (
      already.uploaded_by !== actor ||
      already.academy_course_id !== course ||
      already.academy_lesson_id !== lesson ||
      already.academy_kind !== kind ||
      already.status !== "active"
    )
      throw new Error("Envio anterior incompatível ou removido.");
    return already;
  }
  // Fail before creating even a child folder when the existing destination cannot be confirmed.
  const rootToken = crypto.randomUUID();
  const { data: rootLocked, error: rootError } = await user.rpc(
    "academy_drive_root_lock",
    { p_token: rootToken },
  );
  if (rootError) throw rootError;
  if (!rootLocked)
    throw new Error(
      "Outro envio está verificando a pasta raiz. Tente novamente.",
    );
  let academy;
  try {
    academy = await resolveAcademyFolder(rootId, true);
  } finally {
    await user.rpc("academy_drive_root_unlock", { p_token: rootToken });
  }
  const token = crypto.randomUUID();
  const { data: locked, error: lockError } = await user.rpc(
    "academy_drive_lock",
    { p_course: course, p_token: token },
  );
  if (lockError) throw lockError;
  if (!locked)
    throw new Error(
      "Outro envio está em andamento neste curso. O item continua pendente; tente novamente.",
    );
  let uploadedId: string | null = null;
  let previous: string | null = null;
  if (kind === "cover" || kind === "media" || material) {
    const table =
      kind === "cover"
        ? "academy_courses"
        : kind === "media"
          ? "academy_lessons"
          : "academy_materials";
    const column =
      kind === "cover"
        ? "cover_drive_file_id"
        : kind === "media"
          ? "media_drive_file_id"
          : "drive_file_id";
    const { data } = await user
      .from(table)
      .select(column)
      .eq(
        "id",
        kind === "cover" ? course : kind === "media" ? lesson : material,
      )
      .single();
    previous = (data as Record<string, string | null> | null)?.[column] || null;
  }
  try {
    const segments = [
      "Cursos",
      course,
      ...(kind === "cover"
        ? ["Capa"]
        : lesson
          ? [
              "Módulos",
              module!,
              "Aulas",
              lesson,
              kind === "media" ? "Conteúdo" : "Materiais",
            ]
          : ["Materiais"]),
    ];
    const path = await ensureDrivePath(academy.id, segments);
    const uploaded = await uploadDriveFile(file, path.folderId);
    uploadedId = uploaded.id;
    await assertPrivateDriveFile(uploaded.id);
    const { data: record, error } = await admin.rpc("academy_commit_drive", {
      p_actor: actor,
      p_course: course,
      p_lesson: lesson,
      p_kind: kind,
      p_upload: upload,
      p_material: material,
      p_file: {
        ...uploaded,
        name: uploaded.name || file.name,
        mimeType: uploaded.mimeType || file.type,
        size: uploaded.size || file.size,
        folder_id: path.folderId,
      },
    });
    if (error || !record)
      throw error || new Error("O banco não confirmou os metadados.");
    uploadedId = null; // Commit confirmed. Retried HTTP requests reuse academy_upload_id.
    if (previous && previous !== record.id) {
      const { data: oldFile } = await admin
        .from("drive_files")
        .select("drive_file_id")
        .eq("id", previous)
        .maybeSingle();
      if (oldFile?.drive_file_id) {
        try {
          await trashDriveFile(oldFile.drive_file_id);
          const { error: cleanupError } = await admin.rpc(
            "academy_unlink_drive",
            { p_file: previous },
          );
          if (cleanupError) throw cleanupError;
        } catch {
          console.error(
            "[academy-drive] archived version pending cleanup",
            previous,
          );
        }
      }
    }
    return record;
  } catch (error) {
    if (uploadedId) {
      // A lost RPC response may hide a committed transaction. Do not trash that file.
      const { data: committed, error: checkError } = await admin
        .from("drive_files")
        .select("*")
        .eq("academy_upload_id", upload)
        .maybeSingle();
      if (!checkError && committed?.drive_file_id === uploadedId)
        return committed;
      if (!checkError)
        await trashDriveFile(uploadedId).catch(() =>
          console.error("[academy-drive] pending orphan cleanup", uploadedId),
        );
    }
    throw error;
  } finally {
    const { error } = await user.rpc("academy_drive_unlock", {
      p_course: course,
      p_token: token,
    });
    if (error) console.error("[academy-drive] lease release failed");
  }
}

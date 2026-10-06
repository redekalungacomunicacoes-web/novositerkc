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
export async function prepareAcademyDestination(
  input: { course: string; lesson: string | null; kind: string },
  rootId: string,
  user: SupabaseClient,
  admin: SupabaseClient,
) {
  const { course, lesson, kind } = input;
  const { data: editable, error: permissionError } = await user.rpc("academy_can_edit", { p_course: course });
  if (permissionError || !editable) throw new Error("Sem permissão para editar este curso.");
  const { data: courseRow, error: courseError } = await admin.from("academy_courses").select("id,title,drive_folder_id").eq("id", course).single();
  if (courseError || !courseRow) throw new Error("Curso não encontrado.");
  const academy = await resolveAcademyFolder(rootId);
  let courseFolder = courseRow.drive_folder_id as string | null;
  if (!courseFolder) {
    const path = await ensureDrivePath(academy.id, ["CURSOS", String(courseRow.title || "Curso")]);
    courseFolder = path.folderId;
    const { error } = await admin.from("academy_courses").update({ drive_folder_id: courseFolder }).eq("id", course);
    if (error) throw error;
  }
  if (kind === "cover") return (await ensureDrivePath(courseFolder, ["CAPA"])).folderId;
  if (kind === "banner") return (await ensureDrivePath(courseFolder, ["BANNER"])).folderId;
  if (!lesson) return (await ensureDrivePath(courseFolder, ["MATERIAIS"])).folderId;
  const { data: lessonRow, error: lessonError } = await admin.from("academy_lessons").select("id,title,position,drive_folder_id").eq("id", lesson).eq("course_id", course).single();
  if (lessonError || !lessonRow) throw new Error("Aula não encontrada neste curso.");
  let lessonFolder = lessonRow.drive_folder_id as string | null;
  if (!lessonFolder) {
    const order = String(Number(lessonRow.position ?? 0)).padStart(2, "0");
    const path = await ensureDrivePath(courseFolder, ["AULAS", `${order} - ${String(lessonRow.title || "Aula")}`]);
    lessonFolder = path.folderId;
    const { error } = await admin.from("academy_lessons").update({ drive_folder_id: lessonFolder }).eq("id", lesson);
    if (error) throw error;
  }
  return (await ensureDrivePath(lessonFolder, [kind === "media" ? "VIDEO" : kind === "thumbnail" ? "THUMBNAIL" : "MATERIAIS"])).folderId;
}

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
    !["cover", "banner", "thumbnail", "media", "material"].includes(kind) ||
    (["cover", "banner"].includes(kind) && lesson) ||
    (kind === "thumbnail" && !lesson) ||
    (kind === "media" && !lesson) ||
    (material && kind !== "material")
  )
    throw new Error("Destino acadêmico inválido.");
  if (
    ["cover", "banner"].includes(kind) &&
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
  try {
    // A retry may have read before another request committed, then acquired its released lease.
    const { data: committedBeforeLease, error: recheckError } = await admin
      .from("drive_files").select("*").eq("academy_upload_id", upload).maybeSingle();
    if (recheckError) throw recheckError;
    if (committedBeforeLease) {
      if (committedBeforeLease.uploaded_by !== actor || committedBeforeLease.academy_course_id !== course ||
          committedBeforeLease.academy_lesson_id !== lesson || committedBeforeLease.academy_kind !== kind ||
          committedBeforeLease.status !== "active") throw new Error("Envio anterior incompatível ou removido.");
      return committedBeforeLease;
    }
  if (kind === "cover" || kind === "banner" || kind === "thumbnail" || kind === "media" || material) {
    const table =
      kind === "cover" || kind === "banner"
        ? "academy_courses"
        : kind === "thumbnail" || kind === "media"
          ? "academy_lessons"
          : "academy_materials";
    const column =
      kind === "cover"
        ? "cover_drive_file_id"
        : kind === "banner"
          ? "banner_drive_file_id"
          : kind === "thumbnail"
          ? "thumbnail_drive_file_id"
          : kind === "media"
            ? "media_drive_file_id"
            : "drive_file_id";
    const { data } = await user
      .from(table)
      .select(column)
      .eq(
        "id",
        kind === "cover" || kind === "banner" ? course : kind === "thumbnail" || kind === "media" ? lesson : material,
      )
      .single();
    previous = (data as Record<string, string | null> | null)?.[column] || null;
  }
    // Resolve/create folders only after acquiring the course upload lease.
    // A concurrent upload must never create a parallel folder tree.
    const folderId = await prepareAcademyDestination(
      { course, lesson, kind },
      rootId,
      user,
      admin,
    );
    let uploaded: Record<string, unknown>;
    try {
      uploaded = await uploadDriveFile(file, folderId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (/storageQuotaExceeded|Service Accounts do not have storage quota/i.test(detail)) {
        throw new Error(
          "O Drive recusou o envio porque a integração está usando uma conta de serviço sem cota. Configure o OAuth da conta da RKC no Supabase ou use uma pasta de Shared Drive com acesso de Editor para a integração.",
        );
      }
      throw error;
    }
    if (typeof uploaded.id !== "string" || !uploaded.id)
      throw new Error("O Drive não retornou o identificador do arquivo enviado.");
    uploadedId = uploaded.id;
    await assertPrivateDriveFile(uploadedId);
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
        folder_id: folderId,
      },
    });
    if (error)
      throw new Error(`O banco não confirmou o banner/material: ${error.message}`);
    if (!record)
      throw new Error("O banco não confirmou os metadados do arquivo.");
    if (record.drive_file_id && record.drive_file_id !== uploadedId) {
      await trashDriveFile(uploadedId).catch(() => console.error("[academy-drive] redundant upload pending cleanup", uploadedId));
    }
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

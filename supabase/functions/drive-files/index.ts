import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  downloadDriveFile,
  driveHealth,
  ensureDrivePath,
  renameDriveFile,
  trashDriveFile,
  uploadDriveFile,
  resolveAcademyFolder,
  startDriveResumableUpload,
  getDriveFileMetadata,
  assertPrivateDriveFile,
} from "../_shared/google-drive.ts";

import { deleteTaskAndQueueCleanup, retryTaskCleanup } from "../_shared/task-delete.ts";
import { createCenterFolder, manageCenterFolder, moveCenterFile, uploadCenterFile, withCenterLease } from "../_shared/file-center.ts";
import { prepareTaskFolder } from "../_shared/task-drive.ts";
import { uploadAcademyDrive, prepareAcademyDestination } from "../_shared/academy-drive.ts";
import { ensureTeamMemberFolder, importLegacyTeamAvatar, uploadTeamAvatar, uploadTeamAvatarPair, uploadTeamPortfolio, removeTeamAvatar, removeTeamPortfolio, requireTeamEditor, confirmTeamAvatar } from "../_shared/team-drive.ts";
import { cleanupUnreferencedMateriaFiles, uploadMateriaDrive } from "../_shared/materia-drive.ts";

// Root ID provided and named by RKC in this task; the academy child ID is discovered at runtime.
const academyRootId = "1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD";
function requireAcademyRoot(root: string | undefined) {
  if (root !== academyRootId)
    throw new Error(
      "A raiz da integração não corresponde à pasta RKC - SISTEMA DO SITE autorizada. Confira GOOGLE_DRIVE_ROOT_FOLDER_ID na integração existente.",
    );
  return root;
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeName(value: string) {
  return value.replace(/[\\/\r\n"]/g, "_").slice(0, 180) || "arquivo";
}

function contentDisposition(disposition: "inline" | "attachment", name: string) {
  // Response headers are ByteString values in the browser. Keep the legacy
  // filename ASCII-only and preserve the real UTF-8 name with RFC 5987.
  const original = safeName(name);
  const ascii = original
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\\"]/g, "_")
    .slice(0, 180) || "arquivo";
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(original)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return json({ ok: false, error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  if (!supabaseUrl || !anonKey || !serviceRole)
    return json(
      { ok: false, error: "Configuração do backend incompleta." },
      500,
    );

  const authorization = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user)
    return json({ ok: false, error: "Não autenticado." }, 401);
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  async function requireTaskAccess(taskId: string, writing = false) {
    const { data, error } = await userClient
      .from("tasks")
      .select("id,status")
      .eq("id", taskId)
      .maybeSingle();
    if (error || !data)
      throw new Response(
        JSON.stringify({ ok: false, error: "Sem permissão para esta tarefa." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    if (writing && ["concluida", "concluido"].includes(data.status))
      throw new Response(JSON.stringify({ ok: false, error: "Reabra a tarefa e informe o motivo antes de enviar novos arquivos." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      if (form.get("module") === "materias") {
        if (form.get("action") === "cleanup-unreferenced") {
          const materiaId = String(form.get("materia_id") || "");
          return json({ ok: true, cleanup: await cleanupUnreferencedMateriaFiles(materiaId, userClient, admin) });
        }
        if (!rootFolderId) return json({ ok: false, error: "Pasta raiz do Drive não configurada." }, 503);
        return json({ ok: true, file: await uploadMateriaDrive(form, requireAcademyRoot(rootFolderId), userClient, admin, auth.user.id) });
      }
      if (form.get("module") === "academy" || form.get("module") === "academy-banner") {
        if (!rootFolderId)
          return json(
            { ok: false, error: "Pasta raiz do Drive não configurada." },
            503,
          );
        const dedicatedBanner = form.get("module") === "academy-banner";
        if (dedicatedBanner) {
          form.set("kind", "banner");
          const file = form.get("file");
          if (!(file instanceof File))
            return json({ ok: false, error: "Selecione uma imagem para o banner." }, 400);
          if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))
            return json({ ok: false, error: "O banner precisa ser JPEG, PNG, WebP ou GIF." }, 400);
          if (file.size > 25 * 1024 * 1024)
            return json({ ok: false, error: "O banner deve ter no máximo 25 MB." }, 413);
        }
        try {
          return json({
            ok: true,
            file: await uploadAcademyDrive(
              form,
              requireAcademyRoot(rootFolderId),
              userClient,
              admin,
              auth.user.id,
            ),
          });
        } catch (error) {
          if (!dedicatedBanner) throw error;
          const detail = error instanceof Error ? error.message : String(error || "");
          console.error("[drive-files][academy-banner]", error);
          return json({
            ok: false,
            error: detail || "Falha ao enviar o banner ao Drive RKC.",
            stage: "academy-banner-upload",
          }, 500);
        }
      }
      if (form.get("module") === "team") {
        if (!rootFolderId) return json({ ok:false,error:"Pasta raiz do Drive não configurada."},503);
        if (form.get("operation") === "portfolio") return json({ok:true,item:await uploadTeamPortfolio(form,requireAcademyRoot(rootFolderId),userClient,admin,auth.user.id)});
        if (form.get("operation") === "avatar-pair") {
          return json({ ok:true,files:await uploadTeamAvatarPair(form,rootFolderId,userClient,admin,auth.user.id) });
        }
        return json({ ok:true,file:await uploadTeamAvatar(form,rootFolderId,userClient,admin,auth.user.id) });
      }
      if (form.get("module") === "file-center") {
        if (!rootFolderId) return json({ok:false,error:"Pasta raiz do Drive não configurada."},503);
        const file=await withCenterLease(rootFolderId,admin,()=>uploadCenterFile(form,userClient,admin,auth.user!.id));
        return json({ok:true,file});
      }
      const file = form.get("file");
      const taskId = String(form.get("task_id") ?? "");
      if (!(file instanceof File) || !taskId)
        return json(
          { ok: false, error: "Arquivo e tarefa são obrigatórios." },
          400,
        );
      if (file.size > 50 * 1024 * 1024)
        return json({ ok: false, error: "O limite por arquivo é 50 MB." }, 413);
      await requireTaskAccess(taskId, true);
      if (!rootFolderId)
        return json(
          { ok: false, error: "Pasta raiz do Drive não configurada." },
          500,
        );

      const uploadId = String(form.get("upload_id") || "") || null;
      if (uploadId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadId))
        return json({ ok: false, error: "Identificador de upload inválido." }, 400);
      if (uploadId) {
        const existing = await admin.from("drive_files").select("*").eq("task_id", taskId).eq("module", "tasks").eq("task_upload_id", uploadId).eq("status", "active").maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) return json({ ok: true, file: existing.data });
      }
      const folderId = await prepareTaskFolder(taskId, rootFolderId, admin);

      const uploaded = await uploadDriveFile(file, folderId);
      const row = {
        drive_file_id: uploaded.id,
        drive_folder_id: folderId,
        name: uploaded.name ?? file.name,
        mime_type: uploaded.mimeType ?? file.type ?? null,
        size_bytes: Number(uploaded.size ?? file.size),
        module: "tasks",
        entity_id: taskId,
        task_id: taskId,
        task_upload_id: uploadId,
        category: String(form.get("category") ?? "arquivo"),
        uploaded_by: auth.user.id,
        web_view_link: uploaded.webViewLink ?? null,
        visibility: "private",
        status: "active",
        access_scope:
          form.get("access_scope") === "team" ? "team" : "assignees",
      };
      const { data, error } = await admin
        .from("drive_files")
        .insert(row)
        .select("*")
        .single();
      if (error) {
        await trashDriveFile(uploaded.id).catch((cleanupError) =>
          console.error("[drive-files] cleanup", cleanupError),
        );
        if (uploadId && error.code === "23505") {
          const existing = await admin.from("drive_files").select("*").eq("task_id", taskId).eq("module", "tasks").eq("task_upload_id", uploadId).eq("status", "active").maybeSingle();
          if (!existing.error && existing.data) return json({ ok: true, file: existing.data });
        }
        throw error;
      }
      return json({ ok: true, file: data });
    }

    const body = await req.json();
    const action = String(body.action ?? "");
    if (["center-folder-create","center-folder-rename","center-folder-delete","center-file-move"].includes(action)) {
      if (!rootFolderId) return json({ok:false,error:"Pasta raiz do Drive não configurada."},503);
      const result=await withCenterLease(rootFolderId,admin,async()=>{
        if(action==="center-folder-create")return {folder:await createCenterFolder(body,rootFolderId,userClient,admin,auth.user!.id)};
        if(action==="center-file-move")return {file:await moveCenterFile(body,rootFolderId,userClient,admin,auth.user!.id)};
        return {folder:await manageCenterFolder(body,userClient,admin,auth.user!.id)};
      });
      return json({ok:true,...result});
    }
    if(action === "team-avatar-confirm") return json({ok:true,...await confirmTeamAvatar(String(body.member_id||""),String(body.avatar_id||""),String(body.thumb_id||""),userClient,admin)});
    if(action === "team-remove-avatar") {await removeTeamAvatar(String(body.member_id||""),userClient,admin);return json({ok:true});}
    if(action === "team-remove-portfolio") {await removeTeamPortfolio(String(body.id||""),userClient,admin);return json({ok:true});}
    if (action === "team-ensure-folder") {
      if (!rootFolderId) return json({ ok:false,error:"Pasta raiz do Drive não configurada."},503);
      const memberId=String(body.member_id || "");
      return json({ok:true,...await ensureTeamMemberFolder(memberId,rootFolderId,userClient,admin)});
    }
    if (action === "team-import-legacy") {
      if (!rootFolderId) return json({ ok:false,error:"Pasta raiz do Drive não configurada."},503);
      const memberId=String(body.member_id || "");
      return json({ok:true,files:await importLegacyTeamAvatar(memberId,rootFolderId,userClient,admin,auth.user.id)});
    }
    if (action === "task-ensure-folder") {
      const taskId = String(body.task_id || "");
      if (!taskId) return json({ ok: false, error: "Tarefa obrigatória." }, 400);
      await requireTaskAccess(taskId);
      if (!rootFolderId) return json({ ok: false, error: "Pasta raiz do Drive não configurada." }, 503);
      const folderId = await prepareTaskFolder(taskId, rootFolderId, admin);
      return json({ ok: true, folder_id: folderId });
    }
    if (action === "task-cleanup-pending") {
      const role = await userClient.rpc("is_team_admin");
      if (role.error) throw role.error;
      let query = admin.from("task_cleanup_jobs").select("task_id").eq("status", "pending").order("created_at").limit(5);
      if (role.data !== true) query = query.eq("requested_by", auth.user.id);
      const { data: jobs, error } = await query;
      if (error) throw error;
      const results = await Promise.allSettled((jobs || []).map((job: { task_id: string }) => retryTaskCleanup(job.task_id, userClient, admin, auth.user.id)));
      return json({ ok: true, pending: results.filter((result) => result.status === "rejected" || result.value.cleanup_pending).length });
    }
    if (action === "task-delete" || action === "task-cleanup") {
      const taskId = String(body.task_id || "");
      if (!taskId) return json({ ok: false, error: "Tarefa obrigatória." }, 400);
      return json(await (action === "task-delete"
        ? deleteTaskAndQueueCleanup(taskId, userClient, admin, auth.user.id)
        : retryTaskCleanup(taskId, userClient, admin, auth.user.id)));
    }
    if (action === "academy-upload-start") {
      if (!rootFolderId) return json({ ok: false, error: "Pasta raiz do Drive não configurada." }, 503);
      const course = String(body.course_id || "");
      const lesson = String(body.lesson_id || "") || null;
      const kind = String(body.kind || "");
      const size = Number(body.size || 0);
      const name = safeName(String(body.name || "arquivo"));
      const mimeType = String(body.mime_type || "application/octet-stream");
      const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (!isUuid(course) || (lesson && !isUuid(lesson))) return json({ ok:false,error:"Curso ou aula inválidos."},400);
      if (!["cover","banner","media","material"].includes(kind) || (["cover","banner"].includes(kind) && lesson) || (kind === "media" && !lesson))
        return json({ ok:false,error:"Destino acadêmico inválido."},400);
      if (["cover","banner"].includes(kind) && !["image/jpeg","image/png","image/webp","image/gif"].includes(mimeType))
        return json({ ok:false,error:"A capa precisa ser uma imagem JPEG, PNG, WebP ou GIF."},400);
      const limit = ["cover","banner"].includes(kind) ? 25 * 1024 * 1024 : 15 * 1024 * 1024 * 1024;
      if (!Number.isFinite(size) || size <= 0 || size > limit) return json({ok:false,error:["cover","banner"].includes(kind) ? "A imagem deve ter no máximo 25 MB." : "O limite por arquivo é 15 GB."},413);
      const folderId = await prepareAcademyDestination({ course, lesson, kind }, requireAcademyRoot(rootFolderId), userClient, admin);
      const uploadUrl = await startDriveResumableUpload({ name, mimeType, size, folderId });
      return json({ ok:true, upload_url:uploadUrl, folder_id:folderId });
    }
    if (action === "academy-upload-status") {
      const uploadUrl = String(body.upload_url || "");
      const size = Number(body.size || 0);
      let sessionUrl: URL;
      try {
        sessionUrl = new URL(uploadUrl);
      } catch {
        return json({ ok: false, error: "Sessão resumível inválida." }, 400);
      }
      const allowedHost = sessionUrl.protocol === "https:" &&
        ["www.googleapis.com", "www.googleapisusercontent.com"].includes(sessionUrl.hostname);
      const allowedPath = sessionUrl.pathname.startsWith("/upload/drive/");
      if (!allowedHost || !allowedPath || !sessionUrl.searchParams.get("upload_id"))
        return json({ ok: false, error: "Sessão resumível não pertence ao Google Drive." }, 400);
      if (!Number.isFinite(size) || size <= 0 || size > 15 * 1024 * 1024 * 1024)
        return json({ ok: false, error: "Tamanho de upload inválido." }, 400);

      const response = await fetch(sessionUrl.toString(), {
        method: "PUT",
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Range": `bytes */${size}` },
        redirect: "manual",
      });
      const responseBody = await response.text();
      // 308 = sessão ativa/incompleta; 2xx = o último bloco já concluiu o arquivo.
      if (response.status === 308 || (response.status >= 200 && response.status < 300))
        return json({
          ok: true,
          upload_status: response.status,
          range: response.headers.get("Range"),
          body: responseBody,
        });
      return json({
        ok: false,
        error: `A sessão resumível expirou ou foi recusada (${response.status}).`,
      }, response.status >= 400 && response.status < 600 ? response.status : 502);
    }
    if (action === "academy-upload-commit") {
      if (!rootFolderId) return json({ ok:false,error:"Pasta raiz do Drive não configurada."},503);
      const course = String(body.course_id || "");
      const lesson = String(body.lesson_id || "") || null;
      const kind = String(body.kind || "");
      const upload = String(body.upload_id || "");
      const material = String(body.replace_material_id || "") || null;
      const driveFileId = String(body.drive_file_id || "");
      const expectedName = safeName(String(body.expected_name || ""));
      const expectedMime = String(body.expected_mime_type || "application/octet-stream");
      const expectedSize = Number(body.expected_size || 0);
      const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (!isUuid(course) || !isUuid(upload) || (lesson && !isUuid(lesson)) || (material && !isUuid(material)))
        return json({ok:false,error:"Identificadores acadêmicos inválidos."},400);
      if (!["cover","banner","media","material"].includes(kind) || (["cover","banner"].includes(kind) && lesson) || (kind === "media" && !lesson) || (material && kind !== "material"))
        return json({ok:false,error:"Destino acadêmico inválido."},400);
      if (!driveFileId || !expectedName || !Number.isFinite(expectedSize) || expectedSize <= 0)
        return json({ok:false,error:"Arquivo do Drive não confirmado."},400);

      const { data: already, error: alreadyError } = await admin
        .from("drive_files").select("*").eq("academy_upload_id", upload).maybeSingle();
      if (alreadyError) throw alreadyError;
      if (already) {
        if (already.uploaded_by !== auth.user.id || already.academy_course_id !== course ||
            already.academy_lesson_id !== lesson || already.academy_kind !== kind || already.status !== "active")
          return json({ok:false,error:"Envio anterior incompatível ou removido."},409);
        return json({ok:true,file:already,reused:true});
      }

      const { data: editable, error: permissionError } = await userClient.rpc("academy_can_edit", { p_course: course });
      if (permissionError || !editable) return json({ok:false,error:"Sem permissão para editar este curso."},403);
      const expectedFolderId = await prepareAcademyDestination(
        { course, lesson, kind }, requireAcademyRoot(rootFolderId), userClient, admin,
      );
      const uploaded = await getDriveFileMetadata(driveFileId);
      if (uploaded.trashed === true) return json({ok:false,error:"O arquivo enviado está na lixeira do Drive."},409);
      if (!Array.isArray(uploaded.parents) || !uploaded.parents.includes(expectedFolderId))
        return json({ok:false,error:"O arquivo não está na pasta acadêmica esperada."},409);
      if (String(uploaded.name || "") !== expectedName)
        return json({ok:false,error:"O nome confirmado pelo Drive difere do envio iniciado."},409);
      if (Number(uploaded.size || 0) !== expectedSize)
        return json({ok:false,error:"O tamanho confirmado pelo Drive difere do arquivo enviado."},409);
      if (expectedMime !== "application/octet-stream" && String(uploaded.mimeType || "") !== expectedMime)
        return json({ok:false,error:"O tipo do arquivo confirmado pelo Drive difere do envio iniciado."},409);
      if (["cover","banner"].includes(kind) && !["image/jpeg","image/png","image/webp","image/gif"].includes(String(uploaded.mimeType || "")))
        return json({ok:false,error:"A capa confirmada não é uma imagem permitida."},400);
      await assertPrivateDriveFile(driveFileId);
      const { data: record, error } = await admin.rpc("academy_commit_drive", {
        p_actor: auth.user.id, p_course: course, p_lesson: lesson, p_kind: kind,
        p_upload: upload, p_material: material,
        p_file: { ...uploaded, folder_id: expectedFolderId },
      });
      if (error || !record) throw error || new Error("O banco não confirmou os metadados.");
      return json({ ok:true, file:record });
    }
    if (action === "academy-health") {
      const { data: member, error } = await userClient.rpc("academy_member");
      if (error || !member)
        return json({ ok: false, error: "Sem acesso à Academia." }, 403);
      if (!rootFolderId)
        return json(
          { ok: false, error: "Pasta raiz do Drive não configurada." },
          503,
        );
      return json({
        ok: true,
        drive: await resolveAcademyFolder(requireAcademyRoot(rootFolderId)),
      });
    }
    if (action === "health") {
      if (!rootFolderId)
        return json(
          { ok: false, error: "Pasta raiz do Drive não configurada." },
          503,
        );
      return json({ ok: true, drive: await driveHealth(rootFolderId) });
    }
    const id = String(body.id ?? "");
    if (!id)
      return json({ ok: false, error: "ID do arquivo obrigatório." }, 400);
    const { data: file, error } = await admin
      .from("drive_files")
      .select("*")
      .eq("id", id)
      .in("status", ["active", "archived"])
      .maybeSingle();
    if (error || !file)
      return json({ ok: false, error: "Arquivo não encontrado." }, 404);
    if (file.module === "team") {
      await requireTeamEditor(file.entity_id,userClient);
      if(!["download","stream"].includes(action) || file.status !== "active") return json({ok:false,error:"Operação não permitida."},403);
      const response=await downloadDriveFile(file.drive_file_id,action==="stream"?req.headers.get("Range"):null);
      return new Response(response.body,{status:response.status,headers:{...corsHeaders,"Content-Type":file.mime_type||"application/octet-stream","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
    }
    if (file.module === "academy") {
      // Academy media stays private, but course editors must be able to preview it
      // even when drive_files RLS is learner/enrollment oriented.
      const { data: canEditCourse, error: editAccessError } = await userClient.rpc(
        "academy_can_edit",
        { p_course: file.academy_course_id },
      );
      let canRead = Boolean(canEditCourse) && !editAccessError;
      if (!canRead) {
        const { data: permitted, error: accessError } = await userClient
          .from("drive_files")
          .select("id")
          .eq("id", id)
          .maybeSingle();
        canRead = Boolean(permitted) && !accessError;
      }
      if (!canRead)
        return json({ ok: false, error: "Sem acesso a este material." }, 403);
      if (["download", "stream"].includes(action) && file.status === "active") {
        const range = action === "stream" ? req.headers.get("Range") : null;
        const response = await downloadDriveFile(file.drive_file_id, range);
        const headers: Record<string, string> = {
          ...corsHeaders,
          "Content-Type": file.mime_type || response.headers.get("Content-Type") || "application/octet-stream",
          "Content-Disposition": contentDisposition(action === "stream" ? "inline" : "attachment", file.name),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Accept-Ranges": "bytes",
        };
        for (const name of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
          const value = response.headers.get(name);
          if (value) headers[name] = value;
        }
        return new Response(response.body, {
          status: response.status === 206 ? 206 : 200,
          headers,
        });
      }
      const { data: editable, error } = await userClient.rpc(
        "academy_can_edit",
        { p_course: file.academy_course_id },
      );
      if (error || !editable || action !== "academy-trash")
        return json(
          { ok: false, error: "Operação não permitida para este material." },
          403,
        );
      await trashDriveFile(file.drive_file_id);
      const { error: unlinkError } = await admin.rpc("academy_unlink_drive", {
        p_file: id,
      });
      if (unlinkError) throw unlinkError;
      return json({ ok: true });
    }
    if (file.module === "file-center") {
      const permitted=await userClient.from("drive_files").select("id").eq("id",id).maybeSingle();
      if(permitted.error || !permitted.data)return json({ok:false,error:"Sem acesso ao arquivo."},403);
    } else if (!file.task_id)
      return json(
        {
          ok: false,
          error: "Este serviço aceita apenas arquivos vinculados a tarefas.",
        },
        403,
      );
    if (file.task_id) await requireTaskAccess(file.task_id);

    if (action === "download") {
      const response = await downloadDriveFile(file.drive_file_id);
      return new Response(response.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": file.mime_type ?? "application/octet-stream",
          "Content-Disposition": contentDisposition("attachment", file.name),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (file.uploaded_by !== auth.user.id) {
      const role=await userClient.rpc("is_team_admin");
      if(role.error || role.data!==true)
        return json({ok:false,error:"Somente quem enviou ou um administrador pode alterar o arquivo."},403);
    }
    if (action === "rename") {
      const name = String(body.name ?? "").trim();
      if (!name) return json({ ok: false, error: "Informe o novo nome." }, 400);
      const drive = await renameDriveFile(file.drive_file_id, safeName(name));
      const { data, error: updateError } = await admin
        .from("drive_files")
        .update({ name: drive.name, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json({ ok: true, file: data });
    }
    if (action === "trash") {
      await trashDriveFile(file.drive_file_id);
      const { data, error: updateError } = await admin
        .from("drive_files")
        .update({
          status: "trashed",
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json({ ok: true, file: data });
    }
    return json({ ok: false, error: "Ação desconhecida." }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[drive-files]", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message || "Falha não identificada no Drive.")
          : String(error || "Falha não identificada no Drive.");
    return json({ ok: false, error: detail }, 500);
  }
});

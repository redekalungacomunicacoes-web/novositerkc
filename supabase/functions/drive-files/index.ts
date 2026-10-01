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
} from "../_shared/google-drive.ts";

import { uploadAcademyDrive } from "../_shared/academy-drive.ts";

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

  async function requireTaskAccess(taskId: string) {
    const { data, error } = await userClient
      .from("tasks")
      .select("id")
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
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      if (form.get("module") === "academy") {
        if (!rootFolderId)
          return json(
            { ok: false, error: "Pasta raiz do Drive não configurada." },
            503,
          );
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
      await requireTaskAccess(taskId);
      if (!rootFolderId)
        return json(
          { ok: false, error: "Pasta raiz do Drive não configurada." },
          500,
        );

      const { data: task, error: taskError } = await admin
        .from("tasks")
        .select("id,titulo,context_type,context_id,drive_folder_id")
        .eq("id", taskId)
        .single();
      if (taskError || !task)
        return json({ ok: false, error: "Tarefa não encontrada." }, 404);
      let folderId = task.drive_folder_id as string | null;
      if (!folderId) {
        const label = safeName(`${task.id} - ${task.titulo ?? "Tarefa"}`);
        const segments =
          task.context_type === "project"
            ? [
                "01_PROJETOS",
                String(task.context_id ?? "geral"),
                "TAREFAS",
                label,
              ]
            : task.context_type === "materia"
              ? [
                  "02_MATERIAS",
                  String(task.context_id ?? "geral"),
                  "TAREFAS",
                  label,
                ]
              : ["03_TAREFAS_INTERNAS", label];
        const path = await ensureDrivePath(rootFolderId, segments);
        folderId = path.folderId;
        const { error } = await admin
          .from("tasks")
          .update({ drive_folder_id: folderId })
          .eq("id", taskId);
        if (error) throw error;
      }

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
        throw error;
      }
      return json({ ok: true, file: data });
    }

    const body = await req.json();
    const action = String(body.action ?? "");
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
    if (file.module === "academy") {
      // Always query through the caller's RLS, even though metadata is loaded with service_role.
      const { data: permitted, error: accessError } = await userClient
        .from("drive_files")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (accessError || !permitted)
        return json({ ok: false, error: "Sem acesso a este material." }, 403);
      if (action === "download" && file.status === "active") {
        const response = await downloadDriveFile(file.drive_file_id);
        return new Response(response.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": file.mime_type || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safeName(file.name)}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
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
    if (!file.task_id)
      return json(
        {
          ok: false,
          error: "Este serviço aceita apenas arquivos vinculados a tarefas.",
        },
        403,
      );
    await requireTaskAccess(file.task_id);

    if (action === "download") {
      const response = await downloadDriveFile(file.drive_file_id);
      return new Response(response.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": file.mime_type ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeName(file.name)}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (file.uploaded_by !== auth.user.id)
      return json(
        { ok: false, error: "Somente quem enviou o arquivo pode alterá-lo." },
        403,
      );
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
    return json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Erro interno no Drive.",
      },
      500,
    );
  }
});

/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { driveHealth, moveDriveFile, renameDriveFile, trashDriveFile, uploadDriveFile } from "../_shared/google-drive.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo nao permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
    if (!supabaseUrl || !anonKey || !serviceRole || !rootFolderId) return json({ ok: false, error: "Configuracao do backend incompleta." }, 500);

    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "Nao autenticado." }, 401);

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const action = String(body?.action || "");

      if (action === "health") return json({ ok: true, drive: await driveHealth(rootFolderId) });

      const id = String(body?.id || "");
      if (!id) return json({ ok: false, error: "ID do arquivo obrigatorio." }, 400);
      const { data: record, error: recordError } = await admin.from("drive_files").select("*").eq("id", id).single();
      if (recordError || !record) return json({ ok: false, error: "Arquivo nao encontrado." }, 404);

      if (action === "rename") {
        const name = String(body?.name || "").trim();
        if (!name) return json({ ok: false, error: "Novo nome obrigatorio." }, 400);
        const drive = await renameDriveFile(record.drive_file_id, name);
        const { data, error } = await admin.from("drive_files").update({ name: drive.name, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ ok: true, file: data });
      }

      if (action === "move") {
        const folderId = String(body?.folder_id || "").trim();
        if (!folderId) return json({ ok: false, error: "Pasta de destino obrigatoria." }, 400);
        const drive = await moveDriveFile(record.drive_file_id, folderId, record.drive_folder_id);
        const { data, error } = await admin.from("drive_files").update({ drive_folder_id: drive.parents?.[0] || folderId, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ ok: true, file: data });
      }

      if (action === "visibility") {
        const visibility = body?.visibility === "public" ? "public" : "private";
        const publicSlug = visibility === "public" ? (record.public_slug || crypto.randomUUID()) : record.public_slug;
        const { data, error } = await admin.from("drive_files").update({ visibility, public_slug: publicSlug, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ ok: true, file: data });
      }

      if (action === "trash") {
        await trashDriveFile(record.drive_file_id);
        const now = new Date().toISOString();
        const { data, error } = await admin.from("drive_files").update({ status: "trashed", visibility: "private", deleted_at: now, updated_at: now }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ ok: true, file: data });
      }

      return json({ ok: false, error: "Acao invalida." }, 400);
    }

    const form = await req.formData();
    const file = form.get("file");
    const module = String(form.get("module") || "site").trim().toLowerCase();
    const category = String(form.get("category") || "arquivo").trim().toLowerCase();
    const entityIdRaw = String(form.get("entity_id") || "").trim();
    const folderId = String(form.get("folder_id") || rootFolderId).trim();
    const visibility = form.get("visibility") === "public" ? "public" : "private";
    if (!(file instanceof File)) return json({ ok: false, error: "Arquivo obrigatorio." }, 400);

    const uploaded = await uploadDriveFile(file, folderId);
    const row = {
      drive_file_id: uploaded.id, drive_folder_id: uploaded.parents?.[0] || folderId,
      name: uploaded.name || file.name, mime_type: uploaded.mimeType || file.type || null,
      size_bytes: uploaded.size ? Number(uploaded.size) : file.size, module,
      entity_id: entityIdRaw || null, category, uploaded_by: authData.user.id,
      web_view_link: uploaded.webViewLink || null, visibility,
      public_slug: visibility === "public" ? crypto.randomUUID() : null,
    };

    const { data, error } = await admin.from("drive_files").insert(row).select("*").single();
    if (error) return json({ ok: false, error: `Arquivo enviado ao Drive, mas falhou o registro no Supabase: ${error.message}`, drive_file_id: uploaded.id }, 500);
    return json({ ok: true, file: data }, 201);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});

/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { driveHealth, uploadDriveFile } from "../_shared/google-drive.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo nao permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");

    if (!supabaseUrl || !anonKey || !serviceRole || !rootFolderId) {
      return json({ ok: false, error: "Configuracao do backend incompleta." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "Nao autenticado." }, 401);

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body?.action !== "health") return json({ ok: false, error: "Acao invalida." }, 400);
      const folder = await driveHealth(rootFolderId);
      return json({ ok: true, drive: folder });
    }

    const form = await req.formData();
    const file = form.get("file");
    const module = String(form.get("module") || "site").trim().toLowerCase();
    const category = String(form.get("category") || "arquivo").trim().toLowerCase();
    const entityIdRaw = String(form.get("entity_id") || "").trim();
    const folderId = String(form.get("folder_id") || rootFolderId).trim();

    if (!(file instanceof File)) return json({ ok: false, error: "Arquivo obrigatorio." }, 400);

    const uploaded = await uploadDriveFile(file, folderId);

    const row = {
      drive_file_id: uploaded.id,
      drive_folder_id: uploaded.parents?.[0] || folderId,
      name: uploaded.name || file.name,
      mime_type: uploaded.mimeType || file.type || null,
      size_bytes: uploaded.size ? Number(uploaded.size) : file.size,
      module,
      entity_id: entityIdRaw || null,
      category,
      uploaded_by: authData.user.id,
      web_view_link: uploaded.webViewLink || null,
    };

    const { data, error } = await admin.from("drive_files").insert(row).select("*").single();
    if (error) {
      return json({
        ok: false,
        error: `Arquivo enviado ao Drive, mas falhou o registro no Supabase: ${error.message}`,
        drive_file_id: uploaded.id,
      }, 500);
    }

    return json({ ok: true, file: data }, 201);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});

/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { downloadDriveFile } from "../_shared/google-drive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const slug = url.searchParams.get("id");
  if (!slug) return new Response("Arquivo não encontrado.", { status: 404, headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return new Response("Serviço indisponível.", { status: 503, headers: corsHeaders });
  try {
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: file, error } = await admin.from("drive_files").select("drive_file_id,name,mime_type")
      .eq("public_slug", slug).eq("visibility", "public").eq("status", "active").is("task_id", null).maybeSingle();
    if (error || !file) return new Response("Arquivo não encontrado.", { status: 404, headers: corsHeaders });
    const response = await downloadDriveFile(file.drive_file_id);
    return new Response(response.body, { status: 200, headers: {
      ...corsHeaders,
      "Content-Type": file.mime_type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${String(file.name).replace(/[\\r\\n"]/g, "_").slice(0, 180)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300",
    } });
  } catch (error) {
    console.error("[drive-media]", error);
    return new Response("Não foi possível abrir o arquivo.", { status: 502, headers: corsHeaders });
  }
});

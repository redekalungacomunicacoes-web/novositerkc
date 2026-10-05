/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadDriveFile } from "../_shared/google-drive.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return new Response("Backend configuration error", { status: 500 });
  const slug = new URL(req.url).searchParams.get("id")?.trim();
  if (!slug) return new Response("Not found", { status: 404 });
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const { data: file, error } = await admin.from("drive_files")
    .select("id,drive_file_id,name,mime_type,size_bytes,module,entity_id,category")
    .eq("public_slug", slug).eq("visibility", "public").eq("status", "active").is("deleted_at", null).single();
  if (error || !file) return new Response("Not found", { status: 404 });
  if(file.module === "team") {
    const member=await admin.from("equipe").select("id,avatar_drive_file_id,avatar_thumb_drive_file_id").eq("id",file.entity_id).eq("ativo",true).eq("is_public",true).maybeSingle();
    if(!member.data) return new Response("Not found",{status:404});
    if(file.category === "portfolio") {
      const item=await admin.from("team_member_portfolio").select("id").eq("drive_file_id",file.id).eq("is_public",true).maybeSingle();
      if(!item.data) return new Response("Not found",{status:404});
    } else if(![member.data.avatar_drive_file_id,member.data.avatar_thumb_drive_file_id].includes(file.id)) return new Response("Not found",{status:404});
  }
  try {
    const drive = await downloadDriveFile(file.drive_file_id,req.headers.get("Range"));
    const headers = new Headers();
    headers.set("Content-Type", file.mime_type || drive.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=300, s-maxage=300, must-revalidate");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Accept-Ranges","bytes");
    for(const name of ["Content-Length","Content-Range"]) {const value=drive.headers.get(name);if(value) headers.set(name,value);}
    if (req.method === "HEAD") return new Response(null, { status: drive.status, headers });
    return new Response(drive.body, { status: drive.status, headers });
  } catch {
    return new Response("Media unavailable", { status: 502 });
  }
});

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
    .select("drive_file_id,name,mime_type,size_bytes")
    .eq("public_slug", slug).eq("visibility", "public").eq("status", "active").is("deleted_at", null).single();
  if (error || !file) return new Response("Not found", { status: 404 });
  try {
    const drive = await downloadDriveFile(file.drive_file_id);
    const headers = new Headers();
    headers.set("Content-Type", file.mime_type || drive.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    headers.set("X-Content-Type-Options", "nosniff");
    if (file.size_bytes) headers.set("Content-Length", String(file.size_bytes));
    if (req.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(drive.body, { status: 200, headers });
  } catch {
    return new Response("Media unavailable", { status: 502 });
  }
});

/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRefresh: Promise<string> | null = null;

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function requestAccessToken() {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (clientId && clientSecret && refreshToken) {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    if (!response.ok) throw new Error("Google OAuth unavailable");
    const payload = await response.json();
    return { value: payload.access_token as string, expiresIn: Number(payload.expires_in) || 3600 };
  }

  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
  if (!email || !privateKey) throw new Error("Google credentials unavailable");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/drive", aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("Google service account unavailable");
  const result = await response.json();
  return { value: result.access_token as string, expiresIn: Number(result.expires_in) || 3600 };
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (!tokenRefresh) {
    tokenRefresh = requestAccessToken().then((token) => {
      cachedToken = { value: token.value, expiresAt: Date.now() + token.expiresIn * 1000 };
      return token.value;
    }).finally(() => { tokenRefresh = null; });
  }
  return await tokenRefresh;
}

async function downloadDriveFile(fileId: string, range: string | null, requestSignal: AbortSignal) {
  const token = await accessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers.Range = range;

  // Bound the time to receive upstream headers, not the lifetime of the body stream.
  // AbortSignal.timeout(30000) also aborts large downloads after 30 seconds, even
  // when Google Drive is still transmitting a valid response body.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Google Drive response headers timed out")), 30000);
  const abortBeforeHeaders = () => controller.abort(requestSignal.reason);
  if (requestSignal.aborted) abortBeforeHeaders();
  else requestSignal.addEventListener("abort", abortBeforeHeaders, { once: true });

  let response: Response;
  try {
    response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
      signal: controller.signal,
      headers,
    });
  } catch (error) {
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", abortBeforeHeaders);
    throw error;
  }
  clearTimeout(timeout);
  requestSignal.removeEventListener("abort", abortBeforeHeaders);

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Google Drive returned HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("Google Drive returned an empty response body");
  return response;
}

function forwardDriveBody(body: ReadableStream<Uint8Array>, requestSignal: AbortSignal) {
  const reader = body.getReader();
  let finished = false;
  const cleanup = () => requestSignal.removeEventListener("abort", abort);
  const cancelReader = (reason?: unknown) => {
    if (finished) return;
    finished = true;
    cleanup();
    void reader.cancel(reason).catch(() => undefined);
  };
  const abort = () => cancelReader(requestSignal.reason);

  if (requestSignal.aborted) abort();
  else requestSignal.addEventListener("abort", abort, { once: true });

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return;
      try {
        const result = await reader.read();
        if (result.done) {
          finished = true;
          cleanup();
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        finished = true;
        cleanup();
        console.error("drive-media upstream stream interrupted", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        controller.error(error);
      }
    },
    async cancel(reason) {
      cancelReader(reason);
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return new Response("Backend configuration error", { status: 500 });
  const requestUrl = new URL(req.url);
  const slug = requestUrl.searchParams.get("id")?.trim();
  const authorizeOnly = requestUrl.searchParams.get("authorize") === "1";
  if (!slug) return new Response("Not found", { status: 404 });
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const result = await admin.from("drive_files")
      .select("id,drive_file_id,name,mime_type,size_bytes,module,entity_id,category,updated_at,created_at")
      .eq("public_slug", slug).eq("visibility", "public").eq("status", "active").is("deleted_at", null).single();
  const file = result.data;
  if (result.error || !file) return new Response("Not found", { status: 404 });

    if (file.module === "materias") {
      const { data: materia } = await admin.from("materias")
        .select("id,status,capa_drive_file_id,capa_thumb_drive_file_id,banner_drive_file_id,audio_drive_file_id,content_blocks")
        .eq("id", file.entity_id).eq("status", "published").maybeSingle();
      if (!materia) return new Response("Not found", { status: 404 });
      let linked = false;
      if (file.category === "cover") linked = materia.capa_drive_file_id === file.id;
      else if (file.category === "cover_thumb") linked = materia.capa_thumb_drive_file_id === file.id;
      else if (file.category === "banner") linked = materia.banner_drive_file_id === file.id;
      else if (file.category === "audio") {
        const blocks = Array.isArray(materia.content_blocks) ? materia.content_blocks : [];
        linked = materia.audio_drive_file_id === file.id || blocks.some((block: any) =>
          block?.type === "interview_collection" && Array.isArray(block.interviews) &&
          block.interviews.some((interview: any) => interview?.audioDriveFileId === file.id)
        );
      }
      else if (file.category === "content") {
        const blocks = Array.isArray(materia.content_blocks) ? materia.content_blocks : [];
        linked = blocks.some((block: any) =>
          block?.drive_file_id === file.id ||
          (block?.type === "interview_collection" && Array.isArray(block.interviews) &&
            block.interviews.some((interview: any) => interview?.thumbnailDriveFileId === file.id))
        );
      } else if (file.category === "gallery") {
        const { data: item } = await admin.from("materia_galeria").select("id")
          .eq("materia_id", file.entity_id).eq("drive_file_id", file.id).maybeSingle();
        linked = !!item;
      }
      if (!linked) return new Response("Not found", { status: 404 });
    }

    if (file.module === "projetos") {
      const { data: project } = await admin.from("projetos").select("id,capa_drive_file_id,cover_card_drive_file_id")
        .eq("id", file.entity_id).eq("publicado_transparencia", true).maybeSingle();
      if (!project) return new Response("Not found", { status: 404 });
      let linked = file.category === "cover" && project.capa_drive_file_id === file.id
        || file.category === "cover_card" && project.cover_card_drive_file_id === file.id;
      if (file.category === "gallery" || file.category === "gallery_thumb") {
        const { data: gallery } = await admin.from("projeto_galeria").select("id").eq("projeto_id", project.id)
          .eq(file.category === "gallery" ? "drive_file_id" : "thumb_drive_file_id", file.id).limit(1);
        linked = !!gallery?.length;
      }
      if (!linked) return new Response("Not found", { status: 404 });
    }

    if (file.module === "team") {
      const member = await admin.from("equipe").select("id,avatar_drive_file_id,avatar_thumb_drive_file_id").eq("id", file.entity_id).eq("ativo", true).eq("is_public", true).maybeSingle();
      if (!member.data) return new Response("Not found", { status: 404 });
      if (file.category === "portfolio") {
        const item = await admin.from("team_member_portfolio").select("id").eq("drive_file_id", file.id).eq("is_public", true).maybeSingle();
        if (!item.data) return new Response("Not found", { status: 404 });
      } else if (![member.data.avatar_drive_file_id, member.data.avatar_thumb_drive_file_id].includes(file.id)) return new Response("Not found", { status: 404 });
    }


  // GET is supported by the Supabase Edge Functions gateway; HEAD is not.
  // This authorization-only GET returns after all current visibility/link checks and
  // before downloading the original Drive file.
  if (authorizeOnly) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-RKC-Media-Version": String(file.updated_at ?? file.created_at ?? file.id) } });
  }

  try {
    const drive = await downloadDriveFile(file.drive_file_id, req.headers.get("Range"), req.signal);
    const headers = new Headers();
    headers.set("Content-Type", file.mime_type || drive.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Cache-Control", ["materias", "projetos"].includes(file.module)
      ? "public, max-age=0, s-maxage=0, must-revalidate"
      : "public, max-age=86400, s-maxage=86400");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Timing-Allow-Origin", "*");
    for (const name of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
      const value = drive.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(forwardDriveBody(drive.body!, req.signal), { status: drive.status, headers });
  } catch (error) {
    console.error("drive-media upstream request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response("Media unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
});

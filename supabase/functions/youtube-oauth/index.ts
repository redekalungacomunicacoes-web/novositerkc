import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("YOUTUBE_CLIENT_SECRET") || "";
const ENC_KEY = Deno.env.get("YOUTUBE_TOKEN_ENCRYPTION_KEY") || "";
const REDIRECT = SUPABASE_URL + "/functions/v1/youtube-oauth/callback";
const SITE = "https://kalungacomunicacoes.org";
const SCOPES = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"];
const cors = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
const encoder = new TextEncoder();
function hex(bytes: Uint8Array) { return [...bytes].map(n => n.toString(16).padStart(2, "0")).join(""); }
async function hash(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
async function encrypt(value: string) {
  const keyBytes = Uint8Array.from(atob(ENC_KEY), c => c.charCodeAt(0));
  if (keyBytes.length !== 32) throw new Error("Encryption key must be 32 bytes in base64.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value)));
  return btoa(String.fromCharCode(...iv, ...ciphertext));
}
async function isAdmin(userId: string) {
  const { data, error } = await admin.from("user_roles").select("roles!inner(name)").eq("user_id", userId);
  if (error) return false;
  return (data || []).some((entry: { roles?: { name: string } | { name: string }[] }) => {
    const role = Array.isArray(entry.roles) ? entry.roles[0]?.name : entry.roles?.name;
    return role === "admin_alfa" || role === "admin";
  });
}
async function auth(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user || !await isAdmin(data.user.id)) return null;
  return data.user;
}
function returnToPanel(code: string) {
  return Response.redirect(SITE + "/admin/configuracoes?youtube=" + encodeURIComponent(code), 302);
}
async function tokenExchange(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT, grant_type: "authorization_code" })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error("Google token exchange failed");
  return body;
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!SUPABASE_URL || !SERVICE_KEY || !CLIENT_ID || !CLIENT_SECRET || !ENC_KEY) return json({ error: "Integração do YouTube ainda não configurada." }, 503);
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.pathname.endsWith("/callback")) {
      const state = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      if (url.searchParams.has("error")) return returnToPanel("rejected");
      if (!code || !/^[a-zA-Z0-9_-]{30,160}$/.test(state)) return returnToPanel("invalid");
      const stateHash = await hash(state);
      const { data: record, error: readError } = await admin.from("rkc_youtube_oauth_states").select("requested_by,expires_at").eq("state_hash", stateHash).maybeSingle();
      if (readError || !record || new Date(record.expires_at).getTime() < Date.now()) return returnToPanel("expired");
      // Consume the state before exchanging the code, preventing callback replay.
      const { error: deleteError } = await admin.from("rkc_youtube_oauth_states").delete().eq("state_hash", stateHash);
      if (deleteError || !await isAdmin(record.requested_by)) return returnToPanel("invalid");
      const token = await tokenExchange(code);
      if (!token.refresh_token) return returnToPanel("refresh_missing");
      const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: "Bearer " + token.access_token } });
      const channels = await channelResponse.json();
      if (!channelResponse.ok || !channels.items?.length) return returnToPanel("no_channel");
      const channel = channels.items[0];
      // Require the intended YouTube handle; never connect an unrelated personal channel by accident.
      const snippet = channel.snippet || {};
      const custom = String(snippet.customUrl || "").toLowerCase().replace(/^@/, "");
      if (custom !== "kalungacomunicacoes") return returnToPanel("wrong_channel");
      const encrypted = await encrypt(token.refresh_token);
      const { error: saveError } = await admin.from("rkc_youtube_connections").upsert({
        id: "official", channel_id: channel.id, channel_title: snippet.title || "RKC",
        refresh_token_ciphertext: encrypted, connected_by: record.requested_by,
        granted_scopes: String(token.scope || "").split(" ").filter(Boolean),
        updated_at: new Date().toISOString()
      });
      return returnToPanel(saveError ? "save_error" : "connected");
    }
    if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
    const user = await auth(req);
    if (!user) return json({ error: "Acesso restrito a administradores RKC." }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.action === "status") {
      const { data } = await admin.from("rkc_youtube_connections").select("channel_id,channel_title,connected_at").eq("id","official").maybeSingle();
      return json({ connected: Boolean(data), channel: data || null });
    }
    if (body.action === "connect") {
      const state = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n => n.toString(16).padStart(2, "0")).join("");
      const { error } = await admin.from("rkc_youtube_oauth_states").insert({ state_hash: await hash(state), requested_by: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      if (error) return json({ error: "Não foi possível iniciar a autorização." }, 500);
      const destination = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      for (const [key,val] of Object.entries({
        client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code",
        scope: SCOPES.join(" "), state, access_type: "offline", prompt: "consent"
      })) destination.searchParams.set(key, val);
      return json({ authorization_url: destination.toString() });
    }
    return json({ error: "Ação não reconhecida." }, 400);
  } catch (error) {
    console.error("[youtube-oauth]", error instanceof Error ? error.message : "unknown");
    return req.method === "GET" ? returnToPanel("error") : json({ error: "Falha na integração do YouTube." }, 500);
  }
});

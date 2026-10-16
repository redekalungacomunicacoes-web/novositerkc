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
async function youtubeAccessToken() {
  const { data: row, error } = await admin.from("rkc_youtube_connections").select("refresh_token_ciphertext").eq("id", "official").maybeSingle();
  if (error || !row) throw new Error("O canal ainda não está conectado.");
  const encrypted = Uint8Array.from(atob(row.refresh_token_ciphertext), c => c.charCodeAt(0));
  const keyBytes = Uint8Array.from(atob(ENC_KEY), c => c.charCodeAt(0));
  if (keyBytes.length !== 32 || encrypted.length <= 28) throw new Error("Chave de autenticação inválida.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const refreshToken = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: encrypted.slice(0,12) }, key, encrypted.slice(12)));
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,refresh_token:refreshToken,grant_type:"refresh_token"}) });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw new Error("A autorização do canal expirou ou foi revogada.");
  return token.access_token as string;
}
async function youtubeGet(endpoint: string, token: string, params: Record<string, string>) {
  const url = new URL("https://www.googleapis.com/youtube/v3/" + endpoint);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  const response = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const payload = await response.json();
  if (!response.ok) throw new Error("O YouTube não retornou os dados solicitados.");
  return payload;
}
const validUuid = (id: unknown) => typeof id === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
const validVideoId = (id: unknown) => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
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
      const matched = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=kalungacomunicacoes", { headers: { Authorization: "Bearer " + token.access_token } });
      const expected = await matched.json();
      if (!matched.ok || !expected.items?.some((item: { id: string }) => item.id === channel.id)) return returnToPanel("wrong_channel");
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
    if (body.action === "playlists") {
      const token = await youtubeAccessToken();
      const params: Record<string,string> = {part:"snippet,contentDetails",mine:"true",maxResults:"50"};
      if (typeof body.pageToken === "string" && /^[\\w-]{1,200}$/.test(body.pageToken)) params.pageToken = body.pageToken;
      const [result, channel] = await Promise.all([
        youtubeGet("playlists", token, params),
        youtubeGet("channels", token, {part:"contentDetails",mine:"true"}),
      ]);
      const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      const items = (result.items||[]).map((p: any)=>({id:p.id,title:p.snippet?.title||"",thumbnail:p.snippet?.thumbnails?.medium?.url||"",count:p.contentDetails?.itemCount||0}));
      // YouTube's automatic uploads list is available even when the channel has no manual playlists.
      if (uploads && !body.pageToken && !items.some((p:any)=>p.id===uploads)) items.unshift({id:uploads,title:"Todos os vídeos do canal",thumbnail:"",count:0});
      return json({items,nextPageToken:result.nextPageToken||null});
    }
    if (body.action === "videos") {
      const token = await youtubeAccessToken();
      const params: Record<string,string> = {part:"snippet",maxResults:"50"};
      const playlistId = typeof body.playlistId==="string" && /^[\w-]{1,100}$/.test(body.playlistId)?body.playlistId:"";
      if (!playlistId) return json({error:"Escolha uma playlist válida."},400);
      params.playlistId = playlistId;
      if (typeof body.pageToken==="string" && /^[\w-]{1,200}$/.test(body.pageToken)) params.pageToken=body.pageToken;
      const response=await youtubeGet("playlistItems",token,params);
      const all=(response.items||[]).map((v:any)=>({id:v.snippet?.resourceId?.videoId,title:v.snippet?.title||"",thumbnail:v.snippet?.thumbnails?.medium?.url||"",publishedAt:v.snippet?.publishedAt||""})).filter((v:any)=>validVideoId(v.id) && v.title!=="Private video" && v.title!=="Deleted video");
      const details=all.length?await youtubeGet("videos",token,{part:"status",id:all.map((v:any)=>v.id).join(",")}):{items:[]};
      const statuses=new Map((details.items||[]).map((v:any)=>[v.id,v.status?.privacyStatus]));
      return json({items:all.map((v:any)=>({...v,visibility:statuses.get(v.id)||"unknown"})),nextPageToken:response.nextPageToken||null});
    }
    if (body.action === "link_lesson" || body.action === "link_project") {
      if (!validVideoId(body.videoId)) return json({error:"Vídeo inválido."},400);
      const token = await youtubeAccessToken();
      const details=await youtubeGet("videos",token,{part:"snippet,status",id:body.videoId});
      const video=details.items?.[0];
      if (!video) return json({error:"Vídeo não encontrado no canal."},404);
      const owner=await youtubeGet("channels",token,{part:"id",mine:"true"});
      if (!owner.items?.some((c:any)=>c.id===video.snippet?.channelId)) return json({error:"O vídeo não pertence ao canal RKC."},403);
      const videoUrl="https://www.youtube.com/watch?v="+body.videoId;
      if (body.action==="link_lesson") {
        if (!validUuid(body.lessonId)) return json({error:"Aula inválida."},400);
        const {data:lesson,error:lookupError}=await admin.from("academy_lessons").select("id").eq("id",body.lessonId).maybeSingle();
        if (lookupError || !lesson) return json({error:"Aula não encontrada."},404);
        const {error}=await admin.from("academy_lessons").update({media_source:"youtube",media_url:videoUrl,type:"video"}).eq("id",lesson.id);
        return error?json({error:"Não foi possível atualizar a aula."},500):json({ok:true,url:videoUrl});
      }
      if (video.status?.privacyStatus!=="public") return json({error:"Para vincular ao projeto público, publique o vídeo no YouTube primeiro."},409);
      if (!validUuid(body.projectId)) return json({error:"Projeto inválido."},400);
      const number=Number(body.season ?? body.edition);
      if (!Number.isInteger(number) || number<1 || number>99) return json({error:"Temporada inválida."},400);
      const {data:project,error:projectError}=await admin.from("projetos").select("id").eq("id",body.projectId).maybeSingle();
      if (projectError || !project) return json({error:"Projeto não encontrado."},404);
      const {data:already}=await admin.from("projeto_galeria").select("id").eq("projeto_id",project.id).eq("tipo","video").eq("url",videoUrl).maybeSingle();
      if (already) return json({error:"Este vídeo já está vinculado ao projeto."},409);
      const title=String(video.snippet?.title||"Vídeo").slice(0,180);
      const {error}=await admin.from("projeto_galeria").insert({projeto_id:project.id,tipo:"video",url:videoUrl,titulo:`${number}ª temporada — ${title}`,thumb_url:video.snippet?.thumbnails?.medium?.url||null});
      return error?json({error:"Não foi possível vincular o projeto."},500):json({ok:true,url:videoUrl});
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

import assert from "node:assert/strict";

const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const siteUrl = (process.env.RKC_SITE_URL || "https://kalungacomunicacoes.org").replace(/\/$/, "");
assert.ok(supabaseUrl, "SUPABASE_URL is required");
assert.ok(publishableKey, "SUPABASE_PUBLISHABLE_KEY is required");

const headers = { apikey: publishableKey, Accept: "application/json" };
const results = [];
function record(name, passed, detail = {}) {
  results.push({ name, passed: Boolean(passed), ...detail });
  assert.ok(passed, name);
}
async function readJson(path) {
  const response = await fetch(new URL(path, supabaseUrl), { headers });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { response, data, text };
}

try {
  const routes = [
    ["matérias", "/rest/v1/materias?select=id,slug,capa_url,capa_thumb_url,banner_url&status=eq.published&limit=1"],
    ["projetos", "/rest/v1/projetos?select=id&limit=1"],
    ["equipe", "/rest/v1/equipe?select=id&limit=1"],
    ["configurações gerais", "/rest/v1/site_settings?select=*&limit=0"],
    ["configurações do site", "/rest/v1/configuracoes_site?select=*&limit=0"],
    ["pop-ups", "/rest/v1/site_popups?select=*&limit=0"],
  ];
  let articleRows = [];
  for (const [name, path] of routes) {
    const { response, data, text } = await readJson(path);
    const protectedTableDenied = name === "configurações do site" && response.status === 401 && data?.code === "42501";
    record("Supabase REST " + name + " sem HTTP 402", response.status === 200 || protectedTableDenied,
      { status: response.status, rows: Array.isArray(data) ? data.length : null,
        access: protectedTableDenied ? "restricted as expected for publishable key" : undefined,
        error: response.status === 200 || protectedTableDenied ? undefined : text.slice(0, 160) });
    if (name === "matérias") articleRows = Array.isArray(data) ? data : [];
  }

  const authSettings = await fetch(new URL("/auth/v1/settings", supabaseUrl), { headers });
  record("Supabase Auth settings acessível", authSettings.status === 200, { status: authSettings.status });
  const unauthenticatedUser = await fetch(new URL("/auth/v1/user", supabaseUrl), { headers });
  record("Supabase Auth responde sem bloqueio de quota (401 esperado sem sessão)", unauthenticatedUser.status === 401 || unauthenticatedUser.status === 200,
    { status: unauthenticatedUser.status });

  const sitePaths = [
    ["/", "início"],
    ["/materias", "listagem de matérias"],
    ["/projetos", "projetos"],
    ["/equipe", "equipe"],
    ["/admin", "shell do painel administrativo"],
    ["/materias/observatorio-goiano-comunidades-quilombolas", "página de matéria publicada"],
  ];
  for (const [path, name] of sitePaths) {
    const response = await fetch(siteUrl + path, { redirect: "follow" });
    const text = await response.text();
    const spaFallback = response.status === 404 && text.includes('id="root"');
    record("Site oficial " + name, response.status === 200 || spaFallback,
      { path, status: response.status, spaFallback, bytesHtml: text.length });
  }

  const article = articleRows[0];
  const imageUrl = article?.capa_url || article?.capa_thumb_url || article?.banner_url;
  if (imageUrl) {
    const source = new URL(imageUrl);
    const id = source.searchParams.get("id");
    assert.ok(id, "public article image URL must include a Drive media id");
    const mediaUrl = new URL("/functions/v1/drive-media", supabaseUrl);
    mediaUrl.searchParams.set("id", id);
    const media = await fetch(mediaUrl, { headers: { apikey: publishableKey, Range: "bytes=0-0" } });
    const contentRange = media.headers.get("content-range");
    const contentType = media.headers.get("content-type");
    const status = media.status;
    await media.body?.cancel();
    record("drive-media entrega Range de imagem pública", status === 206 &&
      /^bytes 0-0\/\d+$/.test(contentRange || "") &&
      /^image\/(jpeg|png|webp)$/.test(contentType || ""),
      { status, contentType, contentRange });
  } else {
    record("imagem pública para teste de Range", false, { reason: "matéria publicada não retornou capa_url/capa_thumb_url/banner_url" });
  }

  console.log(JSON.stringify({
    ok: true,
    checks: results,
    note: "Testes de produção somente GET; nenhuma gravação, exclusão, login ou alteração de dados foi executada. O endpoint /admin foi verificado apenas como shell público, sem sessão autenticada."
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    checks: results,
    error: String(error),
    note: "Testes de produção somente GET; nenhuma gravação, exclusão, login ou alteração de dados foi executada."
  }, null, 2));
  process.exitCode = 1;
}

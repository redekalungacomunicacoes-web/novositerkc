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

  const driveMediaId = process.env.RKC_PUBLIC_MEDIA_TEST_ID || "";
  if (driveMediaId) {
    const driveMediaUrl = new URL("/functions/v1/drive-media", supabaseUrl);
    driveMediaUrl.searchParams.set("id", driveMediaId);
    const rangeResponse = await fetch(driveMediaUrl, { headers: { apikey: publishableKey, Range: "bytes=0-0" } });
    const rangeStatus = rangeResponse.status;
    const rangeType = rangeResponse.headers.get("content-type");
    const rangeValue = rangeResponse.headers.get("content-range");
    await rangeResponse.body?.cancel();
    record("drive-media real entrega Range da imagem pública", rangeStatus === 206 &&
      /^bytes 0-0\/\d+$/.test(rangeValue || "") &&
      /^image\/(jpeg|png|webp)$/.test(rangeType || ""),
      { status: rangeStatus, contentType: rangeType, contentRange: rangeValue });

    const probeUrl = new URL(driveMediaUrl);
    probeUrl.searchParams.set("authorize", "1");
    const probe = await fetch(probeUrl, { headers: { apikey: publishableKey, Range: "bytes=0-0", "Cache-Control": "no-cache" } });
    const probeStatus = probe.status;
    const probeCacheControl = probe.headers.get("cache-control") || "";
    const probeContentRange = probe.headers.get("content-range") || "";
    const probeContentType = probe.headers.get("content-type") || "";
    await probe.body?.cancel();
    const probeSafe = probeStatus === 204 && probeCacheControl === "no-store" ||
      probeStatus === 206 && /^bytes 0-0\/\d+$/.test(probeContentRange) &&
      /^image\/(jpeg|png|webp)/.test(probeContentType) && probeCacheControl.includes("s-maxage=0");
    record("drive-media probe de autorização compatível com cache seguro", probeSafe,
      { status: probeStatus, cacheControl: probeCacheControl, contentRange: probeContentRange });
  } else {
    record("drive-media test id configurado", false, { reason: "RKC_PUBLIC_MEDIA_TEST_ID ausente" });
  }

  const article = articleRows[0];
  const imageUrl = article?.capa_url || article?.capa_thumb_url || article?.banner_url;
  if (imageUrl) {
    const source = new URL(imageUrl);
    const isDriveMedia = source.origin === supabaseUrl && source.pathname === "/functions/v1/drive-media" && Boolean(source.searchParams.get("id"));
    const media = await fetch(source, { headers: { apikey: publishableKey, Range: "bytes=0-0" } });
    const contentRange = media.headers.get("content-range");
    const contentType = media.headers.get("content-type");
    const status = media.status;
    await media.body?.cancel();
    const rangeOk = status === 206 && /^bytes 0-0\/\d+$/.test(contentRange || "");
    const imageOk = /^image\/(jpeg|png|webp)$/.test(contentType || "");
    record(isDriveMedia ? "drive-media entrega Range de imagem pública" : "URL pública da imagem da matéria responde sem bloqueio de quota",
      imageOk && (rangeOk || status === 200),
      { status, contentType, contentRange, mediaRoute: isDriveMedia ? "drive-media" : source.hostname + source.pathname });
  } else {
    record("imagem pública para teste de Range", false, { reason: "matéria publicada não retornou capa_url/capa_thumb_url/banner_url" });
  }

  console.log(JSON.stringify({
    ok: results.every((item) => item.passed),
    checks: results,
    note: "Testes de produção somente GET; nenhuma gravação, exclusão, login ou alteração de dados foi executada. O endpoint /admin foi verificado apenas como shell público, sem sessão autenticada."
  }, null, 2));
  if (results.some((item) => !item.passed)) throw new Error("Production read-only checks failed: " + results.filter((item) => !item.passed).map((item) => item.name).join(", "));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    checks: results,
    error: String(error),
    note: "Testes de produção somente GET; nenhuma gravação, exclusão, login ou alteração de dados foi executada."
  }, null, 2));
  process.exitCode = 1;
}

const MEDIA_TTL_SECONDS = 60;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PUBLIC_MEDIA_ID = /^(?:materia|projetos|projeto|kalucast)-[A-Za-z0-9_-]{2,200}$/;

function json(body, status = 200, cacheControl = "no-store", extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function mediaCacheKey(requestUrl, id) {
  const key = new URL("/__rkc_media_cache", requestUrl.origin);
  key.searchParams.set("id", id);
  return new Request(key.toString(), { method: "GET" });
}

function upstreamMediaUrl(env, id) {
  const originUrl = new URL("/functions/v1/drive-media", env.SUPABASE_URL);
  originUrl.searchParams.set("id", id);
  return originUrl;
}

async function authorizePublicMedia(id, env) {
  let response;
  try {
    response = await fetch(upstreamMediaUrl(env, id), {
      method: "HEAD",
      headers: { "Cache-Control": "no-cache" },
    });
  } catch {
    return { ok: false, status: 502 };
  }
  // Only the origin's explicit authorization response permits reading cached bytes.
  if (response.status !== 204 || response.headers.get("Cache-Control") !== "no-store") {
    return { ok: false, status: response.status === 404 ? 404 : 503 };
  }
  return { ok: true };
}

async function servePublicMedia(request, url, env) {
  const id = url.searchParams.get("id");
  if (url.searchParams.size !== 1 || !PUBLIC_MEDIA_ID.test(id || "")) {
    return json({ error: "Mídia pública não encontrada." }, 404);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { "Cache-Control": "no-store" } });
  }

  // Authorization is deliberately performed on EVERY request, before consulting cache.
  // A stale cached object can never bypass current publication/link checks.
  const authorization = await authorizePublicMedia(id, env);
  if (!authorization.ok) {
    return new Response(authorization.status === 404 ? "Not found" : "Media authorization unavailable", {
      status: authorization.status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }

  if (request.method === "HEAD") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const cache = caches.default;
  const key = mediaCacheKey(url, id);
  let cached;
  try {
    cached = await cache.match(key);
  } catch {
    cached = undefined;
  }
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate");
    headers.set("X-RKC-Media-Cache", "HIT");
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
  }

  let upstream;
  try {
    upstream = await fetch(upstreamMediaUrl(env, id), { method: "GET" });
  } catch {
    return new Response("Mídia temporariamente indisponível.", {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }

  const contentType = (upstream.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const cacheable = upstream.status === 200 && IMAGE_TYPES.has(contentType);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Cache-Control", cacheable ? `public, max-age=${MEDIA_TTL_SECONDS}` : "no-store");
  responseHeaders.set("X-RKC-Media-Origin", "drive-media");
  responseHeaders.set("X-RKC-Media-Cache", "MISS");

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
  if (cacheable) {
    try {
      const storedHeaders = new Headers(response.headers);
      storedHeaders.set("Cache-Control", `public, max-age=${MEDIA_TTL_SECONDS}`);
      await cache.put(key, new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers: storedHeaders,
      }));
    } catch {
      // Cache failure must not affect the authorized origin response.
    }
  }
  response.headers.set("Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate");
  return response;
}

async function purgePublicCache(request, env) {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const secret = env.RKC_CACHE_PURGE_SECRET;
  if (!secret) return json({ error: "Invalidação não configurada." }, 503);
  if (request.headers.get("Authorization") !== `Bearer ${secret}`) return json({ error: "Não autorizado." }, 401);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Corpo JSON inválido." }, 400); }
  const tags = payload?.tags;
  const validTag = (tag) => tag === "rkc-public-materias" || tag === "rkc-public-media" ||
    (typeof tag === "string" && /^media-[A-Za-z0-9_-]{2,200}$/.test(tag));
  if (!Array.isArray(tags) || tags.length < 1 || tags.length > 20 || !tags.every(validTag)) {
    return json({ error: "Lista de tags inválida." }, 400);
  }
  try {
    const cache = caches.default;
    const ids = [...new Set(tags.filter((tag) => tag.startsWith("media-")).map((tag) => tag.slice(6)))];
    const deleted = await Promise.all(ids.map((id) => cache.delete(mediaCacheKey(new URL(request.url), id))));
    return json({ purged: tags, mediaEntriesDeleted: deleted.filter(Boolean).length });
  } catch {
    return json({ error: "Falha ao invalidar o cache." }, 502);
  }
}

function upstreamUrl(base, select) {
  const url = new URL("/rest/v1/materias", base);
  url.searchParams.set("select", select);
  url.searchParams.set("status", "eq.published");
  url.searchParams.set("order", "published_at.desc.nullslast,created_at.desc");
  return url;
}

function imageWorkerUrl(value, workerOrigin, supabaseOrigin) {
  if (!value) return value;
  try {
    const imageUrl = new URL(value);
    const id = imageUrl.searchParams.get("id");
    const isPublicMateriaMedia = imageUrl.origin === supabaseOrigin &&
      imageUrl.pathname === "/functions/v1/drive-media" &&
      imageUrl.searchParams.size === 1 && PUBLIC_MEDIA_ID.test(id || "");
    return isPublicMateriaMedia ? `${workerOrigin}/media?id=${encodeURIComponent(id)}` : value;
  } catch { return value; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Range",
        "Cache-Control": "no-store",
      }});
    }
    if (url.pathname === "/__cache/purge") return purgePublicCache(request, env);
    if (url.pathname === "/media") return servePublicMedia(request, url, env);
    if (request.method !== "GET" || url.pathname !== "/materias" || url.search) {
      return json({ error: "Rota pública indisponível." }, 404);
    }
    const withAudio = "id,slug,titulo,resumo,capa_url,capa_thumb_url,banner_url,audio_url,autor_nome,tags,published_at,created_at,status";
    const withoutAudio = "id,slug,titulo,resumo,capa_url,capa_thumb_url,banner_url,autor_nome,tags,published_at,created_at,status";
    let upstream = await fetch(upstreamUrl(env.SUPABASE_URL, withAudio), { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } });
    let bodyText = await upstream.text();
    let includedAudio = true;
    if (!upstream.ok && /audio_url/i.test(bodyText) && /(does not exist|schema cache|column)/i.test(bodyText)) {
      upstream = await fetch(upstreamUrl(env.SUPABASE_URL, withoutAudio), { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } });
      bodyText = await upstream.text();
      includedAudio = false;
    }
    if (!upstream.ok) return json({ error: "Não foi possível carregar as matérias públicas." }, 502);
    let rows;
    try {
      rows = JSON.parse(bodyText);
      if (!Array.isArray(rows)) throw new Error("Invalid response");
      if (!includedAudio) rows = rows.map((row) => ({ ...row, audio_url: null }));
      const supabaseOrigin = new URL(env.SUPABASE_URL).origin;
      rows = rows.map((row) => ({
        ...row,
        capa_url: imageWorkerUrl(row.capa_url, url.origin, supabaseOrigin),
        capa_thumb_url: imageWorkerUrl(row.capa_thumb_url, url.origin, supabaseOrigin),
        banner_url: imageWorkerUrl(row.banner_url, url.origin, supabaseOrigin),
      }));
    } catch { return json({ error: "A resposta do Supabase veio em formato inesperado." }, 502); }
    return json(rows, 200, "public, max-age=0, s-maxage=60", { "Cache-Tag": "rkc-public-materias" });
  },
};

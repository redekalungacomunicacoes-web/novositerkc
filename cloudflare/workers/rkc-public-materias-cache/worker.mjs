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

async function servePublicMedia(request, url, env) {
  const id = url.searchParams.get("id");
  if (url.searchParams.size !== 1 || !PUBLIC_MEDIA_ID.test(id || "")) {
    return json({ error: "Mídia pública não encontrada." }, 404);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { "Cache-Control": "no-store" } });
  }

  // This lightweight origin probe runs on every request. The outer Worker response is
  // no-store, so Workers Cache cannot bypass this authorization check on later requests.
  let authorization;
  try {
    authorization = await fetch(upstreamMediaUrl(env, id), {
      method: "HEAD",
      headers: { "Cache-Control": "no-cache" },
      cf: { cacheTtl: 0 },
    });
  } catch {
    return new Response("Media authorization unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  const authorizationHeaders = authorization.headers.get("Cache-Control") || "";
  // During controlled rollout, accept the existing drive-media HEAD contract as well:
  // it returns 200 only after the same visibility/link checks, with s-maxage=0.
  // The updated function returns the preferred 204 + no-store probe without Drive download.
  const authorized = authorization.status === 204 && authorizationHeaders === "no-store"
    || authorization.status === 200 && authorizationHeaders === "public, max-age=0, s-maxage=0, must-revalidate";
  if (!authorized) {
    return new Response(authorization.status === 404 ? "Not found" : "Media authorization unavailable", {
      status: authorization.status === 404 ? 404 : 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  let upstream;
  try {
    // The subrequest uses Workers Caching. It is independent of the outer no-store
    // response, so the Worker executes and authorizes every request while image bytes
    // are served from Cloudflare after the first origin transfer.
    upstream = await fetch(upstreamMediaUrl(env, id), {
      method: "GET",
      cf: {
        cacheEverything: true,
        cacheTtl: MEDIA_TTL_SECONDS,
        cacheTags: ["rkc-public-media", `media-${id}`],
      },
    });
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
  // Never cache the Worker response itself: that would bypass the authorization probe.
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-RKC-Media-Origin", "drive-media");
  responseHeaders.set("X-RKC-Media-Cache", cacheable
    ? (upstream.headers.get("CF-Cache-Status") || "UNKNOWN").toUpperCase()
    : "BYPASS");

  const rangeHeader = request.headers.get("Range");
  if (rangeHeader && cacheable) {
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    const match = /^bytes=(\\d*)-(\\d*)$/.exec(rangeHeader.trim());
    if (!match || (!match[1] && !match[2])) {
      return new Response(null, { status: 416, headers: {
        "Cache-Control": "no-store",
        "Content-Range": `bytes */${bytes.length}`,
        "Accept-Ranges": "bytes",
      }});
    }
    let start;
    let end;
    if (!match[1]) {
      const suffixLength = Number(match[2]);
      start = Math.max(0, bytes.length - suffixLength);
      end = bytes.length - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
      return new Response(null, { status: 416, headers: {
        "Cache-Control": "no-store",
        "Content-Range": `bytes */${bytes.length}`,
        "Accept-Ranges": "bytes",
      }});
    }
    const partialHeaders = new Headers(responseHeaders);
    partialHeaders.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
    partialHeaders.set("Content-Length", String(end - start + 1));
    partialHeaders.set("Accept-Ranges", "bytes");
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: partialHeaders });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

async function purgePublicCache(request, env, ctx) {
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
  if (!ctx?.cache?.purge) return json({ error: "Workers Cache purge indisponível." }, 503);
  try {
    const result = await ctx.cache.purge({ tags: [...new Set(tags)] });
    if (!result?.success) return json({ error: "A Cloudflare não confirmou a invalidação.", details: result?.errors || [] }, 502);
    return json({ purged: [...new Set(tags)] });
  } catch {
    return json({ error: "Falha ao invalidar o cache." }, 502);
  }
}

function upstreamMediaUrl(env, id) {
  const originUrl = new URL("/functions/v1/drive-media", env.SUPABASE_URL);
  originUrl.searchParams.set("id", id);
  return originUrl;
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

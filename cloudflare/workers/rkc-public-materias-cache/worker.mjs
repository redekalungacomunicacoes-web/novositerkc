const MEDIA_TTL_SECONDS = 60;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(body, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
    const isPublicMateriaMedia =
      imageUrl.origin === supabaseOrigin &&
      imageUrl.pathname === "/functions/v1/drive-media" &&
      imageUrl.searchParams.size === 1 &&
      /^materia-[A-Za-z0-9_-]+$/.test(id || "");
    return isPublicMateriaMedia ? `${workerOrigin}/media?id=${encodeURIComponent(id)}` : value;
  } catch {
    return value;
  }
}

async function servePublicMedia(request, url, env) {
  const id = url.searchParams.get("id");
  if (url.searchParams.size !== 1 || !/^materia-[A-Za-z0-9_-]+$/.test(id || "")) {
    return json({ error: "Mídia pública não encontrada." }, 404);
  }
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { "Cache-Control": "no-store" } });
  }
  const range = request.headers.get("Range");
  const originUrl = new URL("/functions/v1/drive-media", env.SUPABASE_URL);
  originUrl.searchParams.set("id", id);
  const headers = new Headers();
  if (range) headers.set("Range", range);
  let upstream;
  try {
    upstream = await fetch(originUrl, { method: "GET", headers });
  } catch {
    return new Response("Mídia temporariamente indisponível.", {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  const contentType = (upstream.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const cacheable = !range && upstream.status === 200 && IMAGE_TYPES.has(contentType);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  // Workers Cache is enabled for this Worker; shared max-age lets the edge serve hits
  // without invoking this handler or the Supabase drive-media origin again.
  responseHeaders.set("Cache-Control", cacheable ? `public, max-age=${MEDIA_TTL_SECONDS}, s-maxage=${MEDIA_TTL_SECONDS}` : "no-store");
  responseHeaders.set("X-RKC-Media-Origin", "drive-media");
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Range",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/media" && request.method === "GET") {
      return servePublicMedia(request, url, env);
    }

    if (request.method !== "GET" || url.pathname !== "/materias" || url.search) {
      return json({ error: "Rota pública indisponível." }, 404);
    }

    const withAudio = "id,slug,titulo,resumo,capa_url,capa_thumb_url,banner_url,audio_url,autor_nome,tags,published_at,created_at,status";
    const withoutAudio = "id,slug,titulo,resumo,capa_url,capa_thumb_url,banner_url,autor_nome,tags,published_at,created_at,status";
    let upstream = await fetch(upstreamUrl(env.SUPABASE_URL, withAudio), {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
    });
    let bodyText = await upstream.text();
    let includedAudio = true;

    if (!upstream.ok && /audio_url/i.test(bodyText) && /(does not exist|schema cache|column)/i.test(bodyText)) {
      upstream = await fetch(upstreamUrl(env.SUPABASE_URL, withoutAudio), {
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
      });
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
    } catch {
      return json({ error: "A resposta do Supabase veio em formato inesperado." }, 502);
    }

    return json(rows, 200, "public, max-age=0, s-maxage=60");
  },
};

export { mediaCacheKey, servePublicMedia };

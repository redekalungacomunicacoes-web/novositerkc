// Netlify Edge: metadados das matérias no HTML inicial, sem depender do React.
const SUPABASE_URL = "https://yycfqeymdsjyulexwrlb.supabase.co";
const SITE_URL = "https://kalungacomunicacoes.org";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c] || c));
const tag = (name: string, value: string, property = false) =>
  `<meta ${property ? "property" : "name"}="${name}" content="${esc(value)}">`;
export default async function handler(request: Request, context: { next: () => Promise<Response> }) {
  if (request.method !== "GET") return context.next();
  const url = new URL(request.url);
  const match = /^\/materias\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return context.next();
  const anonKey = Deno.env.get("VITE_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) return context.next();
  let slug: string;
  try { slug = decodeURIComponent(match[1]); } catch { return context.next(); }
  if (!/^[a-z0-9-]{1,220}$/i.test(slug)) return context.next();
  try {
    const endpoint = new URL(`${SUPABASE_URL}/rest/v1/materias`);
    endpoint.searchParams.set("select", "titulo,resumo,seo_title,seo_description,slug,banner_url,capa_url,status");
    endpoint.searchParams.set("slug", `eq.${slug}`);
    endpoint.searchParams.set("status", "eq.published");
    endpoint.searchParams.set("limit", "1");
    const dataResponse = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(3500)
    });
    if (!dataResponse.ok) return context.next();
    const data = await dataResponse.json();
    const article = Array.isArray(data) ? data[0] : null;
    if (!article) return context.next();
    const response = await context.next();
    if (!response.ok || !String(response.headers.get("content-type")).includes("text/html")) return response;
    const title = String(article.seo_title || article.titulo || "Rede Kalunga Comunicações");
    const description = String(article.seo_description || article.resumo || "").slice(0, 300);
    const image = String(article.banner_url || article.capa_url || "");
    const canonical = `${SITE_URL}/materias/${encodeURIComponent(article.slug)}`;
    const head = [
      tag("description", description),
      tag("og:type", "article", true),
      tag("og:title", title, true),
      tag("og:description", description, true),
      tag("og:url", canonical, true),
      tag("og:site_name", "Rede Kalunga Comunicações", true),
      ...(image.startsWith("https://") ? [tag("og:image", image, true), tag("twitter:image", image)] : []),
      tag("twitter:card", "summary_large_image"),
      tag("twitter:title", title),
      tag("twitter:description", description),
      `<link rel="canonical" href="${esc(canonical)}">`
    ].join("\n");
    let html = await response.text();
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)} | Rede Kalunga Comunicações</title>`);
    html = html.replace(/<\/head>/i, `${head}\n</head>`);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("cache-control", "public, max-age=0, s-maxage=120");
    return new Response(html, { status: response.status, headers });
  } catch { return context.next(); }
}

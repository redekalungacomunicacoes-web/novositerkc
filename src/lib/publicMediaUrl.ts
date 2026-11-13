const DEFAULT_WORKER_ORIGIN = "https://rkc-public-materias-cache.redekalungacomunicacoes.workers.dev";
const PUBLIC_MEDIA_ID = /^(?:materia|projetos|projeto|kalucast|site|team)-[A-Za-z0-9_-]{2,200}$/;

export function resolvePublicDriveImageUrl(
  value: string | null | undefined,
  supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL,
  workerOrigin: string = DEFAULT_WORKER_ORIGIN,
): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  try {
    const imageUrl = new URL(raw);
    const id = imageUrl.searchParams.get("id");
    if (
      imageUrl.origin !== new URL(supabaseUrl).origin ||
      imageUrl.pathname !== "/functions/v1/drive-media" ||
      imageUrl.searchParams.size !== 1 ||
      !id ||
      !PUBLIC_MEDIA_ID.test(id)
    ) return raw;
    return `${workerOrigin}/media?id=${encodeURIComponent(id)}`;
  } catch {
    return raw;
  }
}

export function rewritePublicDriveImageUrlsInHtml(
  html: string | null | undefined,
  supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL,
  workerOrigin: string = DEFAULT_WORKER_ORIGIN,
): string {
  if (!html) return "";
  return html.replace(
    /https?:\/\/[^\s"'<>]+\/functions\/v1\/drive-media\?id=[^&\s"'<>]+/gi,
    (url) => resolvePublicDriveImageUrl(url, supabaseUrl, workerOrigin),
  );
}

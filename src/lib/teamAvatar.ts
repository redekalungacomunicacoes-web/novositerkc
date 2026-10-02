export function driveMediaUrl(publicSlug?: string | null) {
  const slug = (publicSlug || "").trim();
  const base = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  return slug && base ? `${base}/functions/v1/drive-media?id=${encodeURIComponent(slug)}` : null;
}

export function driveSlug(row: unknown): string | null {
  if (!row) return null;
  if (Array.isArray(row)) return String((row[0] as any)?.public_slug || "") || null;
  return String((row as any)?.public_slug || "") || null;
}

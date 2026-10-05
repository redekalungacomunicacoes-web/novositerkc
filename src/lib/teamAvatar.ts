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

export const TEAM_DRIVE_AVATAR_SELECT = "avatar_drive:drive_files!equipe_avatar_drive_file_id_fkey(public_slug),avatar_thumb_drive:drive_files!equipe_avatar_thumb_drive_file_id_fkey(public_slug)";
export function teamAvatarUrl(member: any): string | null {
  return driveMediaUrl(driveSlug(member?.avatar_thumb_drive) || driveSlug(member?.avatar_drive)) || member?.foto_url || null;
}

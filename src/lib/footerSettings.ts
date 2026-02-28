import { supabase } from "@/lib/supabase";

export const FOOTER_DESCRIPTION_MAX_CHARS = 160;
export const FOOTER_STORAGE_BUCKET = "site-assets";

export type FooterSettings = {
  id?: string | number;
  footer_logo_path: string | null;
  footer_description: string | null;
  footer_email: string | null;
  footer_instagram_url: string | null;
  footer_whatsapp: string | null;
  footer_facebook_url: string | null;
  footer_linkedin_url: string | null;
  footer_youtube_url: string | null;
  footer_location: string | null;
  footer_address_short: string | null;
  footer_maps_url: string | null;
};

const FOOTER_COLUMNS = `
  id,
  footer_logo_path,
  footer_description,
  footer_email,
  footer_instagram_url,
  footer_whatsapp,
  footer_facebook_url,
  footer_linkedin_url,
  footer_youtube_url,
  footer_location,
  footer_address_short,
  footer_maps_url
`;

function normalize(data?: Partial<FooterSettings> | null): FooterSettings {
  return {
    id: data?.id,
    footer_logo_path: data?.footer_logo_path ?? null,
    footer_description: data?.footer_description ?? null,
    footer_email: data?.footer_email ?? null,
    footer_instagram_url: data?.footer_instagram_url ?? null,
    footer_whatsapp: data?.footer_whatsapp ?? null,
    footer_facebook_url: data?.footer_facebook_url ?? null,
    footer_linkedin_url: data?.footer_linkedin_url ?? null,
    footer_youtube_url: data?.footer_youtube_url ?? null,
    footer_location: data?.footer_location ?? null,
    footer_address_short: data?.footer_address_short ?? null,
    footer_maps_url: data?.footer_maps_url ?? null,
  };
}

export async function getFooterSettings(): Promise<FooterSettings> {
  const { data, error } = await supabase
    .from("configuracoes_site")
    .select(FOOTER_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return normalize(data);
}

export async function upsertFooterSettings(patch: Partial<FooterSettings>) {
  const current = await getFooterSettings();
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (current.id) {
    const { data, error } = await supabase
      .from("configuracoes_site")
      .update(payload)
      .eq("id", current.id)
      .select(FOOTER_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    return normalize(data);
  }

  const { data, error } = await supabase
    .from("configuracoes_site")
    .insert(payload)
    .select(FOOTER_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return normalize(data);
}

export function buildPublicStorageUrl(path: string | null | undefined, bucket = FOOTER_STORAGE_BUCKET) {
  if (!path) return "";
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function normalizeWhatsappLink(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  return `https://wa.me/${digits}`;
}

export function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isLikelyUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;

  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

export async function uploadFooterLogo(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `footer/logo.${ext}`;

  const { error } = await supabase.storage.from(FOOTER_STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "31536000",
  });

  if (error) throw error;

  return path;
}

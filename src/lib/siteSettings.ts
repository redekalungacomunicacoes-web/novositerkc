// src/lib/siteSettings.ts
import { supabase } from "@/lib/supabase";

export type SiteSettings = {
  home_banner_image_url: string | null;
  home_banner_title: string | null;
  home_banner_subtitle: string | null;

  home_territory_image_url: string | null;
  home_territory_title: string | null;
  home_territory_subtitle: string | null;

  // Quem Somos
  about_team_image_url: string | null;
  about_team_title: string | null;
  about_team_subtitle: string | null;

  google_analytics_enabled: boolean;
  google_analytics_measurement_id: string | null;

  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_og_title: string | null;
  seo_og_description: string | null;
  seo_og_image: string | null;
  seo_indexation: "index" | "noindex" | null;
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      `
      home_banner_image_url,
      home_banner_title,
      home_banner_subtitle,
      home_territory_image_url,
      home_territory_title,
      home_territory_subtitle,
      about_team_image_url,
      about_team_title,
      about_team_subtitle,
      google_analytics_enabled,
      google_analytics_measurement_id,
      seo_title,
      seo_description,
      seo_keywords,
      seo_og_title,
      seo_og_description,
      seo_og_image,
      seo_indexation
      `
    )
    .eq("singleton", true)
    .maybeSingle();

  if (error) throw error;

  return {
    home_banner_image_url: data?.home_banner_image_url ?? null,
    home_banner_title: data?.home_banner_title ?? null,
    home_banner_subtitle: data?.home_banner_subtitle ?? null,

    home_territory_image_url: data?.home_territory_image_url ?? null,
    home_territory_title: data?.home_territory_title ?? null,
    home_territory_subtitle: data?.home_territory_subtitle ?? null,

    about_team_image_url: data?.about_team_image_url ?? null,
    about_team_title: data?.about_team_title ?? null,
    about_team_subtitle: data?.about_team_subtitle ?? null,

    google_analytics_enabled: data?.google_analytics_enabled ?? false,
    google_analytics_measurement_id: data?.google_analytics_measurement_id ?? null,

    seo_title: data?.seo_title ?? null,
    seo_description: data?.seo_description ?? null,
    seo_keywords: data?.seo_keywords ?? null,
    seo_og_title: data?.seo_og_title ?? null,
    seo_og_description: data?.seo_og_description ?? null,
    seo_og_image: data?.seo_og_image ?? null,
    seo_indexation: data?.seo_indexation ?? "index",
  };
}

export async function getHomeBannerUrl(): Promise<string | null> {
  const settings = await getSiteSettings();
  const bannerUrl = settings.home_banner_image_url?.trim();

  // URL única do Banner (Home): pode ser URL digitada manualmente ou URL pública do upload salvo no admin.
  return bannerUrl ? bannerUrl : null;
}

export async function updateSiteSettings(patch: Partial<SiteSettings>) {
  const { data, error } = await supabase
    .from("site_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("singleton", true)
    .select(
      `
      home_banner_image_url,
      home_banner_title,
      home_banner_subtitle,
      home_territory_image_url,
      home_territory_title,
      home_territory_subtitle,
      about_team_image_url,
      about_team_title,
      about_team_subtitle,
      google_analytics_enabled,
      google_analytics_measurement_id,
      seo_title,
      seo_description,
      seo_keywords,
      seo_og_title,
      seo_og_description,
      seo_og_image,
      seo_indexation
      `
    )
    .maybeSingle();

  if (error) throw error;
  return data;
}

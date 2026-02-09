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
      about_team_subtitle
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
  };
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
      about_team_subtitle
      `
    )
    .maybeSingle();

  if (error) throw error;
  return data;
}

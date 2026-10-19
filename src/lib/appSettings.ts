import { supabase } from "@/lib/supabase";

export const DEFAULT_APP_SETTINGS = {
  app_name: "Rede Kalunga Comunicações",
  app_short_name: "RKC",
  app_description: "Notícias, cultura e informação do Território Kalunga e da Chapada dos Veadeiros.",
  app_logo_url: null,
  app_share_title: "Rede Kalunga Comunicações",
  app_share_text: "Acompanhe as notícias, a cultura e as histórias do Território Kalunga.",
  app_share_enabled: true,
} as const;

export type AppSettings = {
  app_name: string;
  app_short_name: string;
  app_description: string;
  app_logo_url: string | null;
  app_share_title: string;
  app_share_text: string;
  app_share_enabled: boolean;
};

export async function getAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("app_name, app_short_name, app_description, app_logo_url, app_share_title, app_share_text, app_share_enabled")
    .eq("singleton", true)
    .maybeSingle();

  if (error) throw error;

  return {
    app_name: data?.app_name ?? DEFAULT_APP_SETTINGS.app_name,
    app_short_name: data?.app_short_name ?? DEFAULT_APP_SETTINGS.app_short_name,
    app_description: data?.app_description ?? DEFAULT_APP_SETTINGS.app_description,
    app_logo_url: data?.app_logo_url ?? null,
    app_share_title: data?.app_share_title ?? DEFAULT_APP_SETTINGS.app_share_title,
    app_share_text: data?.app_share_text ?? DEFAULT_APP_SETTINGS.app_share_text,
    app_share_enabled: data?.app_share_enabled ?? DEFAULT_APP_SETTINGS.app_share_enabled,
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const { data, error } = await supabase
    .from("site_settings")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("singleton", true)
    .select("singleton")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("As configurações do aplicativo não foram salvas.");
}

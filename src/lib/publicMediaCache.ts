import { supabase } from "@/lib/supabase";

export async function purgeRkcPublicMediaCache(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("cloudflare-cache-purge");
    if (error) {
      console.warn("[rkc-media-cache] purge failed; per-request media authorization still blocks revoked content", error);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[rkc-media-cache] purge failed; per-request media authorization still blocks revoked content", error);
    return false;
  }
}

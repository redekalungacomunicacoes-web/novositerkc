import { supabase } from "@/lib/supabase";

export async function purgeRkcPublicMediaCache(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("cloudflare-cache-purge");
    if (error) {
      console.warn("[rkc-media-cache] invalidation pending; short edge TTL remains active", error);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[rkc-media-cache] invalidation pending; short edge TTL remains active", error);
    return false;
  }
}

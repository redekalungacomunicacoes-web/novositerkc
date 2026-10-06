import { supabase } from "@/lib/supabase";

export type SiteImageCategory = "banner" | "territory" | "about" | "team" | "logo" | "favicon";

export async function uploadSiteImage(file: File, category: SiteImageCategory): Promise<string> {
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error("Envie uma imagem de até 25 MB.");
  const form = new FormData();
  form.set("module", "site");
  form.set("category", category);
  form.set("file", file);
  const { data, error } = await supabase.functions.invoke("drive-files", { body: form });
  if (error) {
    let message = error.message;
    try { message = (await error.context?.json())?.error || message; } catch { /* network error */ }
    throw new Error(message || "Não foi possível enviar a imagem ao Drive.");
  }
  if (!data?.ok || !data.file?.url) throw new Error(data?.error || "O Drive não confirmou a imagem.");
  return data.file.url;
}

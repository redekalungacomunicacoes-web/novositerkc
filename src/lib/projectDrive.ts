import { supabase } from "@/lib/supabase";
import { optimizeMateriaImageForUpload } from "@/lib/materiaMediaOptimization";

export function projectDriveSlug(raw: string): string | null {
  try {
    const url = new URL(raw);
    const origin = new URL(supabase.storage.from("projetos").getPublicUrl("_").data.publicUrl).origin;
    return url.origin === origin && url.pathname === "/functions/v1/drive-media" ? url.searchParams.get("id") : null;
  } catch { return null; }
}
export async function uploadProjectImage(projectId: string, category: "cover" | "cover_card" | "gallery", original: File) {
  const file = await optimizeMateriaImageForUpload(original, category === "gallery" ? "gallery" : "cover");
  const form = new FormData();
  form.set("module", "projetos");
  form.set("project_id", projectId);
  form.set("category", category);
  form.set("file", file, file.name);
  const { data, error } = await supabase.functions.invoke("drive-files", { body: form });
  if(error || !data?.ok || !data.file?.id || !data.file?.url) throw new Error(data?.error || error?.message || "O Drive não confirmou a imagem.");
  return data.file as { id: string; url: string };
}
export async function resolveProjectDriveId(raw: string, projectId: string | null, category: "cover" | "cover_card") {
  const slug = projectDriveSlug(raw);
  if(!slug) return null;
  if(!projectId) throw new Error("Salve o projeto antes de vincular uma imagem do Drive.");
  const {data,error}=await supabase.from("drive_files").select("id").eq("public_slug",slug)
    .eq("module","projetos").eq("entity_id",projectId).eq("category",category)
    .eq("status","active").is("deleted_at",null).single();
  if(error || !data) throw new Error("A imagem do Drive não pertence a este projeto ou tipo de mídia.");
  return data.id as string;
}

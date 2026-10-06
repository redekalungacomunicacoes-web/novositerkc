import { ensureDrivePath, uploadDriveFile } from "./google-drive.ts";
import { withCenterLease } from "./file-center.ts";

const ROOT = "1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD";
const SITE = "110lHONxgUcm7uWC8AHkCPs0fqyxP1CN2";
const categories = ["banner", "territory", "about", "team", "logo", "favicon"];

export function validSiteImage(bytes: Uint8Array, mime: string, category: string) {
  if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/png") return [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (mime === "image/webp") return new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP";
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.slice(0,6)));
  if (["image/x-icon", "image/vnd.microsoft.icon"].includes(mime) && category === "favicon")
    return bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0;
  return false;
}

export async function uploadSiteDrive(form: FormData, root: string, user: any, admin: any, actor: string) {
  if (root !== ROOT) throw new Error("Drive institucional RKC obrigatório.");
  const category = String(form.get("category") || "");
  if (!categories.includes(category)) throw new Error("Destino de imagem inválido.");
  const roles = category === "about" ? ["admin_alfa", "admin", "editor"] : ["admin_alfa", "admin"];
  const role = await user.rpc("has_role", { required: roles });
  if (role.error || role.data !== true) throw new Error("Sem permissão para alterar esta imagem.");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > 25 * 1024 * 1024)
    throw new Error("Envie uma imagem de até 25 MB.");
  if (!validSiteImage(new Uint8Array(await file.slice(0,16).arrayBuffer()), file.type, category))
    throw new Error("Envie uma imagem JPEG, PNG, WebP ou GIF válida; favicon também aceita ICO.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  const hash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  const slug = `site-${category}-${hash}`;
  const result = await withCenterLease("institutional-site", admin, async () => {
    const previous = await admin.from("drive_files").select("*").eq("module", "site")
      .eq("public_slug", slug).eq("status", "active").is("deleted_at", null).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data) return previous.data;
    const folder = await ensureDrivePath(SITE, ["midias-ativas", category]);
    const name = file.name.replace(/[\\/\r\n"]/g, "_").slice(0,180) || "imagem";
    const uploaded = await uploadDriveFile(new File([file], name, { type: file.type }), folder.folderId);
    if (Number(uploaded.size) !== file.size) throw new Error("O Drive não confirmou o tamanho da imagem.");
    const saved = await admin.from("drive_files").insert({
      drive_file_id: uploaded.id, drive_folder_id: folder.folderId, name,
      mime_type: file.type, size_bytes: file.size, module: "site", category,
      visibility: "public", status: "active", public_slug: slug, uploaded_by: actor,
    }).select("*").single();
    // Keep an uncertain upload for recovery; never remove the currently published image.
    if (saved.error) throw saved.error;
    return saved.data;
  });
  return { ...result, url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-media?id=${result.public_slug}` };
}

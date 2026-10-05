import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureDrivePath, trashDriveFile, uploadDriveFile } from "./google-drive.ts";

const ROOT = "1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD";
const MATERIAS = "1cwfy1GybdqWd7Uv6MABFFIqpN3LMlMGL";
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const categories = new Set(["cover", "banner", "content", "gallery", "audio"]);
function safeName(value: string) { return value.replace(/[\\/\r\n"]/g, "_").slice(0, 180) || "arquivo"; }
function validImage(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  if (mime === "image/webp") return new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP";
  if (mime === "image/gif") return ["GIF87a","GIF89a"].includes(new TextDecoder().decode(bytes.slice(0,6)));
  if (mime === "image/avif") return new TextDecoder().decode(bytes.slice(4,12)).includes("ftypavif");
  return false;
}
export async function uploadMateriaDrive(form: FormData, root: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  if (root !== ROOT) throw new Error("Drive institucional RKC obrigatório.");
  const materiaId = String(form.get("materia_id") || "");
  const category = String(form.get("category") || "");
  const file = form.get("file");
  if (!uuid(materiaId) || !categories.has(category) || !(file instanceof File)) throw new Error("Dados de upload de matéria inválidos.");
  const { data: materia, error: readError } = await user.from("materias").select("id,slug,status").eq("id", materiaId).maybeSingle();
  if (readError || !materia) throw new Error("Sem permissão para anexar arquivos a esta matéria.");
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error("Imagem inválida ou maior que 25 MB.");
  const thumbnail = category === "cover" ? form.get("thumbnail") : null;
  if (thumbnail && (!(thumbnail instanceof File) || thumbnail.type !== "image/webp" || !thumbnail.size || thumbnail.size > 1024 * 1024 || !validImage(new Uint8Array(await thumbnail.slice(0, 16).arrayBuffer()), thumbnail.type))) {
    throw new Error("Miniatura da capa inválida. Envie uma imagem WebP de até 1 MB.");
  }
  if (category === "audio") {
    if (!file.type.startsWith("audio/") || file.size > 20 * 1024 * 1024) throw new Error("Áudio inválido ou maior que 20 MB.");
  } else if (!validImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.type)) {
    throw new Error("O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG, WebP, GIF ou AVIF válida.");
  }
  const slug = String(materia.slug || materiaId).toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"").slice(0,100) || materiaId;
  const parent = category === "cover" ? "CAPA" : category === "banner" ? "BANNER" : category === "audio" ? "AUDIOS" : "IMAGENS";
  const target = await ensureDrivePath(MATERIAS, [slug, parent]);
  const uploaded: Array<{id:string;name?:string;size?:number;mimeType?:string}> = [];
  try {
    const safeFile = new File([file], safeName(file.name), { type: file.type });
    uploaded.push(await uploadDriveFile(safeFile, target.folderId));
    if (thumbnail instanceof File) {
      uploaded.push(await uploadDriveFile(new File([thumbnail], "capa-thumb.webp", { type: "image/webp" }), target.folderId));
    }
    const rows = uploaded.map((item, index) => {
      const thumb = index === 1 && thumbnail instanceof File;
      const source = thumb ? thumbnail as File : file;
      const publicSlug = `materia-${crypto.randomUUID()}`;
      return {
        drive_file_id: item.id, drive_folder_id: target.folderId,
        name: item.name || (thumb ? "capa-thumb.webp" : safeName(file.name)), mime_type: source.type,
        size_bytes: source.size, module: "materias", entity_id: materiaId,
        category: thumb ? "cover_thumb" : category, visibility: "public", status: "active", public_slug: publicSlug,
        uploaded_by: actor, access_scope: "public",
      };
    });
    const { data, error } = await admin.from("drive_files").insert(rows)
      .select("id,drive_file_id,drive_folder_id,name,mime_type,size_bytes,module,entity_id,category,public_slug,status");
    if (error || !data || data.length !== rows.length) throw error || new Error("Não foi possível registrar os arquivos da matéria.");
    const withUrl = (row: any) => ({ ...row, url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-media?id=${encodeURIComponent(row.public_slug)}` });
    return { ...withUrl(data[0]), thumbnail: data[1] ? withUrl(data[1]) : null };
  } catch (error) {
    for (const item of uploaded.reverse()) { try { await trashDriveFile(item.id); } catch (cleanup) { console.error("[materia-drive] cleanup pending", cleanup); } }
    throw error;
  }
}

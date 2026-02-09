// src/lib/storage.ts
import { supabase } from "@/lib/supabase";

export type StorageBucket =
  | "materias"
  | "projetos"
  | "equipe"
  | "site"
  | "quem-somos";

type UploadOptions = {
  bucket: StorageBucket;
  folder?: string;           // ex: "capa", "logo", "banner", "galeria"
  file: File;
  // Se você quer sempre sobrescrever o mesmo caminho (ex.: logo do site),
  // passe fixedFileName (ex.: "logo.png")
  fixedFileName?: string;
  // Se true, usa upsert (sobrescreve arquivo)
  upsert?: boolean;
  // Se true, valida se é imagem e tamanho
  validate?: boolean;
  // tamanho máximo (bytes). default 6MB
  maxSizeBytes?: number;
};

function slugifyFilename(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo inválido: envie uma imagem (jpg/png/webp/gif).");
  }
}

export async function uploadImageToStorage(opts: UploadOptions): Promise<{
  publicUrl: string;
  path: string; // caminho dentro do bucket
}> {
  const {
    bucket,
    folder = "",
    file,
    fixedFileName,
    upsert = true,
    validate = true,
    maxSizeBytes = 6 * 1024 * 1024, // 6MB
  } = opts;

  if (!file) throw new Error("Nenhum arquivo selecionado.");

  if (validate) {
    ensureImage(file);
    if (file.size > maxSizeBytes) {
      throw new Error(
        `Imagem muito grande. Máximo: ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`
      );
    }
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeBase = fixedFileName
    ? fixedFileName.replace(/\.[^.]+$/, "") // remove extensão se veio
    : `${Date.now()}-${slugifyFilename(file.name.replace(/\.[^.]+$/, ""))}`;

  const finalName = `${safeBase}.${ext}`;

  const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, "");
  const path = cleanFolder ? `${cleanFolder}/${finalName}` : finalName;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    // Erro comum: policy/permissão do bucket
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Falha ao gerar URL pública do arquivo.");
  }

  return { publicUrl: data.publicUrl, path };
}

/**
 * Opcional: apaga um arquivo antigo do Storage a partir da URL pública.
 * Útil quando você quer evitar lixo (ex.: trocar capa antiga).
 */
export async function deleteFromStorageByPublicUrl(bucket: StorageBucket, publicUrl: string) {
  if (!publicUrl) return;

  // URL pública padrão:
  // https://xxxx.supabase.co/storage/v1/object/public/<bucket>/<path>
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const path = publicUrl.substring(idx + marker.length);
  if (!path) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}

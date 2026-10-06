export type MateriaImageCategory = "cover" | "banner" | "content" | "gallery";

type ImagePreset = {
  maxEdge: number;
  quality: number;
  minBytes: number;
};

const PRESETS: Record<MateriaImageCategory, ImagePreset> = {
  cover: { maxEdge: 1920, quality: 0.82, minBytes: 256 * 1024 },
  banner: { maxEdge: 1920, quality: 0.82, minBytes: 256 * 1024 },
  content: { maxEdge: 1600, quality: 0.82, minBytes: 256 * 1024 },
  gallery: { maxEdge: 1800, quality: 0.82, minBytes: 256 * 1024 },
};

const OPTIMIZABLE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export function getMateriaImageOptimizationPreset(category: MateriaImageCategory) {
  return PRESETS[category];
}

function webpName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "imagem";
  return `${base}.webp`;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem WebP."))),
      "image/webp",
      quality,
    );
  });
}

export async function optimizeMateriaImageForUpload(
  file: File,
  category: MateriaImageCategory,
): Promise<File> {
  const preset = PRESETS[category];
  if (!preset || !OPTIMIZABLE_TYPES.has(file.type) || file.size < preset.minBytes) return file;

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longestEdge > preset.maxEdge ? preset.maxEdge / longestEdge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const resized = scale < 0.999;

    // A WebP que já está pequena e dentro da dimensão alvo não precisa ser recodificada.
    if (!resized && file.type === "image/webp") return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToWebp(canvas, preset.quality);

    // Evita substituir por um WebP maior quando não houve redimensionamento.
    if (!resized && blob.size >= file.size * 0.98) return file;

    const optimized = new File([blob], webpName(file.name), {
      type: "image/webp",
      lastModified: file.lastModified || Date.now(),
    });

    console.info("[materia-media] imagem otimizada antes do Drive", {
      category,
      originalBytes: file.size,
      optimizedBytes: optimized.size,
      savedPercent: Math.max(0, Math.round((1 - optimized.size / file.size) * 100)),
      originalType: file.type,
      optimizedType: optimized.type,
      width,
      height,
    });

    return optimized;
  } catch (error) {
    // O upload continua com o original se o navegador não conseguir decodificar o formato.
    console.warn("[materia-media] otimização ignorada; enviando arquivo original", error);
    return file;
  } finally {
    bitmap?.close();
  }
}

export async function optimizeMateriaDriveForm(body: FormData) {
  if (body.get("module") !== "materias" || body.get("action")) return body;

  const category = String(body.get("category") || "") as MateriaImageCategory | "audio";
  if (category === "audio" || !(category in PRESETS)) return body;

  const file = body.get("file");
  if (!(file instanceof File)) return body;

  const optimized = await optimizeMateriaImageForUpload(file, category);
  if (optimized !== file) body.set("file", optimized, optimized.name);
  return body;
}

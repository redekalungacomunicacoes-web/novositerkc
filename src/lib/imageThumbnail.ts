const WEBP_TYPE = "image/webp";
const JPEG_TYPE = "image/jpeg";

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler a imagem para gerar thumbnail."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Falha ao gerar thumbnail."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

export async function createThumbnail(file: File, size = 320, quality = 0.75): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas indisponível no navegador.");
    }

    const side = Math.min(image.width, image.height);
    const sourceX = Math.floor((image.width - side) / 2);
    const sourceY = Math.floor((image.height - side) / 2);

    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);

    try {
      return await canvasToBlob(canvas, WEBP_TYPE, quality);
    } catch {
      return await canvasToBlob(canvas, JPEG_TYPE, quality);
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}


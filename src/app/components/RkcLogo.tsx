import { useEffect, useRef } from "react";
import logoRKC from "@/assets/4eeb42365666e2aad88f332a0930461cd4eefe17.png";

type Props = { className?: string; alt?: string };

export function RkcLogo({ className = "", alt = "Rede Kalunga Comunicações" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.src = logoRKC;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = image.data;
      const w = canvas.width, h = canvas.height;
      const corner = [d[0], d[1], d[2]];
      const tolerance = 28;
      const seen = new Uint8Array(w * h);
      const stack: number[] = [];
      for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
      for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
      while (stack.length) {
        const pos = stack.pop()!;
        if (pos < 0 || pos >= w * h || seen[pos]) continue;
        seen[pos] = 1;
        const i = pos * 4;
        const near = Math.abs(d[i] - corner[0]) <= tolerance &&
          Math.abs(d[i + 1] - corner[1]) <= tolerance &&
          Math.abs(d[i + 2] - corner[2]) <= tolerance;
        if (!near) continue;
        d[i + 3] = 0;
        const x = pos % w;
        if (x > 0) stack.push(pos - 1);
        if (x < w - 1) stack.push(pos + 1);
        if (pos >= w) stack.push(pos - w);
        if (pos < w * (h - 1)) stack.push(pos + w);
      }
      ctx.putImageData(image, 0, 0);
    };
  }, []);

  return <canvas ref={canvasRef} role="img" aria-label={alt} className={className} />;
}

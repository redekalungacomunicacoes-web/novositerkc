import { useEffect, useRef, useState } from "react";
import { downloadRkcDriveFile } from "@/services/driveFiles";
import placeholder from "@/assets/avatar-placeholder.svg";

export function TeamAvatarImage({ src, originalSrc, fileId, alt, className }: {
  src?: string | null; originalSrc?: string | null; fileId?: string | null;
  alt: string; className?: string;
}) {
  const [url, setUrl] = useState(src || placeholder);
  const [step, setStep] = useState(0);
  const objectUrl = useRef<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setUrl(src || placeholder); setStep(0);
    return () => {
      generation.current += 1;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    };
  }, [src, originalSrc, fileId]);
  async function fallback() {
    if (step === 0 && originalSrc && originalSrc !== url) {
      setStep(1); setUrl(originalSrc); return;
    }
    if (step < 2 && fileId) {
      setStep(2);
      const current = generation.current;
      try {
        const blob = await downloadRkcDriveFile(fileId);
        if (current !== generation.current) return;
        objectUrl.current = URL.createObjectURL(blob);
        setUrl(objectUrl.current); return;
      } catch { /* Private preview requires the editor's session. */ }
    }
    setStep(3); setUrl(placeholder);
  }
  return <img src={url} alt={alt} className={className} onError={fallback} />;
}

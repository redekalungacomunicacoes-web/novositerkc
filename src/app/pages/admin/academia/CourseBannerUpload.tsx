import { useState } from "react";
import { DriveUploads } from "./DriveUploads";
import { Button } from "./components";
import { message } from "./service";
import { removeAcademyFile } from "@/services/driveFiles";

/** Banner shares the proven cover transport, with an independent field and BANNER folder. */
export function CourseBannerUpload({ courseId, fileId, inputId, onSelectedFile, onSaved }: {
  courseId: string;
  fileId: string | null;
  inputId: string;
  onSelectedFile: (file: File | null) => void;
  onSaved: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  return <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
    <DriveUploads courseId={courseId} kind="banner" inputOnly inputIdOverride={inputId}
      onSelectedFile={onSelectedFile} onSaved={onSaved} onBusyChange={setUploading} disabled={removing} />
    {fileId && <Button size="sm" variant="outline" disabled={removing || uploading} onClick={async () => {
      if (!window.confirm("Remover o banner atual do curso e enviá-lo à lixeira do Drive? A capa será preservada.")) return;
      setRemoving(true); setError("");
      try { await removeAcademyFile(fileId); onSelectedFile(null); await onSaved(); }
      catch (e) { setError(message(e)); }
      finally { setRemoving(false); }
    }}>{removing ? "Removendo banner…" : "Remover banner"}</Button>}
    {error && <p role="alert" className="max-w-80 text-xs text-red-200">{error}</p>}
  </div>;
}

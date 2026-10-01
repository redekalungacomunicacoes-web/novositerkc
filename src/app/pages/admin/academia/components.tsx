import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { signedAsset, safeLink, message } from "./service";
import { downloadRkcDriveFile } from "@/services/driveFiles";
import { videoEmbed } from "./media";
export { Button };
export const labels: Record<string, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  published: "Publicado",
  archived: "Arquivado",
  internal: "Interno",
  public: "Público (futuro)",
  free: "Gratuito (futuro)",
  paid: "Pago (futuro)",
  manual: "Manual",
  self: "Livre adesão",
  automatic: "Automática ao entrar",
  active: "Ativa",
  cancelled: "Cancelada",
  passed: "Aprovado",
  failed: "Não aprovado",
  pending: "Aguardando correção",
  approved: "Aprovada",
  rejected: "Devolvida",
  text: "Texto",
  video: "Vídeo",
  audio: "Áudio",
  image: "Imagem",
  pdf: "PDF",
  document: "Documento",
  presentation: "Apresentação",
  link: "Link",
  mixed: "Misto",
  choice: "Múltipla escolha",
  boolean: "Verdadeiro/falso",
  short: "Resposta curta",
  essay: "Discursiva",
  practical: "Prática",
  activity: "Atividade",
  assessment: "Avaliação",
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "published" | "draft";
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs ${tone === "published" ? "bg-green-100 text-green-900 border-green-200" : tone === "draft" ? "bg-amber-100 text-amber-900 border-amber-200" : "bg-muted"}`}
    >
      {children}
    </span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      {children}
    </div>
  );
}
export function Meter({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <progress
        aria-label="Progresso do curso"
        value={value}
        max={100}
        className="w-full h-3 accent-green-700"
      />
      <p className="text-sm text-muted-foreground">{value}% concluído</p>
    </div>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm space-y-4 min-w-0">
      {children}
    </section>
  );
}
export function CourseLink({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <Link
      className="text-primary underline underline-offset-4"
      to={`/admin/academia/cursos/${id}`}
    >
      {children}
    </Link>
  );
}
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "checkbox"
    | "select"
    | "array"
    | "datetime-local"
    | "asset";
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  nullable?: boolean;
  hint?: string;
};
export const opts = (values: string[]) =>
  values.map((value) => ({ value, label: labels[value] || value }));
export function Editor({
  title,
  fields,
  initial,
  courseId: _courseId,
  onSave,
  onClose,
}: {
  title: string;
  fields: Field[];
  initial: Record<string, unknown>;
  courseId?: string;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v = { ...initial };
    for (const f of fields)
      if (f.type === "array")
        v[f.name] = Array.isArray(v[f.name])
          ? (v[f.name] as string[]).join("\n")
          : v[f.name] || "";
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const v = { ...values };
      for (const f of fields) {
        if (f.type === "array")
          v[f.name] = String(v[f.name] || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        if (f.type === "number")
          v[f.name] =
            f.nullable && (v[f.name] === "" || v[f.name] == null)
              ? null
              : Number(v[f.name] || 0);
        if (f.type === "checkbox") v[f.name] = !!v[f.name];
        if (f.nullable && v[f.name] === "") v[f.name] = null;
        if (f.type === "datetime-local" && v[f.name])
          v[f.name] = new Date(String(v[f.name])).toISOString();
      }
      await onSave(v);
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Preencha os dados e salve as alterações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name} className="text-sm space-y-1">
              <label
                className="block font-medium"
                htmlFor={`academy-${f.name}`}
              >
                {f.label}
                {f.required ? " *" : ""}
              </label>
              {f.type === "checkbox" ? (
                <input
                  id={`academy-${f.name}`}
                  type="checkbox"
                  className="ml-3 accent-green-700"
                  checked={!!values[f.name]}
                  onChange={(e) =>
                    setValues({ ...values, [f.name]: e.target.checked })
                  }
                />
              ) : f.type === "select" ? (
                <select
                  id={`academy-${f.name}`}
                  required={f.required}
                  className="w-full border rounded-md bg-background px-3 py-2"
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => {
                    const next = { ...values, [f.name]: e.target.value };
                    if (f.name === "media_source") {
                      if (e.target.value === "none") {
                        next.media_url = null;
                        next.media_path = null;
                        next.media_drive_file_id = null;
                      }
                      if (e.target.value === "drive") {
                        next.media_url = null;
                      }
                      if (["youtube", "vimeo"].includes(e.target.value)) {
                        next.media_path = null;
                        next.media_drive_file_id = null;
                      }
                    }
                    setValues(next);
                  }}
                >
                  {f.nullable && <option value="">Nenhum</option>}
                  {!f.nullable && !values[f.name] && (
                    <option value="">Selecione</option>
                  )}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" || f.type === "array" ? (
                <Textarea
                  id={`academy-${f.name}`}
                  rows={4}
                  required={f.required}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.name]: e.target.value })
                  }
                />
              ) : (
                <Input
                  id={`academy-${f.name}`}
                  required={f.required}
                  type={f.type || "text"}
                  min={f.min}
                  max={f.max}
                  step={f.type === "number" ? "any" : undefined}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.name]: e.target.value })
                  }
                />
              )}
              {f.name === "media_url" &&
                videoEmbed(
                  String(values.media_source),
                  String(values.media_url),
                ) && (
                  <iframe
                    title="Prévia do vídeo"
                    className="w-full aspect-video rounded-md"
                    src={
                      videoEmbed(
                        String(values.media_source),
                        String(values.media_url),
                      )!
                    }
                    allow="fullscreen; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                  />
                )}
              {f.hint && (
                <span className="block text-xs text-muted-foreground">
                  {f.hint}
                </span>
              )}
            </div>
          ))}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button disabled={busy} type="submit">
              {busy ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              disabled={busy}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function Asset({
  path,
  driveFileId,
  source,
  url,
  title,
  type,
}: {
  path?: string | null;
  driveFileId?: string | null;
  source?: string;
  url?: string | null;
  title: string;
  type?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [mime, setMime] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setSrc(null);
    setMime("");
    let objectUrl: string | null = null;
    if (driveFileId)
      downloadRkcDriveFile(driveFileId)
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setMime(blob.type);
          setSrc(objectUrl);
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    else if (path)
      signedAsset(path)
        .then((s) => {
          if (active) setSrc(s);
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    else setSrc(safeLink(url));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, url, driveFileId, retry]);
  if (error)
    return (
      <p role="alert" className="text-destructive">
        {error}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRetry((value) => value + 1)}
        >
          Tentar abrir novamente
        </Button>
      </p>
    );
  if (!src)
    return path || driveFileId ? <p>Carregando material privado…</p> : null;
  const embed = videoEmbed(source || "", url);
  const format = mime.startsWith("video/")
    ? "video"
    : mime.startsWith("audio/")
      ? "audio"
      : mime.startsWith("image/")
        ? "image"
        : type;
  return (
    <div className="space-y-3">
      {embed ? (
        <iframe
          title={title}
          src={embed}
          className="w-full aspect-video rounded-lg"
          allow="fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      ) : format === "video" &&
        (driveFileId || /\.(mp4|webm)(\?|$)/i.test(src)) ? (
        <video
          aria-label={title}
          controls
          preload="metadata"
          className="w-full max-h-96 rounded-lg"
          src={src}
        />
      ) : format === "audio" ? (
        <audio aria-label={title} controls src={src} className="w-full" />
      ) : format === "image" ? (
        <img
          alt={title}
          src={src}
          className="w-full max-h-96 object-contain rounded-lg"
        />
      ) : null}
      <a
        className="text-primary underline break-words"
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        download={driveFileId ? title : undefined}
      >
        Abrir {title}
      </a>
    </div>
  );
}

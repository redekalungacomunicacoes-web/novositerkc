import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button, Asset } from "./components";
import { message } from "./service";
import { uploadAcademyFile, removeAcademyFile } from "@/services/driveFiles";
import type { DriveFileRecord } from "@/services/driveFiles";
type Item = {
  id: string;
  file: File;
  state: "pending" | "sending" | "confirming" | "done" | "error";
  progress: number;
  error?: string;
};
// Keep selected files and failures while navigating between academy views.
const queues = new Map<string, Item[]>();
const listeners = new Set<() => void>();
const emptyQueue: Item[] = [];
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function SelectedPreview({ file }: { file: File }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) return null;
  if (file.type.startsWith("image/"))
    return <img src={src} alt={"Prévia de " + file.name} loading="lazy" decoding="async" className="aspect-video max-h-48 w-full rounded-md object-cover" />;
  if (file.type.startsWith("video/"))
    return <video src={src} controls preload="metadata" className="max-h-64 w-full rounded-md bg-black" aria-label={"Prévia de " + file.name} />;
  if (file.type === "application/pdf")
    return <object data={src} type="application/pdf" aria-label={"Prévia de " + file.name} className="h-48 w-full rounded-md border" />;
  return null;
}
export function DriveUploads({
  courseId,
  lessonId,
  kind,
  existing,
  replaceMaterialId,
  cleanupOnly,
  onSaved,
}: {
  courseId: string;
  lessonId?: string;
  kind: "cover" | "media" | "material";
  existing?: DriveFileRecord[];
  replaceMaterialId?: string;
  cleanupOnly?: boolean;
  onSaved: () => Promise<void>;
}) {
  const inputId = useId();
  const queueKey = courseId + "/" + (lessonId || "course") + "/" + kind + "/" + (replaceMaterialId || "new");
  const items = useSyncExternalStore(subscribe, () => queues.get(queueKey) || emptyQueue);
  const setItems = (update: (rows: Item[]) => Item[]) => {
    queues.set(queueKey, update(queues.get(queueKey) || emptyQueue));
    listeners.forEach((listener) => listener());
  };
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const working = useRef(false);
  const change = (id: string, patch: Partial<Item>) => {
    setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };
  async function send(queue: Item[]) {
    if (working.current) return;
    working.current = true;
    setError("");
    try {
      for (const item of queue) {
        if (!["pending", "error"].includes(item.state)) continue;
        change(item.id, { state: "sending", progress: 0, error: "" });
        try {
          await uploadAcademyFile({
            courseId,
            lessonId,
            kind,
            file: item.file,
            uploadId: item.id,
            replaceMaterialId,
            onProgress: (progress) => change(item.id, {
              progress,
              state: progress === 100 ? "confirming" : "sending",
            }),
          });
          change(item.id, { state: "done", progress: 100 });
        } catch (e) {
          change(item.id, { state: "error", error: message(e) });
        }
      }
      await onSaved();
      setItems((rows) => rows.filter((row) => row.state !== "done"));
    } catch (e) {
      setError(message(e));
    } finally {
      working.current = false;
    }
  }
  const busy = removing || items.some((item) => ["sending", "confirming"].includes(item.state));
  const pending = items.filter((item) => item.state === "pending");
  const activeFiles = (existing || []).filter((file) => file.status === "active");
  const formatSize = (bytes: number | null) => {
    if (!bytes || bytes < 1) return "";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toLocaleString("pt-BR", { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
  };
  const chooseLabel = kind === "cover"
    ? (activeFiles.length ? "Substituir capa" : "Adicionar imagem da capa")
    : kind === "media"
      ? (activeFiles.length ? "Substituir conteúdo da aula" : "Adicionar vídeo ou arquivo da aula")
      : (activeFiles.length ? "Adicionar outro material" : "Adicionar arquivo");
  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-sm font-medium">
        {kind === "cover" ? "Capa do curso — Drive RKC" : kind === "media" ? "Conteúdo da aula — Drive RKC" : "Materiais — Drive RKC"}
      </p>
      <p className="text-xs text-muted-foreground">
        Selecione um arquivo e confira a prévia. O envio começa após a seleção. {kind === "cover"
          ? "Recomendado: 1280 × 720 px (16:9), WebP ou JPG. Evite texto junto às bordas. Até 25 MB."
          : kind === "material"
            ? "Adicione quantos materiais complementares precisar, inclusive vários de uma vez. Até 15 GB por arquivo."
            : "Vídeos e arquivos da aula ficam no Drive RKC. Até 15 GB por arquivo."}
      </p>
      {!cleanupOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={inputId}
            className="sr-only"
            aria-label={chooseLabel}
            type="file"
            multiple={kind === "material" && !replaceMaterialId}
            accept={kind === "cover" ? "image/jpeg,image/png,image/webp,image/gif" : kind === "media" ? "video/*,application/pdf,image/*,audio/*" : undefined}
            disabled={busy}
            onChange={(event) => {
              const next = Array.from(event.target.files || []).map((file): Item => ({
                id: crypto.randomUUID(),
                file,
                state: "pending",
                progress: 0,
              }));
              setItems((rows) => [...rows, ...next]);
              event.target.value = "";
              if (next.length) void send(next);
            }}
          />
          <label
            htmlFor={inputId}
            className={"inline-flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted " + (busy ? "pointer-events-none opacity-50" : "")}
          >
            {chooseLabel}
          </label>
          {pending.length > 0 && (
            <p className="text-sm text-muted-foreground" role="status">
              Envio iniciado automaticamente para o Drive RKC.
            </p>
          )}
        </div>
      )}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
            <p className="break-words font-medium">{item.file.name}</p>
            <SelectedPreview file={item.file} />
            <p>
              {{
                pending: "Pronto para enviar",
                sending: "Enviando",
                confirming: "Confirmando gravação no Drive e na aula",
                done: "Arquivo salvo e vinculado",
                error: "Falha — arquivo mantido para nova tentativa",
              }[item.state]}
              {["sending", "confirming"].includes(item.state) ? " · " + item.progress + "%" : ""}
            </p>
            {["sending", "confirming"].includes(item.state) && (
              <progress aria-label={"Envio de " + item.file.name} className="w-full" max={100} value={item.progress} />
            )}
            {item.error && <p role="alert" className="text-destructive break-words">{item.error}</p>}
            <div className="flex flex-wrap gap-2">
              {item.state === "error" && (
                <Button size="sm" disabled={busy} onClick={() => void send([item])}>Tentar novamente</Button>
              )}
              {["error", "pending", "done"].includes(item.state) && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setItems((rows) => rows.filter((row) => row.id !== item.id))}>
                  {item.state === "done" ? "Limpar da fila" : "Remover arquivo selecionado"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {activeFiles.length > 0 && (
        <div className="border-t pt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {kind === "material"
                ? `${activeFiles.length} material${activeFiles.length === 1 ? "" : "is"} complementar${activeFiles.length === 1 ? "" : "es"}`
                : "Arquivo atualmente vinculado"}
            </p>
            {kind === "material" && (
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                Sem limite de quantidade
              </span>
            )}
          </div>
          <div className={kind === "material" ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
            {activeFiles.map((file) => (
              <article key={file.id} className="overflow-hidden rounded-lg border bg-background">
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.mime_type || "Arquivo"}
                        {formatSize(file.size_bytes) ? ` · ${formatSize(file.size_bytes)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                      Drive RKC
                    </span>
                  </div>
                  {file.mime_type?.startsWith("video/") ? (
                    <Asset driveFileId={file.id} title={file.name} type="video" />
                  ) : file.mime_type?.startsWith("image/") ? (
                    <Asset driveFileId={file.id} title={file.name} type="image" />
                  ) : file.mime_type === "application/pdf" ? (
                    <Asset driveFileId={file.id} title={file.name} />
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm("Remover este arquivo do conteúdo e movê-lo para a lixeira do Drive?")) return;
                      setRemoving(true);
                      setError("");
                      try {
                        await removeAcademyFile(file.id);
                        await onSaved();
                      } catch (e) {
                        setError(message(e));
                      } finally {
                        setRemoving(false);
                      }
                    }}
                  >
                    Remover do curso
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  );
}
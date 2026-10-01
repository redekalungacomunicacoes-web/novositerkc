import { useRef, useState, useSyncExternalStore } from "react";
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
// Keep File objects and failed operations when navigating between academy views.
const queues = new Map<string, Item[]>();
const listeners = new Set<() => void>();
const emptyQueue: Item[] = [];
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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
  const queueKey = `${courseId}/${lessonId || "course"}/${kind}/${replaceMaterialId || "new"}`;
  const items = useSyncExternalStore(
    subscribe,
    () => queues.get(queueKey) || emptyQueue,
  );
  const setItems = (update: (rows: Item[]) => Item[]) => {
    queues.set(queueKey, update(queues.get(queueKey) || emptyQueue));
    listeners.forEach((listener) => listener());
  };
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const working = useRef(false);
  const change = (id: string, patch: Partial<Item>) => {
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  async function send(queue: Item[]) {
    if (working.current) return;
    working.current = true;
    try {
      // Serialize the queue; the server additionally leases the course to prevent cross-tab races.
      for (const item of queue) {
        change(item.id, { state: "sending", progress: 0, error: "" });
        try {
          await uploadAcademyFile({
            courseId,
            lessonId,
            kind,
            file: item.file,
            uploadId: item.id,
            replaceMaterialId,
            onProgress: (p) =>
              change(item.id, {
                progress: p,
                state: p === 100 ? "confirming" : "sending",
              }),
          });
          change(item.id, { state: "done", progress: 100 });
        } catch (e) {
          change(item.id, { state: "error", error: message(e) });
        }
      }
      await onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      working.current = false;
    }
  }
  const busy =
    removing || items.some((i) => ["sending", "confirming"].includes(i.state));
  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-sm font-medium">
        {kind === "cover"
          ? "Capa no Drive RKC"
          : kind === "media"
            ? "Conteúdo da aula no Drive RKC"
            : "Materiais no Drive RKC"}
      </p>
      <p className="text-xs text-muted-foreground">
        Arquivos privados, até 50 MB. Envio confirmado após gravação no Drive e
        vínculo com o conteúdo. Falhas permanecem nesta fila para nova
        tentativa.
      </p>
      {!cleanupOnly && (
        <input
          aria-label={
            kind === "cover"
              ? "Enviar capa"
              : kind === "media"
                ? "Enviar conteúdo da aula"
                : "Enviar materiais"
          }
          type="file"
          multiple={kind === "material" && !replaceMaterialId}
          accept={
            kind === "cover"
              ? "image/jpeg,image/png,image/webp,image/gif"
              : undefined
          }
          disabled={busy}
          onChange={(e) => {
            const next = Array.from(e.target.files || []).map(
              (file): Item => ({
                id: crypto.randomUUID(),
                file,
                state: "pending",
                progress: 0,
              }),
            );
            setItems((rows) => [...rows, ...next]);
            e.target.value = "";
            void send(next);
          }}
        />
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="space-y-1 text-sm">
            <p className="break-words">
              {item.file.name} ·{" "}
              {
                {
                  pending: "Pendente",
                  sending: "Enviando",
                  confirming: "Confirmando gravação",
                  done: "Arquivo salvo e vinculado",
                  error: "Falha — pendente",
                }[item.state]
              }
            </p>
            {["sending", "confirming"].includes(item.state) && (
              <progress
                aria-label={`Envio de ${item.file.name}`}
                className="w-full"
                max={100}
                value={item.progress}
              />
            )}
            {item.error && (
              <p role="alert" className="text-destructive break-words">
                {item.error}
              </p>
            )}
            {item.state === "error" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void send([item])}
              >
                Tentar novamente
              </Button>
            )}
            {["error", "pending", "done"].includes(item.state) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setItems((rows) => rows.filter((r) => r.id !== item.id))
                }
              >
                {item.state === "done" ? "Limpar da fila" : "Remover da fila"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {existing?.map((file) => (
        <div key={file.id} className="space-y-2 border-t pt-3">
          {file.status === "archived" ? (
            <p className="text-sm">
              Versão substituída: {file.name} · limpeza pendente
            </p>
          ) : (
            <Asset
              driveFileId={file.id}
              title={file.name}
              type={file.mime_type?.startsWith("image/") ? "image" : undefined}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  "Remover este arquivo do conteúdo e movê-lo para a lixeira do Drive?",
                )
              )
                return;
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
            Remover arquivo
          </Button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

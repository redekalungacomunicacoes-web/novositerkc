import { useState } from "react";
import {
  FileText,
  Link2,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { openTaskAttachment } from "./tasksApi";
import {
  useDeleteTaskAttachmentMutation,
  useTaskCommentMutation,
} from "./useTaskQueries";
import type { CalendarTask, TeamMember } from "./types";

const card =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-emerald-800/60 dark:bg-emerald-950";
export function TaskMaterials({ task }: { task: CalendarTask }) {
  const [search, setSearch] = useState("");
  const remove = useDeleteTaskAttachmentMutation();
  const files = task.attachments.filter((file) =>
    (file.file_name ?? "")
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <section className={card} aria-label="Materiais gerais">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Paperclip size={18} /> Materiais gerais{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-emerald-900 dark:text-emerald-100">
              {task.attachments.length}
            </span>
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/60">
            Referências e arquivos compartilhados com esta tarefa.
          </p>
        </div>
        <label className="relative min-w-0">
          <Search
            size={16}
            className="absolute left-3 top-3.5 text-slate-400"
          />
          <input
            aria-label="Buscar materiais da tarefa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar arquivo…"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-3 text-sm dark:border-emerald-800"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {files.map((file) => (
          <article
            key={file.id}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-emerald-800/50"
          >
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
              {file.file_url.startsWith("http") ? (
                <Link2 size={20} />
              ) : (
                <FileText size={20} />
              )}
            </span>
            <button
              type="button"
              className="min-h-11 min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() =>
                void openTaskAttachment(file).catch((e) =>
                  toast.error(e.message),
                )
              }
            >
              <span
                className="block truncate text-sm font-medium"
                title={file.file_name ?? "Arquivo"}
              >
                {file.file_name ?? "Arquivo"}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(file.created_at).toLocaleDateString("pt-BR")} ·{" "}
                {file.file_url.startsWith("drive:")
                  ? "Drive"
                  : file.file_url.startsWith("http")
                    ? "Link externo"
                    : "Anexo legado"}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Excluir arquivo ${file.file_name ?? "anexo"}`}
              disabled={remove.isPending}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              onClick={() => {
                if (
                  window.confirm(
                    "Excluir este arquivo? Os vínculos com etapas e entrega final também serão removidos.",
                  )
                )
                  void remove
                    .mutateAsync(file)
                    .catch((e) => toast.error(e.message));
              }}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
      {!files.length ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500 dark:bg-emerald-900/30">
          {search
            ? "Nenhum material encontrado."
            : "Ainda não há materiais. Envie referências ou vincule os arquivos da entrega."}
        </p>
      ) : null}
    </section>
  );
}
export function TaskDiscussion({
  task,
  team,
}: {
  task: CalendarTask;
  team: TeamMember[];
}) {
  const [comment, setComment] = useState("");
  const mutation = useTaskCommentMutation();
  return (
    <section className={card} aria-label="Comentários e check-ins">
      <h3 className="flex items-center gap-2 font-semibold">
        <MessageSquare size={18} /> Comentários e check-ins
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/60">
        Registre avanços, decisões e o que precisa de apoio da equipe.
      </p>
      <form
        className="mt-4 rounded-2xl border border-slate-200 p-3 dark:border-emerald-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (!comment.trim() || mutation.isPending) return;
          void mutation
            .mutateAsync({ taskId: task.id, comentario: comment.trim() })
            .then(() => {
              setComment("");
              toast.success("Check-in registrado.");
            })
            .catch((e) => toast.error(e.message));
        }}
      >
        <label className="sr-only" htmlFor={`comment-${task.id}`}>
          Novo comentário
        </label>
        <textarea
          id={`comment-${task.id}`}
          aria-label="Novo comentário"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-28 w-full resize-y rounded-xl bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="O que avançou? Qual é o próximo passo? Existe algum impedimento?"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending || !comment.trim()}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send size={16} />
            {mutation.isPending ? "Registrando…" : "Registrar check-in"}
          </button>
        </div>
      </form>
      <ol className="mt-5 space-y-4">
        {[...task.comments].reverse().map((item) => {
          const author = team.find((member) => member.id === item.author_id);
          return (
            <li key={item.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
              >
                {(author?.name ?? "Equipe").slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="text-sm font-semibold">
                    {author?.name ?? "Integrante da equipe"}
                  </p>
                  <time
                    dateTime={item.created_at}
                    className="text-xs text-slate-500"
                  >
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 dark:bg-emerald-900/30">
                  {item.comentario}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {!task.comments.length ? (
        <p className="mt-4 text-sm text-slate-500">
          Nenhum check-in registrado. Compartilhe o primeiro avanço.
        </p>
      ) : null}
    </section>
  );
}

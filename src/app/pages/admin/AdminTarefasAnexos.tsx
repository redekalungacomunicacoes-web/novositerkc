import { useMemo, useState } from "react";
import { ExternalLink, FileStack, FileText, ImageIcon, Link as LinkIcon, Paperclip, Plus } from "lucide-react";

import { CalendarProvider, useCalendarStore } from "./calendar2026/store";
import { TasksPageShell } from "./calendar2026/TasksShell";
import { useExternalAttachmentMutation, useTaskAttachmentMutation } from "./calendar2026/useTaskQueries";
import type { TaskAttachment } from "./calendar2026/types";

const typeLabels: Record<TaskAttachment["tipo"], string> = { foto: "Imagem", pdf: "PDF", documento: "Documento", link: "Link", arquivo: "Arquivo", video: "Arquivo" };

function AttachmentIcon({ type }: { type: TaskAttachment["tipo"] }) {
  if (type === "foto") return <ImageIcon size={18} />;
  if (type === "link") return <LinkIcon size={18} />;
  if (type === "pdf" || type === "documento") return <FileText size={18} />;
  return <Paperclip size={18} />;
}

function AttachmentsCenter() {
  const { tasks, teamMembers } = useCalendarStore();
  const uploadAttachment = useTaskAttachmentMutation();
  const linkAttachment = useExternalAttachmentMutation();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const attachments = useMemo(() => tasks.flatMap((task) => task.attachments.map((attachment) => ({ attachment, task }))).sort((a, b) => b.attachment.created_at.localeCompare(a.attachment.created_at)), [tasks]);

  function handleFile(fileValue: File | null) {
    setFile(fileValue);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return fileValue ? URL.createObjectURL(fileValue) : null;
    });
  }

  async function saveAttachment(event: React.FormEvent) {
    event.preventDefault();
    if (!taskId) return;
    if (file) await uploadAttachment.mutateAsync({ taskId, file });
    if (link.trim()) await linkAttachment.mutateAsync({ taskId, url: link.trim() });
    setOpen(false);
    setTaskId("");
    setLink("");
    handleFile(null);
  }

  return (
    <TasksPageShell>
      <main className="space-y-4">
        <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300"><FileStack size={22} /><span className="text-sm font-medium uppercase tracking-[0.2em]">Anexos</span></div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Central de anexos</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-emerald-100/70">Visualize arquivos e links vinculados às tarefas, com preview quando o formato permitir.</p>
            </div>
            <button onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950"><Plus size={16} /> Novo Anexo</button>
          </div>
        </section>

        {open ? (
          <form onSubmit={(event) => void saveAttachment(event)} className="grid gap-3 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70 md:grid-cols-2">
            <select required value={taskId} onChange={(event) => setTaskId(event.target.value)} className="h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-white"><option value="">Selecionar tarefa de destino</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
            <input type="file" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} className="h-11 rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-sm dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-white" />
            <input type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="Ou informe um link" className="h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-white md:col-span-2" />
            {preview ? <div className="rounded-2xl border border-emerald-100 p-3 dark:border-emerald-800/60 md:col-span-2">{file?.type.startsWith("image/") ? <img src={preview} alt="Preview" className="max-h-56 rounded-xl object-contain" /> : <p className="text-sm text-slate-600 dark:text-emerald-100/70">Preview selecionado: {file?.name}</p>}</div> : null}
            <div className="flex gap-2 md:col-span-2"><button disabled={uploadAttachment.isPending || linkAttachment.isPending} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Salvar</button><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-emerald-100 px-4 py-2 text-sm dark:border-emerald-800/60">Cancelar</button></div>
          </form>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="grid grid-cols-[1.1fr_.7fr_1fr_.8fr_.7fr] gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-900/50 dark:text-emerald-100 max-lg:hidden"><span>Nome</span><span>Tipo</span><span>Tarefa vinculada</span><span>Responsável</span><span>Data</span></div>
          <div className="divide-y divide-emerald-100 dark:divide-emerald-800/60">
            {attachments.length ? attachments.map(({ attachment, task }) => {
              const assignee = teamMembers.find((member) => member.id === task.assigneeId || member.userId === task.assigneeId);
              return <article key={attachment.id} className="grid gap-3 px-5 py-4 text-sm text-slate-700 dark:text-emerald-50 lg:grid-cols-[1.1fr_.7fr_1fr_.8fr_.7fr]">
                <div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-100"><AttachmentIcon type={attachment.tipo} /></span><span className="truncate font-medium">{attachment.file_name ?? attachment.external_url ?? "Anexo"}</span>{attachment.external_url ? <a href={attachment.external_url} target="_blank" rel="noreferrer" className="text-emerald-700"><ExternalLink size={14} /></a> : null}</div>
                <span>{typeLabels[attachment.tipo]}</span><span>{task.title}</span><span>{assignee?.name ?? "Não definido"}</span><span>{new Date(attachment.created_at).toLocaleDateString("pt-BR")}</span>
              </article>;
            }) : <p className="p-8 text-center text-sm text-slate-500 dark:text-emerald-100/70">Nenhum anexo encontrado no período filtrado.</p>}
          </div>
        </section>
      </main>
    </TasksPageShell>
  );
}

export function AdminTarefasAnexos() {
  return <CalendarProvider><AttachmentsCenter /></CalendarProvider>;
}

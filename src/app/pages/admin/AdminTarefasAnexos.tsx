import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, ExternalLink, File, FileImage, FileStack, FileText, FolderOpen, Link as LinkIcon, Paperclip, Plus, Search, Trash2, Upload } from "lucide-react";

import { CalendarProvider, useCalendarStore } from "./calendar2026/store";
import { TasksPageShell } from "./calendar2026/TasksShell";
import { useExternalAttachmentMutation, useTaskAttachmentMutation, useTasksQuery } from "./calendar2026/useTaskQueries";
import { getTaskAttachmentSignedUrl, priorityLabels, statusLabels } from "./calendar2026/tasksApi";
import { downloadRkcDriveFile } from "@/services/driveFiles";
import type { CalendarTask, TaskAttachment } from "./calendar2026/types";

function getFileKind(attachment: TaskAttachment) {
  if (/^https?:\/\//i.test(attachment.file_url)) return "link";
  const extension = (attachment.file_name ?? attachment.file_url).split(".").pop()?.toLowerCase();
  if (["pdf"].includes(extension ?? "")) return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension ?? "")) return "image";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"].includes(extension ?? "")) return "document";
  return "file";
}

function AttachmentIcon({ attachment }: { attachment: TaskAttachment }) {
  const kind = getFileKind(attachment);
  if (kind === "link") return <LinkIcon size={18} />;
  if (kind === "image") return <FileImage size={18} />;
  if (kind === "pdf" || kind === "document") return <FileText size={18} />;
  return <File size={18} />;
}

function AttachmentOpenButton({ attachment }: { attachment: TaskAttachment }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function openAttachment() {
    setError("");
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setError("Permita pop-ups para abrir este arquivo.");
      return;
    }
    tab.opener = null;
    setLoading(true);
    try {
      if (attachment.source === "drive") {
        const blob = await downloadRkcDriveFile(attachment.id);
        const url = URL.createObjectURL(blob);
        tab.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const url = /^https?:\/\//i.test(attachment.file_url)
          ? attachment.file_url
          : await getTaskAttachmentSignedUrl(attachment.file_url);
        tab.location.href = url;
      }
    } catch (reason) {
      tab.close();
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  return <span className="flex items-center gap-2">
    <button type="button" onClick={() => void openAttachment()} disabled={loading} aria-label={`Abrir ${attachment.file_name ?? "anexo"}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-900/50">
      {getFileKind(attachment) === "link" ? <ExternalLink size={15} /> : <Download size={15} />}{loading ? "Abrindo…" : "Abrir"}
    </button>
    {error ? <span role="alert" className="text-xs text-rose-600">{error}</span> : null}
  </span>;
}

function AttachmentsCenter() {
  const { teamMembers } = useCalendarStore();
  const { data: tasks = [], isLoading, error, refetch } = useTasksQuery("1900-01-01", "9999-12-31", "all");
  const uploadAttachment = useTaskAttachmentMutation();
  const linkAttachment = useExternalAttachmentMutation();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");

  const tasksWithAttachments = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return tasks.filter((task) => task.attachments.length > 0).filter((task) =>
      !term || task.title.toLocaleLowerCase("pt-BR").includes(term)
      || task.description.toLocaleLowerCase("pt-BR").includes(term)
      || task.attachments.some((attachment) => (attachment.file_name ?? "").toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [tasks, search]);
  const attachmentCount = tasksWithAttachments.reduce((count, task) => count + task.attachments.length, 0);

  async function saveAttachment(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError("");
    setSubmitNotice("");
    if (!taskId) return;

    const failedFiles: File[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        await uploadAttachment.mutateAsync({ taskId, file });
      } catch (reason) {
        failedFiles.push(file);
        failures.push(`${file.name}: ${reason instanceof Error ? reason.message : "falha no envio"}`);
      }
    }

    const links = link.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
    const failedLinks: string[] = [];
    for (const url of links) {
      try {
        await linkAttachment.mutateAsync({ taskId, url });
      } catch (reason) {
        failedLinks.push(url);
        failures.push(`Link ${url}: ${reason instanceof Error ? reason.message : "falha ao salvar"}`);
      }
    }

    setFiles(failedFiles);
    setLink(failedLinks.join("\n"));
    await refetch();
    if (failures.length) {
      setSubmitNotice("Os itens enviados com sucesso já estão vinculados à tarefa. Os itens com erro ficaram selecionados para nova tentativa.");
      setSubmitError(failures.join(" · "));
      return;
    }
    setSubmitNotice("Anexos adicionados à tarefa.");
    setTaskId("");
    setLink("");
    setFiles([]);
  }

  function handleFiles(selected: FileList | null) {
    const incoming = Array.from(selected ?? []);
    setFiles((current) => [...current, ...incoming.filter((file) =>
      !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified),
    )]);
  }

  const pending = uploadAttachment.isPending || linkAttachment.isPending;

  return (
    <TasksPageShell>
      <main className="space-y-5">
        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 dark:from-emerald-950 dark:via-emerald-950/70 dark:to-teal-950/60 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300"><FileStack size={22} /><span className="text-sm font-semibold uppercase tracking-[0.18em]">Arquivos das tarefas</span></div>
                <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white md:text-3xl">Central de arquivos</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-emerald-100/70">Encontre anexos agrupados por tarefa, pesquise pelo nome e adicione vários arquivos de uma vez.</p>
              </div>
              <button type="button" onClick={() => { setOpen((value) => !value); setSubmitError(""); setSubmitNotice(""); }} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950"><Plus size={16} /> {open ? "Fechar envio" : "Adicionar arquivos"}</button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/40"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-emerald-100/60">Tarefas com arquivos</p><p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{tasksWithAttachments.length}</p></div>
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/40"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-emerald-100/60">Arquivos e links</p><p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{attachmentCount}</p></div>
            </div>
          </div>
        </section>

        {open ? (
          <form onSubmit={(event) => void saveAttachment(event)} className="grid gap-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70 md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Upload size={18} /> Adicionar à tarefa</h2><p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/70">Selecione o destino e escolha vários arquivos ou links externos.</p></div>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-emerald-100 md:col-span-2">Tarefa de destino
              <select required value={taskId} onChange={(event) => setTaskId(event.target.value)} className="h-11 rounded-xl border border-emerald-100 bg-white px-3 text-sm dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-white"><option value="">Selecionar tarefa</option>{[...tasks].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
            </label>
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30 md:col-span-2">
              <Upload size={22} className="text-emerald-700 dark:text-emerald-300" /><span className="text-sm font-semibold text-slate-800 dark:text-white">Clique para escolher arquivos</span><span className="text-xs text-slate-500 dark:text-emerald-100/60">É possível selecionar vários de uma vez</span>
              <input type="file" multiple onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ""; }} className="sr-only" />
            </label>
            {files.length ? <div className="space-y-2 md:col-span-2"><p className="text-sm font-medium text-slate-700 dark:text-emerald-100">{files.length} arquivo(s) na fila</p>{files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-100 px-3 py-2 dark:border-emerald-800/60"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"><Paperclip size={16} /></span><span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-emerald-50">{file.name}</span><span className="shrink-0 text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => setFiles((current) => current.filter((_item, itemIndex) => itemIndex !== index))} aria-label={`Remover ${file.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></div>)}</div> : null}
            <textarea value={link} onChange={(event) => setLink(event.target.value)} placeholder="Links externos (um por linha ou separados por vírgula)" className="min-h-20 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-white md:col-span-2" />
            {submitNotice ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100 md:col-span-2">{submitNotice}</p> : null}
            {submitError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-200 md:col-span-2">{submitError}</p> : null}
            <div className="flex flex-wrap gap-2 md:col-span-2"><button disabled={pending || (!files.length && !link.trim())} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950">{pending ? "Enviando…" : "Enviar anexos"}</button><button type="button" onClick={() => { setOpen(false); setFiles([]); setLink(""); setSubmitError(""); setSubmitNotice(""); }} className="rounded-xl border border-emerald-100 px-4 py-2 text-sm dark:border-emerald-800/60">Cancelar</button></div>
          </form>
        ) : null}

        <section className="rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 md:p-5">
            <div><h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><FolderOpen size={18} /> Pastas por tarefa</h2><p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/60">{attachmentCount} arquivo(s) distribuídos em {tasksWithAttachments.length} tarefa(s)</p></div>
            <label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa ou arquivo" className="h-10 w-full rounded-xl border border-emerald-100 bg-white pl-9 pr-3 text-sm dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-white" /></label>
          </div>
          {isLoading ? <div className="p-10 text-center text-sm text-slate-500 dark:text-emerald-100/70">Carregando arquivos…</div>
            : error ? <div role="alert" className="p-8 text-center text-sm text-rose-700 dark:text-rose-200">Não foi possível carregar os arquivos: {error.message}</div>
            : tasksWithAttachments.length ? <div className="divide-y divide-emerald-100 dark:divide-emerald-800/60">
              {tasksWithAttachments.map((task: CalendarTask) => {
                const isExpanded = expanded[task.id] ?? false;
                const assignee = teamMembers.find((member) => member.id === task.assigneeId || member.userId === task.assigneeId);
                return <article key={task.id} className="p-4 md:p-5">
                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [task.id]: !isExpanded }))} aria-expanded={isExpanded} className="flex w-full items-center gap-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">{isExpanded ? <FolderOpen size={19} /> : <FolderOpen size={19} />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900 dark:text-white">{task.title}</span><span className="mt-1 block text-xs text-slate-500 dark:text-emerald-100/60">{assignee?.name ?? "Responsável não definido"} · {task.attachments.length} item(ns)</span><span className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">{statusLabels[task.status]}</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">{priorityLabels[task.priority]}</span></span></span>
                    <span className="hidden text-xs text-slate-500 dark:text-emerald-100/60 sm:block">{new Date(`${task.date}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  {isExpanded ? <div className="mt-4 grid gap-2 pl-0 sm:pl-13">{task.attachments.map((attachment) => <div key={attachment.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-emerald-900/30"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-emerald-200"><AttachmentIcon attachment={attachment} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800 dark:text-emerald-50">{attachment.file_name || attachment.file_url.split("/").pop() || "Anexo"}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-emerald-100/60">{getFileKind(attachment).toUpperCase()} · {new Date(attachment.created_at).toLocaleDateString("pt-BR")}</span></span><AttachmentOpenButton attachment={attachment} /></div>)}</div> : null}
                </article>;
              })}
            </div> : <div className="p-10 text-center text-sm text-slate-500 dark:text-emerald-100/70">{search ? "Nenhum arquivo corresponde à busca." : "Nenhuma tarefa possui arquivos."}</div>}
        </section>
      </main>
    </TasksPageShell>
  );
}

export function AdminTarefasAnexos() {
  return <CalendarProvider><AttachmentsCenter /></CalendarProvider>;
}

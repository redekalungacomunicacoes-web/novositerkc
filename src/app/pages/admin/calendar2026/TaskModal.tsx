import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileText, MessageSquare, Paperclip, UserCircle } from "lucide-react";
import { priorityLabels, statusLabels } from "./tasksApi";
import { useDeleteTaskMutation, useExternalAttachmentMutation, useSaveTaskMutation, useTaskAttachmentMutation, useTaskCommentMutation } from "./useTaskQueries";
import { useCalendarStore } from "./store";
import type { CalendarTask, TaskInput, TaskPriority, TaskStatus } from "./types";

function emptyForm(date: string): TaskInput {
  return { titulo: "", descricao: "", assigned_to: null, prioridade: "media", status: "pendente", data_inicio: date, data_fim: date, data_conclusao: null };
}

const inputClass = "rounded-xl border border-emerald-100 bg-white p-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50";

function formatDate(date?: string | null) {
  if (!date) return "Sem data";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("pt-BR");
}

export function TaskModal({ open, onClose, initialTask }: { open: boolean; onClose: () => void; initialTask?: CalendarTask | null }) {
  const { selectedDate, tasks, teamMembers } = useCalendarStore();
  const dayTasks = tasks.filter((t) => t.date <= selectedDate && t.endDate >= selectedDate);
  const [editing, setEditing] = useState<CalendarTask | null>(null);
  const [form, setForm] = useState<TaskInput>(emptyForm(selectedDate));
  const [comment, setComment] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [externalLinks, setExternalLinks] = useState("");
  const saveTask = useSaveTaskMutation();
  const deleteTask = useDeleteTaskMutation();
  const addComment = useTaskCommentMutation();
  const uploadAttachment = useTaskAttachmentMutation();
  const linkAttachment = useExternalAttachmentMutation();
  const isSaving = saveTask.isPending || addComment.isPending || uploadAttachment.isPending || linkAttachment.isPending;
  const selectedTask = useMemo(() => editing, [editing]);

  function editTask(task: CalendarTask) {
    setEditing(task);
    setForm({ titulo: task.title, descricao: task.description, assigned_to: task.assigneeId || null, prioridade: task.priority, status: task.status, data_inicio: task.date, data_fim: task.endDate, data_conclusao: task.completedAt });
  }

  useEffect(() => {
    if (!open) return;
    if (initialTask) {
      editTask(initialTask);
      setComment("");
      setAttachmentFiles([]);
      setExternalLinks("");
      return;
    }
    setEditing(null);
    setForm(emptyForm(selectedDate));
    setComment("");
    setAttachmentFiles([]);
    setExternalLinks("");
  }, [open, selectedDate, initialTask]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const taskId = await saveTask.mutateAsync({ input: form, taskId: editing?.id });
    if (comment.trim()) await addComment.mutateAsync({ taskId, comentario: comment.trim() });
    for (const file of attachmentFiles) await uploadAttachment.mutateAsync({ taskId, file });
    for (const url of externalLinks.split(/\n|,/).map((item) => item.trim()).filter(Boolean)) {
      await linkAttachment.mutateAsync({ taskId, url });
    }
    setEditing(null);
    setForm(emptyForm(selectedDate));
    setComment("");
    setAttachmentFiles([]);
    setExternalLinks("");
    if (initialTask) onClose();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAttachmentFiles(Array.from(event.target.files ?? []));
  }

  const assignee = teamMembers.find((member) => member.id === selectedTask?.assigneeId || member.userId === selectedTask?.assigneeId);
  const creator = teamMembers.find((member) => member.id === selectedTask?.creatorId || member.userId === selectedTask?.creatorId);

  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 text-slate-900 shadow-2xl dark:border-emerald-800/60 dark:bg-emerald-950 dark:text-emerald-50">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 pb-4 dark:border-emerald-800/60">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">{selectedTask ? "Detalhes da tarefa" : "Nova tarefa"}</p>
          <h3 className="mt-1 text-2xl font-semibold">{selectedTask?.title ?? `Tarefas • ${formatDate(selectedDate)}`}</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border border-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-100 dark:hover:bg-emerald-900/50">Fechar</button>
      </div>

      {selectedTask ? (
        <section className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Responsável</p><p className="mt-1 font-medium">{assignee?.name ?? "Não definido"}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Criador</p><p className="mt-1 font-medium">{creator?.name ?? "Não informado"}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Status</p><p className="mt-1 font-medium">{statusLabels[selectedTask.status]}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Prioridade</p><p className="mt-1 font-medium">{priorityLabels[selectedTask.priority]}</p></div>
        </section>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="mb-5 grid gap-2 md:grid-cols-2">
        <input required value={form.titulo} onChange={(e) => setForm((old) => ({ ...old, titulo: e.target.value }))} className={inputClass} placeholder="Título" />
        <input value={form.descricao ?? ""} onChange={(e) => setForm((old) => ({ ...old, descricao: e.target.value }))} className={inputClass} placeholder="Descrição" />
        <input type="date" value={form.data_inicio} onChange={(e) => setForm((old) => ({ ...old, data_inicio: e.target.value }))} className={inputClass} />
        <input type="date" value={form.data_fim} onChange={(e) => setForm((old) => ({ ...old, data_fim: e.target.value }))} className={inputClass} />
        <select value={form.prioridade} onChange={(e) => setForm((old) => ({ ...old, prioridade: e.target.value as TaskPriority }))} className={inputClass}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={form.status} onChange={(e) => setForm((old) => ({ ...old, status: e.target.value as TaskStatus }))} className={inputClass}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={form.assigned_to ?? ""} onChange={(e) => setForm((old) => ({ ...old, assigned_to: e.target.value || null }))} className={`${inputClass} md:col-span-2`}><option value="">Responsável inteligente</option>{teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}</select>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} className={`${inputClass} min-h-20 md:col-span-2`} placeholder="Adicionar comentário" />
        <input type="file" multiple onChange={handleFileChange} className={`${inputClass} md:col-span-2`} />
        <textarea value={externalLinks} onChange={(e) => setExternalLinks(e.target.value)} className={`${inputClass} min-h-16 md:col-span-2`} placeholder="Links externos (um por linha ou separados por vírgula)" />
        {attachmentFiles.length ? <p className="text-xs text-slate-500 dark:text-emerald-100/60 md:col-span-2">{attachmentFiles.length} arquivo(s) selecionado(s): {attachmentFiles.map((file) => file.name).join(", ")}</p> : null}
        {saveTask.error ? <p className="text-sm text-rose-500 md:col-span-2">{saveTask.error.message}</p> : null}
        {uploadAttachment.error ? <p className="text-sm text-rose-500 md:col-span-2">{uploadAttachment.error.message}</p> : null}
        {linkAttachment.error ? <p className="text-sm text-rose-500 md:col-span-2">{linkAttachment.error.message}</p> : null}
        <div className="flex flex-wrap gap-2 md:col-span-2"><button disabled={isSaving} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400">{editing ? "Atualizar tarefa" : "Criar tarefa"}</button>{editing ? <button type="button" onClick={() => { setEditing(null); setForm(emptyForm(selectedDate)); }} className="rounded-xl border border-emerald-100 px-4 py-2 text-sm dark:border-emerald-800/60">Cancelar edição</button> : null}</div>
      </form>

      {selectedTask ? (
        <section className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60 lg:col-span-2"><h4 className="flex items-center gap-2 font-semibold"><FileText size={16} /> Descrição</h4><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-emerald-100/70">{selectedTask.description || "Sem descrição."}</p></div>
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60"><h4 className="flex items-center gap-2 font-semibold"><CalendarDays size={16} /> Histórico</h4><p className="mt-2 text-sm text-slate-600 dark:text-emerald-100/70">Criada em {formatDate(selectedTask.createdAt?.slice(0,10))}</p><p className="text-sm text-slate-600 dark:text-emerald-100/70">Atualizada em {formatDate(selectedTask.updatedAt?.slice(0,10))}</p></div>
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60 lg:col-span-2"><h4 className="flex items-center gap-2 font-semibold"><MessageSquare size={16} /> Comentários</h4><div className="mt-2 space-y-2">{selectedTask.comments.length ? selectedTask.comments.map((item) => <p key={item.id} className="rounded-xl bg-emerald-50 p-2 text-sm dark:bg-emerald-900/40">{item.comentario}</p>) : <p className="text-sm text-slate-500 dark:text-emerald-100/60">Nenhum comentário.</p>}</div></div>
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60"><h4 className="flex items-center gap-2 font-semibold"><Paperclip size={16} /> Anexos</h4><div className="mt-2 space-y-2">{selectedTask.attachments.length ? selectedTask.attachments.map((item) => <p key={item.id} className="rounded-xl bg-emerald-50 p-2 text-sm dark:bg-emerald-900/40">{item.file_name ?? item.external_url ?? "Anexo"}</p>) : <p className="text-sm text-slate-500 dark:text-emerald-100/60">Nenhum anexo.</p>}</div></div>
        </section>
      ) : (
        <div className="space-y-2">{dayTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-200 p-6 text-center text-slate-500 dark:border-emerald-800/60 dark:text-emerald-100/60">Nenhuma tarefa para este dia.</div> : dayTasks.map((t) => <button type="button" key={t.id} onClick={() => editTask(t)} className="w-full rounded-2xl border border-emerald-100 p-3 text-left transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:hover:bg-emerald-900/40"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{t.title}</p><p className="text-xs text-slate-500 dark:text-emerald-100/60">{formatDate(t.date)} · {t.description}</p><p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/60">{statusLabels[t.status]} · {priorityLabels[t.priority]}</p></div><span className="text-xs text-emerald-700 dark:text-emerald-300"><UserCircle size={14} /></span></div></button>)}</div>
      )}
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

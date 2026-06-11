import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { priorityLabels, statusLabels } from "./tasksApi";
import { useDeleteTaskMutation, useSaveTaskMutation, useTaskAttachmentMutation, useTaskCommentMutation } from "./useTaskQueries";
import { useCalendarStore } from "./store";
import type { CalendarTask, TaskInput, TaskPriority, TaskStatus } from "./types";

function emptyForm(date: string): TaskInput {
  return { titulo: "", descricao: "", assigned_to: null, prioridade: "media", status: "pendente", data_inicio: date, data_fim: date, data_conclusao: null };
}

export function TaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedDate, tasks, teamMembers } = useCalendarStore();
  const dayTasks = tasks.filter((t) => t.date <= selectedDate && t.endDate >= selectedDate);
  const [editing, setEditing] = useState<CalendarTask | null>(null);
  const [form, setForm] = useState<TaskInput>(emptyForm(selectedDate));
  const [comment, setComment] = useState("");
  const saveTask = useSaveTaskMutation();
  const deleteTask = useDeleteTaskMutation();
  const addComment = useTaskCommentMutation();
  const uploadAttachment = useTaskAttachmentMutation();
  const isSaving = saveTask.isPending || addComment.isPending || uploadAttachment.isPending;

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setForm(emptyForm(selectedDate));
    setComment("");
  }, [open, selectedDate]);

  const selectedTask = useMemo(() => editing, [editing]);

  function editTask(task: CalendarTask) {
    setEditing(task);
    setForm({ titulo: task.title, descricao: task.description, assigned_to: task.assigneeId || null, prioridade: task.priority, status: task.status, data_inicio: task.date, data_fim: task.endDate, data_conclusao: task.completedAt });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const taskId = await saveTask.mutateAsync({ input: form, taskId: editing?.id });
    if (comment.trim()) await addComment.mutateAsync({ taskId, comentario: comment.trim() });
    setEditing(null);
    setForm(emptyForm(selectedDate));
    setComment("");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const taskId = editing?.id;
    if (!taskId) return;
    for (const file of files) await uploadAttachment.mutateAsync({ taskId, file });
    event.target.value = "";
  }

  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 text-slate-900 shadow-2xl dark:border-emerald-800/60 dark:bg-emerald-950 dark:text-emerald-50">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Tarefas • {selectedDate}</h3><button onClick={onClose}>Fechar</button></div>
      <form onSubmit={(event) => void handleSubmit(event)} className="mb-4 grid gap-2 md:grid-cols-2">
        <input required value={form.titulo} onChange={(e) => setForm((old) => ({ ...old, titulo: e.target.value }))} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50" placeholder="Título" />
        <input value={form.descricao ?? ""} onChange={(e) => setForm((old) => ({ ...old, descricao: e.target.value }))} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50" placeholder="Descrição" />
        <input type="date" value={form.data_inicio} onChange={(e) => setForm((old) => ({ ...old, data_inicio: e.target.value }))} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50" />
        <input type="date" value={form.data_fim} onChange={(e) => setForm((old) => ({ ...old, data_fim: e.target.value }))} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50" />
        <select value={form.prioridade} onChange={(e) => setForm((old) => ({ ...old, prioridade: e.target.value as TaskPriority }))} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50">{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={form.status} onChange={(e) => setForm((old) => ({ ...old, status: e.target.value as TaskStatus }))} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={form.assigned_to ?? ""} onChange={(e) => setForm((old) => ({ ...old, assigned_to: e.target.value || null }))} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50 md:col-span-2"><option value="">Responsável inteligente</option>{teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}</select>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-20 rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50 md:col-span-2" placeholder="Comentário" />
        {editing ? <input type="file" multiple onChange={(event) => void handleFileChange(event)} className="rounded-xl border border-emerald-100 bg-white p-2 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/70 dark:text-emerald-50 md:col-span-2" /> : null}
        {saveTask.error ? <p className="text-sm text-rose-300 md:col-span-2">{saveTask.error.message}</p> : null}
        <div className="flex gap-2 md:col-span-2"><button disabled={isSaving} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400">{editing ? "Atualizar tarefa" : "Criar tarefa"}</button>{editing ? <button type="button" onClick={() => { setEditing(null); setForm(emptyForm(selectedDate)); }} className="rounded-xl border border-emerald-100 px-4 py-2 dark:border-emerald-800/60 text-sm">Cancelar edição</button> : null}</div>
      </form>
      <div className="space-y-2">{dayTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800/60 p-6 text-center text-slate-500 dark:text-emerald-100/60">Nenhuma tarefa para este dia.</div> : dayTasks.map((t) => <div key={t.id} className="rounded-2xl border border-emerald-100 p-3 dark:border-emerald-800/60"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{t.title}</p><p className="text-xs text-slate-500 dark:text-emerald-100/60">{t.date} - {t.endDate} · {t.description}</p><p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/60">{statusLabels[t.status]} · {priorityLabels[t.priority]}</p></div><div className="flex gap-2 text-xs"><button onClick={() => editTask(t)} className="text-emerald-700 dark:text-emerald-300">Editar</button><button onClick={() => void deleteTask.mutateAsync(t.id)} className="text-rose-300">Excluir</button></div></div>{t.comments.length > 0 ? <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-emerald-100/80">{t.comments.map((item) => <p key={item.id} className="rounded-xl bg-emerald-50 dark:bg-emerald-900/50 p-2">{item.comentario}</p>)}</div> : null}{t.attachments.length > 0 ? <div className="mt-2 text-xs text-slate-500 dark:text-emerald-100/60">{t.attachments.map((item) => <p key={item.id}>{item.file_name ?? item.external_url}</p>)}</div> : null}</div>)}</div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

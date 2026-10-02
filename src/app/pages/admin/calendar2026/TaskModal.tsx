import { progressLabel } from "./taskWorkflow";
import { allowedTaskStatuses } from "./taskPermissions";
import { useCurrentMemberQuery, usePermissionQuery } from "./useTaskQueries";
import { TaskWorkflowPanel } from "./TaskWorkflowPanel";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ensureTaskDriveFolder } from "@/services/driveFiles";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, FileText, Link2, MessageSquare, MoreVertical, Paperclip, Pencil, Trash2, UserCircle, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { openTaskAttachment, priorityLabels, statusLabels } from "./tasksApi";
import { useDeleteTaskAttachmentMutation, useExternalAttachmentMutation, useSaveTaskMutation, useTaskAttachmentMutation, useTaskCommentMutation, useTaskDetailsQuery } from "./useTaskQueries";
import { TaskDeleteDialog } from "./TaskDeleteDialog";
import { useCalendarStore } from "./store";
import type { CalendarTask, TaskInput, TaskPriority, TaskStatus } from "./types";

function emptyForm(date: string): TaskInput {
  return { titulo: "", descricao: "", assigned_to: null, direcionamento: [], prioridade: "media", status: "pendente", data_inicio: date, data_fim: date, data_conclusao: null };
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
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<TaskInput>(emptyForm(selectedDate));
  const [comment, setComment] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [externalLinks, setExternalLinks] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [savedTaskId, setSavedTaskId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const currentMember = useCurrentMemberQuery();
  const permission = usePermissionQuery();
  const saveTask = useSaveTaskMutation();
  const addComment = useTaskCommentMutation();
  const uploadAttachment = useTaskAttachmentMutation();
  const linkAttachment = useExternalAttachmentMutation();
  const removeAttachment = useDeleteTaskAttachmentMutation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStage, setSaveStage] = useState("");
  const submitting = useRef(false);
  const details = useTaskDetailsQuery(editing?.id);
  const selectedTask = useMemo(() => editing ? {
    ...(tasks.find((task) => task.id === editing.id) ?? editing),
    attachments: details.data?.attachments ?? editing.attachments,
    comments: details.data?.comments ?? editing.comments,
  } : null, [editing, details.data, tasks]);

  function editTask(task: CalendarTask) {
    setEditing(task);
    setIsEditing(true);
    setForm({ titulo: task.title, descricao: task.description, assigned_to: task.assigneeId || null, direcionamento: task.direcionamento, prioridade: task.priority, status: task.status, data_inicio: task.date, data_fim: task.endDate, data_conclusao: task.completedAt });
  }

  useEffect(() => {
    if (!open) return;
    if (initialTask) {
      setEditing(initialTask);
      setIsEditing(false);
      setForm({ titulo: initialTask.title, descricao: initialTask.description, assigned_to: initialTask.assigneeId || null, direcionamento: initialTask.direcionamento, prioridade: initialTask.priority, status: initialTask.status, data_inicio: initialTask.date, data_fim: initialTask.endDate, data_conclusao: initialTask.completedAt });
      setComment("");
      setAttachmentFiles([]);
      setExternalLinks("");
      setSubmitError(null);
      setSubmitNotice(null);
      setSavedTaskId(null);
      return;
    }
    setEditing(null);
    setIsEditing(false);
    setForm(emptyForm(selectedDate));
    setComment("");
    setAttachmentFiles([]);
    setExternalLinks("");
    setSubmitError(null);
    setSubmitNotice(null);
    setSavedTaskId(null);
  }, [open, selectedDate, initialTask]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setIsSaving(true);
    try {
    setSubmitError(null);
    setSubmitNotice(null);

    if (!form.titulo.trim()) {
      setSubmitError("Informe o título da tarefa.");
      return;
    }
    if (!form.data_inicio || !form.data_fim) {
      setSubmitError("Informe as datas inicial e final da tarefa.");
      return;
    }
    if (form.data_fim < form.data_inicio) {
      setSubmitError("A data final não pode ser anterior à data inicial.");
      return;
    }
    if (!form.assigned_to) {
      setSubmitError("Selecione o responsável pela tarefa.");
      return;
    }
     let taskId = savedTaskId;
    {
      try {
        setSaveStage("Salvando tarefa...");
        taskId = await saveTask.mutateAsync({ input: form, taskId: savedTaskId ?? editing?.id });
        setSavedTaskId(taskId);
      } catch (error) {
        console.error("[TASK CREATE] erro ao salvar tarefa:", error);
        const message = error instanceof Error ? error.message : "Erro inesperado ao salvar a tarefa.";
        setSubmitError(message.includes("usuário não possui um cadastro correspondente")
          ? "Seu usuário não possui um cadastro correspondente na equipe."
          : `Não foi possível salvar a tarefa: ${message}`);
        return;
      }
    }
    if (!taskId) return;

    const failures: string[] = [];
    setSaveStage("Preparando pasta...");
    try {
      await ensureTaskDriveFolder(taskId);
    } catch (error) {
      setSubmitNotice("A tarefa foi salva. Tente novamente para preparar a pasta e enviar os arquivos.");
      setSubmitError(error instanceof Error ? error.message : "Não foi possível preparar a pasta.");
      return;
    }
    setSaveStage("Enviando arquivos e comentários...");
    if (comment.trim()) {
      try {
        await addComment.mutateAsync({ taskId, comentario: comment.trim() });
        setComment("");
      } catch (error) {
        failures.push(`Comentário: ${error instanceof Error ? error.message : "falha ao salvar"}`);
      }
    }

    // Limit simultaneous uploads to avoid exhausting memory on mobile.
    const uploadResults: PromiseSettledResult<unknown>[] = [];
    for (let offset = 0; offset < attachmentFiles.length; offset += 2) {
      uploadResults.push(...await Promise.allSettled(attachmentFiles.slice(offset, offset + 2)
        .map((file) => uploadAttachment.mutateAsync({ taskId, file }))));
    }
    const failedFiles: File[] = [];
    uploadResults.forEach((result, index) => {
      if (result.status === "rejected") {
        failedFiles.push(attachmentFiles[index]);
        const reason = result.reason instanceof Error ? result.reason.message : "falha no envio";
        failures.push(`${attachmentFiles[index].name}: ${reason}`);
      }
    });
    setAttachmentFiles(failedFiles);

    const links = externalLinks.split(/\n/).map((item) => item.trim()).filter(Boolean);
    const failedLinks: string[] = [];
    for (const url of links) {
      try {
        await linkAttachment.mutateAsync({ taskId, url });
      } catch (error) {
        failedLinks.push(url);
        failures.push(`Link ${url}: ${error instanceof Error ? error.message : "falha ao salvar"}`);
      }
    }
    setExternalLinks(failedLinks.join("\n"));

    if (failures.length) {
      setSubmitNotice(`Tarefa salva com sucesso (código ${taskId.slice(0, 8)}). Reenvie os itens pendentes abaixo; a tarefa não será criada novamente.`);
      setSubmitError(`Não foi possível concluir: ${failures.join(" · ")}`);
      return;
    }

    setIsEditing(false);
    setSavedTaskId(null);
    setForm(emptyForm(selectedDate));
    setComment("");
    setAttachmentFiles([]);
    setExternalLinks("");
    toast.success(editing ? "Tarefa atualizada com sucesso." : "Tarefa criada com sucesso.");
    setSubmitNotice(editing ? "Tarefa atualizada com sucesso." : "Tarefa criada com sucesso.");
    if (!initialTask && !editing) onClose();
    } finally {
      submitting.current = false;
      setIsSaving(false);
      setSaveStage("");
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setAttachmentFiles((current) => [...current, ...selected.filter((file) =>
      !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified),
    )]);
    event.currentTarget.value = "";
  }

  const canEdit = Boolean(selectedTask && currentMember.data?.id && (permission.data === "admin" || [selectedTask.creatorId,selectedTask.assigneeId].includes(currentMember.data.id)));
  const canDelete = Boolean(selectedTask && currentMember.data?.id && (permission.data === "admin" || selectedTask.creatorId === currentMember.data.id));
  const assignee = teamMembers.find((member) => member.id === selectedTask?.assigneeId || member.userId === selectedTask?.assigneeId);
  const creator = teamMembers.find((member) => member.id === selectedTask?.creatorId || member.userId === selectedTask?.creatorId);

  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !isSaving) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <Dialog.Content onEscapeKeyDown={(event) => { if (isSaving) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()} className="fixed left-1/2 top-1/2 z-50 max-h-[94dvh] w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-emerald-100 bg-white p-3 text-slate-900 shadow-2xl sm:rounded-3xl sm:p-5 dark:border-emerald-800/60 dark:bg-emerald-950 dark:text-emerald-50">
    <Dialog.Description className="sr-only">Crie e acompanhe tarefas, comentários e arquivos da equipe.</Dialog.Description>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 pb-4 dark:border-emerald-800/60">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">{selectedTask ? "Detalhes da tarefa" : "Nova tarefa"}</p>
          <Dialog.Title className="mt-1 break-words text-xl font-semibold sm:text-2xl">{selectedTask?.title ?? `Tarefas • ${formatDate(selectedDate)}`}</Dialog.Title>
        </div>
        <div className="flex items-center gap-2">
          {selectedTask ? <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" aria-label="Ações da tarefa" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-emerald-100 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-100"><MoreVertical size={20} /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-emerald-950">
              {canEdit && selectedTask.status !== "concluida" ? <DropdownMenuItem onSelect={() => editTask(selectedTask)}><Pencil /> Editar</DropdownMenuItem> : null}
              {canDelete ? <DropdownMenuItem variant="destructive" onSelect={() => setDeleteDialogOpen(true)}><Trash2 /> Excluir</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu> : null}
          <button type="button" disabled={isSaving} onClick={onClose} className="min-h-11 rounded-xl border border-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-100 dark:hover:bg-emerald-900/50">Fechar</button>
        </div>
      </div>

      {selectedTask ? (
        <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Responsável</p><p className="mt-1 font-medium">{assignee?.name ?? "Não definido"}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Criador</p><p className="mt-1 font-medium">{creator?.name ?? "Não informado"}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Status</p><p className="mt-1 font-medium">{statusLabels[selectedTask.status]}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">Prioridade</p><p className="mt-1 font-medium">{priorityLabels[selectedTask.priority]}</p></div>
        </section>
      ) : null}

      {selectedTask && !isEditing ? <TaskWorkflowPanel key={selectedTask.id} task={selectedTask} attachments={selectedTask.attachments} team={teamMembers} /> : null}

      {(!selectedTask || isEditing) ? <form onSubmit={(event) => void handleSubmit(event)} className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/60 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/30">
        <div className="border-b border-slate-200 bg-white px-5 py-4 dark:border-emerald-800/60 dark:bg-emerald-950">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"><CheckCircle2 size={20}/></div><div><h4 className="font-semibold">{isEditing ? "Editar tarefa" : "Criar nova tarefa"}</h4><p className="text-xs text-slate-500 dark:text-emerald-100/60">O criador é identificado automaticamente pela conta conectada.</p></div></div>
        </div>
        <fieldset disabled={isSaving} className="grid min-w-0 gap-5 p-3 sm:p-5">
          <section className="grid gap-4">
            <div><label className="mb-1.5 block text-sm font-semibold">Título da tarefa <span className="text-rose-500">*</span></label><input required autoFocus value={form.titulo} onChange={(e) => setForm((old) => ({ ...old, titulo: e.target.value }))} className={inputClass+" w-full min-h-11"} placeholder="Ex.: Finalizar matéria sobre o encontro comunitário" /></div>
            <div><label className="mb-1.5 block text-sm font-semibold">Descrição e orientações</label><textarea value={form.descricao ?? ""} onChange={(e) => setForm((old) => ({ ...old, descricao: e.target.value }))} className={inputClass+" min-h-28 w-full resize-y"} placeholder="Descreva o objetivo, entregáveis e informações importantes para executar a tarefa." /></div>
          </section>
          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-emerald-800/60 dark:bg-emerald-950">
            <div className="flex items-center gap-2"><UserRound size={18} className="text-emerald-700"/><div><h5 className="text-sm font-semibold">Responsável</h5><p className="text-xs text-slate-500 dark:text-emerald-100/60">Escolha somente para quem esta tarefa será direcionada.</p></div></div>
            <label className="grid gap-1.5 text-sm font-medium">Direcionar para <span className="sr-only">obrigatório</span><select required value={form.assigned_to ?? ""} onChange={(e) => { const id=e.target.value || null; setForm((old) => ({ ...old, assigned_to:id, direcionamento:id ? [id] : [] })); }} className={inputClass+" min-h-11 w-full"}><option value="">Selecione um integrante da equipe</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">Data inicial<input required aria-label="Data inicial" type="date" value={form.data_inicio} onChange={(e) => setForm((old) => ({ ...old, data_inicio:e.target.value, data_fim: old.data_fim < e.target.value ? e.target.value : old.data_fim }))} className={inputClass+" min-h-11"} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Prazo final<input required aria-label="Data final" type="date" min={form.data_inicio} value={form.data_fim} onChange={(e) => setForm((old) => ({ ...old, data_fim:e.target.value }))} className={inputClass+" min-h-11"} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Prioridade<select value={form.prioridade} onChange={(e) => setForm((old) => ({ ...old, prioridade:e.target.value as TaskPriority }))} className={inputClass+" min-h-11"}>{Object.entries(priorityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-medium">Status<select value={form.status} onChange={(e) => setForm((old) => ({ ...old, status:e.target.value as TaskStatus }))} className={inputClass+" min-h-11"}>{Object.entries(statusLabels).filter(([value]) => !selectedTask ? value === "pendente" : value === selectedTask.status || allowedTaskStatuses(selectedTask,currentMember.data?.id,permission.data === "admin").includes(value as TaskStatus)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          </section>
          <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-emerald-800/60 dark:bg-emerald-950"><summary className="min-h-11 cursor-pointer">Arquivos iniciais (opcional)</summary><section className="grid gap-4">
            <div><h5 className="flex items-center gap-2 text-sm font-semibold"><Paperclip size={17} className="text-emerald-700"/> Arquivos</h5><p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/60">Os arquivos serão enviados ao Drive RKC e vinculados automaticamente à pasta desta tarefa após a criação.</p></div>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-center transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"><Paperclip size={20}/><span className="mt-2 text-sm font-medium">Selecionar arquivos</span><span className="text-xs text-slate-500">Você pode selecionar vários arquivos</span><input type="file" multiple onChange={handleFileChange} className="sr-only"/></label>
            {attachmentFiles.length ? <div className="grid gap-2">{attachmentFiles.map((file,index)=><div key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-emerald-800/60"><Paperclip size={15} className="shrink-0 text-emerald-700"/><span className="min-w-0 flex-1 truncate text-sm">{file.name}</span><span className="text-xs text-slate-400">{(file.size/1024/1024).toFixed(1)} MB</span><button type="button" aria-label={`Remover ${file.name}`} onClick={()=>setAttachmentFiles((current)=>current.filter((_item,itemIndex)=>itemIndex!==index))} className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 size={15}/></button></div>)}</div>:null}
          </section>
          </details><details><summary className="min-h-11 cursor-pointer">Comentário e links iniciais (opcional)</summary><section className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><label className="mb-1.5 flex items-center gap-2 text-sm font-medium"><MessageSquare size={16}/> Comentário inicial</label><textarea value={comment} onChange={(e)=>setComment(e.target.value)} className={inputClass+" min-h-20 w-full"} placeholder="Observação opcional para iniciar o histórico da tarefa."/></div>
            <div className="md:col-span-2"><label className="mb-1.5 flex items-center gap-2 text-sm font-medium"><Link2 size={16}/> Links de apoio</label><textarea value={externalLinks} onChange={(e)=>setExternalLinks(e.target.value)} className={inputClass+" min-h-16 w-full"} placeholder="Cole links externos, um por linha."/></div>
          </section>
          </details>
          {submitNotice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">{submitNotice}</p>:null}
          {submitError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{submitError}</p>:null}
        </fieldset>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-emerald-800/60 dark:bg-emerald-950/95"><p className="text-xs text-slate-500">{attachmentFiles.length ? `${attachmentFiles.length} arquivo(s) preparado(s)` : "Arquivos são opcionais"}</p><div className="flex gap-2"><button type="button" disabled={isSaving} onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium dark:border-emerald-800">Cancelar</button><button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60">{isSaving ? saveStage || "Salvando..." : savedTaskId ? "Concluir envio" : editing ? "Salvar alterações" : "Criar tarefa"}</button></div></div>
      </form> : null}

      {selectedTask ? (
        <section className="grid gap-3 lg:grid-cols-3">
          {details.isLoading ? <div className="lg:col-span-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">Carregando comentários e anexos…</div> : null}
          {details.error ? <div role="alert" className="lg:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>Não foi possível carregar os detalhes: {details.error instanceof Error ? details.error.message : "erro inesperado"}</span><button type="button" onClick={() => void details.refetch()} className="min-h-10 rounded-xl border border-rose-300 px-3 font-semibold hover:bg-rose-100">Tentar novamente</button></div> : null}
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60 lg:col-span-2"><h4 className="flex items-center gap-2 font-semibold"><FileText size={16} /> Descrição</h4><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-emerald-100/70">{selectedTask.description || "Sem descrição."}</p></div>
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60"><h4 className="flex items-center gap-2 font-semibold"><CalendarDays size={16} /> Histórico</h4><p className="mt-2 text-sm text-slate-600 dark:text-emerald-100/70">Criada em {formatDate(selectedTask.createdAt?.slice(0,10))}</p><p className="text-sm text-slate-600 dark:text-emerald-100/70">Atualizada em {formatDate(selectedTask.updatedAt?.slice(0,10))}</p></div>
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60 lg:col-span-2"><h4 className="flex items-center gap-2 font-semibold"><MessageSquare size={16} /> Comentários</h4><div className="mt-2 space-y-2">{selectedTask.comments.length ? selectedTask.comments.map((item) => <p key={item.id} className="rounded-xl bg-emerald-50 p-2 text-sm dark:bg-emerald-900/40">{item.comentario}</p>) : <p className="text-sm text-slate-500 dark:text-emerald-100/60">Nenhum comentário.</p>}</div><form className="mt-3 grid gap-2" onSubmit={event=>{event.preventDefault();if(!comment.trim())return;void addComment.mutateAsync({taskId:selectedTask.id,comentario:comment.trim()}).then(()=>setComment("")).catch(error=>toast.error(error.message));}}><label className="text-sm">Novo comentário<textarea aria-label="Novo comentário" className={inputClass+" mt-1 w-full"} value={comment} onChange={event=>setComment(event.target.value)}/></label><button type="submit" disabled={addComment.isPending || !comment.trim()} className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm text-white disabled:opacity-50">{addComment.isPending ? "Enviando…" : "Enviar comentário"}</button></form></div>
          <div className="rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800/60"><h4 className="flex items-center gap-2 font-semibold"><Paperclip size={16} /> Materiais gerais</h4><div className="mt-2 space-y-2">{selectedTask.attachments.length ? selectedTask.attachments.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 p-2 text-sm dark:bg-emerald-900/40"><button type="button" onClick={() => void openTaskAttachment(item).catch((error) => toast.error(error.message))} className="min-w-0 flex-1 truncate text-left text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-100">{item.file_name ?? "Anexo"}</button><button type="button" disabled={removeAttachment.isPending} aria-label={`Remover ${item.file_name ?? "anexo"}`} onClick={() => void removeAttachment.mutateAsync(item).catch((error) => toast.error(error.message))} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-100 disabled:opacity-50"><Trash2 size={16} /></button></div>) : <p className="text-sm text-slate-500 dark:text-emerald-100/60">Nenhum anexo.</p>}</div></div>
        </section>
      ) : (
        <div className="space-y-2">{dayTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-200 p-6 text-center text-slate-500 dark:border-emerald-800/60 dark:text-emerald-100/60">Nenhuma tarefa para este dia.</div> : dayTasks.map((t) => <button type="button" key={t.id} onClick={() => editTask(t)} className="w-full rounded-2xl border border-emerald-100 p-3 text-left transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:hover:bg-emerald-900/40"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{t.title}</p><p className="text-xs text-slate-500 dark:text-emerald-100/60">{formatDate(t.date)} · {t.description}</p><p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/60">{statusLabels[t.status]} · {priorityLabels[t.priority]} · {progressLabel(t.checklistTotal,t.checklistCompleted)}</p></div><span className="text-xs text-emerald-700 dark:text-emerald-300"><UserCircle size={14} /></span></div></button>)}</div>
      )}
      {details.isLoading ? <p role="status" className="py-3 text-sm">Carregando comentários e arquivos...</p> : null}
      {details.error ? <p role="alert" className="py-3 text-sm text-rose-700">{details.error.message} <button type="button" onClick={() => void details.refetch()} className="underline">Tentar novamente</button></p> : null}
    </Dialog.Content>
      {selectedTask ? <TaskDeleteDialog taskId={selectedTask.id} open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onDeleted={onClose} /> : null}
  </Dialog.Portal></Dialog.Root>;
}

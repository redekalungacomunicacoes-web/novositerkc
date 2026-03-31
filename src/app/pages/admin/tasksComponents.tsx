import { Paperclip, Plus, X } from "lucide-react";
import type { FormEvent } from "react";

import { cn } from "@/app/components/ui/utils";
import { priorityBadgeClass, statusBadgeClass, taskBrandTheme } from "./tasksTheme";
import type { Task, TaskFormValues, TeamProfile } from "./tasksTypes";

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus-visible:border-[--brand-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--brand-primary]/30";

export function TasksCalendarGrid({
  calendarDays,
  month,
  selectedDateKey,
  taskCountByDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  isLoading,
}: {
  calendarDays: Date[];
  month: Date;
  selectedDateKey: string;
  taskCountByDate: Map<string, number>;
  onSelectDate: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isLoading: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm" style={{ ["--brand-primary" as string]: taskBrandTheme.brandPrimary }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onPrevMonth} className="rounded-lg border border-slate-300 p-2 text-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--brand-primary]/40">
          ◀
        </button>
        <p className="text-lg font-semibold capitalize text-slate-900">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        <button type="button" onClick={onNextMonth} className="rounded-lg border border-slate-300 p-2 text-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--brand-primary]/40">
          ▶
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {calendarDays.map((day) => {
          const key = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, "0")}-${`${day.getDate()}`.padStart(2, "0")}`;
          const count = taskCountByDate.get(key) ?? 0;
          const isSelected = key === selectedDateKey;
          const hasTasks = count > 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              aria-label={`Dia ${day.getDate()} com ${count} tarefa${count === 1 ? "" : "s"}`}
              className={cn(
                "group min-h-[90px] rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--brand-primary]/40",
                hasTasks && "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
                !hasTasks && "border-slate-200 bg-white hover:bg-slate-50",
                isSelected && "border-emerald-600 bg-emerald-100 shadow-sm ring-1 ring-emerald-500/20",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{day.getDate()}</span>
                {hasTasks ? (
                  <span className={cn("inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white", isSelected ? "bg-emerald-700" : "bg-emerald-600")}>
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </div>
              <span className="mt-3 block text-[11px] text-slate-500">{hasTasks ? "Com tarefas" : "Sem tarefas"}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? <p className="mt-3 text-sm text-slate-500">Carregando tarefas do mês...</p> : null}
    </section>
  );
}

export function TasksDrawer({
  isOpen,
  selectedDate,
  tasksOfDay,
  canManage,
  teamLoading,
  teamError,
  isSaving,
  saveSuccess,
  form,
  profiles,
  files,
  saveError,
  tasksDayLoading,
  onClose,
  onSubmit,
  onFormChange,
  onFilesChange,
}: {
  isOpen: boolean;
  selectedDate: Date;
  tasksOfDay: Task[];
  canManage: boolean;
  teamLoading: boolean;
  teamError: string | null;
  isSaving: boolean;
  saveSuccess: string | null;
  form: TaskFormValues;
  profiles: TeamProfile[];
  files: File[];
  saveError: string | null;
  tasksDayLoading: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onFormChange: (values: Partial<TaskFormValues>) => void;
  onFilesChange: (newFiles: File[]) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 p-5">
        <header className="mb-5 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-100 via-emerald-50 to-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-emerald-900">Tarefas do dia</h2>
              <p className="text-sm font-medium text-emerald-800">{selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-emerald-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40" aria-label="Fechar painel">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Lista de tarefas</h3>
          {tasksDayLoading ? <p className="text-sm text-slate-500">Carregando tarefas da data selecionada...</p> : null}
          {!tasksDayLoading && tasksOfDay.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">Nenhuma tarefa cadastrada para esta data.</p> : null}
          <div className="space-y-3">
            {tasksOfDay.map((task) => (
              <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{task.titulo}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", priorityBadgeClass[task.prioridade])}>{task.prioridade}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", statusBadgeClass[task.status])}>{task.status.replace("_", " ")}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">{task.hora_inicio ?? "--:--"} - {task.hora_fim ?? "--:--"} • {task.assigned_profile?.nome || task.assigned_profile?.email || "Sem responsável"}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-700">{task.descricao || "Sem descrição"}</p>
                {(task.task_attachments ?? []).length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {(task.task_attachments ?? []).map((attachment) => (
                      <li key={attachment.id} className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {attachment.external_url ? <a className="text-emerald-700 underline" href={attachment.external_url} target="_blank" rel="noreferrer">Link externo</a> : <span>{attachment.file_name || "Anexo"}</span>}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {canManage ? (
          <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-semibold text-emerald-900"><Plus className="h-4 w-4" /> Nova tarefa</h3>

            {saveError ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">Erro ao salvar: {saveError}</p> : null}
            {saveSuccess ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{saveSuccess}</p> : null}
            {teamError ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">{teamError}</p> : null}

            <div>
              <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-slate-700">Título *</label>
              <input id="task-title" className={fieldClass} placeholder="Título da tarefa" value={form.titulo} onChange={(event) => onFormChange({ titulo: event.target.value })} required />
            </div>

            <div>
              <label htmlFor="task-description" className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
              <textarea id="task-description" className={fieldClass} placeholder="Descreva a tarefa" value={form.descricao} onChange={(event) => onFormChange({ descricao: event.target.value })} rows={3} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="task-date" className="mb-1 block text-sm font-medium text-slate-700">Data *</label>
                <input id="task-date" type="date" className={fieldClass} value={form.data_tarefa} onChange={(event) => onFormChange({ data_tarefa: event.target.value })} required />
              </div>
              <div>
                <label htmlFor="task-assigned" className="mb-1 block text-sm font-medium text-slate-700">Responsável *</label>
                <select id="task-assigned" className={fieldClass} value={form.assigned_to} onChange={(event) => onFormChange({ assigned_to: event.target.value })} disabled={teamLoading} required>
                  <option value="">{teamLoading ? "Carregando equipe..." : "Selecione"}</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.nome || profile.email || profile.id}</option>
                  ))}
                </select>
                {!teamLoading && profiles.length === 0 ? <p className="mt-1 text-xs text-amber-700">Nenhum integrante ativo cadastrado.</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="task-start" className="mb-1 block text-sm font-medium text-slate-700">Hora inicial</label>
                <input id="task-start" type="time" className={fieldClass} value={form.hora_inicio} onChange={(event) => onFormChange({ hora_inicio: event.target.value })} />
              </div>
              <div>
                <label htmlFor="task-end" className="mb-1 block text-sm font-medium text-slate-700">Hora final</label>
                <input id="task-end" type="time" className={fieldClass} value={form.hora_fim} onChange={(event) => onFormChange({ hora_fim: event.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="task-priority" className="mb-1 block text-sm font-medium text-slate-700">Prioridade</label>
                <select id="task-priority" className={fieldClass} value={form.prioridade} onChange={(event) => onFormChange({ prioridade: event.target.value as TaskFormValues["prioridade"] })}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label htmlFor="task-status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select id="task-status" className={fieldClass} value={form.status} onChange={(event) => onFormChange({ status: event.target.value as TaskFormValues["status"] })}>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="task-link" className="mb-1 block text-sm font-medium text-slate-700">Link externo</label>
              <input id="task-link" className={fieldClass} placeholder="https://..." value={form.external_link} onChange={(event) => onFormChange({ external_link: event.target.value })} />
            </div>

            <div>
              <label htmlFor="task-link-attachment" className="mb-1 block text-sm font-medium text-slate-700">Link de anexo (opcional)</label>
              <input id="task-link-attachment" className={fieldClass} placeholder="https://..." value={form.external_attachment_link} onChange={(event) => onFormChange({ external_attachment_link: event.target.value })} />
            </div>

            <div>
              <label htmlFor="task-files" className="mb-1 block text-sm font-medium text-slate-700">Arquivos</label>
              <input id="task-files" type="file" multiple className="block w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-emerald-700" onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))} />
              {files.length > 0 ? <p className="mt-1 text-xs text-slate-600">{files.length} arquivo(s) selecionado(s).</p> : null}
            </div>

            <button disabled={isSaving} type="submit" className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-70">
              {isSaving ? "Salvando..." : "Salvar tarefa"}
            </button>
          </form>
        ) : (
          <p className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-800">Você tem acesso apenas para visualização das tarefas e notificações destinadas a você.</p>
        )}
      </div>
    </div>
  );
}

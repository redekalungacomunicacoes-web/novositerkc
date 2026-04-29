import { Loader2, Paperclip, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { cn } from "@/app/components/ui/utils";
import { priorityBadgeClass, statusBadgeClass, taskBrandTheme } from "./tasksTheme";
import type { Task, TaskFormValues, TeamProfile } from "./tasksTypes";

const priorityLabel: Record<Task["prioridade"], string> = { urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa" };

export const PriorityBadge = ({ prioridade }: { prioridade: Task["prioridade"] }) => (
  <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", priorityBadgeClass[prioridade])}>{priorityLabel[prioridade]}</span>
);

function TaskFormContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[980px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">{children}</div>;
}

function TabsNavigation({ tab, onChange }: { tab: "detalhes" | "arquivos" | "direcionamento"; onChange: (tab: "detalhes" | "arquivos" | "direcionamento") => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {(["detalhes", "arquivos", "direcionamento"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium capitalize transition-all duration-200",
            tab === item ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function InputField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function TextAreaField({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <InputField label={label}>
      <textarea
        {...props}
        className={cn(
          "min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
          props.className,
        )}
      />
    </InputField>
  );
}

function DatePicker(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} className={cn("h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-200", props.className)} />;
}

function UserSelector({ users, value, onChange }: { users: TeamProfile[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="space-y-2">
      {users.map((u) => {
        const checked = value.includes(u.id);
        return (
          <label key={u.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition", checked ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50")}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked ? [...new Set([...value, u.id])] : value.filter((id) => id !== u.id))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Avatar className="h-8 w-8">
              <AvatarImage alt={u.nome ?? u.email ?? "Usuário"} />
              <AvatarFallback>{(u.nome ?? u.email ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-slate-800">{u.nome || u.email || "Usuário"}</span>
          </label>
        );
      })}
    </div>
  );
}

function FileUploadArea({ files, onFilesChange }: { files: File[]; onFilesChange: (f: File[]) => void }) {
  return (
    <div className="space-y-3">
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-slate-400 hover:bg-slate-100">
        <UploadCloud className="mb-2 h-7 w-7 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Arraste arquivos ou clique para enviar</span>
        <span className="text-xs text-slate-500">Múltiplos anexos permitidos</span>
        <input type="file" multiple className="hidden" onChange={(e) => onFilesChange(Array.from(e.target.files ?? []))} />
      </label>
      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <Paperclip className="h-4 w-4" /> {file.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TasksCalendarGrid({ calendarDays, monthStartOffset, month, selectedDateKey, taskCountByDate, onSelectDate, onPrevMonth, onNextMonth, isLoading }: { calendarDays: Date[]; monthStartOffset: number; month: Date; selectedDateKey: string; taskCountByDate: Map<string, number>; onSelectDate: (d: Date) => void; onPrevMonth: () => void; onNextMonth: () => void; isLoading: boolean }) {
  return <section className="rounded-2xl border p-4" style={{ ["--brand-primary" as string]: taskBrandTheme.brandPrimary }}><div className="flex justify-between"><button onClick={onPrevMonth}>◀</button><p>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p><button onClick={onNextMonth}>▶</button></div><div className="mt-2 grid grid-cols-7 gap-2">{Array.from({ length: monthStartOffset }).map((_, i) => <div key={i} />)}{calendarDays.map((day) => { const key = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, "0")}-${`${day.getDate()}`.padStart(2, "0")}`; const count = taskCountByDate.get(key) ?? 0; return <button key={key} onClick={() => onSelectDate(day)} className={cn("rounded border p-2 text-left", key === selectedDateKey && "border-emerald-500")}><div>{day.getDate()}</div><div>{count} tarefas</div></button>; })}</div>{isLoading && <p>Carregando...</p>}</section>;
}

export function TasksDrawer(props: { isOpen: boolean; selectedDate: Date; tasksOfDay: Task[]; canManage: boolean; teamLoading: boolean; teamError: string | null; isSaving: boolean; saveSuccess: string | null; form: TaskFormValues; users: TeamProfile[]; userNameById: Map<string, string>; files: File[]; saveError: string | null; tasksDayLoading: boolean; onClose: () => void; onSubmit: (e: FormEvent) => void; onFormChange: (v: Partial<TaskFormValues>) => void; onFilesChange: (f: File[]) => void; onEditTask: (t: Task) => void; onDeleteTask: (id: string) => void; responsibleName: string }) {
  const [tab, setTab] = useState<"detalhes" | "arquivos" | "direcionamento">("detalhes");
  const finalDateInvalid = useMemo(() => props.form.data_final < props.form.data_inicial, [props.form.data_final, props.form.data_inicial]);
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4 md:p-8">
      <div className="ml-auto w-full max-w-5xl">
        <TaskFormContainer>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Nova tarefa</h2>
              <p className="text-sm text-slate-500">{props.selectedDate.toLocaleDateString("pt-BR")}</p>
            </div>
            <button onClick={props.onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X /></button>
          </div>

          <div className="mb-6 space-y-3">
            {props.tasksOfDay.map((task) => (
              <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <PriorityBadge prioridade={task.prioridade} />
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs", statusBadgeClass[task.status])}>{task.status}</span>
                  <button onClick={() => props.onEditTask(task)} className="ml-auto rounded p-1 hover:bg-slate-200"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => props.onDeleteTask(task.id)} className="rounded p-1 text-rose-600 hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button>
                </div>
                <p className="text-sm font-semibold text-slate-900">{task.titulo}</p>
              </article>
            ))}
          </div>

          <form onSubmit={props.onSubmit} className="space-y-5">
            <TabsNavigation tab={tab} onChange={setTab} />

            <div className="transition-all duration-200">
              {tab === "detalhes" ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2"><InputField label="Título"><input required value={props.form.titulo} onChange={(e) => props.onFormChange({ titulo: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-200" /></InputField></div>
                  <div className="md:col-span-2"><TextAreaField label="Descrição" value={props.form.descricao} onChange={(e) => props.onFormChange({ descricao: e.target.value })} /></div>
                  <InputField label="Data inicial"><DatePicker value={props.form.data_inicial} onChange={(e) => props.onFormChange({ data_inicial: e.target.value })} /></InputField>
                  <InputField label="Data final"><DatePicker value={props.form.data_final} onChange={(e) => props.onFormChange({ data_final: e.target.value })} /></InputField>
                  <InputField label="Prioridade">
                    <div className="relative">
                      <select value={props.form.prioridade} onChange={(e) => props.onFormChange({ prioridade: e.target.value as TaskFormValues["prioridade"] })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
                        <option value="urgente">Urgente</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
                      </select>
                    </div>
                    <div className="pt-2"><PriorityBadge prioridade={props.form.prioridade} /></div>
                  </InputField>
                  <InputField label="Status">
                    <select value={props.form.status} onChange={(e) => props.onFormChange({ status: e.target.value as TaskFormValues["status"] })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
                      <option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option>
                    </select>
                  </InputField>
                  <div className="md:col-span-2"><InputField label="Responsável (automático)"><input readOnly value={props.responsibleName} className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500" /></InputField></div>
                </div>
              ) : null}

              {tab === "arquivos" ? (
                <div className="space-y-5">
                  <FileUploadArea files={props.files} onFilesChange={props.onFilesChange} />
                  <TextAreaField label="Observações (aceita links)" value={props.form.observacoes} onChange={(e) => props.onFormChange({ observacoes: e.target.value })} className="min-h-40" />
                </div>
              ) : null}

              {tab === "direcionamento" ? (
                <div>
                  {props.teamLoading ? <p className="text-sm text-slate-500">Carregando usuários…</p> : null}
                  {props.teamError ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{props.teamError}</p> : null}
                  <UserSelector users={props.users} value={props.form.direcionamento} onChange={(ids) => props.onFormChange({ direcionamento: ids })} />
                </div>
              ) : null}
            </div>

            {finalDateInvalid ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">A data final não pode ser menor que a data inicial.</p> : null}
            {props.saveError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{props.saveError}</p> : null}
            {props.saveSuccess ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{props.saveSuccess}</p> : null}

            <div className="flex justify-end">
              <button disabled={props.isSaving || finalDateInvalid} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {props.isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar tarefa"}
              </button>
            </div>
          </form>
        </TaskFormContainer>
      </div>
    </div>
  );
}

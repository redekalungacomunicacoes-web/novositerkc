import { Bell, KeyRound, ListChecks, Settings, ShieldCheck, Tags } from "lucide-react";

import { TasksPageShell } from "./calendar2026/TasksShell";

const taskTypes = ["Design", "Audiovisual", "Redes Sociais", "Site", "Newsletter", "Evento", "Administrativo", "Financeiro", "Outros"];
const priorities = ["Baixa", "Média", "Alta", "Urgente"];
const statuses = ["Pendente", "Em andamento", "Revisão", "Concluída", "Cancelada"];
const notifications = ["Sistema", "E-mail", "WhatsApp (futuro)"];
const permissions = [
  "Responsável: move Pendente → Em andamento e Em andamento → Concluída.",
  "Criador: move qualquer etapa e pode cancelar suas tarefas.",
  "Administrador: move qualquer etapa, cancela e consulta todo o módulo.",
  "Colaboradores visualizam e atuam nas tarefas atribuídas conforme regras existentes.",
];

function ConfigCard({ title, icon: Icon, items, muted }: { title: string; icon: typeof Settings; items: string[]; muted?: boolean }) {
  return (
    <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
      <h2 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><Icon size={18} className="text-emerald-700 dark:text-emerald-300" /> {title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <span key={item} className={`${muted ? "border-dashed text-slate-500 dark:text-emerald-100/70" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"} rounded-full border border-emerald-100 px-3 py-1.5 text-sm dark:border-emerald-800/60`}>{item}</span>)}</div>
    </article>
  );
}

export function AdminTarefasConfiguracoes() {
  return (
    <TasksPageShell>
      <main className="space-y-4">
        <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300"><Settings size={22} /><span className="text-sm font-medium uppercase tracking-[0.2em]">Configurações</span></div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Painel administrativo do módulo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-emerald-100/70">Parâmetros de interface preparados para crescimento, sem alterar banco de dados, Supabase, triggers ou permissões implementadas.</p>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ConfigCard title="Tipos de tarefa" icon={Tags} items={taskTypes} />
          <ConfigCard title="Prioridades" icon={ListChecks} items={priorities} />
          <ConfigCard title="Status" icon={ShieldCheck} items={statuses} />
          <ConfigCard title="Notificações" icon={Bell} items={notifications} muted />
        </section>

        <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <h2 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><KeyRound size={18} className="text-emerald-700 dark:text-emerald-300" /> Permissões atuais para consulta</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{permissions.map((item) => <p key={item} className="rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700 dark:bg-emerald-900/40 dark:text-emerald-100/80">{item}</p>)}</div>
        </article>
      </main>
    </TasksPageShell>
  );
}

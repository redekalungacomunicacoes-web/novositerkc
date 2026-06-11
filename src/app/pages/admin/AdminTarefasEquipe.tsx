import { Users } from "lucide-react";

import { TasksPageShell } from "./calendar2026/TasksShell";

export function AdminTarefasEquipe() {
  return (
    <TasksPageShell>
      <main className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
            <Users size={22} />
            <span className="text-sm font-medium uppercase tracking-[0.2em]">Equipe</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">Equipe de tarefas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-emerald-100/70">
            Em desenvolvimento
          </p>
      </main>
    </TasksPageShell>
  );
}

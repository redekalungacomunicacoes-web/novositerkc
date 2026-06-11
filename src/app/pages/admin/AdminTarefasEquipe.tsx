import { Users } from "lucide-react";

import { Sidebar } from "./calendar2026/Sidebar";

export function AdminTarefasEquipe() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <main className="rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
          <div className="flex items-center gap-3 text-sky-300">
            <Users size={22} />
            <span className="text-sm font-medium uppercase tracking-[0.2em]">Equipe</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">Equipe de tarefas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Em desenvolvimento
          </p>
        </main>
      </div>
    </div>
  );
}

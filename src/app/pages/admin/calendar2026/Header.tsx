import { Bell, Plus, Search } from "lucide-react";
import { sharedData, useCalendarStore } from "./store";

export function Header({ onNewTask }: { onNewTask: () => void }) {
  const { setTeam, selectedTeam, setSearch, setStatus, setPriority } = useCalendarStore();
  return (
    <header className="mb-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onNewTask} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"><Plus size={16} />Nova tarefa</button>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 min-w-64">
          <Search size={16} className="text-slate-400" /><input onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar tarefas, responsável..." />
        </div>
        <button className="relative rounded-xl border border-white/10 p-2 hover:bg-white/5"><Bell size={18}/><span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-rose-500 text-[10px] text-white">2</span></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <select value={selectedTeam} onChange={(e) => setTeam(e.target.value)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2">
          {sharedData.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select onChange={(e) => setStatus(e.target.value as never)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2"><option value="all">Status</option><option value="pendente">Pendente</option><option value="andamento">Em andamento</option><option value="concluido">Concluído</option><option value="atrasado">Atrasado</option></select>
        <select onChange={(e) => setPriority(e.target.value as never)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2"><option value="all">Prioridade</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select>
      </div>
    </header>
  );
}

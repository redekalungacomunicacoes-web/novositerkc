import { Filter, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { priorityLabels, statusLabels } from "./tasksApi";
import { useCalendarStore } from "./store";

const fieldClass = "h-10 rounded-xl border border-emerald-100 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/70 dark:text-emerald-50";

export function Header({ onNewTask }: { onNewTask: () => void }) {
  const { setTeam, selectedTeam, setSearch, setStatus, setPriority, setAssignee, setPeriod, filters, teamMembers } = useCalendarStore();
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = useMemo(() => [filters.assignee !== "all", filters.status !== "all", filters.priority !== "all", Boolean(filters.periodStart), Boolean(filters.periodEnd)].filter(Boolean).length, [filters]);

  function clearFilters() {
    setTeam("equipe"); setAssignee("all"); setStatus("all" as never); setPriority("all" as never); setPeriod("", "");
  }

  return (
    <section className="mb-3 rounded-2xl border border-emerald-100 bg-white/90 p-2 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onNewTask} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-600"><Plus size={15}/> Nova tarefa</button>
        <label className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400"/>
          <input aria-label="Buscar tarefas" value={filters.search} onChange={(e) => setSearch(e.target.value)} className={`${fieldClass} w-full pl-9 pr-8`} placeholder="Buscar tarefa, responsável ou conteúdo…"/>
          {filters.search ? <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-2.5 rounded-full p-0.5 text-slate-400 hover:text-slate-700" aria-label="Limpar busca"><X size={14}/></button> : null}
        </label>
        <button type="button" onClick={() => setShowFilters((v) => !v)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${showFilters || activeFilters ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}><SlidersHorizontal size={15}/> Filtros{activeFilters ? <span className="rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] text-white">{activeFilters}</span> : null}</button>
      </div>
      {showFilters ? (
        <div className="mt-2 grid gap-2 border-t border-emerald-50 pt-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <select aria-label="Equipe" value={selectedTeam} onChange={(e) => setTeam(e.target.value)} className={fieldClass}><option value="equipe">Equipe</option></select>
          <select aria-label="Responsável" value={filters.assignee} onChange={(e) => setAssignee(e.target.value)} className={fieldClass}><option value="all">Responsável</option>{teamMembers.map((m)=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select aria-label="Status" value={filters.status} onChange={(e) => setStatus(e.target.value as never)} className={fieldClass}><option value="all">Status</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          <select aria-label="Prioridade" value={filters.priority} onChange={(e) => setPriority(e.target.value as never)} className={fieldClass}><option value="all">Prioridade</option>{Object.entries(priorityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          <input aria-label="Data inicial" type="date" value={filters.periodStart} onChange={(e)=>setPeriod(e.target.value,filters.periodEnd)} className={fieldClass}/>
          <input aria-label="Data final" type="date" value={filters.periodEnd} onChange={(e)=>setPeriod(filters.periodStart,e.target.value)} className={fieldClass}/>
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"><RotateCcw size={14}/> Limpar</button>
        </div>
      ) : null}
    </section>
  );
}

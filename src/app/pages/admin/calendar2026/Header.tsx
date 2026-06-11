import { Plus, Search } from "lucide-react";
import { priorityLabels, statusLabels } from "./tasksApi";
import { useCalendarStore } from "./store";

const fieldClass = "h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/70 dark:text-emerald-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-800/40";

export function Header({ onNewTask }: { onNewTask: () => void }) {
  const { setTeam, selectedTeam, setSearch, setStatus, setPriority, setAssignee, setPeriod, filters, teamMembers } = useCalendarStore();

  return (
    <section className="mb-4 rounded-[2rem] border border-emerald-100 bg-white/90 p-3 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/70">
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          <button onClick={onNewTask} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400">
            <Plus size={16} /> Nova
          </button>
          <label className="relative min-w-0">
            <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-emerald-700/70 dark:text-emerald-200/70" />
            <input value={filters.search} onChange={(e) => setSearch(e.target.value)} className={`${fieldClass} w-full pl-9`} placeholder="Busca" />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(120px,.8fr)_minmax(170px,1.1fr)_minmax(135px,.8fr)_minmax(135px,.8fr)_minmax(145px,.8fr)_minmax(145px,.8fr)]">
        <select value={selectedTeam} onChange={(e) => setTeam(e.target.value)} className={`${fieldClass} min-w-0 w-full`}>
          <option value="equipe">Equipe</option>
        </select>
        <select value={filters.assignee} onChange={(e) => setAssignee(e.target.value)} className={`${fieldClass} min-w-0 w-full`}>
          <option value="all">Responsável</option>
          {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setStatus(e.target.value as never)} className={`${fieldClass} min-w-0 w-full`}>
          <option value="all">Status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => setPriority(e.target.value as never)} className={`${fieldClass} min-w-0 w-full`}>
          <option value="all">Prioridade</option>
          {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input aria-label="Data Inicial" type="date" value={filters.periodStart} onChange={(e) => setPeriod(e.target.value, filters.periodEnd)} className={`${fieldClass} min-w-0 w-full`} />
        <input aria-label="Data Final" type="date" value={filters.periodEnd} onChange={(e) => setPeriod(filters.periodStart, e.target.value)} className={`${fieldClass} min-w-0 w-full`} />
        </div>
      </div>
    </section>
  );
}

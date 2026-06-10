import { Bell, Plus, Search } from "lucide-react";
import { priorityLabels, statusLabels } from "./tasksApi";
import { useNotificationsQuery } from "./useTaskQueries";
import { useCalendarStore } from "./store";

export function Header({ onNewTask }: { onNewTask: () => void }) {
  const { setTeam, selectedTeam, setSearch, setStatus, setPriority, setAssignee, setPeriod, filters, teamMembers } = useCalendarStore();
  const notifications = useNotificationsQuery();
  const unreadCount = (notifications.data ?? []).filter((item) => item.status === "novo").length;

  return (
    <header className="mb-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onNewTask} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"><Plus size={16} />Nova tarefa</button>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 min-w-64">
          <Search size={16} className="text-slate-400" /><input onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar tarefas, responsável..." />
        </div>
        <button className="relative rounded-xl border border-white/10 p-2 hover:bg-white/5"><Bell size={18}/>{unreadCount > 0 ? <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-rose-500 text-[10px] text-white">{unreadCount}</span> : null}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <select value={selectedTeam} onChange={(e) => setTeam(e.target.value)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2">
          <option value="equipe">Equipe</option>
        </select>
        <select value={filters.assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2">
          <option value="all">Responsável</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setStatus(e.target.value as never)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2"><option value="all">Status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={filters.priority} onChange={(e) => setPriority(e.target.value as never)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2"><option value="all">Prioridade</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input type="date" value={filters.periodStart} onChange={(e) => setPeriod(e.target.value, filters.periodEnd)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2" />
        <input type="date" value={filters.periodEnd} onChange={(e) => setPeriod(filters.periodStart, e.target.value)} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2" />
      </div>
    </header>
  );
}

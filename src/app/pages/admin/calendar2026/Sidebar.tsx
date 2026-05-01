import { CalendarDays, CheckSquare, FileStack, Settings, Users, BarChart3, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

const items = [
  { label: "Calendário", icon: CalendarDays },
  { label: "Tarefas", icon: CheckSquare },
  { label: "Anexos", icon: FileStack },
  { label: "Equipe", icon: Users },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-72 flex-col rounded-3xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur-xl">
      <h1 className="mb-6 text-lg font-semibold text-white">Admin Calendar 2026</h1>
      <nav className="space-y-2">
        {items.map(({ label, icon: Icon }, index) => (
          <motion.button whileHover={{ scale: 1.02 }} key={label} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm ${index === 0 ? "bg-sky-500/20 text-sky-300" : "text-slate-300 hover:bg-white/5"}`}>
            <Icon size={16} /> {label}
          </motion.button>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <img src="https://i.pravatar.cc/64?img=21" className="h-9 w-9 rounded-full" />
          <div>
            <p className="text-white">Marina Prado</p>
            <p className="text-xs text-slate-400">Head de Operações</p>
          </div>
        </div>
        <button className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2 hover:bg-white/5">
          Dark/Light <span className="flex gap-1"><Moon size={14} /><Sun size={14} /></span>
        </button>
      </div>
    </aside>
  );
}

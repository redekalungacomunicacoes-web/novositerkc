import { AnimatePresence, motion } from "motion/react";
import { sharedData, useCalendarStore } from "./store";

export function TaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedDate, tasks, selectedTeam } = useCalendarStore();
  const members = sharedData.teamMembers.filter((m) => m.teamId === selectedTeam);
  const dayTasks = tasks.filter((t) => t.date === selectedDate);

  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Tarefas • {selectedDate}</h3><button onClick={onClose}>Fechar</button></div>
      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <input className="rounded-xl border border-white/10 bg-slate-800 p-2" placeholder="Título" />
        <input className="rounded-xl border border-white/10 bg-slate-800 p-2" placeholder="Descrição" />
        <input type="time" className="rounded-xl border border-white/10 bg-slate-800 p-2" />
        <input type="time" className="rounded-xl border border-white/10 bg-slate-800 p-2" />
        <select className="rounded-xl border border-white/10 bg-slate-800 p-2"><option>Baixa</option><option>Média</option><option>Alta</option></select>
        <select className="rounded-xl border border-white/10 bg-slate-800 p-2"><option>Pendente</option><option>Em andamento</option><option>Concluído</option><option>Atrasado</option></select>
        <select className="rounded-xl border border-white/10 bg-slate-800 p-2 md:col-span-2"><option>Responsável inteligente</option>{members.map((m) => <option key={m.id}>{m.name} · {m.role}</option>)}</select>
      </div>
      <div className="space-y-2">{dayTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-slate-400">Nenhuma tarefa para este dia.</div> : dayTasks.map((t) => <div key={t.id} className="rounded-2xl border border-white/10 p-3"><p className="font-medium">{t.title}</p><p className="text-xs text-slate-400">{t.startTime} - {t.endTime} · {t.description}</p></div>)}</div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

import { useState } from "react";
import { Calendar } from "./calendar2026/Calendar";
import { Header } from "./calendar2026/Header";
import { RightPanel } from "./calendar2026/RightPanel";
import { Sidebar } from "./calendar2026/Sidebar";
import { TaskModal } from "./calendar2026/TaskModal";
import { CalendarProvider } from "./calendar2026/store";

export function AdminTarefas() {
  const [openModal, setOpenModal] = useState(false);

  return (
    <CalendarProvider><div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-[280px_1fr_340px]">
        <Sidebar />
        <main>
          <Header onNewTask={() => setOpenModal(true)} />
          <Calendar onSelectDay={() => setOpenModal(true)} />
        </main>
        <RightPanel />
      </div>
      <TaskModal open={openModal} onClose={() => setOpenModal(false)} />
    </div></CalendarProvider>
  );
}

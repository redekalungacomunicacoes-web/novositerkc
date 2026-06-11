import { useState } from "react";
import { Calendar } from "./calendar2026/Calendar";
import { ExecutiveDashboard } from "./calendar2026/ExecutiveDashboard";
import { Header } from "./calendar2026/Header";
import { TaskModal } from "./calendar2026/TaskModal";
import { CalendarProvider } from "./calendar2026/store";
import { TasksPageShell } from "./calendar2026/TasksShell";

export function AdminTarefas() {
  const [openModal, setOpenModal] = useState(false);

  return (
    <CalendarProvider>
      <TasksPageShell>
        <Header onNewTask={() => setOpenModal(true)} />
        <ExecutiveDashboard />
        <Calendar onSelectDay={() => setOpenModal(true)} />
        <TaskModal open={openModal} onClose={() => setOpenModal(false)} />
      </TasksPageShell>
    </CalendarProvider>
  );
}

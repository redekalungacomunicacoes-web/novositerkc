import type { CalendarTask, TaskStatus } from "./types";

export const kanbanStatuses: TaskStatus[] = ["pendente", "em_andamento", "revisao", "concluida"];

const responsibleTransitions: Partial<Record<TaskStatus, TaskStatus[]>> = {
  pendente: ["em_andamento"],
  em_andamento: ["revisao", "concluida"],
  revisao: ["em_andamento", "concluida"],
};

export function canMoveTask(
  task: CalendarTask,
  targetStatus: TaskStatus,
  currentMemberId?: string | null,
  isAdmin?: boolean,
) {
  if (task.status === targetStatus) return false;
  if (targetStatus === "cancelada") return Boolean(isAdmin || task.creatorId === currentMemberId);
  if (isAdmin || task.creatorId === currentMemberId) return true;
  if (task.assigneeId !== currentMemberId) return false;
  return responsibleTransitions[task.status]?.includes(targetStatus) ?? false;
}

export function allowedTaskStatuses(
  task: CalendarTask,
  currentMemberId?: string | null,
  isAdmin?: boolean,
) {
  return (["pendente", "em_andamento", "revisao", "concluida", "cancelada"] as TaskStatus[])
    .filter((status) => canMoveTask(task, status, currentMemberId, isAdmin));
}

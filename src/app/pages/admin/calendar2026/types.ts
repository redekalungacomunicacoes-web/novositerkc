export type ViewMode = "month" | "week" | "day";
export type TaskStatus = "concluido" | "andamento" | "pendente" | "atrasado";
export type TaskPriority = "baixa" | "media" | "alta";

export interface TeamMember {
  id: string;
  teamId: string;
  name: string;
  role: string;
  avatar: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface CalendarTask {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string;
  meetingLink?: string;
  attachments: string[];
}

export interface TeamNotification {
  id: string;
  type: "meeting" | "task" | "attachment";
  message: string;
  status: "novo" | "lido";
  date: string;
}

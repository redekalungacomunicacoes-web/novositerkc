export type ViewMode = "month" | "week" | "day";
export type TaskStatus = "pendente" | "em_andamento" | "revisao" | "concluida" | "cancelada";
export type TaskPriority = "baixa" | "media" | "alta" | "urgente";
export type PermissionLevel = "admin" | "gestor" | "colaborador";

export interface TeamMember {
  id: string;
  teamId: string;
  name: string;
  role: string;
  avatar: string;
  email?: string | null;
  userId?: string | null;
}

export interface Team {
  id: string;
  name: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  comentario: string;
  created_at: string;
  updated_at: string;
  author?: { nome: string | null; email_login?: string | null } | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  tipo: "link" | "foto" | "pdf" | "video" | "documento" | "arquivo";
  external_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CalendarTask {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string;
  creatorId: string | null;
  completedAt: string | null;
  meetingLink?: string | null;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamNotification {
  id: string;
  type: "meeting" | "task" | "attachment" | "comment" | "overdue" | "done";
  message: string;
  status: "novo" | "lido";
  date: string;
}

export interface TaskFilters {
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  assignee: string | "all";
  periodStart: string;
  periodEnd: string;
  search: string;
}

export interface TaskInput {
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  prioridade: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by?: string | null;
  data_conclusao?: string | null;
}

export type TaskPriority = "baixa" | "media" | "alta" | "urgente" | "concluida";
export type TaskStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
export type AttachmentType = "link" | "foto" | "pdf" | "video" | "documento" | "arquivo";

export type TeamProfile = {
  id: string;
  equipe_id?: string | null;
  nome: string | null;
  email: string | null;
  ativo: boolean;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  tipo: AttachmentType;
  external_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_tarefa: string;
  prioridade: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  external_link: string | null;
  direcionamento: string[];
  created_at: string;
  updated_at: string;
  assigned_profile?: { nome: string | null; email: string | null } | null;
  created_profile?: { nome: string | null; email: string | null } | null;
  task_attachments?: TaskAttachment[];
};

export type Notification = {
  id: string;
  user_id: string;
  task_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
  read_at: string | null;
  tasks?: {
    titulo: string;
    data_tarefa: string;
    assigned_to: string | null;
    direcionamento: string[];
  } | null;
  recipient?: { nome: string | null; email: string | null } | null;
};

export type TaskFormValues = {
  id?: string;
  titulo: string;
  descricao: string;
  data_inicial: string;
  data_final: string;
  prioridade: TaskPriority;
  status: TaskStatus;
  assigned_to: string;
  direcionamento: string[];
  observacoes: string;
};

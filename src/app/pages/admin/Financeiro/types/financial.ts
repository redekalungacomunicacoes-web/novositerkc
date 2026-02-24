export type MovementType = "entrada" | "saida";
export type MovementStatus = "pago" | "pendente" | "cancelado";

export interface Project {
  id: string;
  name: string;
  year: number;
  funder: string | null;
  start_date: string | null;
  end_date: string | null;
  responsible: string | null;
  initial_amount: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  movement_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  public_url: string | null;
  created_at: string;
}

export interface Movement {
  id: string;
  project_id: string;
  date: string;
  type: MovementType;
  description: string;
  category_id: string | null;
  unit_value: number;
  quantity: number;
  total_value: number;
  status: MovementStatus;
  cost_center: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  tags?: Tag[];
  attachments?: Attachment[];
}

export type ProjectInput = Omit<Project, "id" | "current_balance" | "created_at" | "updated_at"> & {
  current_balance?: number;
};

export type MovementInput = Omit<Movement, "id" | "project_id" | "total_value" | "created_at" | "updated_at" | "category" | "tags" | "attachments"> & {
  tag_ids?: string[];
};

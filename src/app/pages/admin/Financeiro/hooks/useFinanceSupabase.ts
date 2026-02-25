import { supabase } from "@/lib/supabase";
import { normalizeEntityStatus } from "../utils/statusMap";

const BUCKET = "finance-attachments";

type FundPayload = {
  name: string;
  year?: number | null;
  description?: string | null;
  opening_balance: number;
  current_balance?: number;
  status?: string;
};

type ProjectPayload = {
  name: string;
  year?: number | null;
  description?: string | null;
  fund_id?: string | null;
  initial_amount?: number;
  current_balance?: number;
  status?: string;
};

type MovementPayload = {
  date: string;
  type: "entrada" | "saida";
  project_id?: string | null;
  fund_id?: string | null;
  description: string;
  category?: string | null;
  unit_value?: number;
  quantity?: number;
  total_value?: number;
  status?: string;
  cost_center?: string | null;
  notes?: string | null;
};

type MovementFilters = {
  status?: string;
  type?: "entrada" | "saida";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  fundId?: string;
  projectId?: string;
};

type AttachmentRow = { id: string; storage_path: string };
type UploadAttachmentArgs = { movementId: string; fundId?: string | null; projectId?: string | null };

const ensure = <T>(data: T, error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message);
  }
  return data;
};

export function useFinanceSupabase() {
  const listFunds = async () => {
    const res = await supabase
      .from("finance_funds")
      .select("id, name, year, current_balance, opening_balance, status, description")
      .order("year", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true });
    return ensure(res.data ?? [], res.error);
  };

  const getFund = async (id: string) => {
    const res = await supabase.from("finance_funds").select("*").eq("id", id).single();
    return ensure(res.data, res.error);
  };

  const createFund = async (payload: FundPayload) => {
    const nextPayload = {
      ...payload,
      status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
    };
    const res = await supabase.from("finance_funds").insert(nextPayload).select("*").single();
    return ensure(res.data, res.error);
  };

  const updateFund = async (id: string, payload: Partial<FundPayload>) => {
    const nextPayload = {
      ...payload,
      status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
    };
    const res = await supabase.from("finance_funds").update(nextPayload).eq("id", id).select("*").single();
    return ensure(res.data, res.error);
  };

  const deleteFund = async (id: string) => {
    const res = await supabase.from("finance_funds").delete().eq("id", id);
    ensure(true, res.error);
  };

  const listProjects = async () => {
    const res = await supabase
      .from("finance_projects")
      .select("id, name, year, fund_id, description, initial_amount, current_balance, status")
      .order("year", { ascending: false })
      .order("name", { ascending: true });
    return ensure(res.data ?? [], res.error);
  };

  const getProject = async (id: string) => {
    const res = await supabase.from("finance_projects").select("*").eq("id", id).single();
    return ensure(res.data, res.error);
  };

  const createProject = async (payload: ProjectPayload) => {
    const nextPayload = {
      ...payload,
      description: payload.description ?? null,
      status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
    };
    const res = await supabase.from("finance_projects").insert(nextPayload).select("*").single();
    return ensure(res.data, res.error);
  };

  const updateProject = async (id: string, payload: Partial<ProjectPayload>) => {
    const nextPayload = {
      ...payload,
      description: payload.description ?? null,
      status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
    };
    const res = await supabase.from("finance_projects").update(nextPayload).eq("id", id).select("*").single();
    return ensure(res.data, res.error);
  };

  const deleteProject = async (id: string) => {
    const res = await supabase.from("finance_projects").delete().eq("id", id);
    ensure(true, res.error);
  };

  const listMovementsByFund = async (fundId: string) => {
    const res = await supabase
      .from("finance_movements")
      .select("*")
      .eq("fund_id", fundId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    return ensure(res.data ?? [], res.error);
  };

  const listMovementsByProject = async (projectId: string) => {
    const res = await supabase
      .from("finance_movements")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    return ensure(res.data ?? [], res.error);
  };

  const listMovements = async (filters: MovementFilters = {}) => {
    let query = supabase
      .from("finance_movements")
      .select("id, date, type, description, total_value, status, fund_id, project_id, category, unit_value, quantity, payment_method, payee, document_type, document_number, cost_center, notes, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.fundId) query = query.eq("fund_id", filters.fundId);
    if (filters.projectId) query = query.eq("project_id", filters.projectId);
    if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("date", filters.dateTo);
    if (filters.search) query = query.ilike("description", `%${filters.search}%`);

    const res = await query;
    return ensure(res.data ?? [], res.error);
  };

  const listLatestMovements = async (limit = 10) => {
    const res = await supabase
      .from("finance_movements")
      .select("id, date, type, description, total_value, status, fund_id, project_id, category_id, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    return ensure(res.data ?? [], res.error);
  };

  const createMovement = async (payload: MovementPayload) => {
    const res = await supabase.from("finance_movements").insert(payload).select("*").single();
    return ensure(res.data, res.error);
  };

  const updateMovement = async (id: string, payload: Partial<MovementPayload>) => {
    const res = await supabase.from("finance_movements").update(payload).eq("id", id).select("*").single();
    return ensure(res.data, res.error);
  };

  const deleteMovement = async (id: string) => {
    const res = await supabase.from("finance_movements").delete().eq("id", id);
    ensure(true, res.error);
  };

  const listCategories = async () => {
    const res = await supabase.from("finance_categories").select("*").order("name", { ascending: true });
    return ensure(res.data ?? [], res.error);
  };

  const listTags = async () => {
    const res = await supabase.from("finance_tags").select("*").order("name", { ascending: true });
    return ensure(res.data ?? [], res.error);
  };

  const listAttachments = async (movementId: string) => {
    const res = await supabase.from("finance_attachments").select("*").eq("movement_id", movementId).order("created_at", { ascending: false });
    return ensure(res.data ?? [], res.error);
  };

  const listAttachmentCounts = async (movementIds: string[]) => {
    if (!movementIds.length) return {} as Record<string, number>;

    const res = await supabase
      .from("finance_attachments")
      .select("movement_id")
      .in("movement_id", movementIds);

    const rows = ensure(res.data ?? [], res.error) as Array<{ movement_id: string }>;
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.movement_id] = (acc[row.movement_id] || 0) + 1;
      return acc;
    }, {});
  };

  const listAttachmentsForMovements = async (movementIds: string[]) => {
    if (!movementIds.length) return [] as Array<{ movement_id: string }>;

    const res = await supabase
      .from("finance_attachments")
      .select("movement_id")
      .in("movement_id", movementIds);

    return ensure(res.data ?? [], res.error) as Array<{ movement_id: string }>;
  };

  const uploadAttachment = async (file: File, { movementId, fundId, projectId }: UploadAttachmentArgs) => {
    const path = `${fundId ?? "no-fund"}/${projectId ?? "no-project"}/${movementId}/${Date.now()}-${file.name}`;
    const upload = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    ensure(true, upload.error);

    const insert = await supabase
      .from("finance_attachments")
      .insert({
        movement_id: movementId,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
      })
      .select("*")
      .single();

    return ensure(insert.data, insert.error);
  };

  const deleteAttachment = async (attachment: AttachmentRow) => {
    const remove = await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
    ensure(true, remove.error);
    const res = await supabase.from("finance_attachments").delete().eq("id", attachment.id);
    ensure(true, res.error);
  };

  return {
    listFunds,
    getFund,
    createFund,
    updateFund,
    deleteFund,
    listProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    listMovementsByFund,
    listMovementsByProject,
    listMovements,
    listLatestMovements,
    createMovement,
    updateMovement,
    deleteMovement,
    listCategories,
    listTags,
    listAttachments,
    listAttachmentCounts,
    listAttachmentsForMovements,
    uploadAttachment,
    deleteAttachment,
  };
}

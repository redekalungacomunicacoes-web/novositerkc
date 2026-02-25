import { supabase } from "@/lib/supabase";

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
    const res = await supabase.from("finance_funds").select("*").order("year", { ascending: false, nullsFirst: false }).order("name", { ascending: true });
    return ensure(res.data ?? [], res.error);
  };

  const getFund = async (id: string) => {
    const res = await supabase.from("finance_funds").select("*").eq("id", id).single();
    return ensure(res.data, res.error);
  };

  const createFund = async (payload: FundPayload) => {
    const res = await supabase.from("finance_funds").insert(payload).select("*").single();
    return ensure(res.data, res.error);
  };

  const updateFund = async (id: string, payload: Partial<FundPayload>) => {
    const res = await supabase.from("finance_funds").update(payload).eq("id", id).select("*").single();
    return ensure(res.data, res.error);
  };

  const deleteFund = async (id: string) => {
    const res = await supabase.from("finance_funds").delete().eq("id", id);
    ensure(true, res.error);
  };

  const listProjects = async () => {
    const res = await supabase.from("finance_projects").select("*").order("year", { ascending: false }).order("name", { ascending: true });
    return ensure(res.data ?? [], res.error);
  };

  const getProject = async (id: string) => {
    const res = await supabase.from("finance_projects").select("*").eq("id", id).single();
    return ensure(res.data, res.error);
  };

  const createProject = async (payload: ProjectPayload) => {
    const res = await supabase.from("finance_projects").insert(payload).select("*").single();
    return ensure(res.data, res.error);
  };

  const updateProject = async (id: string, payload: Partial<ProjectPayload>) => {
    const res = await supabase.from("finance_projects").update(payload).eq("id", id).select("*").single();
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
    createMovement,
    updateMovement,
    deleteMovement,
    listCategories,
    listTags,
    listAttachments,
    uploadAttachment,
    deleteAttachment,
  };
}

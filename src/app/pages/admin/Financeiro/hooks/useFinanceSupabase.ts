import { supabase } from "@/lib/supabase";

const BUCKET = "finance-attachments";

const asDate = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : null);

export function useFinanceSupabase() {
  const listFunds = async () => supabase.from("finance_funds").select("*").order("year", { ascending: false }).order("name", { ascending: true });
  const getFund = async (id: string) => supabase.from("finance_funds").select("*").eq("id", id).single();
  const createFund = async (payload: Record<string, unknown>) => supabase.from("finance_funds").insert(payload).select("*").single();
  const updateFund = async (id: string, payload: Record<string, unknown>) => supabase.from("finance_funds").update(payload).eq("id", id).select("*").single();
  const deleteFund = async (id: string) => supabase.from("finance_funds").delete().eq("id", id);

  const listProjects = async () => supabase.from("finance_projects").select("*").order("year", { ascending: false }).order("name", { ascending: true });
  const getProject = async (id: string) => supabase.from("finance_projects").select("*").eq("id", id).single();

  const listMovementsByFund = async (fundId: string) => supabase.from("finance_movements").select("*, attachments:finance_attachments(*)").eq("fund_id", fundId).order("date", { ascending: false });
  const listMovementsByProject = async (projectId: string) => supabase.from("finance_movements").select("*, attachments:finance_attachments(*)").eq("project_id", projectId).order("date", { ascending: false });

  const createMovement = async (payload: Record<string, unknown>) =>
    supabase
      .from("finance_movements")
      .insert({ ...payload, date: asDate(payload.date as string | undefined) })
      .select("*")
      .single();

  const updateMovement = async (id: string, payload: Record<string, unknown>) =>
    supabase
      .from("finance_movements")
      .update({ ...payload, date: asDate(payload.date as string | undefined) ?? undefined })
      .eq("id", id)
      .select("*")
      .single();

  const deleteMovement = async (id: string) => supabase.from("finance_movements").delete().eq("id", id);

  const uploadAttachment = async (file: File, movementId: string, pathParts: string[]) => {
    const path = `${pathParts.join("/")}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (uploadError) return { data: null, error: uploadError };

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return supabase
      .from("finance_attachments")
      .insert({
        movement_id: movementId,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
        public_url: publicData.publicUrl,
      })
      .select("*")
      .single();
  };

  const listAttachments = async (movementId: string) =>
    supabase.from("finance_attachments").select("*").eq("movement_id", movementId).order("created_at", { ascending: false });

  const deleteAttachment = async (attachmentId: string) => {
    const { data, error } = await supabase.from("finance_attachments").select("id,storage_path").eq("id", attachmentId).single();
    if (error || !data) return { error };
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
    if (storageError) return { error: storageError };
    return supabase.from("finance_attachments").delete().eq("id", attachmentId);
  };

  return {
    listFunds,
    getFund,
    createFund,
    updateFund,
    deleteFund,
    listProjects,
    getProject,
    listMovementsByFund,
    listMovementsByProject,
    createMovement,
    updateMovement,
    deleteMovement,
    uploadAttachment,
    listAttachments,
    deleteAttachment,
  };
}

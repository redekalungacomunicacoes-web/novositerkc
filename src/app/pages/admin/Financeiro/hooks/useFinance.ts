import { supabase } from "@/lib/supabase";
import { Attachment, Category, Movement, MovementInput, Project, ProjectInput, Tag } from "../types/financial";

const BUCKET = "finance-attachments";

const asDate = (v: string) => (v ? new Date(v).toISOString().slice(0, 10) : v);

export function useFinance() {
  const listProjects = async () => {
    return supabase.from("finance_projects").select("*").order("year", { ascending: false }).order("name", { ascending: true });
  };

  const getProject = async (id: string) => {
    return supabase.from("finance_projects").select("*").eq("id", id).single<Project>();
  };

  const createProject = async (payload: ProjectInput) => {
    return supabase
      .from("finance_projects")
      .insert({ ...payload, start_date: payload.start_date || null, end_date: payload.end_date || null })
      .select("*")
      .single<Project>();
  };

  const updateProject = async (id: string, payload: Partial<ProjectInput>) => {
    return supabase
      .from("finance_projects")
      .update({ ...payload, start_date: payload.start_date || null, end_date: payload.end_date || null })
      .eq("id", id)
      .select("*")
      .single<Project>();
  };

  const deleteProject = async (id: string) => supabase.from("finance_projects").delete().eq("id", id);

  const listMovements = async (projectId: string) => {
    const { data, error } = await supabase
      .from("finance_movements")
      .select("*, category:finance_categories(*), movement_tags:finance_movement_tags(tag:finance_tags(*)), attachments:finance_attachments(*)")
      .eq("project_id", projectId)
      .order("date", { ascending: false });

    if (error) return { data: null, error };

    const mapped = (data || []).map((m: any) => ({
      ...m,
      tags: (m.movement_tags || []).map((mt: any) => mt.tag).filter(Boolean),
    })) as Movement[];

    return { data: mapped, error: null };
  };

  const createMovement = async (projectId: string, payload: MovementInput) => {
    const { tag_ids = [], ...base } = payload;
    const { data, error } = await supabase
      .from("finance_movements")
      .insert({ ...base, project_id: projectId, date: asDate(base.date) })
      .select("*")
      .single<Movement>();
    if (error || !data) return { data, error };

    if (tag_ids.length) {
      await supabase.from("finance_movement_tags").insert(tag_ids.map((tag_id) => ({ movement_id: data.id, tag_id })));
    }

    return { data, error: null };
  };

  const updateMovement = async (id: string, payload: Partial<MovementInput>) => {
    const { tag_ids, ...base } = payload;
    const { data, error } = await supabase
      .from("finance_movements")
      .update({ ...base, date: base.date ? asDate(base.date) : undefined })
      .eq("id", id)
      .select("*")
      .single<Movement>();
    if (error) return { data: null, error };

    if (Array.isArray(tag_ids)) {
      await supabase.from("finance_movement_tags").delete().eq("movement_id", id);
      if (tag_ids.length) {
        await supabase.from("finance_movement_tags").insert(tag_ids.map((tag_id) => ({ movement_id: id, tag_id })));
      }
    }

    return { data, error: null };
  };

  const deleteMovement = async (id: string) => supabase.from("finance_movements").delete().eq("id", id);

  const listCategories = async () => supabase.from("finance_categories").select("*").order("name", { ascending: true }).returns<Category[]>();
  const listTags = async () => supabase.from("finance_tags").select("*").order("name", { ascending: true }).returns<Tag[]>();

  const upsertCategories = async (list: Array<Partial<Category>>) => supabase.from("finance_categories").upsert(list, { onConflict: "id" });
  const upsertTags = async (list: Array<Partial<Tag>>) => supabase.from("finance_tags").upsert(list, { onConflict: "id" });

  const listPendingTop = async () =>
    supabase
      .from("finance_movements")
      .select("id,date,description,total_value,project:finance_projects(id,name)")
      .eq("status", "pendente")
      .order("date", { ascending: true })
      .limit(5);

  const uploadAttachment = async (file: File, projectId: string, movementId: string) => {
    const path = `${projectId}/${movementId}/${Date.now()}-${file.name}`;
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
      .single<Attachment>();
  };

  const deleteAttachment = async (attachmentId: string) => {
    const { data, error } = await supabase.from("finance_attachments").select("*").eq("id", attachmentId).single<Attachment>();
    if (error || !data) return { error };
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
    if (storageError) return { error: storageError };
    return supabase.from("finance_attachments").delete().eq("id", attachmentId);
  };

  return {
    listProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    listMovements,
    createMovement,
    updateMovement,
    deleteMovement,
    listCategories,
    upsertCategories,
    listTags,
    upsertTags,
    listPendingTop,
    uploadAttachment,
    deleteAttachment,
  };
}

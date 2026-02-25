import { supabase } from "@/lib/supabase";
import {
  Attachment,
  Category,
  Movement,
  MovementInput,
  Project,
  ProjectInput,
  Tag,
} from "../types/financial";

const BUCKET = "finance-attachments";

type Fund = {
  id: string;
  name: string;
  year?: number | null;
  description?: string | null;
  opening_balance?: number | null;
  current_balance?: number | null;
  status?: string | null;
};

type DashboardAggregates = {
  kpis: {
    totalMovements: number;
    totalPending: number;
    totalIn: number;
    totalOut: number;
    currentBalance: number;
  };
  cashflowLine: Array<{ mes: string; entradas: number; saidas: number }>;
  budgetVsReal: Array<{ mes: string; orcado: number; real: number }>;
  categoryPie: Array<{ name: string; value: number }>;
};

const asDate = (v: string) => (v ? new Date(v).toISOString().slice(0, 10) : v);

const monthKey = (value: string) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
};

const normalizeStatus = (status: unknown) => `${status ?? ""}`.trim().toLowerCase();
const normalizeType = (type: unknown) =>
  `${type ?? ""}`.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function useFinance() {
  // -------------------------
  // Projects
  // -------------------------
  const listProjects = async () => {
    return supabase
      .from("finance_projects")
      .select("*")
      .order("year", { ascending: false })
      .order("name", { ascending: true });
  };

  const getProject = async (id: string) => {
    return supabase.from("finance_projects").select("*").eq("id", id).single<Project>();
  };

  const createProject = async (payload: ProjectInput) => {
    return supabase
      .from("finance_projects")
      .insert({
        ...payload,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      })
      .select("*")
      .single<Project>();
  };

  const updateProject = async (id: string, payload: Partial<ProjectInput>) => {
    return supabase
      .from("finance_projects")
      .update({
        ...payload,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      })
      .eq("id", id)
      .select("*")
      .single<Project>();
  };

  const deleteProject = async (id: string) =>
    supabase.from("finance_projects").delete().eq("id", id);

  // -------------------------
  // Funds (necessário pro saldo real do dashboard)
  // -------------------------
  const listFunds = async () => {
    return supabase
      .from("finance_funds")
      .select("*")
      .order("year", { ascending: false })
      .order("name", { ascending: true })
      .returns<Fund[]>();
  };

  const getFund = async (id: string) => {
    return supabase.from("finance_funds").select("*").eq("id", id).single<Fund>();
  };

  // -------------------------
  // Movements (por projeto)
  // -------------------------
  const listMovements = async (projectId: string) => {
    const { data, error } = await supabase
      .from("finance_movements")
      .select(
        "*, category:finance_categories(*), movement_tags:finance_movement_tags(tag:finance_tags(*)), attachments:finance_attachments(*)"
      )
      .eq("project_id", projectId)
      .order("date", { ascending: false });

    if (error) return { data: null, error };

    const mapped = (data || []).map((m: any) => ({
      ...m,
      tags: (m.movement_tags || []).map((mt: any) => mt.tag).filter(Boolean),
    })) as Movement[];

    return { data: mapped, error: null };
  };

  // Movements (geral / caixa) com filtros simples
  const listMovementsAll = async (filters?: {
    status?: string;
    type?: "entrada" | "saida";
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    fundId?: string;
    projectId?: string;
    limit?: number;
  }) => {
    let q = supabase
      .from("finance_movements")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.type) q = q.eq("type", filters.type);
    if (filters?.fundId) q = q.eq("fund_id", filters.fundId);
    if (filters?.projectId) q = q.eq("project_id", filters.projectId);
    if (filters?.dateFrom) q = q.gte("date", asDate(filters.dateFrom));
    if (filters?.dateTo) q = q.lte("date", asDate(filters.dateTo));
    if (filters?.search) q = q.ilike("description", `%${filters.search}%`);
    if (filters?.limit) q = q.limit(filters.limit);

    return q;
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
      await supabase
        .from("finance_movement_tags")
        .insert(tag_ids.map((tag_id) => ({ movement_id: data.id, tag_id })));
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
        await supabase
          .from("finance_movement_tags")
          .insert(tag_ids.map((tag_id) => ({ movement_id: id, tag_id })));
      }
    }

    return { data, error: null };
  };

  const deleteMovement = async (id: string) =>
    supabase.from("finance_movements").delete().eq("id", id);

  // Exclusão em cascata: remove anexos (storage + tabela) e depois a movimentação
  const deleteMovementCascade = async (movementId: string) => {
    const { data: att, error: attErr } = await supabase
      .from("finance_attachments")
      .select("id, storage_path")
      .eq("movement_id", movementId);

    if (attErr) return { error: attErr };

    const paths = (att || []).map((a: any) => a.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageErr) return { error: storageErr };
    }

    const { error: delAttErr } = await supabase
      .from("finance_attachments")
      .delete()
      .eq("movement_id", movementId);

    if (delAttErr) return { error: delAttErr };

    const { error: delMovErr } = await supabase
      .from("finance_movements")
      .delete()
      .eq("id", movementId);

    if (delMovErr) return { error: delMovErr };

    return { error: null };
  };

  // -------------------------
  // Categories / Tags
  // -------------------------
  const listCategories = async () =>
    supabase
      .from("finance_categories")
      .select("*")
      .order("name", { ascending: true })
      .returns<Category[]>();

  const listTags = async () =>
    supabase.from("finance_tags").select("*").order("name", { ascending: true }).returns<Tag[]>();

  const upsertCategories = async (list: Array<Partial<Category>>) =>
    supabase.from("finance_categories").upsert(list, { onConflict: "id" });

  const upsertTags = async (list: Array<Partial<Tag>>) =>
    supabase.from("finance_tags").upsert(list, { onConflict: "id" });

  // -------------------------
  // Dashboard
  // -------------------------
  const listPendingTop = async () =>
    supabase
      .from("finance_movements")
      .select("id,date,description,total_value,project:finance_projects(id,name)")
      .eq("status", "pendente")
      .order("date", { ascending: true })
      .limit(5);

  const listLatestMovements = async (limit = 10) => {
    return supabase
      .from("finance_movements")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
  };

  const listAttachmentsForMovementIds = async (movementIds: string[]) => {
    if (!movementIds.length) return { data: [], error: null as any };
    return supabase
      .from("finance_attachments")
      .select("movement_id")
      .in("movement_id", movementIds);
  };

  const getDashboardAggregates = async ({ months = 6 }: { months?: number } = {}) => {
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const fromDate = start.toISOString().slice(0, 10);

    // tenta com category_id
    let res = await supabase
      .from("finance_movements")
      .select("id,date,type,status,total_value,created_at,category,category_id")
      .gte("date", fromDate);

    // fallback sem category_id
    if (res.error?.message?.toLowerCase().includes("category_id")) {
      res = await supabase
        .from("finance_movements")
        .select("id,date,type,status,total_value,created_at,category")
        .gte("date", fromDate);
    }

    let rows = (res.data || []) as any[];

    // fallback all time se vazio
    if (!rows.length) {
      let fb = await supabase
        .from("finance_movements")
        .select("id,date,type,status,total_value,created_at,category,category_id");

      if (fb.error?.message?.toLowerCase().includes("category_id")) {
        fb = await supabase
          .from("finance_movements")
          .select("id,date,type,status,total_value,created_at,category");
      }

      rows = (fb.data || []) as any[];
    }

    const paid = rows.filter((r) => normalizeStatus(r.status) === "pago");
    const totalIn = paid
      .filter((r) => normalizeType(r.type) === "entrada")
      .reduce((acc, r) => acc + Number(r.total_value || 0), 0);

    const totalOut = paid
      .filter((r) => normalizeType(r.type) === "saida")
      .reduce((acc, r) => acc + Number(r.total_value || 0), 0);

    const cashflowByMonth = new Map<string, { mes: string; entradas: number; saidas: number }>();
    paid.forEach((r) => {
      const key = monthKey(r.date);
      const item = cashflowByMonth.get(key) || { mes: monthLabel(key), entradas: 0, saidas: 0 };
      if (normalizeType(r.type) === "entrada") item.entradas += Number(r.total_value || 0);
      if (normalizeType(r.type) === "saida") item.saidas += Number(r.total_value || 0);
      cashflowByMonth.set(key, item);
    });

    const pieMap = new Map<string, number>();
    paid
      .filter((r) => normalizeType(r.type) === "saida")
      .forEach((r) => {
        const key = r.category || "Sem categoria";
        pieMap.set(key, (pieMap.get(key) || 0) + Number(r.total_value || 0));
      });

    const { data: fundsData } = await supabase.from("finance_funds").select("current_balance");
    const funds = (fundsData || []) as any[];
    const fundsBalance = funds.reduce((acc: number, f: any) => acc + Number(f.current_balance || 0), 0);

    const result: DashboardAggregates = {
      kpis: {
        totalMovements: rows.length,
        totalPending: rows.filter((r) => normalizeStatus(r.status) === "pendente").length,
        totalIn,
        totalOut,
        currentBalance: funds.length ? fundsBalance : totalIn - totalOut,
      },
      cashflowLine: Array.from(cashflowByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v),
      budgetVsReal: Array.from(cashflowByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({ mes: v.mes, orcado: 0, real: v.saidas })),
      categoryPie: Array.from(pieMap.entries()).map(([name, value]) => ({ name, value })),
    };

    return { data: result, error: null };
  };

  // -------------------------
  // Attachments (upload / preview)
  // -------------------------
  const uploadAttachment = async (file: File, projectId: string, movementId: string) => {
    const path = `${projectId}/${movementId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });

    if (uploadError) return { data: null, error: uploadError };

    // NÃO dependa de public url (bucket pode ser privado)
    // Salva storage_path e metadados — preview via signed url.
    return supabase
      .from("finance_attachments")
      .insert({
        movement_id: movementId,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
      })
      .select("*")
      .single<Attachment>();
  };

  const getSignedUrl = async (storagePath: string, expiresIn = 60 * 10) => {
    return supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  };

  const deleteAttachment = async (attachmentId: string) => {
    const { data, error } = await supabase
      .from("finance_attachments")
      .select("*")
      .eq("id", attachmentId)
      .single<Attachment>();

    if (error || !data) return { error };

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
    if (storageError) return { error: storageError };

    return supabase.from("finance_attachments").delete().eq("id", attachmentId);
  };

  return {
    // funds
    listFunds,
    getFund,

    // projects
    listProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,

    // movements
    listMovements,
    listMovementsAll,
    createMovement,
    updateMovement,
    deleteMovement,
    deleteMovementCascade,

    // categories/tags
    listCategories,
    upsertCategories,
    listTags,
    upsertTags,

    // dashboard
    listPendingTop,
    listLatestMovements,
    listAttachmentsForMovementIds,
    getDashboardAggregates,

    // attachments
    uploadAttachment,
    deleteAttachment,
    getSignedUrl,
  };
}

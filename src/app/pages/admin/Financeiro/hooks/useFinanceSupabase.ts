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
  category_id?: string | null;
  unit_value?: number;
  quantity?: number;
  total_value?: number;
  status?: string;
  cost_center?: string | null;
  payment_method?: string | null;
  payee?: string | null;
  document_type?: string | null;
  document_number?: string | null;
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
type UploadAttachmentArgs = {
  movementId: string;
  fundId?: string | null;
  projectId?: string | null;
};

type DashboardAggregateArgs = { months?: number };
type ReportFilters = Pick<MovementFilters, "type" | "status" | "dateFrom" | "dateTo">;

const ensure = <T>(data: T, error: { message: string } | null) => {
  if (error) throw new Error(error.message);
  return data;
};

const monthKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  `${type ?? ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

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
    const res = await supabase
      .from("finance_funds")
      .insert({
        ...payload,
        status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
      })
      .select("*")
      .single();
    return ensure(res.data, res.error);
  };

  const updateFund = async (id: string, payload: Partial<FundPayload>) => {
    const res = await supabase
      .from("finance_funds")
      .update({
        ...payload,
        status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
      })
      .eq("id", id)
      .select("*")
      .single();
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
    const res = await supabase
      .from("finance_projects")
      .insert({
        ...payload,
        description: payload.description ?? null,
        status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
      })
      .select("*")
      .single();
    return ensure(res.data, res.error);
  };

  const updateProject = async (id: string, payload: Partial<ProjectPayload>) => {
    const res = await supabase
      .from("finance_projects")
      .update({
        ...payload,
        description: payload.description ?? null,
        status: payload.status ? normalizeEntityStatus(payload.status) : payload.status,
      })
      .eq("id", id)
      .select("*")
      .single();
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
      .select("*")
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

  const listCategories = async () => {
    const res = await supabase
      .from("finance_categories")
      .select("id,name,color")
      .order("name", { ascending: true });
    return ensure(res.data ?? [], res.error);
  };

  const listLatestMovements = async (limit = 10) => {
    const res = await supabase
      .from("finance_movements")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    return ensure(res.data ?? [], res.error);
  };

  // ✅ ÚNICA versão (robusta): tolera schema sem category_id e normaliza status/tipo
  const getDashboardAggregates = async ({ months = 6 }: DashboardAggregateArgs = {}) => {
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const fromDate = start.toISOString().slice(0, 10);

    let res = await supabase
      .from("finance_movements")
      .select("id,date,type,status,total_value,created_at,category,category_id")
      .gte("date", fromDate);

    if (res.error?.message?.toLowerCase().includes("category_id")) {
      res = await supabase
        .from("finance_movements")
        .select("id,date,type,status,total_value,created_at,category")
        .gte("date", fromDate);
    }

    let rows = ensure(res.data ?? [], res.error) as any[];

    // Se não tem nada nos últimos X meses, faz fallback “all time”
    if (!rows.length) {
      let fallback = await supabase
        .from("finance_movements")
        .select("id,date,type,status,total_value,created_at,category,category_id");

      if (fallback.error?.message?.toLowerCase().includes("category_id")) {
        fallback = await supabase
          .from("finance_movements")
          .select("id,date,type,status,total_value,created_at,category");
      }

      rows = ensure(fallback.data ?? [], fallback.error) as any[];
    }

    const paid = rows.filter((row) => normalizeStatus(row.status) === "pago");

    const totalIn = paid
      .filter((row) => normalizeType(row.type) === "entrada")
      .reduce((acc, row) => acc + Number(row.total_value || 0), 0);

    const totalOut = paid
      .filter((row) => normalizeType(row.type) === "saida")
      .reduce((acc, row) => acc + Number(row.total_value || 0), 0);

    const cashflowByMonth = new Map<string, { mes: string; entradas: number; saidas: number }>();
    paid.forEach((row) => {
      const key = monthKey(row.date);
      const record = cashflowByMonth.get(key) || {
        mes: monthLabel(key),
        entradas: 0,
        saidas: 0,
      };

      if (normalizeType(row.type) === "entrada") record.entradas += Number(row.total_value || 0);
      if (normalizeType(row.type) === "saida") record.saidas += Number(row.total_value || 0);

      cashflowByMonth.set(key, record);
    });

    const pieMap = new Map<string, number>();
    paid
      .filter((row) => normalizeType(row.type) === "saida")
      .forEach((row) => {
        const key = row.category || "Sem categoria";
        pieMap.set(key, (pieMap.get(key) || 0) + Number(row.total_value || 0));
      });

    const fundsRes = await supabase.from("finance_funds").select("current_balance");
    const funds = ensure(fundsRes.data ?? [], fundsRes.error) as any[];
    const fundsBalance = funds.reduce(
      (acc: number, fund: any) => acc + Number(fund.current_balance || 0),
      0
    );

    return {
      kpis: {
        totalMovements: rows.length,
        totalPending: rows.filter((row) => normalizeStatus(row.status) === "pendente").length,
        totalIn,
        totalOut,
        currentBalance: funds.length ? fundsBalance : totalIn - totalOut,
      },
      cashflowLine: Array.from(cashflowByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value),
      budgetVsReal: Array.from(cashflowByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => ({ mes: value.mes, orcado: 0, real: value.saidas })),
      categoryPie: Array.from(pieMap.entries()).map(([name, value]) => ({ name, value })),
    };
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

  const listAttachments = async (movementId: string) => {
    const res = await supabase
      .from("finance_attachments")
      .select("*")
      .eq("movement_id", movementId)
      .order("created_at", { ascending: false });
    return ensure(res.data ?? [], res.error);
  };

  const listAttachmentsForMovementIds = async (movementIds: string[]) => {
    if (!movementIds.length) return [] as Array<{ movement_id: string }>;
    const res = await supabase
      .from("finance_attachments")
      .select("movement_id")
      .in("movement_id", movementIds);
    return ensure(res.data ?? [], res.error) as Array<{ movement_id: string }>;
  };

  const listAttachmentCounts = async (movementIds: string[]) => {
    const rows = await listAttachmentsForMovementIds(movementIds);
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.movement_id] = (acc[row.movement_id] || 0) + 1;
      return acc;
    }, {});
  };

  const uploadAttachment = async (
    file: File,
    { movementId, fundId, projectId }: UploadAttachmentArgs
  ) => {
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

  const deleteMovementCascade = async (movement: { id: string }) => {
    const attachmentRows = await listAttachments(movement.id);
    const paths = (attachmentRows as any[]).map((row: any) => row.storage_path).filter(Boolean);

    if (paths.length) {
      const remove = await supabase.storage.from(BUCKET).remove(paths);
      ensure(true, remove.error);
    }

    const delAttachments = await supabase.from("finance_attachments").delete().eq("movement_id", movement.id);
    ensure(true, delAttachments.error);

    const delMovement = await supabase.from("finance_movements").delete().eq("id", movement.id);
    ensure(true, delMovement.error);
  };

  const getSignedUrl = async (storagePath: string) => {
    const res = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10);
    return ensure(res.data?.signedUrl || "", res.error);
  };

  const getReportBase = async (
    scope: { projectId?: string; fundId?: string },
    filters: ReportFilters = {}
  ) => {
    let query = supabase
      .from("finance_movements")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (scope.projectId) query = query.eq("project_id", scope.projectId);
    if (scope.fundId) query = query.eq("fund_id", scope.fundId);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("date", filters.dateTo);

    const [movRes, categories] = await Promise.all([query, listCategories()]);
    const movements = ensure(movRes.data ?? [], movRes.error) as any[];

    const counts = await listAttachmentCounts(movements.map((row: any) => row.id));
    const categoryMap = new Map((categories as any[]).map((category: any) => [category.id, category.name]));

    return movements.map((movement: any) => ({
      ...movement,
      category_name: categoryMap.get(movement.category_id) || movement.category || "",
      attachments_count: counts[movement.id] || 0,
    }));
  };

  const getProjectReport = async (projectId: string, filters: ReportFilters = {}) =>
    getReportBase({ projectId }, filters);

  const getFundReport = async (fundId: string, filters: ReportFilters = {}) =>
    getReportBase({ fundId }, filters);

  const listBudgetItemsByProject = async (projectId: string) => {
    const res = await supabase.from("budget_items").select("*").eq("project_id", projectId);
    return ensure(res.data ?? [], res.error);
  };

  const listBudgetItemsByFund = async (fundId: string) => {
    const res = await supabase.from("budget_items").select("*").eq("fund_id", fundId);
    return ensure(res.data ?? [], res.error);
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

    getDashboardAggregates,

    createMovement,
    updateMovement,
    deleteMovement,
    deleteMovementCascade,

    listCategories,

    listAttachments,
    listAttachmentCounts,
    listAttachmentsForMovementIds,
    listAttachmentsForMovements: listAttachmentsForMovementIds,

    uploadAttachment,
    deleteAttachment,
    getSignedUrl,

    getProjectReport,
    getFundReport,

    listBudgetItemsByProject,
    listBudgetItemsByFund,
  };
}
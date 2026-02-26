import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DashboardData, FinanceAttachment, FinanceStatus, FinanceiroFundo, FinanceiroMovimentacao, FinanceiroProjeto } from '../data/financeiro.repo';

type AnyRow = Record<string, unknown>;

type MovementStatus = 'pago' | 'pendente' | 'cancelado';
type MovementType = 'entrada' | 'saida';
type PayMethod = 'pix' | 'transferencia' | 'dinheiro';

export type FundPayload = {
  name: string;
  year: number;
  description: string;
  opening_balance: number;
  status: Extract<FinanceStatus, 'ativo' | 'concluido' | 'cancelado'>;
};

export type ProjectPayload = {
  name: string;
  year: number;
  description: string;
  fund_id: string;
  initial_amount: number;
  status: Extract<FinanceStatus, 'em_andamento' | 'concluido' | 'cancelado'>;
};

export type MovementPayload = {
  date: string;
  type: MovementType;
  project_id?: string;
  fund_id?: string;
  category_id?: string;
  title?: string;
  category?: string;
  description: string;
  unit_value: number;
  quantity: number;
  total_value?: number;
  status: MovementStatus;
  pay_method: PayMethod;
  beneficiary?: string;
  notes?: string;
  doc_type?: string;
  doc_number?: string;
  cost_center?: string;
};

export type FinanceCategory = {
  id: string;
  name: string;
  color?: string;
};

export type MovementFilters = {
  fundId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  status?: MovementStatus;
  limit?: number;
};

export type ReportFilters = {
  startDate?: string;
  endDate?: string;
  type?: MovementType | 'todos';
  status?: MovementStatus | 'todos';
  fundId?: string;
  projectId?: string;
  categoryId?: string;
};

const toNumber = (value: unknown) => Number(value) || 0;

const ensure = (error: { message?: string } | null, fallbackMessage: string) => {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
};

const normalizeStatus = (value: unknown, fallback: FinanceStatus): FinanceStatus => {
  const status = `${value ?? ''}`.toLowerCase();
  if (['pago', 'pendente', 'cancelado', 'ativo', 'em_andamento', 'concluido'].includes(status)) return status as FinanceStatus;
  if (status === 'active') return 'ativo';
  if (status === 'done') return 'concluido';
  if (status === 'in_progress') return 'em_andamento';
  if (status === 'paid') return 'pago';
  return fallback;
};

const normalizeMovementStatus = (value: unknown): MovementStatus => {
  const status = `${value ?? ''}`.toLowerCase();
  if (status === 'pago' || status === 'pendente' || status === 'cancelado') return status;
  return 'pendente';
};

const normalizeType = (value: unknown): MovementType => (`${value ?? ''}`.toLowerCase() === 'entrada' ? 'entrada' : 'saida');

const normalizePayMethod = (value: unknown): PayMethod => {
  const method = `${value ?? ''}`.toLowerCase();
  if (method === 'pix' || method === 'transferencia' || method === 'dinheiro') return method;
  if (method === 'transferência') return 'transferencia';
  return 'pix';
};

const monthKey = (value: string) => value.slice(0, 7);

const mapAttachment = (row: AnyRow): FinanceAttachment => ({
  id: String(row.id ?? ''),
  movement_id: String(row.movement_id ?? ''),
  file_name: String(row.file_name ?? 'arquivo'),
  mime_type: String(row.mime_type ?? 'application/octet-stream'),
  file_size: toNumber(row.file_size),
  storage_path: String(row.storage_path ?? ''),
  public_url: row.public_url ? String(row.public_url) : undefined,
  created_at: String(row.created_at ?? new Date().toISOString()),
});

const mapFund = (row: AnyRow): FinanceiroFundo => {
  const totalOrcado = toNumber(row.total_orcado ?? row.opening_balance);
  const saldoInicial = toNumber(row.saldo_inicial ?? row.opening_balance);
  const saldoAtual = toNumber(row.saldo_atual ?? row.current_balance ?? saldoInicial);
  const totalEntradas = toNumber(row.total_entradas);
  const totalSaidas = toNumber(row.total_saidas);
  const totalGasto = toNumber(row.total_gasto ?? totalSaidas);

  return {
    id: String(row.id),
    nome: String(row.nome ?? row.name ?? 'Sem nome'),
    ano: Number(row.ano ?? row.year ?? new Date().getFullYear()),
    totalOrcado,
    saldoInicial,
    saldoAtual,
    totalGasto,
    totalEntradas,
    totalSaidas,
    status: normalizeStatus(row.status, 'ativo'),
    execucao: totalOrcado > 0 ? Math.min(100, (totalGasto / totalOrcado) * 100) : 0,
  };
};

const mapProject = (row: AnyRow, fundsById: Map<string, string>): FinanceiroProjeto => {
  const totalOrcado = toNumber(row.initial_amount ?? row.total_orcado);
  const saldoDisponivel = toNumber(row.current_balance ?? row.saldo_disponivel);
  const gastoReal = Math.max(0, totalOrcado - saldoDisponivel);
  const fundoId = String(row.fund_id ?? '');

  return {
    id: String(row.id),
    nome: String(row.name ?? row.nome ?? 'Sem nome'),
    fundo: fundsById.get(fundoId) ?? String(row.funder ?? '—'),
    fundoId,
    saldoDisponivel,
    totalOrcado,
    gastoReal,
    diferenca: gastoReal - totalOrcado,
    execucao: totalOrcado > 0 ? Math.min(100, (gastoReal / totalOrcado) * 100) : 0,
    status: normalizeStatus(row.status, 'em_andamento'),
  };
};

const mapMovement = (row: AnyRow): FinanceiroMovimentacao => ({
  id: String(row.id),
  data: String(row.date ?? row.created_at ?? new Date().toISOString()),
  tipo: normalizeType(row.type),
  titulo: String(row.title ?? row.description ?? 'Sem título'),
  descricao: String(row.description ?? row.title ?? 'Sem descrição'),
  valorUnitario: toNumber(row.unit_value),
  quantidade: toNumber(row.quantity || 1),
  valorTotal: toNumber(row.total_value),
  status: normalizeMovementStatus(row.status),
  projetoNome: String((row.project as AnyRow | undefined)?.name ?? row.project_name ?? '—'),
  projetoId: String(row.project_id ?? ''),
  fundo: String((row.fund as AnyRow | undefined)?.name ?? row.fund_name ?? '—'),
  fundoId: String(row.fund_id ?? ''),
  categoria: String((row.category as AnyRow | undefined)?.name ?? row.category_name ?? 'Sem categoria'),
  categoriaId: row.category_id ? String(row.category_id) : '',
  payMethod: normalizePayMethod(row.pay_method),
  beneficiary: String(row.beneficiary ?? ''),
  notes: String(row.notes ?? ''),
  docType: String(row.doc_type ?? ''),
  docNumber: String(row.doc_number ?? ''),
  costCenter: String(row.cost_center ?? ''),
  attachmentsCount: toNumber(row.attachments_count),
  comprovantes: Array.isArray(row.attachments) ? row.attachments.map((item) => mapAttachment(item as AnyRow)) : [],
});

const movementSelect = 'id,date,type,fund_id,project_id,title,description,unit_value,quantity,total_value,status,category_id,pay_method,beneficiary,notes,doc_type,doc_number,cost_center,created_at,project:finance_projects(id,name),fund:finance_funds(id,name),category:finance_categories(id,name,color),attachments:finance_attachments(*)';

const buildMovementsQuery = (filters?: MovementFilters) => {
  let query = supabase.from('finance_movements').select(movementSelect);
  if (filters?.fundId) query = query.eq('fund_id', filters.fundId);
  if (filters?.projectId) query = query.eq('project_id', filters.projectId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.startDate) query = query.gte('date', filters.startDate);
  if (filters?.endDate) query = query.lte('date', filters.endDate);
  query = query.order('date', { ascending: false });
  if (filters?.limit) query = query.limit(filters.limit);
  return query;
};

const createEmptyDashboard = (): DashboardData => ({
  kpis: {
    totalFunds: 0,
    totalProjects: 0,
    currentBalanceFunds: 0,
    currentBalanceProjects: 0,
    totalInPaid: 0,
    totalOutPaid: 0,
    totalPending: 0,
    totalMovements: 0,
    budgetTotal: 0,
    budgetReal: 0,
    executionPct: 0,
    attachmentsPct: 0,
    noDocumentCount: 0,
  },
  cashflowLine: [],
  budgetVsReal: [],
  categoryPie: [],
  latestMovements: [],
  entradas: 0,
  saidas: 0,
  saldoAtual: 0,
  pendencias: 0,
  fluxoCaixa: [],
  distribuicaoCategoria: [],
  orcadoVsReal: [],
});

export function useFinanceSupabase() {
  const [funds, setFunds] = useState<FinanceiroFundo[]>([]);
  const [projects, setProjects] = useState<FinanceiroProjeto[]>([]);
  const [movements, setMovements] = useState<FinanceiroMovimentacao[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>(createEmptyDashboard());
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listFunds = useCallback(async () => {
    const { data, error: fundsError } = await supabase.from('finance_funds').select('*').order('year', { ascending: false });
    ensure(fundsError, 'Falha ao listar fundos.');
    return (data || []).map(mapFund);
  }, []);

  const listProjects = useCallback(async (fundItems?: FinanceiroFundo[]) => {
    const { data, error: projectsError } = await supabase.from('finance_projects').select('*').order('created_at', { ascending: false });
    ensure(projectsError, 'Falha ao listar projetos.');
    const list = fundItems ?? [];
    const byId = new Map(list.map((f) => [f.id, f.nome]));
    return (data || []).map((row) => mapProject(row as AnyRow, byId));
  }, []);

  const listCategories = useCallback(async () => {
    const { data, error: categoriesError } = await supabase.from('finance_categories').select('id,name,color').order('name', { ascending: true });
    ensure(categoriesError, 'Falha ao listar categorias.');
    return (data || []).map((item) => ({ id: String(item.id), name: String(item.name), color: item.color ? String(item.color) : undefined }));
  }, []);

  const listAttachments = useCallback(async (movementId: string) => {
    const { data, error: attachmentsError } = await supabase.from('finance_attachments').select('*').eq('movement_id', movementId).order('created_at', { ascending: false });
    ensure(attachmentsError, 'Falha ao listar anexos.');
    return (data || []).map((row) => mapAttachment(row as AnyRow));
  }, []);

  const listMovements = useCallback(async (filters?: MovementFilters) => {
    const { data, error: movementsError } = await buildMovementsQuery(filters);
    ensure(movementsError, 'Falha ao listar movimentações.');
    return (data || []).map((row) => mapMovement(row as AnyRow));
  }, []);

  const listLatestMovements = useCallback(async (limit = 10) => listMovements({ limit }), [listMovements]);

  const buildMonths = (months: number, endDate?: Date) => {
    const periods: string[] = [];
    const now = endDate ?? new Date();
    for (let i = months - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(date.toISOString().slice(0, 7));
    }
    return periods;
  };

  const getDashboardAggregates = useCallback(async ({ months = 6 }: { months?: number } = {}): Promise<DashboardData> => {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - (months - 1), 1);
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);

    const [
      fundsRes,
      projectsRes,
      categoriesRes,
      movementsRes,
      budgetRes,
    ] = await Promise.all([
      supabase.from('finance_funds').select('id,current_balance'),
      supabase.from('finance_projects').select('id,current_balance'),
      supabase.from('finance_categories').select('id,name,color'),
      supabase
        .from('finance_movements')
        .select('id,date,type,description,fund_id,project_id,total_value,status,category_id,created_at')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('finance_budget_items')
        .select('id,total_value,start_date,created_at,year,category_id')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`),
    ]);

    ensure(fundsRes.error, 'Falha ao carregar fundos do dashboard.');
    ensure(projectsRes.error, 'Falha ao carregar projetos do dashboard.');
    ensure(categoriesRes.error, 'Falha ao carregar categorias do dashboard.');
    ensure(movementsRes.error, 'Falha ao carregar movimentações do dashboard.');
    ensure(budgetRes.error, 'Falha ao carregar orçamento do dashboard.');

    const movementRows = (movementsRes.data || []) as AnyRow[];
    const categoriesMap = new Map((categoriesRes.data || []).map((item) => [String(item.id), String(item.name)]));
    const monthsList = buildMonths(months, endDate);

    const totalFunds = (fundsRes.data || []).length;
    const totalProjects = (projectsRes.data || []).length;
    const currentBalanceFunds = (fundsRes.data || []).reduce((acc, row) => acc + toNumber(row.current_balance), 0);
    const currentBalanceProjects = (projectsRes.data || []).reduce((acc, row) => acc + toNumber(row.current_balance), 0);

    const paidIn = movementRows.filter((m) => m.status === 'pago' && m.type === 'entrada');
    const paidOut = movementRows.filter((m) => m.status === 'pago' && m.type === 'saida');
    const pending = movementRows.filter((m) => m.status === 'pendente');

    const totalInPaid = paidIn.reduce((acc, row) => acc + toNumber(row.total_value), 0);
    const totalOutPaid = paidOut.reduce((acc, row) => acc + toNumber(row.total_value), 0);
    const totalPending = pending.length;
    const totalMovements = movementRows.length;

    const movementsMap = new Map<string, { mes: string; entradas: number; saidas: number }>();
    const realBudgetMap = new Map<string, number>();
    const categoryPieMap = new Map<string, number>();

    for (const row of movementRows) {
      const rawDate = String(row.date || row.created_at || new Date().toISOString());
      const mes = monthKey(rawDate);
      const flow = movementsMap.get(mes) || { mes, entradas: 0, saidas: 0 };
      const value = toNumber(row.total_value);
      if (row.status === 'pago' && row.type === 'entrada') flow.entradas += value;
      if (row.status === 'pago' && row.type === 'saida') {
        flow.saidas += value;
        realBudgetMap.set(mes, (realBudgetMap.get(mes) || 0) + value);
        const cat = row.category_id ? categoriesMap.get(String(row.category_id)) || 'Sem categoria' : 'Sem categoria';
        categoryPieMap.set(cat, (categoryPieMap.get(cat) || 0) + value);
      }
      movementsMap.set(mes, flow);
    }

    const budgetItems = (budgetRes.data || []) as AnyRow[];
    const budgetMap = new Map<string, number>();
    for (const item of budgetItems) {
      const monthSource = String(item.start_date || item.created_at || '');
      if (!monthSource) continue;
      const key = monthKey(monthSource);
      if (!monthsList.includes(key)) continue;
      budgetMap.set(key, (budgetMap.get(key) || 0) + toNumber(item.total_value));
    }

    const budgetTotal = Array.from(budgetMap.values()).reduce((a, b) => a + b, 0);
    const budgetReal = totalOutPaid;
    const executionPct = budgetTotal > 0 ? (budgetReal / budgetTotal) * 100 : 0;

    const movementIds = movementRows.map((m) => String(m.id));
    let attachmentsByMovement = new Map<string, number>();
    if (movementIds.length > 0) {
      const { data: attachmentRows, error: attachmentErr } = await supabase
        .from('finance_attachments')
        .select('movement_id')
        .in('movement_id', movementIds);
      ensure(attachmentErr, 'Falha ao carregar anexos do dashboard.');
      attachmentsByMovement = new Map();
      (attachmentRows || []).forEach((row) => {
        const id = String(row.movement_id);
        attachmentsByMovement.set(id, (attachmentsByMovement.get(id) || 0) + 1);
      });
    }

    const movementsPaidTotal = movementRows.filter((m) => m.status === 'pago').length;
    const movementsPaidWithAttachment = movementRows.filter((m) => m.status === 'pago' && (attachmentsByMovement.get(String(m.id)) || 0) > 0).length;
    const attachmentsPct = movementsPaidTotal > 0 ? (movementsPaidWithAttachment / movementsPaidTotal) * 100 : 0;
    const noDocumentCount = movementRows.filter((m) => (m.status === 'pago' || m.status === 'pendente') && (attachmentsByMovement.get(String(m.id)) || 0) === 0).length;

    const cashflowLine = monthsList.map((mes) => movementsMap.get(mes) || { mes, entradas: 0, saidas: 0 });
    const budgetVsReal = monthsList.map((mes) => ({ mes, orcado: budgetMap.get(mes) || 0, real: realBudgetMap.get(mes) || 0 }));
    const categoryPie = Array.from(categoryPieMap.entries()).map(([name, value]) => ({ name, value }));

    const latestMovements = movementRows.slice(0, 10).map((row) => ({
      id: String(row.id),
      date: String(row.date || row.created_at || new Date().toISOString()),
      type: normalizeType(row.type),
      description: String(row.description || ''),
      fund_id: row.fund_id ? String(row.fund_id) : undefined,
      project_id: row.project_id ? String(row.project_id) : undefined,
      total_value: toNumber(row.total_value),
      status: normalizeMovementStatus(row.status),
      category_id: row.category_id ? String(row.category_id) : undefined,
      category_name: row.category_id ? categoriesMap.get(String(row.category_id)) || 'Sem categoria' : 'Sem categoria',
      attachments_count: attachmentsByMovement.get(String(row.id)) || 0,
    }));

    return {
      kpis: {
        totalFunds,
        totalProjects,
        currentBalanceFunds,
        currentBalanceProjects,
        totalInPaid,
        totalOutPaid,
        totalPending,
        totalMovements,
        budgetTotal,
        budgetReal,
        executionPct,
        attachmentsPct,
        noDocumentCount,
      },
      cashflowLine,
      budgetVsReal,
      categoryPie,
      latestMovements,
      entradas: totalInPaid,
      saidas: totalOutPaid,
      saldoAtual: currentBalanceFunds,
      pendencias: totalPending,
      fluxoCaixa: cashflowLine.map((item) => ({ periodo: item.mes, entradas: item.entradas, saidas: item.saidas })),
      distribuicaoCategoria: categoryPie.map((item) => ({ categoria: item.name, valor: item.value })),
      orcadoVsReal: budgetVsReal.map((item) => ({ periodo: item.mes, orcado: item.orcado, real: item.real })),
    };
  }, []);

  const getMovementsReport = useCallback(async (filters: ReportFilters) => {
    let query = supabase
      .from('finance_movements')
      .select('id,date,type,description,fund_id,project_id,total_value,status,category_id,unit_value,quantity,pay_method,beneficiary,cost_center,doc_type,doc_number,created_at,fund:finance_funds(name),project:finance_projects(name),category:finance_categories(name)')
      .order('date', { ascending: false });

    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.type && filters.type !== 'todos') query = query.eq('type', filters.type);
    if (filters.status && filters.status !== 'todos') query = query.eq('status', filters.status);
    if (filters.fundId) query = query.eq('fund_id', filters.fundId);
    if (filters.projectId) query = query.eq('project_id', filters.projectId);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);

    const { data, error: reportError } = await query;
    ensure(reportError, 'Falha ao gerar relatório.');

    const rows = (data || []) as AnyRow[];
    const ids = rows.map((row) => String(row.id));
    const attachmentMap = await listAttachmentsForMovementIds(ids);

    return rows.map((row) => ({
      id: String(row.id),
      date: String(row.date ?? row.created_at ?? ''),
      type: normalizeType(row.type),
      description: String(row.description ?? ''),
      fundName: String((row.fund as AnyRow | undefined)?.name ?? '—'),
      projectName: String((row.project as AnyRow | undefined)?.name ?? '—'),
      categoryName: String((row.category as AnyRow | undefined)?.name ?? 'Sem categoria'),
      totalValue: toNumber(row.total_value),
      status: normalizeMovementStatus(row.status),
      beneficiary: String(row.beneficiary ?? ''),
      payMethod: normalizePayMethod(row.pay_method),
      costCenter: String(row.cost_center ?? ''),
      doc: [String(row.doc_type ?? ''), String(row.doc_number ?? '')].filter(Boolean).join(' '),
      quantity: toNumber(row.quantity),
      unitValue: toNumber(row.unit_value),
      attachmentsCount: attachmentMap.get(String(row.id)) || 0,
    }));
  }, [listAttachmentsForMovementIds]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fundsList = await listFunds();
      const [projectsList, categoriesList, aggregates] = await Promise.all([listProjects(fundsList), listCategories(), getDashboardAggregates({ months: 6 })]);
      setFunds(fundsList);
      setProjects(projectsList);
      setMovements(aggregates.latestMovements.map((row) => ({
        id: row.id,
        data: row.date,
        tipo: row.type,
        titulo: row.description,
        descricao: row.description,
        valorUnitario: row.total_value,
        quantidade: 1,
        valorTotal: row.total_value,
        status: row.status,
        projetoNome: '—',
        projetoId: row.project_id || '',
        fundo: '—',
        fundoId: row.fund_id || '',
        categoria: row.category_name,
        categoriaId: row.category_id || '',
        payMethod: 'pix',
        beneficiary: '',
        notes: '',
        docType: '',
        docNumber: '',
        costCenter: '',
        attachmentsCount: row.attachments_count,
        comprovantes: [],
      })));
      setCategories(categoriesList);
      setDashboard(aggregates);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getDashboardAggregates, listCategories, listProjects, listFunds]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAndReload = useCallback(async <T,>(runner: () => Promise<T>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await runner();
      await load();
      return result;
    } catch (runnerError) {
      const message = (runnerError as Error).message || 'Falha ao salvar.';
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [load]);

  const createFund = useCallback(async (payload: FundPayload) => runAndReload(async () => {
    const { error: createError } = await supabase.from('finance_funds').insert({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') });
    ensure(createError, 'Falha ao criar fundo.');
    return true;
  }), [runAndReload]);

  const updateFund = useCallback(async (id: string, payload: FundPayload) => runAndReload(async () => {
    const { error: updateError } = await supabase.from('finance_funds').update({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') }).eq('id', id);
    ensure(updateError, 'Falha ao atualizar fundo.');
    return true;
  }), [runAndReload]);

  const deleteFund = useCallback(async (id: string) => runAndReload(async () => {
    const { error: deleteError } = await supabase.from('finance_funds').delete().eq('id', id);
    ensure(deleteError, 'Falha ao excluir fundo.');
    return true;
  }), [runAndReload]);

  const createProject = useCallback(async (payload: ProjectPayload) => runAndReload(async () => {
    const { error: createError } = await supabase.from('finance_projects').insert({ ...payload, initial_amount: toNumber(payload.initial_amount), current_balance: toNumber(payload.initial_amount), status: normalizeStatus(payload.status, 'em_andamento') });
    ensure(createError, 'Falha ao criar projeto.');
    return true;
  }), [runAndReload]);

  const updateProject = useCallback(async (id: string, payload: ProjectPayload) => runAndReload(async () => {
    const { error: updateError } = await supabase.from('finance_projects').update({ ...payload, initial_amount: toNumber(payload.initial_amount), status: normalizeStatus(payload.status, 'em_andamento') }).eq('id', id);
    ensure(updateError, 'Falha ao atualizar projeto.');
    return true;
  }), [runAndReload]);

  const deleteProject = useCallback(async (id: string) => runAndReload(async () => {
    const { error: deleteError } = await supabase.from('finance_projects').delete().eq('id', id);
    ensure(deleteError, 'Falha ao excluir projeto.');
    return true;
  }), [runAndReload]);

  const toMovementDbPayload = (payload: MovementPayload) => {
    const qty = Math.max(1, toNumber(payload.quantity || 1));
    const unit = toNumber(payload.unit_value);
    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim();
    if (!title) throw new Error('Título é obrigatório.');
    if (!description) throw new Error('Descrição é obrigatória.');
    if (!payload.fund_id && !payload.project_id) throw new Error('Selecione ao menos um fundo ou projeto.');

    let categoryId = payload.category_id;
    if (!categoryId && payload.category) {
      const normalized = payload.category.toLowerCase();
      const found = categories.find((item) => item.name.toLowerCase() === normalized);
      categoryId = found?.id;
    }

    return {
      date: payload.date,
      type: normalizeType(payload.type),
      fund_id: payload.fund_id || null,
      project_id: payload.project_id || null,
      category_id: categoryId || null,
      title,
      description,
      unit_value: unit,
      quantity: qty,
      total_value: payload.total_value !== undefined ? toNumber(payload.total_value) : unit * qty,
      status: normalizeMovementStatus(payload.status),
      pay_method: normalizePayMethod(payload.pay_method),
      beneficiary: payload.beneficiary || null,
      notes: payload.notes || null,
      doc_type: payload.doc_type || null,
      doc_number: payload.doc_number || null,
      cost_center: payload.cost_center || null,
    };
  };

  const insertMovement = async (payload: MovementPayload) => {
    const base = toMovementDbPayload(payload);
    const result = await supabase.from('finance_movements').insert(base).select('id').single();
    ensure(result.error, 'Falha ao criar movimentação.');
    return String(result.data.id);
  };

  const createMovement = useCallback(async (payload: MovementPayload) => runAndReload(async () => {
    const movementId = await insertMovement(payload);
    const list = await listMovements();
    const created = list.find((m) => m.id === movementId) ?? { id: movementId };
    return created;
  }), [runAndReload, listMovements]);

  const updateMovement = useCallback(async (id: string, payload: MovementPayload) => runAndReload(async () => {
    const base = toMovementDbPayload(payload);
    const result = await supabase.from('finance_movements').update(base).eq('id', id);
    ensure(result.error, 'Falha ao atualizar movimentação.');
    return true;
  }), [runAndReload]);

  const getSignedUrl = useCallback(async (storagePath: string) => {
    const { data, error: signedError } = await supabase.storage.from('finance-attachments').createSignedUrl(storagePath, 60 * 10);
    ensure(signedError, 'Falha ao gerar URL assinada.');
    return data.signedUrl;
  }, []);

  const uploadAttachment = useCallback(async (file: File, context: { movementId: string; fundId?: string; projectId?: string }) => {
    const { movementId, fundId, projectId } = context;
    const safeName = file.name.replaceAll(' ', '_');
    const path = `${fundId || 'sem-fundo'}/${projectId || 'sem-projeto'}/${movementId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('finance-attachments').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    ensure(uploadError, 'Falha ao enviar anexo para o storage.');
    const { error: insertError } = await supabase.from('finance_attachments').insert({ movement_id: movementId, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size });
    ensure(insertError, 'Falha ao registrar metadados do anexo.');
    return true;
  }, []);

  const listAttachmentsForMovementIds = useCallback(async (movementIds: string[]) => {
    if (movementIds.length === 0) return new Map<string, number>();
    const { data, error: attachmentsError } = await supabase
      .from('finance_attachments')
      .select('movement_id')
      .in('movement_id', movementIds);
    ensure(attachmentsError, 'Falha ao listar anexos das movimentações.');
    const map = new Map<string, number>();
    (data || []).forEach((row) => {
      const key = String(row.movement_id);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, []);

  const deleteAttachment = useCallback(async (attachmentId: string) => runAndReload(async () => {
    const { data, error: readError } = await supabase.from('finance_attachments').select('id,storage_path').eq('id', attachmentId).single();
    ensure(readError, 'Falha ao localizar anexo para exclusão.');
    const storagePath = String(data.storage_path || '');
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from('finance-attachments').remove([storagePath]);
      ensure(storageError, 'Falha ao remover arquivo do storage.');
    }
    const { error: deleteError } = await supabase.from('finance_attachments').delete().eq('id', attachmentId);
    ensure(deleteError, 'Falha ao excluir metadados do anexo.');
    return true;
  }), [runAndReload]);

  const deleteMovementCascade = useCallback(async (id: string) => runAndReload(async () => {
    const attachments = await listAttachments(id);
    const paths = attachments.map((item) => item.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('finance-attachments').remove(paths);
      ensure(removeError, 'Falha ao remover anexos da movimentação.');
      const { error: attachmentsError } = await supabase.from('finance_attachments').delete().eq('movement_id', id);
      ensure(attachmentsError, 'Falha ao excluir anexos da movimentação.');
    }
    const { error: movementError } = await supabase.from('finance_movements').delete().eq('id', id);
    ensure(movementError, 'Falha ao excluir movimentação.');
    return true;
  }), [listAttachments, runAndReload]);

  return {
    funds,
    projects,
    movements,
    dashboard,
    categories,
    loading,
    saving,
    error,
    load,
    listFunds,
    createFund,
    updateFund,
    deleteFund,
    listProjects,
    createProject,
    updateProject,
    deleteProject,
    listMovements,
    listLatestMovements,
    getDashboardAggregates,
    getMovementsReport,
    listCategories,
    createMovement,
    updateMovement,
    uploadAttachment,
    deleteAttachment,
    listAttachments,
    listAttachmentsForMovementIds,
    getSignedUrl,
    deleteMovementCascade,
  };
}

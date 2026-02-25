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
  fund_id: string;
  title: string;
  description: string;
  unit_value: number;
  quantity: number;
  status: MovementStatus;
  category_id?: string;
  pay_method: PayMethod;
  beneficiary: string;
  notes: string;
};

export type FinanceCategory = {
  id: string;
  name: string;
};

export type MovementFilters = {
  fundId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  status?: MovementStatus;
  limit?: number;
};

const toNumber = (value: unknown) => Number(value) || 0;

const normalizeStatus = (value: unknown, fallback: FinanceStatus): FinanceStatus => {
  const status = String(value || '').trim().toLowerCase();
  if (['pago', 'pendente', 'cancelado', 'ativo', 'em_andamento', 'concluido'].includes(status)) return status as FinanceStatus;
  if (status === 'active') return 'ativo';
  if (status === 'done') return 'concluido';
  if (status === 'in_progress') return 'em_andamento';
  if (status === 'paid') return 'pago';
  return fallback;
};

const normalizeMovementStatus = (value: unknown): MovementStatus => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'pago' || status === 'pendente' || status === 'cancelado') return status;
  return 'pendente';
};

const normalizeType = (value: unknown): MovementType => {
  const type = String(value || '').trim().toLowerCase();
  return type === 'entrada' ? 'entrada' : 'saida';
};

const normalizePayMethod = (value: unknown): PayMethod => {
  const method = String(value || '').trim().toLowerCase();
  if (method === 'pix' || method === 'transferencia' || method === 'dinheiro') return method;
  if (method === 'transferência') return 'transferencia';
  return 'pix';
};

const isMissingColumnError = (message: string | undefined, column: string) =>
  Boolean(message?.toLowerCase().includes(`column`) && message?.toLowerCase().includes(column.toLowerCase()));

const mapAttachment = (row: AnyRow): FinanceAttachment => ({
  id: String(row.id ?? ''),
  movement_id: String(row.movement_id ?? ''),
  file_name: String(row.file_name ?? 'arquivo'),
  mime_type: String(row.mime_type ?? 'application/octet-stream'),
  file_size: toNumber(row.file_size),
  storage_path: String(row.storage_path ?? ''),
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
  categoriaId: String(row.category_id ?? ''),
  payMethod: normalizePayMethod(row.pay_method),
  beneficiary: String(row.beneficiary ?? ''),
  notes: String(row.notes ?? ''),
  attachmentsCount: toNumber(row.attachments_count),
  comprovantes: Array.isArray(row.attachments) ? row.attachments.map((item) => mapAttachment(item as AnyRow)) : [],
});

const movementSelect = 'id,date,type,fund_id,project_id,title,description,unit_value,quantity,total_value,status,category_id,pay_method,beneficiary,notes,created_at,project:finance_projects(id,name),fund:finance_funds(id,name),category:finance_categories(id,name),attachments:finance_attachments(*)';

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

export function useFinanceSupabase() {
  const [funds, setFunds] = useState<FinanceiroFundo[]>([]);
  const [projects, setProjects] = useState<FinanceiroProjeto[]>([]);
  const [movements, setMovements] = useState<FinanceiroMovimentacao[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({ entradas: 0, saidas: 0, saldoAtual: 0, pendencias: 0, fluxoCaixa: [], distribuicaoCategoria: [], orcadoVsReal: [] });
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listFunds = useCallback(async () => {
    const { data, error: fundsError } = await supabase.from('finance_funds').select('*').order('year', { ascending: false });
    if (fundsError) throw fundsError;
    return (data || []).map(mapFund);
  }, []);

  const listProjects = useCallback(async (fundItems?: FinanceiroFundo[]) => {
    const { data, error: projectsError } = await supabase.from('finance_projects').select('*').order('created_at', { ascending: false });
    if (projectsError) throw projectsError;
    const list = fundItems ?? funds;
    const byId = new Map(list.map((f) => [f.id, f.nome]));
    return (data || []).map((row) => mapProject(row as AnyRow, byId));
  }, [funds]);

  const listCategories = useCallback(async () => {
    const { data, error: categoriesError } = await supabase.from('finance_categories').select('id,name').order('name', { ascending: true });
    if (categoriesError) throw categoriesError;
    return (data || []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  }, []);

  const listAttachments = useCallback(async (movementId: string) => {
    const { data, error: attachmentsError } = await supabase.from('finance_attachments').select('*').eq('movement_id', movementId).order('created_at', { ascending: false });
    if (attachmentsError) throw attachmentsError;
    return (data || []).map((row) => mapAttachment(row as AnyRow));
  }, []);

  const listMovements = useCallback(async (filters?: MovementFilters) => {
    const { data, error: movementsError } = await buildMovementsQuery(filters);
    if (movementsError) throw movementsError;
    return (data || []).map((row) => mapMovement(row as AnyRow));
  }, []);

  const listLatestMovements = useCallback(async () => listMovements({ limit: 10 }), [listMovements]);

  const getDashboardAggregates = useCallback(async (): Promise<DashboardData> => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 5);
    const [latestMovements, fundsList, budgetRes] = await Promise.all([
      listMovements({ startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10) }),
      listFunds(),
      supabase.from('finance_budget_items').select('*').gte('date', startDate.toISOString().slice(0, 10)).lte('date', endDate.toISOString().slice(0, 10)),
    ]);

    const paid = latestMovements.filter((m) => m.status === 'pago');
    const entradas = paid.filter((m) => m.tipo === 'entrada').reduce((acc, m) => acc + m.valorTotal, 0);
    const saidas = paid.filter((m) => m.tipo === 'saida').reduce((acc, m) => acc + m.valorTotal, 0);
    const pendencias = latestMovements.filter((m) => m.status === 'pendente').length;
    const saldoAtual = fundsList.reduce((acc, item) => acc + item.saldoAtual, 0) || entradas - saidas;

    const fluxoMap = new Map<string, { periodo: string; entradas: number; saidas: number }>();
    const pizzaMap = new Map<string, number>();

    for (const row of paid) {
      const month = row.data.slice(0, 7);
      const current = fluxoMap.get(month) ?? { periodo: month, entradas: 0, saidas: 0 };
      if (row.tipo === 'entrada') current.entradas += row.valorTotal;
      if (row.tipo === 'saida') current.saidas += row.valorTotal;
      fluxoMap.set(month, current);
      if (row.tipo === 'saida') pizzaMap.set(row.categoria || 'Sem categoria', (pizzaMap.get(row.categoria || 'Sem categoria') ?? 0) + row.valorTotal);
    }

    const realMap = new Map<string, number>();
    for (const row of paid.filter((m) => m.tipo === 'saida')) {
      const month = row.data.slice(0, 7);
      realMap.set(month, (realMap.get(month) ?? 0) + row.valorTotal);
    }

    const budgetMap = new Map<string, number>();
    if (!budgetRes.error) {
      for (const row of budgetRes.data || []) {
        const period = String((row as AnyRow).date ?? (row as AnyRow).periodo ?? '').slice(0, 7);
        if (!period) continue;
        const value = toNumber((row as AnyRow).value ?? (row as AnyRow).valor ?? (row as AnyRow).planned_value);
        budgetMap.set(period, (budgetMap.get(period) ?? 0) + value);
      }
    }

    const periods = Array.from(new Set([...realMap.keys(), ...budgetMap.keys(), ...fluxoMap.keys()])).sort();

    return {
      entradas,
      saidas,
      saldoAtual,
      pendencias,
      fluxoCaixa: Array.from(fluxoMap.values()).sort((a, b) => a.periodo.localeCompare(b.periodo)),
      distribuicaoCategoria: Array.from(pizzaMap.entries()).map(([categoria, valor]) => ({ categoria, valor })),
      orcadoVsReal: periods.map((periodo) => ({ periodo, orcado: budgetMap.get(periodo) ?? 0, real: realMap.get(periodo) ?? 0 })),
    };
  }, [listFunds, listMovements]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fundsList = await listFunds();
      const [projectsList, latest, categoriesList, aggregates] = await Promise.all([
        listProjects(fundsList),
        listLatestMovements(),
        listCategories(),
        getDashboardAggregates(),
      ]);
      setFunds(fundsList);
      setProjects(projectsList);
      setMovements(latest);
      setCategories(categoriesList);
      setDashboard(aggregates);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getDashboardAggregates, listCategories, listLatestMovements, listProjects, listFunds]);

  useEffect(() => { void load(); }, [load]);

  const runAndReload = useCallback(async (runner: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await runner();
      await load();
      return true;
    } catch (runnerError) {
      setError((runnerError as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [load]);

  const createFund = useCallback(async (payload: FundPayload) => runAndReload(async () => {
    const { error: createError } = await supabase.from('finance_funds').insert({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') });
    if (createError) throw createError;
  }), [runAndReload]);

  const updateFund = useCallback(async (id: string, payload: FundPayload) => runAndReload(async () => {
    const { error: updateError } = await supabase.from('finance_funds').update({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') }).eq('id', id);
    if (updateError) throw updateError;
  }), [runAndReload]);

  const deleteFund = useCallback(async (id: string) => runAndReload(async () => {
    const { error: deleteError } = await supabase.from('finance_funds').delete().eq('id', id);
    if (deleteError) throw deleteError;
  }), [runAndReload]);

  const createProject = useCallback(async (payload: ProjectPayload) => runAndReload(async () => {
    const { error: createError } = await supabase.from('finance_projects').insert({ ...payload, initial_amount: toNumber(payload.initial_amount), current_balance: toNumber(payload.initial_amount), status: normalizeStatus(payload.status, 'em_andamento') });
    if (createError) throw createError;
  }), [runAndReload]);

  const updateProject = useCallback(async (id: string, payload: ProjectPayload) => runAndReload(async () => {
    const { error: updateError } = await supabase.from('finance_projects').update({ ...payload, initial_amount: toNumber(payload.initial_amount), status: normalizeStatus(payload.status, 'em_andamento') }).eq('id', id);
    if (updateError) throw updateError;
  }), [runAndReload]);

  const deleteProject = useCallback(async (id: string) => runAndReload(async () => {
    const { error: deleteError } = await supabase.from('finance_projects').delete().eq('id', id);
    if (deleteError) throw deleteError;
  }), [runAndReload]);

  const insertMovement = async (payload: MovementPayload) => {
    const base = {
      date: payload.date,
      type: normalizeType(payload.type),
      fund_id: payload.fund_id,
      project_id: payload.project_id || null,
      description: payload.description || payload.title,
      unit_value: toNumber(payload.unit_value),
      quantity: toNumber(payload.quantity || 1),
      total_value: toNumber(payload.unit_value) * toNumber(payload.quantity || 1),
      status: normalizeMovementStatus(payload.status),
      category_id: payload.category_id || null,
      pay_method: normalizePayMethod(payload.pay_method),
      beneficiary: payload.beneficiary,
      notes: payload.notes,
    };

    const withTitle = await supabase.from('finance_movements').insert({ ...base, title: payload.title || payload.description }).select('id').single();
    if (!withTitle.error) return String(withTitle.data.id);

    if (isMissingColumnError(withTitle.error.message, 'title')) {
      const withoutTitle = await supabase.from('finance_movements').insert(base).select('id').single();
      if (withoutTitle.error) throw withoutTitle.error;
      return String(withoutTitle.data.id);
    }

    throw withTitle.error;
  };

  const updateMovement = useCallback(async (id: string, payload: MovementPayload) => runAndReload(async () => {
    const base = {
      date: payload.date,
      type: normalizeType(payload.type),
      fund_id: payload.fund_id,
      project_id: payload.project_id || null,
      description: payload.description || payload.title,
      unit_value: toNumber(payload.unit_value),
      quantity: toNumber(payload.quantity || 1),
      total_value: toNumber(payload.unit_value) * toNumber(payload.quantity || 1),
      status: normalizeMovementStatus(payload.status),
      category_id: payload.category_id || null,
      pay_method: normalizePayMethod(payload.pay_method),
      beneficiary: payload.beneficiary,
      notes: payload.notes,
    };
    const withTitle = await supabase.from('finance_movements').update({ ...base, title: payload.title || payload.description }).eq('id', id);
    if (!withTitle.error) return;
    if (!isMissingColumnError(withTitle.error.message, 'title')) throw withTitle.error;
    const fallback = await supabase.from('finance_movements').update(base).eq('id', id);
    if (fallback.error) throw fallback.error;
  }), [runAndReload]);

  const createMovement = useCallback(async (payload: MovementPayload, files: File[] = []) => runAndReload(async () => {
    const movementId = await insertMovement(payload);
    for (const file of files) {
      await uploadAttachment(movementId, file, { fundId: payload.fund_id, projectId: payload.project_id });
    }
  }), [runAndReload]);

  const getSignedUrl = useCallback(async (storagePath: string) => {
    const { data, error: signedError } = await supabase.storage.from('finance-attachments').createSignedUrl(storagePath, 60 * 10);
    if (signedError) throw signedError;
    return data.signedUrl;
  }, []);

  const uploadAttachment = useCallback(async (movementId: string, file: File, context?: { fundId?: string; projectId?: string }) => {
    const path = `${context?.fundId || 'sem-fundo'}/${context?.projectId || 'sem-projeto'}/${movementId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('finance-attachments').upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase.from('finance_attachments').insert({ movement_id: movementId, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size });
    if (insertError) throw insertError;
  }, []);

  const deleteAttachment = useCallback(async (attachment: FinanceAttachment) => runAndReload(async () => {
    const { error: storageError } = await supabase.storage.from('finance-attachments').remove([attachment.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await supabase.from('finance_attachments').delete().eq('id', attachment.id);
    if (deleteError) throw deleteError;
  }), [runAndReload]);

  const deleteMovementCascade = useCallback(async (id: string) => runAndReload(async () => {
    const attachments = await listAttachments(id);
    const paths = attachments.map((item) => item.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('finance-attachments').remove(paths);
      if (removeError) throw removeError;
      const { error: attachmentsError } = await supabase.from('finance_attachments').delete().eq('movement_id', id);
      if (attachmentsError) throw attachmentsError;
    }
    const { error: movementError } = await supabase.from('finance_movements').delete().eq('id', id);
    if (movementError) throw movementError;
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
    listCategories,
    createMovement,
    updateMovement,
    uploadAttachment,
    deleteAttachment,
    listAttachments,
    getSignedUrl,
    deleteMovementCascade,
  };
}

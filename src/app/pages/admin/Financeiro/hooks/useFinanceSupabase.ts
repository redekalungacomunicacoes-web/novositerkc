import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  DashboardData,
  FinanceAttachment,
  FinanceStatus,
  FinanceiroFundo,
  FinanceiroMovimentacao,
  FinanceiroProjeto,
} from '../data/financeiro.repo';
import { formatCurrency } from '../data/financeiro.repo';

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
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status?: MovementStatus;
  limit?: number;
};

export type ReportMode = 'geral' | 'fundo' | 'projeto';

export type ReportFilters = {
  mode: ReportMode;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  fundId?: string;
  projectId?: string;
  status?: MovementStatus;
};

type ReportSummary = {
  entradas: number;
  saidas: number;
  saldo: number;
  pendencias: number;
};

const toNumber = (value: unknown) => Number(value) || 0;

const ensure = (error: { message?: string } | null, fallbackMessage: string) => {
  if (error) throw new Error(error.message || fallbackMessage);
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

const normalizeType = (value: unknown): MovementType =>
  (`${value ?? ''}`.toLowerCase() === 'entrada' ? 'entrada' : 'saida');

const normalizePayMethod = (value: unknown): PayMethod => {
  const method = `${value ?? ''}`.toLowerCase();
  if (method === 'pix' || method === 'transferencia' || method === 'dinheiro') return method;
  if (method === 'transferência') return 'transferencia';
  return 'pix';
};

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

const movementSelect =
  'id,date,type,fund_id,project_id,title,description,unit_value,quantity,total_value,status,category_id,pay_method,beneficiary,notes,doc_type,doc_number,cost_center,created_at,project:finance_projects(id,name,fund_id),fund:finance_funds(id,name),category:finance_categories(id,name,color),attachments:finance_attachments(*)';

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

const monthKey = (dateIsoLike: string) => {
  const d = new Date(dateIsoLike);
  if (Number.isNaN(d.getTime())) return String(dateIsoLike).slice(0, 7);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}`;
};

const buildPeriodsBetween = (startDate: string, endDate: string) => {
  const periods: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return periods;

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor.getTime() <= last.getTime()) {
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    periods.push(`${cursor.getFullYear()}-${mm}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
};

export function useFinanceSupabase() {
  const [funds, setFunds] = useState<FinanceiroFundo[]>([]);
  const [projects, setProjects] = useState<FinanceiroProjeto[]>([]);
  const [movements, setMovements] = useState<FinanceiroMovimentacao[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({
    entradas: 0,
    saidas: 0,
    saldoAtual: 0,
    pendencias: 0,
    fluxoCaixa: [],
    distribuicaoCategoria: [],
    orcadoVsReal: [],
  });
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fundsById = useMemo(() => new Map(funds.map((f) => [f.id, f.nome])), [funds]);
  const projectToFundId = useMemo(() => new Map(projects.map((p) => [p.id, p.fundoId])), [projects]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p.nome])), [projects]);

  const normalizeMovementFund = useCallback(
    (m: FinanceiroMovimentacao): FinanceiroMovimentacao => {
      const resolvedFundId = m.fundoId || (m.projetoId ? projectToFundId.get(m.projetoId) ?? '' : '');
      const resolvedFundName = resolvedFundId ? (fundsById.get(resolvedFundId) ?? m.fundo) : m.fundo;

      const resolvedProjectName =
        m.projetoNome !== '—'
          ? m.projetoNome
          : m.projetoId
            ? (projectsById.get(m.projetoId) ?? m.projetoNome)
            : m.projetoNome;

      return {
        ...m,
        fundoId: resolvedFundId,
        fundo: resolvedFundName || '—',
        projetoNome: resolvedProjectName || '—',
      };
    },
    [fundsById, projectToFundId, projectsById],
  );

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

  const listMovements = useCallback(
    async (filters?: MovementFilters) => {
      const { data, error: movementsError } = await buildMovementsQuery(filters);
      ensure(movementsError, 'Falha ao listar movimentações.');
      const list = (data || []).map((row) => mapMovement(row as AnyRow));
      return list.map(normalizeMovementFund);
    },
    [normalizeMovementFund],
  );

  const listLatestMovements = useCallback(async () => listMovements({ limit: 10 }), [listMovements]);

  const getDashboardAggregates = useCallback(async (): Promise<DashboardData> => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 5);

    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);

    const [movementsRes, fundsList] = await Promise.all([
      buildMovementsQuery({ startDate: start, endDate: end }),
      listFunds(),
    ]);

    ensure(movementsRes.error, 'Falha ao carregar dados do dashboard.');
    const raw = (movementsRes.data || []).map((row) => mapMovement(row as AnyRow));

    const projectFundFromRow = new Map<string, string>();
    raw.forEach((m, idx) => {
      const r = movementsRes.data?.[idx] as AnyRow | undefined;
      const proj = r?.project as AnyRow | undefined;
      if (proj?.id && proj?.fund_id) projectFundFromRow.set(String(proj.id), String(proj.fund_id));
    });

    const fundsNameById = new Map(fundsList.map((f) => [f.id, f.nome]));

    const normalized = raw.map((m) => {
      const resolvedFundId = m.fundoId || (m.projetoId ? (projectFundFromRow.get(m.projetoId) ?? '') : '');
      const resolvedFundName = resolvedFundId ? (fundsNameById.get(resolvedFundId) ?? m.fundo) : m.fundo;
      return { ...m, fundoId: resolvedFundId, fundo: resolvedFundName || '—' };
    });

    const paid = normalized.filter((m) => m.status === 'pago');
    const paidIn = paid.filter((m) => m.tipo === 'entrada');
    const paidOut = paid.filter((m) => m.tipo === 'saida');

    const entradas = paidIn.reduce((acc, m) => acc + m.valorTotal, 0);
    const saidas = paidOut.reduce((acc, m) => acc + m.valorTotal, 0);
    const pendencias = normalized.filter((m) => m.status === 'pendente').reduce((acc, m) => acc + m.valorTotal, 0);

    const saldoFundos = fundsList.reduce((acc, f) => acc + (Number.isFinite(f.saldoAtual) ? f.saldoAtual : 0), 0);
    const saldoAtual = saldoFundos !== 0 ? saldoFundos : entradas - saidas;

    const fluxoMap = new Map<string, { periodo: string; entradas: number; saidas: number }>();
    const pizzaMap = new Map<string, number>();
    const realMap = new Map<string, number>();

    for (const row of paid) {
      const period = monthKey(row.data);
      const current = fluxoMap.get(period) ?? { periodo: period, entradas: 0, saidas: 0 };
      if (row.tipo === 'entrada') current.entradas += row.valorTotal;
      if (row.tipo === 'saida') current.saidas += row.valorTotal;
      fluxoMap.set(period, current);

      if (row.tipo === 'saida') {
        pizzaMap.set(row.categoria || 'Sem categoria', (pizzaMap.get(row.categoria || 'Sem categoria') ?? 0) + row.valorTotal);
        realMap.set(period, (realMap.get(period) ?? 0) + row.valorTotal);
      }
    }

    const periods = buildPeriodsBetween(start, end);

    const totalOrcadoPeriodo = fundsList.reduce((acc, f) => acc + (Number.isFinite(f.totalOrcado) ? f.totalOrcado : 0), 0);
    const orcadoMensal = periods.length > 0 ? totalOrcadoPeriodo / periods.length : 0;

    return {
      entradas,
      saidas,
      saldoAtual,
      pendencias,
      fluxoCaixa: periods.map((periodo) => fluxoMap.get(periodo) ?? { periodo, entradas: 0, saidas: 0 }),
      distribuicaoCategoria: Array.from(pizzaMap.entries()).map(([categoria, valor]) => ({ categoria, valor })),
      orcadoVsReal: periods.map((periodo) => ({ periodo, orcado: orcadoMensal, real: realMap.get(periodo) ?? 0 })),
    };
  }, [listFunds]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fundsList = await listFunds();
      const projectsList = await listProjects(fundsList);

      setFunds(fundsList);
      setProjects(projectsList);

      const [latest, categoriesList, aggregates] = await Promise.all([
        (async () => {
          const { data, error: movementsError } = await buildMovementsQuery({ limit: 10 });
          ensure(movementsError, 'Falha ao listar movimentações.');
          const raw = (data || []).map((row) => mapMovement(row as AnyRow));
          const p2f = new Map(projectsList.map((p) => [p.id, p.fundoId]));
          const fById = new Map(fundsList.map((f) => [f.id, f.nome]));
          const pById = new Map(projectsList.map((p) => [p.id, p.nome]));
          return raw.map((m) => {
            const resolvedFundId = m.fundoId || (m.projetoId ? (p2f.get(m.projetoId) ?? '') : '');
            const resolvedFundName = resolvedFundId ? (fById.get(resolvedFundId) ?? m.fundo) : m.fundo;
            const resolvedProjectName =
              m.projetoNome !== '—'
                ? m.projetoNome
                : m.projetoId
                  ? (pById.get(m.projetoId) ?? m.projetoNome)
                  : m.projetoNome;

            return { ...m, fundoId: resolvedFundId, fundo: resolvedFundName || '—', projetoNome: resolvedProjectName || '—' };
          });
        })(),
        listCategories(),
        getDashboardAggregates(),
      ]);

      setMovements(latest);
      setCategories(categoriesList);
      setDashboard(aggregates);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getDashboardAggregates, listCategories, listFunds, listProjects]);

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
    const { error: createError } = await supabase
      .from('finance_funds')
      .insert({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') });
    ensure(createError, 'Falha ao criar fundo.');
    return true;
  }), [runAndReload]);

  const updateFund = useCallback(async (id: string, payload: FundPayload) => runAndReload(async () => {
    const { error: updateError } = await supabase
      .from('finance_funds')
      .update({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') })
      .eq('id', id);
    ensure(updateError, 'Falha ao atualizar fundo.');
    return true;
  }), [runAndReload]);

  const deleteFund = useCallback(async (id: string) => runAndReload(async () => {
    const { error: deleteError } = await supabase.from('finance_funds').delete().eq('id', id);
    ensure(deleteError, 'Falha ao excluir fundo.');
    return true;
  }), [runAndReload]);

  const createProject = useCallback(async (payload: ProjectPayload) => runAndReload(async () => {
    const { error: createError } = await supabase
      .from('finance_projects')
      .insert({ ...payload, initial_amount: toNumber(payload.initial_amount), current_balance: toNumber(payload.initial_amount), status: normalizeStatus(payload.status, 'em_andamento') });
    ensure(createError, 'Falha ao criar projeto.');
    return true;
  }), [runAndReload]);

  const updateProject = useCallback(async (id: string, payload: ProjectPayload) => runAndReload(async () => {
    const { error: updateError } = await supabase
      .from('finance_projects')
      .update({ ...payload, initial_amount: toNumber(payload.initial_amount), status: normalizeStatus(payload.status, 'em_andamento') })
      .eq('id', id);
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
    if (!payload.category_id) throw new Error('Categoria é obrigatória.');
    return {
      date: payload.date,
      type: normalizeType(payload.type),
      fund_id: payload.fund_id || null,
      project_id: payload.project_id || null,
      category_id: payload.category_id || null,
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
    const created = list.find((m) => m.id === movementId) ?? ({ id: movementId } as any);
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
    const { data, error: attachmentsError } = await supabase.from('finance_attachments').select('movement_id').in('movement_id', movementIds);
    ensure(attachmentsError, 'Falha ao listar anexos das movimentações.');
    const map = new Map<string, number>();
    (data || []).forEach((row: any) => {
      const key = String(row.movement_id);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, []);

  const deleteAttachment = useCallback(async (attachmentId: string) => runAndReload(async () => {
    const { data, error: readError } = await supabase.from('finance_attachments').select('id,storage_path').eq('id', attachmentId).single();
    ensure(readError, 'Falha ao localizar anexo para exclusão.');
    const storagePath = String((data as any).storage_path || '');
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

  const getReportMovements = useCallback(async (filters: ReportFilters) => {
    const base: MovementFilters = { startDate: filters.startDate, endDate: filters.endDate, status: filters.status };

    // Modo fundo: não dá pra confiar só no eq('fund_id') porque movimento pode vir do projeto sem fund_id
    if (filters.mode === 'fundo') {
      const list = await listMovements({ startDate: filters.startDate, endDate: filters.endDate, status: filters.status });
      const target = filters.fundId || '';
      return list.filter((m) => (m.fundoId || '') === target);
    }

    if (filters.mode === 'projeto') base.projectId = filters.projectId;
    if (filters.mode === 'geral') { /* nada */ }

    return listMovements(base);
  }, [listMovements]);

  const summarizeMovements = (list: FinanceiroMovimentacao[]): ReportSummary => {
    const entradas = list.filter((m) => m.status === 'pago' && m.tipo === 'entrada').reduce((acc, m) => acc + m.valorTotal, 0);
    const saidas = list.filter((m) => m.status === 'pago' && m.tipo === 'saida').reduce((acc, m) => acc + m.valorTotal, 0);
    const pendencias = list.filter((m) => m.status === 'pendente').reduce((acc, m) => acc + m.valorTotal, 0);
    return { entradas, saidas, saldo: entradas - saidas, pendencias };
  };

  const generateReportPdf = useCallback(async (filters: ReportFilters, opts?: { logoDataUrl?: string | null; fileName?: string }) => {
    const list = await getReportMovements(filters);
    const summary = summarizeMovements(list);

    const jsPDFmod = await import('jspdf');
    const autoTableMod: any = await import('jspdf-autotable');

    const doc = new jsPDFmod.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorY = 12;

    if (opts?.logoDataUrl) {
      try {
        const imgW = 40;
        const imgH = 18;
        doc.addImage(opts.logoDataUrl, 'PNG', (pageWidth - imgW) / 2, cursorY, imgW, imgH);
        cursorY += imgH + 6;
      } catch {
        // ignora se a logo vier em formato não suportado
      }
    }

    doc.setFontSize(14);
    doc.text('RELATÓRIO FINANCEIRO', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 6;

    doc.setFontSize(10);

    const modeLabel =
      filters.mode === 'geral'
        ? 'Geral'
        : filters.mode === 'fundo'
          ? `Fundo: ${fundsById.get(filters.fundId || '') ?? '—'}`
          : `Projeto: ${projectsById.get(filters.projectId || '') ?? '—'}`;

    doc.text(`Período: ${filters.startDate} até ${filters.endDate}`, 14, cursorY); cursorY += 5;
    doc.text(`Filtro: ${modeLabel}`, 14, cursorY); cursorY += 5;
    doc.text(`Status: ${filters.status ?? 'todos'}`, 14, cursorY); cursorY += 8;

    doc.setFontSize(11);
    doc.text('Resumo', 14, cursorY); cursorY += 5;

    doc.setFontSize(10);
    doc.text(`Entradas pagas: ${formatCurrency(summary.entradas)}`, 14, cursorY); cursorY += 5;
    doc.text(`Saídas pagas: ${formatCurrency(summary.saidas)}`, 14, cursorY); cursorY += 5;
    doc.text(`Saldo (pagos): ${formatCurrency(summary.saldo)}`, 14, cursorY); cursorY += 5;
    doc.text(`Pendências: ${formatCurrency(summary.pendencias)}`, 14, cursorY); cursorY += 8;

    const head = [['Data', 'Tipo', 'Fundo', 'Projeto', 'Categoria', 'Descrição', 'Valor', 'Status']];
    const body = list.map((m) => ([
      String(m.data).slice(0, 10),
      m.tipo,
      m.fundo || '—',
      m.projetoNome !== '—' ? m.projetoNome : '—',
      m.categoria || '—',
      m.descricao || '—',
      formatCurrency(m.valorTotal),
      m.status,
    ]));

    (autoTableMod.default || autoTableMod)(doc, {
      head,
      body,
      startY: cursorY,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 61, 46] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 14 },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 16 },
      },
      didDrawPage: () => {
        const now = new Date();
        const footer = `Gerado em: ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
        doc.setFontSize(8);
        doc.text(footer, 14, doc.internal.pageSize.getHeight() - 10);
      },
    });

    doc.save(opts?.fileName ?? `relatorio-financeiro_${filters.startDate}_a_${filters.endDate}.pdf`);
    return { ok: true, total: list.length };
  }, [fundsById, projectsById, getReportMovements]);

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
    listAttachmentsForMovementIds,
    getSignedUrl,
    deleteMovementCascade,

    // NOVO
    generateReportPdf,
  };
}

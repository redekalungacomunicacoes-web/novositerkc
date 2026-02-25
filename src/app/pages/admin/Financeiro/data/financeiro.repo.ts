import { supabase } from '@/lib/supabase';

export type FinanceStatus =
  | 'pago'
  | 'pendente'
  | 'cancelado'
  | 'ativo'
  | 'em_andamento'
  | 'concluido';

type AnyRow = Record<string, any>;

export type FinanceiroFundo = {
  id: string;
  nome: string;
  ano: number;
  totalOrcado: number;
  saldoInicial: number;
  saldoAtual: number;
  totalGasto: number;
  totalEntradas: number;
  totalSaidas: number;
  status: FinanceStatus;
  execucao: number;
};

export type FinanceiroProjeto = {
  id: string;
  nome: string;
  fundo: string;
  fundoId: string;
  saldoDisponivel: number;
  totalOrcado: number;
  gastoReal: number;
  diferenca: number;
  execucao: number;
  status: FinanceStatus;
};

export type FinanceiroMovimentacao = {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  titulo: string;
  descricao: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
  status: FinanceStatus;
  projetoNome: string;
  projetoId: string;
  fundo: string;
  fundoId: string;
  categoria: string;
  paymentMethod: string;
  payee: string;
  notes: string;
  comprovantes: FinanceAttachment[];
};

export type FinanceAttachment = {
  id: string;
  movement_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
};

export type DashboardData = {
  entradas: number;
  saidas: number;
  saldoAtual: number;
  pendencias: number;
  fluxoCaixa: { periodo: string; entradas: number; saidas: number }[];
  distribuicaoCategoria: { categoria: string; valor: number }[];
  orcadoVsReal: { periodo: string; orcado: number; real: number }[];
};

const asNumber = (value: unknown) => Number(value) || 0;

const asDateIso = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const asStatus = (value: unknown, fallback: FinanceStatus = 'pendente'): FinanceStatus => {
  if (
    value === 'pago' ||
    value === 'pendente' ||
    value === 'cancelado' ||
    value === 'ativo' ||
    value === 'em_andamento' ||
    value === 'concluido'
  ) {
    return value;
  }
  return fallback;
};

const monthKey = (isoLike: unknown) => {
  const date = new Date(String(isoLike || ''));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(asNumber(value));

export const formatDate = (dateLike: string) => {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

/**
 * Movimentações com robustez:
 * - tenta coluna nova: date / type / description / total_value
 * - se falhar (ambiente legado): data / tipo / descricao / valor_total
 * - tenta trazer relações (project/category) quando possível
 */
async function getMovementsRaw() {
  const selectWithCategoryId =
    '*, project:finance_projects(id,name,funder), category:finance_categories(id,name), fund:finance_funds(id,name), attachments:finance_attachments(*)';
  const selectWithoutCategoryId =
    '*, project:finance_projects(id,name,funder), fund:finance_funds(id,name), attachments:finance_attachments(*)';

  const byDateWithCategory = await supabase
    .from('finance_movements')
    .select(selectWithCategoryId)
    .order('date', { ascending: false });

  if (!byDateWithCategory.error) return byDateWithCategory.data || [];

  const byDateWithoutCategory = await supabase
    .from('finance_movements')
    .select(selectWithoutCategoryId)
    .order('date', { ascending: false });

  if (!byDateWithoutCategory.error) return byDateWithoutCategory.data || [];

  const byDataLegacy = await supabase
    .from('finance_movements')
    .select('*')
    .order('data', { ascending: false });

  if (!byDataLegacy.error) return byDataLegacy.data || [];

  return [];
}

export async function listFunds(): Promise<FinanceiroFundo[]> {
  const { data: fundsData, error: fundsError } = await supabase
    .from('finance_funds')
    .select('*');

  // Modelo “fundos” existe
  if (!fundsError && fundsData?.length) {
    return fundsData.map((row: AnyRow) => {
      const totalOrcado = asNumber(row.total_orcado ?? row.totalOrcado ?? row.orcado);
      const saldoInicial = asNumber(row.saldo_inicial ?? row.saldoInicial);
      const saldoAtual = asNumber(row.saldo_atual ?? row.saldoAtual ?? row.saldo);
      const totalEntradas = asNumber(row.total_entradas ?? row.totalEntradas);
      const totalSaidas = asNumber(row.total_saidas ?? row.totalSaidas);
      const totalGasto = asNumber(row.total_gasto ?? row.totalGasto ?? totalSaidas);
      const execucaoBase = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0;

      return {
        id: String(row.id ?? row.slug ?? crypto.randomUUID()),
        nome: String(row.nome ?? row.name ?? 'Sem nome'),
        ano: Number(row.ano ?? row.year ?? new Date().getFullYear()),
        totalOrcado,
        saldoInicial,
        saldoAtual,
        totalGasto,
        totalEntradas,
        totalSaidas,
        status: asStatus(row.status, 'ativo'),
        execucao: Math.max(0, Math.min(100, asNumber(row.execucao ?? execucaoBase))),
      };
    });
  }

  // Fallback: se não existir tabela de fundos, tenta derivar via projects
  const { data: projectsData, error: projectsError } = await supabase
    .from('finance_projects')
    .select('*');

  if (projectsError || !projectsData) return [];

  return projectsData.map((row: AnyRow) => {
    const totalOrcado = asNumber(row.initial_amount ?? row.total_orcado ?? row.totalOrcado ?? row.orcado);
    const saldoAtual = asNumber(row.current_balance ?? row.saldo_atual ?? row.saldoAtual ?? row.saldo);
    const totalGasto = Math.max(0, totalOrcado - saldoAtual);

    return {
      id: String(row.id ?? crypto.randomUUID()),
      nome: String(row.funder ?? row.nome ?? row.name ?? 'Sem nome'),
      ano: Number(row.year ?? row.ano ?? new Date().getFullYear()),
      totalOrcado,
      saldoInicial: totalOrcado,
      saldoAtual,
      totalGasto,
      totalEntradas: 0,
      totalSaidas: totalGasto,
      status: asStatus(row.status, 'ativo'),
      execucao: Math.max(0, Math.min(100, totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0)),
    };
  });
}

export async function listProjects(): Promise<FinanceiroProjeto[]> {
  const [projectsRes, funds] = await Promise.all([
    supabase.from('finance_projects').select('*'),
    listFunds(),
  ]);

  if (projectsRes.error || !projectsRes.data) return [];

  return projectsRes.data.map((row: AnyRow) => {
    const totalOrcado = asNumber(row.initial_amount ?? row.total_orcado ?? row.totalOrcado ?? row.orcado);
    const saldoDisponivel = asNumber(row.current_balance ?? row.saldo_disponivel ?? row.saldoDisponivel);
    const gastoReal = Math.max(0, totalOrcado - saldoDisponivel);

    const fundoId = String(row.fund_id ?? row.fundo_id ?? row.fundoId ?? '');
    const fundoNome =
      funds.find((f) => f.id === fundoId)?.nome ??
      String(row.funder ?? row.fundo_nome ?? row.fundo ?? '—');

    return {
      id: String(row.id ?? crypto.randomUUID()),
      nome: String(row.name ?? row.nome ?? 'Sem nome'),
      fundo: fundoNome,
      fundoId,
      saldoDisponivel,
      totalOrcado,
      gastoReal,
      diferenca: asNumber(row.diferenca ?? gastoReal - totalOrcado),
      execucao: Math.max(
        0,
        Math.min(100, asNumber(row.execucao ?? (totalOrcado > 0 ? (gastoReal / totalOrcado) * 100 : 0))),
      ),
      status: asStatus(row.status, 'em_andamento'),
    };
  });
}

export async function listCategories() {
  const { data, error } = await supabase.from('finance_categories').select('*');
  if (error || !data) return [];
  return data;
}

export async function listLatestMovements(limit = 10): Promise<FinanceiroMovimentacao[]> {
  const rows = await getMovementsRaw();

  return rows.slice(0, limit).map((row: AnyRow) => ({
    id: String(row.id ?? crypto.randomUUID()),
    data: asDateIso(row.date ?? row.data ?? row.created_at),
    tipo: String(row.type ?? row.tipo ?? 'saida') === 'entrada' ? 'entrada' : 'saida',
    titulo: String(row.title ?? row.titulo ?? row.description ?? row.descricao ?? 'Sem título'),
    descricao: String(row.description ?? row.descricao ?? 'Sem descrição'),
    valorUnitario: asNumber(row.unit_value ?? row.valor_unitario),
    quantidade: asNumber(row.quantity ?? row.quantidade ?? 1),
    valorTotal: asNumber(row.total_value ?? row.valor_total ?? row.valorTotal ?? row.valor),
    status: asStatus(row.status, 'pendente'),
    projetoNome: String(row.project?.name ?? row.projeto_nome ?? row.projeto ?? '—'),
    projetoId: String(row.project_id ?? row.projeto_id ?? row.projetoId ?? ''),
    fundo: String(row.project?.funder ?? row.fundo_nome ?? row.fundo ?? '—'),
    fundoId: String(row.fund_id ?? row.fundo_id ?? row.fundoId ?? ''),
    categoria: String(row.category?.name ?? row.categoria ?? row.category ?? 'Sem categoria'),
    paymentMethod: String(row.payment_method ?? row.forma_pagamento ?? ''),
    payee: String(row.payee ?? row.favorecido ?? ''),
    notes: String(row.notes ?? row.observacoes ?? ''),
    comprovantes: [],
  }));
}

export async function getDashboardData(
  range?: { startDate?: string; endDate?: string },
): Promise<DashboardData> {
  const empty: DashboardData = {
    entradas: 0,
    saidas: 0,
    saldoAtual: 0,
    pendencias: 0,
    fluxoCaixa: [],
    distribuicaoCategoria: [],
    orcadoVsReal: [],
  };

  const [movementsRows, funds, budgetRes] = await Promise.all([
    getMovementsRaw(),
    listFunds(),
    supabase.from('finance_budget_items').select('*'),
  ]);

  const start = range?.startDate ? new Date(range.startDate) : null;
  const end = range?.endDate ? new Date(range.endDate) : null;

  const movements = (movementsRows || []).filter((row: AnyRow) => {
    const date = new Date(String(row.date ?? row.data ?? row.created_at ?? ''));
    if (Number.isNaN(date.getTime())) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });

  const entradas = movements
    .filter((row: AnyRow) => String(row.type ?? row.tipo ?? '').toLowerCase() === 'entrada')
    .reduce(
      (acc: number, row: AnyRow) =>
        acc + asNumber(row.total_value ?? row.valor_total ?? row.valorTotal ?? row.valor),
      0,
    );

  const saidas = movements
    .filter((row: AnyRow) => String(row.type ?? row.tipo ?? '').toLowerCase() === 'saida')
    .reduce(
      (acc: number, row: AnyRow) =>
        acc + asNumber(row.total_value ?? row.valor_total ?? row.valorTotal ?? row.valor),
      0,
    );

  const hasStatusColumn = movements.some((row: AnyRow) =>
    Object.prototype.hasOwnProperty.call(row, 'status'),
  );

  const pendencias = hasStatusColumn
    ? movements.filter((row: AnyRow) => String(row.status || '').toLowerCase() !== 'pago').length
    : 0;

  const saldoFromFunds = funds.reduce((acc, item) => acc + asNumber(item.saldoAtual), 0);
  const saldoAtual = saldoFromFunds || entradas - saidas;

  const fluxoMap = new Map<string, { periodo: string; entradas: number; saidas: number }>();
  const categoriaMap = new Map<string, number>();

  movements.forEach((row: AnyRow) => {
    const periodo = monthKey(row.date ?? row.data ?? row.created_at);
    if (!periodo) return;

    const current = fluxoMap.get(periodo) ?? { periodo, entradas: 0, saidas: 0 };
    const value = asNumber(row.total_value ?? row.valor_total ?? row.valorTotal ?? row.valor);
    const type = String(row.type ?? row.tipo ?? '').toLowerCase();

    if (type === 'entrada') current.entradas += value;
    if (type === 'saida') current.saidas += value;
    fluxoMap.set(periodo, current);

    if (type === 'saida') {
      const categoria = String(row.category?.name ?? row.categoria ?? row.category ?? 'Sem categoria');
      categoriaMap.set(categoria, (categoriaMap.get(categoria) ?? 0) + value);
    }
  });

  const fluxoCaixa = [...fluxoMap.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));

  const distribuicaoCategoria = [...categoriaMap.entries()].map(([categoria, valor]) => ({
    categoria,
    valor: asNumber(valor),
  }));

  const realPorPeriodo = new Map<string, number>();
  fluxoCaixa.forEach((item) => realPorPeriodo.set(item.periodo, asNumber(item.saidas)));

  const orcadoPorPeriodo = new Map<string, number>();
  if (!budgetRes.error && budgetRes.data) {
    budgetRes.data.forEach((row: AnyRow) => {
      const periodo = monthKey(row.date ?? row.data ?? row.periodo ?? row.created_at);
      if (!periodo) return;
      const valor = asNumber(
        row.value ?? row.valor ?? row.valor_orcado ?? row.valor_planejado ?? row.total_orcado,
      );
      orcadoPorPeriodo.set(periodo, (orcadoPorPeriodo.get(periodo) ?? 0) + valor);
    });
  }

  const periodos = Array.from(new Set([...realPorPeriodo.keys(), ...orcadoPorPeriodo.keys()])).sort();

  const orcadoVsReal = periodos.map((periodo) => ({
    periodo,
    orcado: asNumber(orcadoPorPeriodo.get(periodo) ?? 0),
    real: asNumber(realPorPeriodo.get(periodo) ?? 0),
  }));

  return {
    entradas: asNumber(entradas),
    saidas: asNumber(saidas),
    saldoAtual: asNumber(saldoAtual),
    pendencias: asNumber(pendencias),
    fluxoCaixa,
    distribuicaoCategoria,
    orcadoVsReal,
  };
}

import { supabase } from '@/lib/supabase';

export type FinanceStatus = 'pago' | 'pendente' | 'cancelado' | 'ativo' | 'em_andamento' | 'concluido';

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
  descricao: string;
  valorTotal: number;
  status: FinanceStatus;
  projetoNome: string;
  projetoId: string;
  fundo: string;
  fundoId: string;
  categoria: string;
  comprovantes: unknown[];
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
  if (value === 'pago' || value === 'pendente' || value === 'cancelado' || value === 'ativo' || value === 'em_andamento' || value === 'concluido') {
    return value;
  }
  return fallback;
};

const monthKey = (isoLike: unknown) => {
  const date = new Date(String(isoLike || ''));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(asNumber(value));

export const formatDate = (dateLike: string) => {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

export async function listFunds(): Promise<FinanceiroFundo[]> {
  const { data, error } = await supabase.from('finance_funds').select('*');
  if (error || !data) return [];

  return data.map((row: any) => {
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
      ano: Number(row.ano ?? new Date().getFullYear()),
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

export async function listProjects(): Promise<FinanceiroProjeto[]> {
  const [projectsRes, funds] = await Promise.all([
    supabase.from('finance_projects').select('*'),
    listFunds(),
  ]);

  if (projectsRes.error || !projectsRes.data) return [];

  return projectsRes.data.map((row: any) => {
    const totalOrcado = asNumber(row.total_orcado ?? row.totalOrcado ?? row.orcado);
    const gastoReal = asNumber(row.gasto_real ?? row.gastoReal ?? row.realizado);
    const saldoDisponivel = asNumber(row.saldo_disponivel ?? row.saldoDisponivel ?? totalOrcado - gastoReal);
    const fundoId = String(row.fundo_id ?? row.fundoId ?? '');
    const fundoNome = funds.find((f) => f.id === fundoId)?.nome ?? String(row.fundo_nome ?? row.fundo ?? '—');

    return {
      id: String(row.id ?? crypto.randomUUID()),
      nome: String(row.nome ?? row.name ?? 'Sem nome'),
      fundo: fundoNome,
      fundoId,
      saldoDisponivel,
      totalOrcado,
      gastoReal,
      diferenca: asNumber(row.diferenca ?? gastoReal - totalOrcado),
      execucao: Math.max(0, Math.min(100, asNumber(row.execucao ?? (totalOrcado > 0 ? (gastoReal / totalOrcado) * 100 : 0)))),
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
  const { data, error } = await supabase
    .from('finance_movements')
    .select('*')
    .order('data', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: String(row.id ?? crypto.randomUUID()),
    data: asDateIso(row.data ?? row.created_at),
    descricao: String(row.descricao ?? row.description ?? 'Sem descrição'),
    valorTotal: asNumber(row.valor_total ?? row.valorTotal ?? row.valor),
    status: asStatus(row.status, 'pendente'),
    projetoNome: String(row.projeto_nome ?? row.projeto ?? '—'),
    projetoId: String(row.projeto_id ?? row.projetoId ?? ''),
    fundo: String(row.fundo_nome ?? row.fundo ?? '—'),
    fundoId: String(row.fundo_id ?? row.fundoId ?? ''),
    categoria: String(row.categoria ?? row.category ?? 'Sem categoria'),
    comprovantes: Array.isArray(row.comprovantes) ? row.comprovantes : [],
  }));
}

export async function getDashboardData(range?: { startDate?: string; endDate?: string }): Promise<DashboardData> {
  const empty: DashboardData = {
    entradas: 0,
    saidas: 0,
    saldoAtual: 0,
    pendencias: 0,
    fluxoCaixa: [],
    distribuicaoCategoria: [],
    orcadoVsReal: [],
  };

  const [movementsRes, funds, budgetRes] = await Promise.all([
    supabase.from('finance_movements').select('*').order('data', { ascending: true }),
    listFunds(),
    supabase.from('finance_budget_items').select('*'),
  ]);

  if (movementsRes.error || !movementsRes.data) {
    return { ...empty, saldoAtual: funds.reduce((acc, item) => acc + asNumber(item.saldoAtual), 0) };
  }

  const start = range?.startDate ? new Date(range.startDate) : null;
  const end = range?.endDate ? new Date(range.endDate) : null;

  const movements = movementsRes.data.filter((row: any) => {
    const date = new Date(String(row.data ?? row.created_at ?? ''));
    if (Number.isNaN(date.getTime())) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });

  const entradas = movements
    .filter((row: any) => row.tipo === 'entrada')
    .reduce((acc: number, row: any) => acc + asNumber(row.valor_total ?? row.valor), 0);

  const saidas = movements
    .filter((row: any) => row.tipo === 'saida')
    .reduce((acc: number, row: any) => acc + asNumber(row.valor_total ?? row.valor), 0);

  const hasStatusColumn = movements.some((row: any) => Object.prototype.hasOwnProperty.call(row, 'status'));
  const pendencias = hasStatusColumn
    ? movements.filter((row: any) => String(row.status || '').toLowerCase() !== 'pago').length
    : 0;

  const saldoFromFunds = funds.reduce((acc, item) => acc + asNumber(item.saldoAtual), 0);
  const saldoAtual = saldoFromFunds || entradas - saidas;

  const fluxoMap = new Map<string, { periodo: string; entradas: number; saidas: number }>();
  const categoriaMap = new Map<string, number>();

  movements.forEach((row: any) => {
    const periodo = monthKey(row.data ?? row.created_at);
    if (!periodo) return;

    const current = fluxoMap.get(periodo) ?? { periodo, entradas: 0, saidas: 0 };
    const value = asNumber(row.valor_total ?? row.valor);

    if (row.tipo === 'entrada') current.entradas += value;
    if (row.tipo === 'saida') current.saidas += value;
    fluxoMap.set(periodo, current);

    if (row.tipo === 'saida') {
      const categoria = String(row.categoria ?? row.category ?? 'Sem categoria');
      categoriaMap.set(categoria, (categoriaMap.get(categoria) ?? 0) + value);
    }
  });

  const fluxoCaixa = [...fluxoMap.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  const distribuicaoCategoria = [...categoriaMap.entries()].map(([categoria, valor]) => ({ categoria, valor: asNumber(valor) }));

  const realPorPeriodo = new Map<string, number>();
  fluxoCaixa.forEach((item) => realPorPeriodo.set(item.periodo, asNumber(item.saidas)));

  const orcadoPorPeriodo = new Map<string, number>();
  if (!budgetRes.error && budgetRes.data) {
    budgetRes.data.forEach((row: any) => {
      const periodo = monthKey(row.data ?? row.periodo ?? row.created_at);
      if (!periodo) return;
      const valor = asNumber(row.valor ?? row.valor_orcado ?? row.valor_planejado ?? row.total_orcado);
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

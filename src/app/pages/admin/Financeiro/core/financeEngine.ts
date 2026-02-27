import type { FinanceiroFundo, FinanceiroMovimentacao, FinanceiroProjeto, DashboardData } from '../data/financeiro.repo';

const toNumber = (v: unknown) => Number(v) || 0;

export type FinanceSnapshot = {
  funds: FinanceiroFundo[];
  projects: FinanceiroProjeto[];
  dashboard: DashboardData;
};

type MonthBucket = { periodo: string; entradas: number; saidas: number };

const monthKey = (isoLike: string) => String(isoLike).slice(0, 7);

export function computeFundSummaries(
  funds: FinanceiroFundo[],
  paidMovements: Array<Pick<FinanceiroMovimentacao, 'fundoId' | 'tipo' | 'valorTotal'>>
): FinanceiroFundo[] {
  const agg = new Map<string, { entradas: number; saidas: number }>();
  for (const m of paidMovements) {
    const fundId = String(m.fundoId || '');
    if (!fundId) continue;
    const cur = agg.get(fundId) ?? { entradas: 0, saidas: 0 };
    const val = toNumber(m.valorTotal);
    if (m.tipo === 'entrada') cur.entradas += val;
    else cur.saidas += val;
    agg.set(fundId, cur);
  }

  return funds.map((f) => {
    const a = agg.get(f.id) ?? { entradas: 0, saidas: 0 };
    const saldoInicial = toNumber(f.saldoInicial);
    const totalOrcado = toNumber(f.totalOrcado);
    const totalEntradas = a.entradas;
    const totalSaidas = a.saidas;
    const totalGasto = totalSaidas;
    const saldoAtual = saldoInicial + totalEntradas - totalSaidas;
    const execucao = totalOrcado > 0 ? Math.min(100, (totalGasto / totalOrcado) * 100) : 0;

    return {
      ...f,
      totalEntradas,
      totalSaidas,
      totalGasto,
      saldoAtual,
      execucao,
    };
  });
}

export function computeProjectSummaries(
  projects: FinanceiroProjeto[],
  paidMovements: Array<Pick<FinanceiroMovimentacao, 'projetoId' | 'tipo' | 'valorTotal'>>
): FinanceiroProjeto[] {
  const agg = new Map<string, { entradas: number; saidas: number }>();
  for (const m of paidMovements) {
    const projectId = String(m.projetoId || '');
    if (!projectId) continue;
    const cur = agg.get(projectId) ?? { entradas: 0, saidas: 0 };
    const val = toNumber(m.valorTotal);
    if (m.tipo === 'entrada') cur.entradas += val;
    else cur.saidas += val;
    agg.set(projectId, cur);
  }

  return projects.map((p) => {
    const a = agg.get(p.id) ?? { entradas: 0, saidas: 0 };
    const totalOrcado = toNumber(p.totalOrcado);
    const entradas = a.entradas;
    const saidas = a.saidas;
    const saldoDisponivel = totalOrcado + entradas - saidas;
    const gastoReal = saidas;
    const execucao = totalOrcado > 0 ? Math.min(100, (gastoReal / totalOrcado) * 100) : 0;
    const diferenca = totalOrcado - gastoReal;

    return {
      ...p,
      saldoDisponivel,
      gastoReal,
      execucao,
      diferenca,
    };
  });
}

export function computeDashboardData(params: {
  funds: FinanceiroFundo[];
  paidMovementsInRange: FinanceiroMovimentacao[];
  paidMovementsAll: FinanceiroMovimentacao[];
  allMovementsInRange: FinanceiroMovimentacao[];
  periods: string[];
}): DashboardData {
  const { funds, paidMovementsInRange, paidMovementsAll, allMovementsInRange, periods } = params;

  const entradas = paidMovementsInRange.filter((m) => m.tipo === 'entrada').reduce((acc, m) => acc + toNumber(m.valorTotal), 0);
  const saidas = paidMovementsInRange.filter((m) => m.tipo === 'saida').reduce((acc, m) => acc + toNumber(m.valorTotal), 0);
  const pendencias = allMovementsInRange
    .filter((m) => m.status === 'pendente')
    .reduce((acc, m) => acc + toNumber(m.valorTotal), 0);

  // Caixa geral = soma do saldo de todos os fundos (calculado a partir do saldo inicial + entradas - saídas)
  const fundsComputed = computeFundSummaries(funds, paidMovementsAll);
  const saldoAtual = fundsComputed.reduce((acc, f) => acc + toNumber(f.saldoAtual), 0);

  const fluxoMap = new Map<string, MonthBucket>();
  const pizzaMap = new Map<string, number>();
  const realMap = new Map<string, number>();

  for (const m of paidMovementsInRange) {
    const period = monthKey(m.data);
    const bucket = fluxoMap.get(period) ?? { periodo: period, entradas: 0, saidas: 0 };
    const val = toNumber(m.valorTotal);
    if (m.tipo === 'entrada') bucket.entradas += val;
    else bucket.saidas += val;
    fluxoMap.set(period, bucket);

    if (m.tipo === 'saida') {
      const cat = m.categoria || 'Sem categoria';
      pizzaMap.set(cat, (pizzaMap.get(cat) ?? 0) + val);
      realMap.set(period, (realMap.get(period) ?? 0) + val);
    }
  }

  const totalOrcadoPeriodo = fundsComputed.reduce((acc, f) => acc + (Number.isFinite(f.totalOrcado) ? toNumber(f.totalOrcado) : 0), 0);
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
}

export function buildPeriodsBetween(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const periods: string[] = [];
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return periods;

  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

  while (cursor.getTime() <= endCursor.getTime()) {
    periods.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return periods;
}

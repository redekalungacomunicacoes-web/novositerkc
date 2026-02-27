type FundLike = {
  id: string;
  saldoInicial?: number;
};

type MovementLike = {
  fundoId?: string;
  tipo: 'entrada' | 'saida';
  valorTotal: number;
  status?: string;
};

export type FundBalanceSummary = {
  entradas: number;
  saidas: number;
  saldo: number;
};

export type FundBalancesResult = {
  byFundId: Map<string, FundBalanceSummary>;
  totalSaldoGeral: number;
};

export const computeFundBalances = (fundos: FundLike[], movs: MovementLike[]): FundBalancesResult => {
  const byFundId = new Map<string, FundBalanceSummary>();

  for (const fundo of fundos) {
    byFundId.set(fundo.id, {
      entradas: 0,
      saidas: 0,
      saldo: Number(fundo.saldoInicial) || 0,
    });
  }

  for (const mov of movs) {
    if (mov.status && mov.status !== 'pago') continue;
    const fundoId = mov.fundoId || '';
    if (!fundoId || !byFundId.has(fundoId)) continue;

    const current = byFundId.get(fundoId);
    if (!current) continue;

    const valor = Number(mov.valorTotal) || 0;

    if (mov.tipo === 'entrada') {
      current.entradas += valor;
      current.saldo += valor;
    } else {
      current.saidas += valor;
      current.saldo -= valor;
    }

    byFundId.set(fundoId, current);
  }

  const totalSaldoGeral = Array.from(byFundId.values()).reduce((acc, item) => acc + item.saldo, 0);

  return { byFundId, totalSaldoGeral };
};

// FAJ II: derived values only; never seed missing financial records.
type Amount = number | null | undefined;
type Team = { name?: string; relationship?: string; monthly?: Amount; charges?: Amount; months?: Amount; faj?: Amount };
type Budget = { label?: string; description?: string; total?: Amount; faj?: Amount };
type Funding = { source?: string; sourceType?: string; purpose?: string; project?: string; year?: number | null; status?: string; amount?: Amount };

export type FajFinancialData = {
  team?: Team[];
  budgetExcludingTeam?: Budget[];
  funding?: Funding[];
  workPlan?: string;
};

export const fundingStatuses = ['Confirmado – recurso recebido', 'Confirmado – a receber', 'Em negociação', 'Potencial doador / prospecção'] as const;
const valid = (v: Amount): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const cents = (v: number) => Math.round(v * 100);
const sum = (values: Amount[]): number | null => {
  const known = values.filter(valid);
  return known.length ? known.reduce((s, v) => s + cents(v), 0) / 100 : null;
};
const share = (total: Amount, faj: Amount) => valid(total) && total > 0 && valid(faj) ? faj / total : null;
export function calculateFajFinancials(team: Team[], budgetExcludingTeam: Budget[], funding: Funding[]) {
  const teamRows = team.map(row => {
    const total = valid(row.monthly) && valid(row.months) && Number.isInteger(row.months) && row.months >= 1 && (row.charges == null || valid(row.charges))
      ? Math.round((cents(row.monthly) + cents(row.charges ?? 0)) * row.months) / 100 : null;
    return { total, faj: valid(row.faj) ? row.faj : null, share: share(total, row.faj) };
  });
  const teamTotal = sum(teamRows.map(r => r.total));
  const teamFaj = sum(teamRows.map(r => r.faj));
  const rows = [{ total: teamTotal, faj: teamFaj }, ...budgetExcludingTeam];
  const total = sum(rows.map(r => r.total));
  const faj = sum(rows.map(r => r.faj));
  const other = sum(rows.map(row => valid(row.total) && valid(row.faj) && row.faj <= row.total ? (cents(row.total) - cents(row.faj)) / 100 : null));
  const complete = rows.filter(row => row.total != null || row.faj != null).every(row => valid(row.total) && valid(row.faj) && row.faj <= row.total);
  const sustainability = [2025, 2026, 2027].map(year => ({
    year, amounts: Object.fromEntries(fundingStatuses.map(status => [status, sum(funding.filter(r => r.year === year && r.status === status).map(r => r.amount))]))
  }));
  const teamCount = team.filter(row => typeof row.name === 'string' && row.name.trim()).length;
  return { teamRows, teamCount, teamTotal, teamFaj, total, faj, other, share: complete ? share(total, faj) : null, sustainability };
}

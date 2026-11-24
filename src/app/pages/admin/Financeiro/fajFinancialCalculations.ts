// FAJ II: derived values only; never seed missing financial records.
type Amount = number | null | undefined;
type Team = { monthly?: Amount; charges?: Amount; months?: Amount; faj?: Amount };
type Budget = { total?: Amount; faj?: Amount };
type Funding = { year: number; status: string; amount?: Amount };
const valid = (v: Amount): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const cents = (v: number) => Math.round(v * 100);
const sum = (values: Amount[]): number | null => {
  const known = values.filter(valid);
  return known.length ? known.reduce((s, v) => s + cents(v), 0) / 100 : null;
};
const share = (total: Amount, faj: Amount) => valid(total) && total > 0 && valid(faj) ? faj / total : null;
export function calculateFajFinancials(team: Team[], budgetExcludingTeam: Budget[], funding: Funding[]) {
  const teamRows = team.map(row => {
    const total = valid(row.monthly) && valid(row.months) && row.months >= 1 && (row.charges == null || valid(row.charges))
      ? Math.round((cents(row.monthly) + cents(row.charges ?? 0)) * row.months) / 100 : null;
    return { total, faj: valid(row.faj) ? row.faj : null, share: share(total, row.faj) };
  });
  const teamTotal = sum(teamRows.map(r => r.total));
  const teamFaj = sum(teamRows.map(r => r.faj));
  const rows = [{ total: teamTotal, faj: teamFaj }, ...budgetExcludingTeam];
  const total = sum(rows.map(r => r.total));
  const faj = sum(rows.map(r => r.faj));
  const other = valid(total) && valid(faj) ? (cents(total) - cents(faj)) / 100 : null;
  const statuses = ['Confirmado – recurso recebido', 'Confirmado – a receber', 'Em negociação', 'Potencial doador / prospecção'];
  const sustainability = [2025, 2026, 2027].map(year => ({
    year, amounts: Object.fromEntries(statuses.map(status => [status, sum(funding.filter(r => r.year === year && r.status === status).map(r => r.amount))]))
  }));
  return { teamRows, teamTotal, teamFaj, total, faj, other, share: share(total, faj), sustainability };
}

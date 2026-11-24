import { calculateFajFinancials, fundingStatuses, type FajFinancialData } from './fajFinancialCalculations';

const budgetLabels = [
  'Infraestrutura e custos operacionais', 'Serviços especializados e consultorias',
  'Produção jornalística e editorial', 'Tecnologia e ferramentas digitais', 'Equipamentos',
  'Viagens e deslocamentos', 'Eventos e atividades institucionais', 'Comunicação e relacionamento com público',
  'Despesas administrativas e financeiras', 'Outros custos',
];

const amountField = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
const section = 'rounded-2xl border border-[#e7e9e2] bg-white p-5 sm:p-6';
const money = (value: number | null) => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function AmountInput({ label, value, onChange, months = false }: {
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
  months?: boolean;
}) {
  return <label className="block space-y-1 text-sm font-medium">
    <span>{label}</span>
    <input className={amountField} type="number" min={months ? 1 : 0} step={months ? 1 : 0.01}
      value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : event.target.valueAsNumber)} />
  </label>;
}

export function FajFinancialForm({ value, onChange }: {
  value: FajFinancialData;
  onChange: (value: FajFinancialData) => void;
}) {
  const team = Array.isArray(value.team) ? value.team : [];
  const budget = Array.isArray(value.budgetExcludingTeam) ? value.budgetExcludingTeam : [];
  const funding = Array.isArray(value.funding) ? value.funding : [];
  const workPlan = typeof value.workPlan === 'string' ? value.workPlan : '';
  const calculated = calculateFajFinancials(team, budget, funding);
  const budgetRows = Array.from({ length: Math.max(budgetLabels.length, budget.length) }, (_, index) => budget[index] ?? {});

  return <>
    <section className={section}>
      <h2 className="mb-3 font-semibold">Plano de trabalho</h2>
      <label className="block space-y-2 text-sm">
        <span>Objetivos, entregas, resultados, indicadores, período e rubricas vinculadas</span>
        <textarea rows={5} className={amountField} value={workPlan} onChange={event => onChange({ ...value, workPlan: event.target.value })} />
      </label>
    </section>
    <section className={section}>
      <h2 className="mb-3 font-semibold">Equipe</h2>
      <p className="mb-3 text-sm text-gray-600">{calculated.teamCount} integrantes identificados • Custo previsto {money(calculated.teamTotal)}</p>
      <div className="space-y-3">
        {team.map((row, index) => {
          const update = (patch: Partial<typeof row>) => onChange({ ...value, team: team.map((item, position) => position === index ? { ...item, ...patch } : item) });
          return <fieldset className="rounded-xl border p-3" key={index}>
            <legend className="px-1 text-sm font-medium">Integrante {index + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block space-y-1 text-sm font-medium">Nome ou função<input className={amountField} value={row.name ?? ''} onChange={event => update({ name: event.target.value })} /></label>
              <label className="block space-y-1 text-sm font-medium">Tipo de vínculo<input className={amountField} value={row.relationship ?? ''} onChange={event => update({ relationship: event.target.value })} /></label>
              <AmountInput label="Remuneração mensal" value={row.monthly} onChange={monthly => update({ monthly })} />
              <AmountInput label="Encargos mensais" value={row.charges} onChange={charges => update({ charges })} />
              <AmountInput label="Meses previstos" months value={row.months} onChange={months => update({ months })} />
              <AmountInput label="Valor FAJ" value={row.faj} onChange={faj => update({ faj })} />
            </div>
            <p className="mt-3 text-sm text-gray-600">Custo calculado {money(calculated.teamRows[index].total)}</p>
          </fieldset>;
        })}
      </div>
      {team.length < 16 && <button type="button" className="mt-3 rounded-lg border px-3 py-2 text-sm" onClick={() => onChange({ ...value, team: [...team, {}] })}>Adicionar integrante</button>}
    </section>
    <section className={section}>
      <h2 className="mb-3 font-semibold">Orçamento por rubricas</h2>
      <p className="mb-4 text-sm text-gray-600">Pessoal/equipe · {money(calculated.teamTotal)} de custo previsto · {money(calculated.teamFaj)} do FAJ</p>
      <div className="space-y-3">
        {budgetRows.map((row, index) => {
          const update = (patch: Partial<typeof row>) => onChange({ ...value, budgetExcludingTeam: budgetRows.map((item, position) => position === index ? { ...item, ...patch } : item) });
          return <fieldset className="rounded-xl border p-3" key={index}>
            <legend className="px-1 text-sm font-medium">{row.label || budgetLabels[index] || 'Rubrica adicional'}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1 text-sm font-medium">Descrição<input className={amountField} value={row.description ?? ''} onChange={event => update({ description: event.target.value })} /></label>
              <AmountInput label="Custo previsto" value={row.total} onChange={total => update({ total })} />
              <AmountInput label="Valor FAJ" value={row.faj} onChange={faj => update({ faj })} />
            </div>
          </fieldset>;
        })}
      </div>
    </section>
    <section className={section}>
      <h2 className="mb-3 font-semibold">Sustentabilidade financeira</h2>
      <div className="space-y-3">
        {funding.map((row, index) => {
          const update = (patch: Partial<typeof row>) => onChange({ ...value, funding: funding.map((item, position) => position === index ? { ...item, ...patch } : item) });
          return <fieldset className="rounded-xl border p-3" key={index}>
            <legend className="px-1 text-sm font-medium">Recurso {index + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {([['source', 'Financiador / doador'], ['sourceType', 'Tipo de financiador'], ['purpose', 'Finalidade do recurso'], ['project', 'Projeto ou pesquisa']] as const).map(([key, label]) => (
                <label key={key} className="block space-y-1 text-sm font-medium">{label}<input className={amountField} value={row[key] ?? ''} onChange={event => update({ [key]: event.target.value })} /></label>
              ))}
              <label className="block space-y-1 text-sm font-medium">Ano
                <select className={amountField} value={row.year ?? ''} onChange={event => update({ year: event.target.value === '' ? null : Number(event.target.value) })}>
                  <option value="">Selecione</option>
                  {[2025, 2026, 2027].map(year => <option key={year}>{year}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">Situação
                <select className={amountField} value={row.status ?? ''} onChange={event => update({ status: event.target.value })}>
                  <option value="">Selecione</option>
                  {fundingStatuses.map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
              <AmountInput label="Valor" value={row.amount} onChange={amount => update({ amount })} />
            </div>
          </fieldset>;
        })}
      </div>
      {funding.length < 16 && <button type="button" className="mt-3 rounded-lg border px-3 py-2 text-sm" onClick={() => onChange({ ...value, funding: [...funding, {}] })}>Adicionar recurso</button>}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th scope="col" className="p-2">Situação</th>{calculated.sustainability.map(item => <th scope="col" className="p-2" key={item.year}>{item.year}</th>)}</tr></thead>
          <tbody>{fundingStatuses.map(status => <tr className="border-t" key={status}><th scope="row" className="p-2 font-normal">{status}</th>{calculated.sustainability.map(item => <td key={item.year} className="whitespace-nowrap p-2">{money(item.amounts[status])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}

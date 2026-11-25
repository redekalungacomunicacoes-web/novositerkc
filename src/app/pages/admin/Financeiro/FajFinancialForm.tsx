import { budgetLabels, calculateFajFinancials, fundingStatuses, type FajFinancialData, type FajWorkPlanRow } from './fajFinancialCalculations';

const planColumns = [
  ['objective', 'Objetivo'], ['activity', 'Atividade / entrega'], ['outcome', 'Resultado esperado'],
  ['evidence', 'Indicador / evidência'], ['period', 'Período'], ['budgetLine', 'Rubrica / custo'],
  ['notes', 'Observações / apoio do FAJ'],
] as const satisfies readonly [keyof FajWorkPlanRow, string][];

const amountField = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
const section = 'rounded-2xl border border-[#e7e9e2] bg-white p-5 sm:p-6';
const money = (value: number | null) => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function AmountInput({ label, value, onChange, months = false, hideLabel = false }: {
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
  months?: boolean;
  hideLabel?: boolean;
}) {
  return <label className="block space-y-1 text-sm font-medium">
    <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
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
  const planRows = Array.isArray(value.workPlanRows) ? value.workPlanRows : [];
  const legacyPlan = typeof value.workPlan === 'string' ? value.workPlan : '';
  const updatePlan = (index: number, key: keyof FajWorkPlanRow, text: string) => {
    onChange({ ...value, workPlanRows: planRows.map((row, position) => position === index ? { ...row, [key]: text } : row) });
  };
  const calculated = calculateFajFinancials(team, budget, funding);
  const budgetRows = Array.from({ length: Math.max(budgetLabels.length, budget.length) }, (_, index) => budget[index] ?? {});

  return <>
    <section id="plano" className={section}>
      <h2 className="mb-3 font-semibold">Plano de trabalho</h2>
      {legacyPlan.trim() && <details className="mb-4 rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Texto do plano registrado anteriormente</summary>
        <p className="mt-2 whitespace-pre-wrap">{legacyPlan}</p>
      </details>}
      {planRows.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[75rem] text-left text-sm">
          <thead><tr>{planColumns.map(([key, label]) => <th key={key} scope="col" className="p-2 align-bottom">{label}</th>)}<th scope="col" className="p-2">Ações</th></tr></thead>
          <tbody>{planRows.map((row, index) => <tr className="border-t" key={index}>
            {planColumns.map(([key, label]) => <td className="p-2 align-top" key={key}>
              <textarea className={amountField} rows={3} aria-label={`${label}, linha ${index + 1}`} value={row[key] ?? ''}
                onChange={event => updatePlan(index, key, event.target.value)} />
            </td>)}
            <td className="p-2 align-top">
              {planColumns.every(([key]) => !row[key]?.trim()) && <button type="button" className="rounded-lg border px-2 py-1" aria-label={`Remover linha vazia ${index + 1}`}
                onClick={() => onChange({ ...value, workPlanRows: planRows.filter((_, position) => position !== index) })}>Remover</button>}
            </td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="text-sm text-gray-600">Nenhuma ação registrada no plano.</p>}
      <button type="button" disabled={planRows.length >= 13} className="mt-3 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" onClick={() => onChange({ ...value, workPlanRows: [...planRows, {}] })}>Adicionar ação</button>
    </section>
    <section id="equipe" className={section}>
      <h2 className="mb-3 font-semibold">Equipe</h2>
      <p className="mb-3 text-sm text-gray-600">{calculated.teamCount} integrantes identificados • Custo previsto {money(calculated.teamTotal)}</p>
      {team.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Demonstrativo individual da equipe">
        <table className="w-full min-w-[86rem] text-left text-sm">
          <thead><tr>{[
            'Nome ou função', 'Tipo de vínculo', 'Remuneração mensal bruta', 'Encargos mensais',
            'Número de meses previsto', 'Custo anual calculado', 'Valor financiado pelo FAJ',
            '% financiado pelo FAJ (calculado)', 'Observações',
          ].map(label => <th className="p-2 align-bottom" scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{team.map((row, index) => {
            const update = (patch: Partial<typeof row>) => onChange({ ...value, team: team.map((item, position) => position === index ? { ...item, ...patch } : item) });
            const calculatedRow = calculated.teamRows[index];
            return <tr key={index} className="border-t align-top">
              <td className="p-2"><input className={amountField} aria-label={`Nome ou função, linha ${index + 1}`} value={row.name ?? ''} onChange={event => update({ name: event.target.value })} /></td>
              <td className="p-2"><input className={amountField} aria-label={`Tipo de vínculo, linha ${index + 1}`} value={row.relationship ?? ''} onChange={event => update({ relationship: event.target.value })} /></td>
              <td className="p-2"><AmountInput label={`Remuneração mensal bruta, linha ${index + 1}`} hideLabel value={row.monthly} onChange={monthly => update({ monthly })} /></td>
              <td className="p-2"><AmountInput label={`Encargos mensais, linha ${index + 1}`} hideLabel value={row.charges} onChange={charges => update({ charges })} /></td>
              <td className="p-2"><AmountInput label={`Número de meses previsto, linha ${index + 1}`} hideLabel months value={row.months} onChange={months => update({ months })} /></td>
              <td className="whitespace-nowrap p-2">{money(calculatedRow.total)}</td>
              <td className="p-2"><AmountInput label={`Valor financiado pelo FAJ, linha ${index + 1}`} hideLabel value={row.faj} onChange={faj => update({ faj })} /></td>
              <td className="p-2">{calculatedRow.share == null ? '—' : calculatedRow.share.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 2 })}</td>
              <td className="p-2"><input className={amountField} aria-label={`Observações, linha ${index + 1}`} value={row.notes ?? ''} onChange={event => update({ notes: event.target.value })} /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {team.length < 16 && <button type="button" className="mt-3 rounded-lg border px-3 py-2 text-sm" onClick={() => onChange({ ...value, team: [...team, {}] })}>Adicionar integrante</button>}
    </section>
    <section id="rubricas" className={section}>
      <h2 className="mb-3 font-semibold">Orçamento por rubricas</h2>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium">Referência do orçamento
          <textarea rows={2} className={amountField} value={value.budgetReference ?? ''}
            onChange={event => onChange({ ...value, budgetReference: event.target.value })} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Período do orçamento
          <textarea rows={2} className={amountField} value={value.budgetPeriod ?? ''}
            onChange={event => onChange({ ...value, budgetPeriod: event.target.value })} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Observações sobre pessoal
          <textarea rows={2} className={amountField} value={value.personnelNotes ?? ''}
            onChange={event => onChange({ ...value, personnelNotes: event.target.value })} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Mudanças em relação ao orçamento aprovado
          <textarea rows={2} className={amountField} value={value.budgetChanges ?? ''}
            onChange={event => onChange({ ...value, budgetChanges: event.target.value })} />
        </label>
      </div>
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
              <label className="block space-y-1 text-sm font-medium">Observações<input className={amountField} value={row.notes ?? ''} onChange={event => update({ notes: event.target.value })} /></label>
            </div>
          </fieldset>;
        })}
      </div>
    </section>
    <section id="sustentabilidade" className={section}>
      <h2 className="mb-3 font-semibold">Sustentabilidade financeira</h2>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium">Variações e mudanças
          <textarea rows={2} className={amountField} value={value.sustainabilityVariations ?? ''}
            onChange={event => onChange({ ...value, sustainabilityVariations: event.target.value })} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Riscos, captação e sustentabilidade
          <textarea rows={2} className={amountField} value={value.sustainabilityRisks ?? ''}
            onChange={event => onChange({ ...value, sustainabilityRisks: event.target.value })} />
        </label>
      </div>
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
              <label className="block space-y-1 text-sm font-medium">Data ou período previsto de entrada
                <input className={amountField} value={row.expectedDate ?? ''} onChange={event => update({ expectedDate: event.target.value })} />
              </label>
              <label className="block space-y-1 text-sm font-medium">Observações<input className={amountField} value={row.notes ?? ''} onChange={event => update({ notes: event.target.value })} /></label>
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

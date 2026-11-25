import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, BookOpen, ChevronRight, Info, Maximize, Share2 } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatDate, money, parsePublicReport, percentage, sections, type PublicReport, type PublicRow, type Section } from './model';
import { Gallery, NarrativeAnswer } from './EditorialMedia';
import './dashboard.css';

const financialTabs: Section[] = ['overview', 'plan', 'funding', 'team', 'budget'];
const narrativeTabs: Section[] = ['institution', 'narrative', 'records', 'impact', 'results'];
const valueText = (value: PublicRow[string] | undefined) => value == null || value === '' ? 'Não informado' : String(value);
const sumMoney = (rows: PublicRow[], key: string) => {
  const values = rows.flatMap(row => typeof row[key] === 'number' ? [Math.round(row[key] * 100)] : []);
  return values.length ? values.reduce((total, value) => total + value, 0) / 100 : null;
};
const unique = (rows: PublicRow[], field: string) => Array.from(new Set(rows.map(row => row[field]).filter(value => value != null)));

export function DashboardContent({ report, section, navigate, initialRubric }: { report: PublicReport; section: Section; navigate?: (section: Section, rubric?: string) => void; initialRubric?: string }) {
  const [table, setTable] = useState(section === 'budget' || section === 'impact');
  const [timeline, setTimeline] = useState(false);
  const rows = report.content[section] ?? [];
  const overview = report.content.overview?.[0] ?? {};
  const officialResults = section === 'results' && report.content.narrative?.length === 4;
  const fundingComments = rows.find(row => row.purposeComment || row.projectComment);

  return <section className="rkc-account-section" aria-labelledby="account-section-title">
    <h2 id="account-section-title">{sections[section]}</h2>
    {section === 'records' && rows.length > 0 && <Gallery rows={rows} />}
    {officialResults && <p className="rkc-account-panel">
      <Link className="rkc-account-text-link" to={{ search: '?aba=narrative', hash: '#pergunta-4' }}>
        {report.content.narrative?.[3].label} <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </p>}
    {!rows.length && section !== 'overview' && !officialResults ? <p className="rkc-account-panel">Dados indisponíveis nesta versão pública.</p> : <>
      {(section === 'budget' || section === 'impact') && <ViewSwitch table={table} onChange={setTable} />}
      {section === 'plan' && <div className="rkc-account-switch" role="group" aria-label="Exibição do plano">
        <button type="button" aria-pressed={!timeline} onClick={() => setTimeline(false)}>Tabela de atividades</button>
        <button type="button" aria-pressed={timeline} onClick={() => setTimeline(true)}>Cronograma</button>
      </div>}
      {section === 'overview' && <>
        <Identification report={report} row={overview} navigate={navigate} />
      </>}
      {section === 'budget' && <>
        {overview.total != null && <BudgetComposition row={overview} label="Orçamento previsto" />}
        {rows.length > 0 && <Budget rows={rows} openRubric={initialRubric ?? ''} table={table} total={overview.total} plan={report.content.plan ?? []} />}
        <BudgetSource row={overview} />
      </>}
      {section === 'team' && <TeamSummary row={rows[0]} navigate={navigate} />}
      {(section === 'team_members' || section === 'team') && !!report.content.team_members?.length &&
        <TeamMembers rows={report.content.team_members} />}
      {section === 'funding' && <>
        <SourceTable title="Registros de financiamento" rows={rows} columns={[
          ['label', 'Financiador ou doador'], ['type', 'Tipo de financiador'], ['purpose', 'Finalidade do recurso', fundingComments?.purposeComment],
          ['project', 'Nome do projeto ou pesquisa', fundingComments?.projectComment], ['year', 'Ano do recurso'],
          ['total', 'Valor (R$)'], ['status', 'Situação'], ['expectedDate', 'Data ou período previsto de entrada'], ['notes', 'Observações'],
        ]} />
        <details className="rkc-account-panel">
          <summary>Valores por situação e ano</summary>
          <FundingSummary rows={rows} overview={overview} />
        </details>
        <details className="rkc-account-panel">
          <summary>Contexto da sustentabilidade</summary>
          <PublicFields row={overview} fields={{ fundingChanges: 'Variações e mudanças', fundingRisks: 'Riscos, captação e sustentabilidade' }} />
        </details>
      </>}
      {section === 'plan' && (timeline
        ? <div className="rkc-account-stack rkc-account-timeline">{rows.map((row, index) => <details key={index} className="rkc-account-panel">
          <summary><small>{row.period}</small>{row.activity || row.label || 'Atividade'}</summary>
          <PublicFields row={row} fields={Object.fromEntries(planColumns)} />
        </details>)}</div>
        : <SourceTable title="Atividades do plano de trabalho" rows={rows} columns={planColumns} />)}
      {section === 'narrative' && <div className="rkc-account-reading">
        <nav aria-label="Índice das perguntas"><ol>{rows.map((row, index) => <li key={index}>
          <a href={'#pergunta-' + (index + 1)}>{row.label}</a>
        </li>)}</ol></nav>
        <div>{rows.map((row, index) => <article id={'pergunta-' + (index + 1)} key={index} className="rkc-account-editorial">
          <h3>{row.label}</h3>
          {row.guidance && <p className="rkc-account-guidance">{row.guidance}</p>}
          <NarrativeAnswer row={row} media={(report.content.records ?? []).filter(item => item.question === index + 1)} />
        </article>)}</div>
      </div>}
      {(section === 'institution' || (section === 'results' && !officialResults)) && <div className="rkc-account-stack">{rows.map((row, index) =>
        <article className="rkc-account-panel" key={index}><h3>{row.label}</h3><p className="rkc-account-body">{row.body}</p></article>)}</div>}
      {section === 'impact' && table && <ImpactTable rows={rows} />}
      {section === 'impact' && !table && <div className="rkc-account-cards">{rows.map((row, index) => <article className="rkc-account-panel" key={index}>
        <small>{row.channel}</small><h3>{row.label}</h3>
        <dl className="rkc-account-periods">{([['2025', 'prior'], ['2026', 'current']] as const).map(([year, key]) =>
          <div key={key}><dt>{year}</dt><dd className="rkc-account-value">{valueText(row[key])}</dd>
            {(row[key + 'Start'] || row[key + 'End']) && <small>{[row[key + 'Start'], row[key + 'End']].filter(Boolean).join(' a ')}</small>}</div>)}</dl>
        <ImpactComparison row={row} />
        {row.variation && <p>Variação informada · {row.variation}</p>}
        {row.notes && <details><summary>Observações</summary><p className="rkc-account-body">{row.notes}</p></details>}
      </article>)}</div>}
    </>}
    <SourceInstructions value={overview[section + 'Instructions']} />
  </section>;
}

function SourceInstructions({ value }: { value: PublicRow[string] }) {
  return typeof value === 'string' && value ? <details className="rkc-account-panel">
    <summary>Instruções da planilha oficial</summary>
    <p className="rkc-account-body">{value}</p>
  </details> : null;
}

function CellNote({ value, label }: { value: PublicRow[string]; label?: string }) {
  if (typeof value !== 'string' || !value) return null;
  return <details className="rkc-account-note"><summary><Info size={16} aria-hidden="true" /> {label ? label + " · Comentário da célula" : "Comentário da célula"}</summary>
    <p className="rkc-account-value">{value}</p>
  </details>;
}

function ViewSwitch({ table, onChange }: { table: boolean; onChange: (table: boolean) => void }) {
  return <div className="rkc-account-switch" role="group" aria-label="Modo de visualização">
    <button type="button" aria-pressed={!table} onClick={() => onChange(false)}>Gráficos</button>
    <button type="button" aria-pressed={table} onClick={() => onChange(true)}>Tabela completa</button>
  </div>;
}

function ImpactTable({ rows }: { rows: PublicRow[] }) {
  return <div className="rkc-account-table" tabIndex={0} role="region" aria-label="Comparativo de impacto e engajamento"><table>
    <thead><tr>{['Canal / formato', 'Indicadores', '2025', '2026', 'Variação', 'Observações'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}><th scope="row">{row.channel}</th><td>{row.label}</td>
      {['prior', 'current'].map(key => <td key={key}><div className="rkc-account-value">{valueText(row[key])}</div>
        <small>{[row[key + 'Start'], row[key + 'End']].filter(Boolean).join(' a ')}</small></td>)}
      <td>{valueText(row.variation)}</td><td className="rkc-account-value">{valueText(row.notes)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function PublicFields({ row, fields }: { row: PublicRow; fields: Record<string, string> }) {
  const entries = Object.entries(fields).filter(([key]) => row[key] != null);
  if (!entries.length) return null;
  return <dl className="rkc-account-source-fields">{entries.map(([key, label]) => <div key={key}>
    <dt>{label}</dt><dd className="rkc-account-value">{row[key]}</dd>
  </div>)}</dl>;
}

function FundingSummary({ rows, overview }: { rows: PublicRow[]; overview: PublicRow }) {
  const statuses = typeof overview.funders2025 === 'number' ? [
    'Confirmado – recurso recebido', 'Confirmado – a receber', 'Em negociação', 'Potencial doador / prospecção',
  ] : unique(rows, 'status');
  const years = unique(rows, 'year').sort((a, b) => Number(a) - Number(b));
  if (!statuses.length || !years.length) return null;
  return <><div className="rkc-account-cards">{statuses.map(status => <article key={status} className="rkc-account-panel">
    <h3>{status}</h3>
    <dl className="rkc-account-periods">{years.map(year => {
      const values = rows.filter(row => row.year === year && row.status === status && typeof row.total === 'number');
      const total = values.length ? values.reduce((sum, row) => sum + Math.round(Number(row.total) * 100), 0) / 100 : null;
      return <div key={year}><dt>{year}</dt><dd>{total === null ? money(typeof overview.funders2025 === 'number' ? 0 : null) : money(total)}</dd></div>;
    })}</dl>
  </article>)}</div>
    {years.some(year => typeof overview['funders' + year] === 'number') && <div className="rkc-account-panel">
      <h3>Financiadores confirmados, exceto FAJ</h3>
      <dl className="rkc-account-periods">{years.map(year => <div key={year}><dt>{year}</dt>
        <dd>{valueText(overview['funders' + year])}</dd></div>)}</dl>
    </div>}
  </>;
}

function ImpactComparison({ row }: { row: PublicRow }) {
  const { prior, current } = row;
  if (row.label === 'Dados gerais do canal' || typeof prior !== 'number' || typeof current !== 'number' || prior < 0 || current < 0) return null;
  const days = (start: PublicRow[string], end: PublicRow[string]) =>
    typeof start === 'string' && typeof end === 'string' ? Date.parse(end) - Date.parse(start) : NaN;
  const priorDuration = days(row.priorStart, row.priorEnd);
  if (!(priorDuration >= 0 && priorDuration === days(row.currentStart, row.currentEnd))) return null;
  if ((row.priorStart as string).slice(5) !== (row.currentStart as string).slice(5)) return null;
  const max = Math.max(prior, current, 1);
  return <div className="rkc-account-impact-bars" aria-hidden="true">
    {[prior, current].map((value, index) => <div key={index} className="rkc-account-track">
      <div className="rkc-account-bar" style={{ width: percentageWidth(value / max) }} />
    </div>)}
  </div>;
}

const planColumns = [
  ['label', 'Objetivo'], ['activity', 'Atividade ou entrega'], ['outcome', 'Resultado esperado'],
  ['evidence', 'Indicador ou evidência'], ['period', 'Período'], ['budgetLine', 'Rubrica ou custo'],
  ['notes', 'Observações e apoio do FAJ'],
] as const;

function SourceTable({ title, rows, columns }: {
  title: string; rows: PublicRow[]; columns: readonly (readonly [string, string, PublicRow[string]?])[];
}) {
  return <div className="rkc-account-table rkc-account-source-table" tabIndex={0} role="region" aria-label={title}>
    <table>
      <thead><tr>{columns.map(([key, label, comment]) => <th key={key} scope="col">{label}
        {comment && <CellNote value={comment} />}
      </th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{columns.map(([key], column) => {
        const field = row[key];
        const value = ['total', 'faj', 'other', 'monthly', 'charges'].includes(key) && typeof field !== 'string'
          ? money(field)
          : key === 'expectedDate' && typeof field === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(field) && Number.isFinite(Date.parse(field))
            ? formatDate(field) : valueText(field);
        return column === 0 ? <th key={key} scope="row">{value}</th> : <td key={key} className={key === 'notes' ? 'rkc-account-observation' : undefined}>{value}</td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}

function Identification({ report, row, navigate }: {
  report: PublicReport; row: PublicRow; navigate?: (section: Section, rubric?: string) => void;
}) {
  const fields = report.content.institution ?? [];
  const organization = row.organization ?? fields.find(field => field.label === 'Organização' || field.label === 'Nome da organização')?.body;
  const period = fields.find(field => field.label === 'Período de renovação' || field.label === 'Período previsto da renovação')?.body
    ?? [report.period_start, report.period_end].filter(Boolean).map(formatDate).join(' a ');
  return <article className="rkc-account-identity">

    <dl>
      <div><dt>Nome da organização</dt><dd>{valueText(organization)}</dd></div>
      <div><dt>Período previsto da renovação</dt><dd>{period || 'Não informado'}</dd></div>
      {row.reference != null && <div><dt>Exercício de referência</dt><dd>{row.reference}</dd></div>}
      {row.faj != null && <div><dt>Solicitado ao FAJ</dt><dd className="rkc-account-requested">{money(row.faj)}</dd></div>}
    </dl>
    {navigate && <button type="button" onClick={() => navigate('budget')}>Consultar orçamento por rubricas <ArrowUpRight size={16} /></button>}
  </article>;
}

function TeamSummary({ row, navigate }: { row: PublicRow; navigate?: (section: Section, rubric?: string) => void }) {
  const share = typeof row.total === 'number' && row.total > 0 && typeof row.faj === 'number' ? row.faj / row.total : null;
  return <>
    <h3 className="rkc-account-subheading">Composição e custo previsto da equipe</h3>
    <SourceTable title="Totais da equipe" rows={[{ ...row, faj: money(row.faj), other: money(row.other), share: percentage(share) }]} columns={[
      ['count', 'Integrantes'], ['total', 'Custo anual previsto'], ['faj', 'Valor previsto do FAJ'],
      ['other', 'Outras fontes previstas'], ['share', '% do custo coberto pelo FAJ'],
    ]} />
    <CellNote value={row.roleComment} label="Equipe permanente" />
    <CellNote value={row.relationshipComment} label="Tipo de vínculo" />
    {navigate && <button className="rkc-account-team-link" type="button" onClick={() => navigate('budget', 'Pessoal/equipe')}>Ver rubrica Pessoal/equipe</button>}
  </>;
}

function TeamMembers({ rows }: { rows: PublicRow[] }) {
  return <>
    <h3 className="rkc-account-subheading">Funções, vínculos e remunerações previstas</h3>
    <p>{rows.length} funções · Valor previsto do FAJ {money(sumMoney(rows, 'faj'))}</p>
    <SourceTable title="Remuneração e vínculo por função" rows={rows} columns={[
      ['name', 'Função'], ['relationship', 'Vínculo'], ['monthly', 'Remuneração mensal bruta'],
      ['charges', 'Encargos mensais'], ['months', 'Meses previstos'], ['faj', 'Valor previsto do FAJ'],
      ['notes', 'Observações'],
    ]} />
  </>;
}

function BudgetSource({ row }: { row: PublicRow }) {
  return <>
    {(row.budgetCheck != null || row.fajCheck != null || row.teamCheck != null) && <details className="rkc-account-panel">
      <summary>Valores de conferência da planilha</summary>
      <PublicFields row={{
        budgetCheck: row.budgetCheck == null ? null : money(row.budgetCheck),
        fajCheck: row.fajCheck == null ? null : money(row.fajCheck),
        teamCheck: row.teamCheck == null ? null : money(row.teamCheck),
      }} fields={{ budgetCheck: 'Despesa total prevista', fajCheck: 'Valor FAJ previsto', teamCheck: 'Custo total da equipe' }} />
    </details>}
    <PublicFields row={row} fields={{ reference: 'Exercício do orçamento', period: 'Período do orçamento', notes: 'Mudanças em relação ao orçamento aprovado' }} />
  </>;
}

function percentageWidth(value: number) { return Math.min(100, Math.max(0, value * 100)) + '%'; }

function BudgetComposition({ row, label }: { row: PublicRow; label: string }) {
  const share = typeof row.share === 'number' && row.share >= 0 && row.share <= 1 ? row.share : null;
  return <figure className="rkc-account-composition">
    <figcaption><span>{label}</span><strong>{money(row.total)}</strong></figcaption>
    {share !== null && <div className="rkc-account-donut" aria-hidden="true"
      style={{ background: `conic-gradient(var(--chart-faj) ${share * 100}%, var(--chart-other) 0)` }}><span>{percentage(share)}<small>FAJ</small></span></div>}
    <dl className="rkc-account-composition-key">
      <div><dt>{label === 'Custo previsto da equipe' ? 'Parcela prevista do FAJ' : 'Solicitado ao FAJ'}</dt><dd>{money(row.faj)}{share !== null && <small>{percentage(share)}</small>}</dd></div>
      <div><dt>Outras fontes previstas</dt><dd>{money(row.other)}{share !== null && <small>{percentage(1 - share)}</small>}</dd></div>
    </dl>
  </figure>;
}

function RubricSource({ row, plan }: { row: PublicRow; plan: PublicRow[] }) {
  const related = plan.filter(activity => typeof activity.budgetLine === 'string' &&
    activity.budgetLine.split(';').some(label => label.trim().replace(/\.$/, '') === String(row.label).trim()));
  return <>
    <PublicFields row={row} fields={{ description: 'Descrição', notes: 'Observações da planilha' }} />
    <CellNote value={row.cellComment} />
    {related.length > 0 && <details className="rkc-account-linked-activities">
      <summary>Atividades vinculadas no plano de trabalho ({related.length})</summary>
      <ul className="rkc-account-linked">{related.map((activity, index) => <li key={index}>{activity.activity}</li>)}</ul>
    </details>}
  </>;
}

function RubricExplorer({ rows, total, plan }: { rows: PublicRow[]; total: PublicRow[string]; plan: PublicRow[] }) {
  const [selected, setSelected] = useState<PublicRow[string]>(null);
  const active = rows.find(row => row.label === selected) ?? rows[0];
  const max = Math.max(1, ...rows.map(row => Number(row.total) || 0));
  const share = typeof total === 'number' && total > 0 && typeof active.total === 'number' ? active.total / total : null;
  return <div className="rkc-account-explorer">
    <div className="rkc-account-explorer-list">
      <div className="rkc-account-legend"><span>FAJ solicitado</span><span>Outras fontes previstas</span></div>
      <div role="group" aria-label="Selecionar rubrica">
        {rows.map((row, index) => <button key={index} type="button"
          aria-pressed={row === active} aria-controls="account-rubric-detail" onClick={() => setSelected(row.label)}>
          <span>{row.label}</span><strong>{money(row.total)}</strong><ChevronRight aria-hidden="true" size={16} />
          {typeof row.total === 'number' && <span className="rkc-account-track" aria-hidden="true">
            <span className="rkc-account-bar" style={{ width: percentageWidth(row.total / max) }}>
              <span style={{ width: percentageWidth(row.total > 0 && typeof row.faj === 'number' ? row.faj / row.total : 0) }} />
            </span>
          </span>}
        </button>)}
      </div>
    </div>
    <section id="account-rubric-detail" className="rkc-account-inspector" aria-label="Detalhamento da rubrica">
      <div aria-live="polite">
        <h4>{active.label}</h4>
        <strong className="rkc-account-inspector-value">{money(active.total)}</strong>
        {share !== null && <p>{percentage(share)} do orçamento previsto</p>}
        <dl className="rkc-account-inspector-breakdown">
          <div><dt>FAJ solicitado</dt><dd>{money(active.faj)}</dd></div>
          <div><dt>Outras fontes previstas</dt><dd>{money(active.other)}</dd></div>
          <div><dt>Participação FAJ nesta rubrica</dt><dd>{rubricShare(active)}</dd></div>
        </dl>
      </div>
      <RubricSource key={String(active.label)} row={active} plan={plan} />
    </section>
  </div>;
}

function Budget({ rows, openRubric, table, total, plan }: {
  rows: PublicRow[]; openRubric: string; table: boolean; total: PublicRow[string]; plan: PublicRow[];
}) {
  return !table ? <RubricExplorer rows={rows} total={total} plan={plan} /> :
    <div className="rkc-account-table" tabIndex={0} role="region" aria-label="Tabela de dados"><table>
      <thead><tr><th>Rubrica</th><th>Custo previsto</th><th>FAJ solicitado</th><th>Outras fontes previstas</th><th>Participação FAJ</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}><th scope="row"><details open={row.label === openRubric || undefined}><summary>{row.label}</summary><RubricSource row={row} plan={plan} /></details></th><td>{money(row.total)}</td>
        <td>{money(row.faj)}</td><td>{money(row.other)}</td>
        <td>{rubricShare(row)}</td></tr>)}</tbody>
    </table></div>;
}

function rubricShare(row: PublicRow) {
  return percentage(typeof row.share === 'number' ? row.share : typeof row.total === 'number' && row.total > 0 && typeof row.faj === 'number' ? row.faj / row.total : null);
}

export default function Dashboard() {
  const { slug: routeSlug = '', view } = useParams();
  const slug = routeSlug === 'faj-ii-ciclo-painel' ? 'faj-ii-ciclo' : routeSlug;
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<{ slug: string; report: PublicReport | null; error: boolean }>();
  const [notice, setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const report = state?.slug === slug ? state.report : null;
  const landing = !view;
  const narrative = view === 'narrativo';
  const tabs = narrative ? narrativeTabs : financialTabs;
  const rubric = params.get('rubrica') ?? '';
  const goTo = (tab: Section, label?: string) => setParams({ aba: tab, ...(label ? { rubrica: label } : {}) });
  const candidate = params.get('aba') as Section | null;
  const section = candidate && tabs.includes(candidate) ? candidate : tabs[0];
  const base = '/prestacao-de-contas/' + encodeURIComponent(slug === 'faj-ii-ciclo' ? 'faj-ii-ciclo-painel' : slug);

  useEffect(() => {
    let active = true;
    void supabase.rpc('get_finance_accountability_public_report', { requested_slug: slug }).then(({ data, error }) => {
      if (!active) return;
      const parsed = parsePublicReport(data);
      setState({ slug, report: parsed, error: !!error || (data != null && parsed === null) });
    });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!report) return;
    const old = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const oldDescription = description?.content ?? '';
    if (description) description.content = 'Orçamento, relatório narrativo e indicadores de ' + report.title + ', publicados pela Rede Kalunga de Comunicações.';
    document.title = report.title + ' | Prestação de contas · Rede Kalunga';
    return () => { document.title = old; if (description) description.content = oldDescription; };
  }, [report]);

  useEffect(() => {
    if (section === 'narrative' && /^#pergunta-[1-4]$/.test(hash)) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [hash, report, section]);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: location.href });
      else {
        await navigator.clipboard.writeText(location.href);
        setNotice('Link copiado.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice('Não foi possível compartilhar o link.');
    }
  };

  const presentation = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setNotice('Tela cheia indisponível neste navegador.');
    } catch { setNotice('Não foi possível ativar a tela cheia.'); }
  };

  if (landing) return <main className="rkc-account rkc-account-landing" aria-label="FAJ II Ciclo">
    <div className="rkc-account-landing-inner">
      <div className="rkc-account-brands">
        <img className="rkc-account-logo" src="/prestacao-de-contas/marcas/rede-kalunga.png" alt="Rede Kalunga de Comunicações" width="1610" height="402" />
        {slug === 'faj-ii-ciclo' && <img className="rkc-account-faj" src="/prestacao-de-contas/marcas/faj-azul.png"
          alt="Fundo de Apoio ao Jornalismo" width="349" height="111" />}
      </div>
      <nav className="rkc-account-entry" aria-label="Acessar a prestação de contas">
        <Link to={base + '/financeiro'}>Dashboard Financeiro</Link>
        <Link to={base + '/narrativo'}>Relatório Narrativo</Link>
      </nav>
    </div>
  </main>;

  return <div className="rkc-account" ref={root}>
    <a className="rkc-account-skip" href="#account-main">Ir para o conteúdo</a>
    <header className="rkc-account-top"><div className="rkc-account-wrap">
      <div className="rkc-account-brands">
        <Link to="/" aria-label="Página inicial da Rede Kalunga">
          <img className="rkc-account-logo" src="/prestacao-de-contas/marcas/rede-kalunga.png" alt="Rede Kalunga de Comunicações" width="1610" height="402" />
        </Link>
        {slug === 'faj-ii-ciclo' && report && <div className="rkc-account-funder">
          <small>Financiamento via edital</small>
          <img className="rkc-account-faj" src="/prestacao-de-contas/marcas/faj-azul.png"
            alt="Fundo de Apoio ao Jornalismo" width="349" height="111" />
        </div>}
      </div>
      <div className="rkc-account-actions">{report && <>
        <button type="button" onClick={() => void share()}><Share2 size={16} /> Compartilhar</button>
        <button type="button" onClick={() => void presentation()}><Maximize size={16} /> Apresentação</button>
        <button type="button" onClick={() => {
          const closed = Array.from(root.current?.querySelectorAll<HTMLDetailsElement>('details:not([open])') ?? []);
          closed.forEach(detail => { detail.open = true; });
          window.addEventListener('afterprint', () => closed.forEach(detail => { detail.open = false; }), { once: true });
          window.print();
        }}>Imprimir ou salvar em PDF</button>
      </>}</div>
    </div></header>
    {notice && <p className="rkc-account-wrap" role="status">{notice}</p>}
    <main id="account-main">
      <div className="rkc-account-hero"><div className="rkc-account-wrap">
        <div><h1>{narrative ? 'Relatório Narrativo' : 'Dashboard Financeiro'}</h1>
          {report && <p>{report.title}</p>}
        </div>
      </div></div>
      <div className="rkc-account-wrap">
        {state?.slug !== slug ? <p role="status">Carregando prestação…</p> : !report || (view !== 'financeiro' && !narrative)
          ? <p role="status">{state.error ? 'Erro ao consultar a prestação. Atualize a página para tentar novamente.' : 'Prestação indisponível para consulta pública.'}</p>
          : <>
            <nav className="rkc-account-views" aria-label="Páginas da prestação">
              <Link to={base}>Início</Link>
              <Link to={base + '/financeiro'} aria-current={!narrative ? 'page' : undefined}><BarChart3 size={20} /> Financeiro</Link>
              <Link to={base + '/narrativo'} aria-current={narrative ? 'page' : undefined}><BookOpen size={20} /> Narrativo e impacto</Link>
            </nav>
            <div className="rkc-account-tabs" role="tablist" aria-label="Seções da prestação">
              {tabs.map((tab, index) => <Link key={tab} id={'account-tab-' + tab} to={{ search: '?aba=' + tab }}
                role="tab" aria-selected={tab === section} aria-controls="account-tab-panel"
                aria-current={tab === section ? 'location' : undefined} tabIndex={tab === section ? 0 : -1}
                onKeyDown={event => {
                  if (event.key === ' ') {
                    event.preventDefault();
                    goTo(tab);
                    return;
                  }
                  const next = { ArrowLeft: (index + tabs.length - 1) % tabs.length,
                    ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
                  if (next === undefined) return;
                  event.preventDefault();
                  goTo(tabs[next]);
                  document.getElementById('account-tab-' + tabs[next])?.focus();
                }}>{sections[tab]}</Link>)}
            </div>
            <div id="account-tab-panel" role="tabpanel" aria-labelledby={'account-tab-' + section} tabIndex={0}>
              <DashboardContent key={section + slug + rubric} report={report} section={section} navigate={goTo} initialRubric={rubric} />
            </div>
          </>}
      </div>
    </main>
    <footer className="rkc-account-wrap rkc-account-footer"><Link to="/">Rede Kalunga de Comunicações <ArrowUpRight size={16} /></Link></footer>
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, BookOpen, Info, Maximize, Share2 } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatDate, money, percentage, sections, type PublicReport, type PublicRow, type Section } from './model';
import { Gallery, NarrativeAnswer } from './EditorialMedia';
import './dashboard.css';

const financialTabs: Section[] = ['overview', 'budget', 'team', 'funding', 'plan'];
const narrativeTabs: Section[] = ['institution', 'narrative', 'records', 'impact', 'results'];
const valueText = (value: PublicRow[string] | undefined) => value == null ? 'Não informado' : String(value);
const unique = (rows: PublicRow[], field: string) => Array.from(new Set(rows.map(row => row[field]).filter(value => value != null)));

export function DashboardContent({ report, section, navigate, initialRubric }: { report: PublicReport; section: Section; navigate?: (section: Section, rubric?: string) => void; initialRubric?: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(initialRubric ?? '');
  const [sort, setSort] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [table, setTable] = useState(false);
  const [funder, setFunder] = useState('');
  const [type, setType] = useState('');
  const [timeline, setTimeline] = useState(false);
  const rows = report.content[section] ?? [];
  const overview = report.content.overview?.[0] ?? {};
  const officialResults = section === 'results' && report.content.narrative?.length === 4;
  const fundingComments = rows.find(row => row.purposeComment || row.projectComment);
  const field = { impact: 'channel', funding: 'year', plan: 'label', budget: 'label' }[section as 'impact' | 'funding' | 'plan' | 'budget'];
  const filterLabel = { impact: 'Canal', funding: 'Ano', plan: 'Objetivo', budget: 'Rubrica' }[section as 'impact' | 'funding' | 'plan' | 'budget'];
  const filtered = rows.filter(row =>
    (!filter || String(row[field]) === filter) &&
    (!status || row.status === status) &&
    (!funder || row.label?.toString().trim() === funder) &&
    (!type || row.type === type) &&
    (!period || String(row.period) === period) &&
    (!query || Object.values(row).some(value => value != null && String(value).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))),
  );
  const visible = sort ? [...filtered].sort((a, b) => sort === 'total'
    ? Number(b.total ?? -1) - Number(a.total ?? -1)
    : valueText(a.label).localeCompare(valueText(b.label), 'pt-BR')) : filtered;

  return <section className="rkc-account-section" aria-labelledby="account-section-title">
    <h2 id="account-section-title">{sections[section]}</h2>
    {section === 'records' && rows.length > 0 && <Gallery rows={rows} />}
    {officialResults && <p className="rkc-account-panel">
      <Link className="rkc-account-text-link" to={{ search: '?aba=narrative', hash: '#pergunta-4' }}>
        {report.content.narrative?.[3].label} <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </p>}
    {!rows.length && !officialResults ? <p className="rkc-account-panel">Dados indisponíveis nesta versão pública.</p> : <>
      {field && <div className="rkc-account-tools">
        <label>Buscar<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label>{filterLabel}<select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">Todos</option>{unique(rows, field).map(option => <option key={option}>{option}</option>)}
        </select></label>
        {section === 'funding' && <label>Situação<select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">Todas</option>{unique(rows, 'status').map(option => <option key={option}>{option}</option>)}
        </select></label>}
        {section === 'funding' && <>
          <label>Financiador<select value={funder} onChange={event => setFunder(event.target.value)}>
            <option value="">Todos</option>{[...new Set(unique(rows, 'label').map(item => String(item).trim()))].map(option => <option key={option}>{option}</option>)}
          </select></label>
          <label>Tipo<select value={type} onChange={event => setType(event.target.value)}>
            <option value="">Todos</option>{unique(rows, 'type').map(option => <option key={option}>{option}</option>)}
          </select></label>
        </>}
        {section === 'plan'  && unique(rows, 'period').length > 0 && <label>Período
          <select value={period} onChange={event => setPeriod(event.target.value)}>
            <option value="">Todos</option>{unique(rows, 'period').map(option => <option key={option}>{option}</option>)}
          </select>
        </label>}
        {section === 'budget' && <label>Ordenar<select value={sort} onChange={event => setSort(event.target.value)}>
          <option value="">Ordem original</option><option value="label">Rubrica</option><option value="total">Maior valor previsto</option>
        </select></label>}
      </div>}
      {(section === 'budget' || section === 'impact') && <ViewSwitch table={table} onChange={setTable} />}
      {section === 'plan' && <div className="rkc-account-switch" role="group" aria-label="Exibição do plano">
        <button type="button" aria-pressed={!timeline} onClick={() => setTimeline(false)}>Atividades</button>
        <button type="button" aria-pressed={timeline} onClick={() => setTimeline(true)}>Cronograma</button>
      </div>}
      {!visible.length && <p role="status">Nenhum registro para os filtros selecionados.</p>}
      {section === 'overview' && <Overview row={rows[0]} rubrics={report.content.budget ?? []} navigate={navigate} />}
      {section === 'budget' && visible.length > 0 && <Budget rows={visible} openRubric={filter} table={table} plan={report.content.plan ?? []} />}
      {section === 'team' && <Overview row={{ ...rows[0], share: Number(rows[0].total) > 0 && typeof rows[0].faj === 'number' ? rows[0].faj / Number(rows[0].total) : null }}
        rubrics={[]} team navigate={navigate} />}
      {section === 'funding' && <><FundingSummary rows={rows} overview={overview} filter={(year, selectedStatus) => { setFilter(String(year)); setStatus(String(selectedStatus)); }} /><div className="rkc-account-table" tabIndex={0} role="region" aria-label="Tabela de dados"><table>
        <thead><tr><th>Fonte</th><th>Tipo</th><th>Ano</th><th>Situação</th><th>Valor</th></tr></thead>
        <tbody>{visible.map((row, index) => <tr key={index}>
          <th scope="row">{(row.purpose || row.project || row.expectedDate || row.notes) ? <details><summary>{valueText(row.label)}</summary><PublicFields row={row} fields={{ purpose: "Finalidade", project: "Projeto ou pesquisa", expectedDate: "Entrada prevista", notes: "Observações" }}
             /></details> : valueText(row.label)}</th><td>{valueText(row.type)}</td><td>{valueText(row.year)}</td>
          <td>{valueText(row.status)}</td><td>{money(row.total)}</td>
        </tr>)}</tbody>
      </table></div>
        {fundingComments && <div className="rkc-account-note-fields">
          <CellNote value={fundingComments.purposeComment} label="Finalidade do recurso" />
          <CellNote value={fundingComments.projectComment} label="Nome do projeto ou pesquisa" />
        </div>}
        <PublicFields row={overview} fields={{ fundingChanges: "Variações e mudanças", fundingRisks: "Riscos, captação e sustentabilidade" }} /></>}
      {section === 'plan' && <div className={timeline ? 'rkc-account-stack rkc-account-timeline' : 'rkc-account-stack'}>{visible.map((row, index) => <details key={index} className="rkc-account-panel">
        <summary>{timeline && row.period && <small>{row.period}</small>}{row.activity || row.label || 'Atividade'}{!timeline && row.period && <small>{row.period}</small>}</summary>
        <dl>{Object.entries({ label: 'Objetivo', outcome: 'Resultado esperado', evidence: 'Evidência prevista', period: 'Período', budgetLine: 'Rubricas vinculadas', notes: 'Observações e suporte do FAJ' })
          .filter(([key]) => row[key] != null).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{row[key]}</dd></div>)}</dl>
      </details>)}</div>}
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
      {section === 'impact' && table && <ImpactTable rows={visible} />}
      {section === 'impact' && !table && <div className="rkc-account-cards">{visible.map((row, index) => <article className="rkc-account-panel" key={index}>
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

function FundingSummary({ rows, overview, filter }: { rows: PublicRow[]; overview: PublicRow; filter: (year: number | string, status: number | string) => void }) {
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
      return <div key={year}><dt>{year}</dt><dd>{total === null ? money(typeof overview.funders2025 === 'number' ? 0 : null) : <button type="button" onClick={() => filter(year!, status!)}>{money(total)}</button>}</dd></div>;
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
  const count = (value: PublicRow[string]) => {
    if (typeof value === 'number') return value;
    return typeof value === 'string' && /^\d{1,3}(?:\.\d{3})+$|^\d+$/.test(value.trim()) ? Number(value.replaceAll('.', '')) : null;
  };
  const prior = count(row.prior);
  const current = count(row.current);
  if (row.label === 'Dados gerais do canal' || prior === null || current === null || prior < 0 || current < 0) return null;
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

function Overview({ row, rubrics, navigate, team = false }: {
  row: PublicRow; rubrics: PublicRow[]; navigate?: (section: Section, rubric?: string) => void; team?: boolean;
}) {
  const share = typeof row.share === 'number' && row.share >= 0 && row.share <= 1 ? row.share : null;
  const top = [...rubrics].filter(item => typeof item.total === 'number').sort((a, b) => Number(b.total) - Number(a.total)).slice(0, 5);
  return <>
    {team && typeof row.count === 'number' && <p className="rkc-account-team-count">{row.count} integrantes</p>}
    <div className="rkc-account-cards rkc-account-metrics">{[
      [team ? 'Custo previsto da equipe' : 'Orçamento previsto', money(row.total)],
      [team ? 'Parcela prevista do FAJ' : 'Solicitado ao FAJ', money(row.faj)],
      ['Outras fontes previstas', money(row.other)],
    ].map(([label, value]) => <article className="rkc-account-panel" key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div>
    {share !== null && <figure className="rkc-account-panel">
      <figcaption>{team ? 'Composição do custo da equipe' : 'Composição do orçamento previsto'}</figcaption>
      <div className="rkc-account-bar" aria-hidden="true"><span style={{ width: percentageWidth(share) }} /></div>
      <div className="rkc-account-legend"><span>FAJ · {percentage(share)}</span><span>Outras fontes · {percentage(1 - share)}</span></div>
    </figure>}
    {top.length > 0 && <div className="rkc-account-panel">
      <h3>Maiores rubricas do orçamento</h3>
      <div className="rkc-account-rank">{top.map(item => <button type="button" key={item.label} disabled={!navigate}
        onClick={() => navigate?.('budget', String(item.label))}>
        <span>{item.label}</span><b>{money(item.total)}</b>
        <span aria-hidden="true" className="rkc-account-bar" style={{ width: percentageWidth(Number(item.total) / Number(top[0].total || 1)) }} />
      </button>)}</div>
      {navigate && <button type="button" onClick={() => navigate('budget')}>Ver todas as rubricas</button>}
    </div>}
    {!team && (row.budgetCheck != null || row.fajCheck != null || row.teamCheck != null) && <details className="rkc-account-panel">
      <summary>Valores de conferência da planilha</summary>
      <PublicFields row={{
        budgetCheck: row.budgetCheck == null ? null : money(row.budgetCheck),
        fajCheck: row.fajCheck == null ? null : money(row.fajCheck),
        teamCheck: row.teamCheck == null ? null : money(row.teamCheck),
      }} fields={{ budgetCheck: 'Despesa total prevista', fajCheck: 'Valor FAJ previsto', teamCheck: 'Custo total da equipe' }} />
    </details>}
    {!team && <PublicFields row={row} fields={{ reference: 'Exercício do orçamento', period: 'Período do orçamento', notes: 'Mudanças em relação ao orçamento aprovado' }} />}
    {team && <><CellNote value={row.roleComment} label="Equipe permanente" /><CellNote value={row.relationshipComment} label="Tipo de vínculo" /></>}
    {team && navigate && <button className="rkc-account-team-link" type="button" onClick={() => navigate('budget', 'Pessoal/equipe')}>Ver rubrica Pessoal/equipe</button>}
  </>;
}

function percentageWidth(value: number) { return Math.min(100, Math.max(0, value * 100)) + '%'; }

function Budget({ rows, openRubric, table, plan }: { rows: PublicRow[]; openRubric: string; table: boolean; plan: PublicRow[] }) {
  const detail = (row: PublicRow) => {
    const related = plan.filter(activity => typeof activity.budgetLine === 'string' &&
      activity.budgetLine.split(';').some(label => label.trim().replace(/\.$/, '') === String(row.label).trim()));
    return <>
      <PublicFields row={row} fields={{ description: 'Descrição', notes: 'Observações' }} />
      <CellNote value={row.cellComment} />
      {related.length > 0 && <details><summary>Atividades vinculadas no plano de trabalho</summary>
        <ul className="rkc-account-linked">{related.map((activity, index) => <li key={index}>{activity.activity}</li>)}</ul>
      </details>}
    </>;
  };
  const max = Math.max(1, ...rows.map(row => Number(row.total) || 0));
  return <>
    {!table ? <div className="rkc-account-stack">
      <div className="rkc-account-legend"><span>FAJ solicitado</span><span>Outras fontes previstas</span></div>
      {rows.map((row, index) => <details key={index} className="rkc-account-panel rkc-account-rubric" open={row.label === openRubric || undefined}>
        <summary><span>{row.label}</span><b>{money(row.total)}</b>
        {typeof row.total === 'number' && <div className="rkc-account-track" aria-hidden="true">
          <div className="rkc-account-bar" style={{ width: percentageWidth(row.total / max) }}>
            <span style={{ width: percentageWidth(row.total > 0 && typeof row.faj === 'number' ? row.faj / row.total : 0) }} />
          </div>
        </div>}</summary>
        <dl className="rkc-account-periods"><div><dt>FAJ solicitado</dt><dd>{money(row.faj)}</dd></div>
          <div><dt>Outras fontes previstas</dt><dd>{money(row.other)}</dd></div>
          <div><dt>Participação FAJ</dt><dd>{rubricShare(row)}</dd></div>
        </dl>
        {detail(row)}
      </details>)}
    </div> :
    <div className="rkc-account-table" tabIndex={0} role="region" aria-label="Tabela de dados"><table>
      <thead><tr><th>Rubrica</th><th>Custo previsto</th><th>FAJ solicitado</th><th>Outras fontes previstas</th><th>Participação FAJ</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}><th scope="row"><details open={row.label === openRubric || undefined}><summary>{row.label}</summary>{detail(row)}</details></th><td>{money(row.total)}</td>
        <td>{money(row.faj)}</td><td>{money(row.other)}</td>
        <td>{rubricShare(row)}</td></tr>)}</tbody>
    </table></div>}
  </>;
}

function rubricShare(row: PublicRow) {
  return percentage(typeof row.share === 'number' ? row.share : typeof row.total === 'number' && row.total > 0 && typeof row.faj === 'number' ? row.faj / row.total : null);
}

export default function Dashboard() {
  const { slug = '', view } = useParams();
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
  const base = '/prestacao-de-contas/' + encodeURIComponent(slug);

  useEffect(() => {
    let active = true;
    void supabase.rpc('get_finance_accountability_public_report', { requested_slug: slug }).then(({ data, error }) => {
      if (active) setState({ slug, report: data as PublicReport | null, error: !!error });
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
      </>}</div>
    </div></header>
    {notice && <p className="rkc-account-wrap" role="status">{notice}</p>}
    <main id="account-main">
      <div className={landing ? "rkc-account-hero rkc-account-cover" : "rkc-account-hero"}><div className="rkc-account-wrap">

        <div>{landing && <p className="rkc-account-kicker">{report?.title}</p>}
          <h1>{landing ? 'Portal de Transparência' : narrative ? 'Relatório Narrativo e Impacto' : 'Dashboard Financeiro'}</h1>
          {landing && report && <><p className="rkc-account-organization">Rede Kalunga de Comunicações</p>
            <p>Consulte o orçamento previsto, o plano de trabalho e as respostas oficiais do formulário narrativo.</p></>}
          {!landing && report && <p>{report.title}</p>}
        </div>
        {report && <dl>
          <div><dt>Período de referência</dt><dd>{report.period_start || report.period_end ? [report.period_start, report.period_end].filter(Boolean).map(formatDate).join(' a ') : 'Não informado'}</dd></div>
          <div><dt>Atualização pública</dt><dd>{formatDate(report.published_at)}</dd></div>
        </dl>}
      </div></div>
      <div className="rkc-account-wrap">
        {state?.slug !== slug ? <p role="status">Carregando prestação…</p> : !report || (view && view !== 'financeiro' && !narrative)
          ? <p role="status">{state.error ? 'Erro ao consultar a prestação. Atualize a página para tentar novamente.' : 'Prestação indisponível para consulta pública.'}</p>
          : landing ? <nav className="rkc-account-entry" aria-label="Áreas do Portal de Transparência">
            <Link to={base + '/financeiro'}><BarChart3 aria-hidden="true" /><h2>Dashboard Financeiro</h2>
              <p>Orçamento previsto, rubricas, equipe, financiamento e plano de trabalho.</p><ArrowUpRight aria-hidden="true" /></Link>
            <Link to={base + '/narrativo'}><BookOpen aria-hidden="true" /><h2>Relatório Narrativo e Impacto</h2>
              <p>Respostas oficiais, registros de atividades e indicadores de impacto.</p><ArrowUpRight aria-hidden="true" /></Link>
          </nav> : <>
            <nav className="rkc-account-views" aria-label="Páginas da prestação">
              <Link to={base}>Portal de Transparência</Link>
              <Link to={base + '/financeiro'} aria-current={!narrative ? 'page' : undefined}><BarChart3 size={20} /> Financeiro</Link>
              <Link to={base + '/narrativo'} aria-current={narrative ? 'page' : undefined}><BookOpen size={20} /> Narrativo e impacto</Link>
            </nav>
            <nav className="rkc-account-tabs" aria-label="Seções da prestação">
              {tabs.map(tab => <Link key={tab} to={{ search: '?aba=' + tab }} aria-current={section === tab ? 'location' : undefined}>{sections[tab]}</Link>)}
            </nav>
            <DashboardContent key={section + slug + rubric} report={report} section={section} navigate={goTo} initialRubric={rubric} />
          </>}
      </div>
    </main>
    <footer className="rkc-account-wrap rkc-account-footer"><Link to="/">Rede Kalunga de Comunicações <ArrowUpRight size={16} /></Link></footer>
  </div>;
}

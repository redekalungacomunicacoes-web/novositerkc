import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, BookOpen, Maximize, Share2 } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatDate, money, percentage, sections, type PublicReport, type PublicRow, type Section } from './model';
import './dashboard.css';

const financialTabs: Section[] = ['overview', 'budget', 'team', 'funding', 'plan'];
const narrativeTabs: Section[] = ['institution', 'narrative', 'impact', 'results'];
const valueText = (value: PublicRow[string] | undefined) => value == null ? 'Não informado' : String(value);
const unique = (rows: PublicRow[], field: string) => Array.from(new Set(rows.map(row => row[field]).filter(value => value != null)));

export function DashboardContent({ report, section }: { report: PublicReport; section: Section }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [period, setPeriod] = useState('');
  const [expanded, setExpanded] = useState(false);
  const rows = report.content[section] ?? [];
  const field = { impact: 'channel', funding: 'year', plan: 'label', budget: 'label' }[section as 'impact' | 'funding' | 'plan' | 'budget'];
  const filterLabel = { impact: 'Canal', funding: 'Ano', plan: 'Objetivo', budget: 'Rubrica' }[section as 'impact' | 'funding' | 'plan' | 'budget'];
  const filtered = rows.filter(row =>
    (!filter || String(row[field]) === filter) &&
    (!period || String(row.period) === period) &&
    (!query || Object.values(row).some(value => value != null && String(value).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))),
  );
  const visible = sort ? [...filtered].sort((a, b) => sort === 'total'
    ? Number(b.total ?? -1) - Number(a.total ?? -1)
    : valueText(a.label).localeCompare(valueText(b.label), 'pt-BR')) : filtered;

  return <section className="rkc-account-section" aria-labelledby="account-section-title">
    <h2 id="account-section-title">{sections[section]}</h2>
    {!rows.length ? <p className="rkc-account-panel">Dados indisponíveis nesta versão pública.</p> : <>
      {field && <div className="rkc-account-tools">
        <label>Buscar<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label>{filterLabel}<select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">Todos</option>{unique(rows, field).map(option => <option key={option}>{option}</option>)}
        </select></label>
        {section === 'plan' && unique(rows, 'period').length > 0 && <label>Período
          <select value={period} onChange={event => setPeriod(event.target.value)}>
            <option value="">Todos</option>{unique(rows, 'period').map(option => <option key={option}>{option}</option>)}
          </select>
        </label>}
        {section === 'budget' && <label>Ordenar<select value={sort} onChange={event => setSort(event.target.value)}>
          <option value="">Ordem original</option><option value="label">Rubrica</option><option value="total">Maior valor previsto</option>
        </select></label>}
      </div>}
      {!visible.length && <p role="status">Nenhum registro para os filtros selecionados.</p>}
      {section === 'overview' && <Overview row={rows[0]} />}
      {(section === 'budget' || section === 'team') && visible.length > 0 && <Budget rows={visible} />}
      {section === 'funding' && visible.length > 0 && <><FundingSummary rows={visible} /><div className="rkc-account-table" tabIndex={0} role="region" aria-label="Tabela de dados"><table>
        <thead><tr><th>Fonte</th><th>Tipo</th><th>Ano</th><th>Situação</th><th>Valor</th></tr></thead>
        <tbody>{visible.map((row, index) => <tr key={index}>
          <th scope="row">{valueText(row.label)}</th><td>{valueText(row.type)}</td><td>{valueText(row.year)}</td>
          <td>{valueText(row.status)}</td><td>{money(row.total)}</td>
        </tr>)}</tbody>
      </table></div></>}
      {section === 'plan' && <div className="rkc-account-stack">{visible.map((row, index) => <details key={index} className="rkc-account-panel">
        <summary>{row.label || row.activity || 'Atividade'}{row.period && <small>{row.period}</small>}</summary>
        <dl>{Object.entries({ activity: 'Atividade', outcome: 'Resultado esperado', evidence: 'Evidência prevista', period: 'Período', budgetLine: 'Rubrica' })
          .filter(([key]) => row[key] != null).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{row[key]}</dd></div>)}</dl>
      </details>)}</div>}
      {section === 'narrative' && <>
        <button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Recolher respostas' : 'Ler todas as respostas'}</button>
        <div className="rkc-account-reading">
          <aside aria-label="Índice das perguntas"><ol>{rows.map((row, index) => <li key={index}><a href={'#pergunta-' + (index + 1)} onClick={() => {
            const detail = document.getElementById('pergunta-' + (index + 1));
            if (detail instanceof HTMLDetailsElement) detail.open = true;
          }}>{row.label}</a></li>)}</ol></aside>
          <div className="rkc-account-stack">{rows.map((row, index) => <details id={'pergunta-' + (index + 1)}
            open={expanded || undefined} className="rkc-account-panel" key={index}>
            <summary>{row.label}</summary><p className="rkc-account-body">{row.body}</p>
          </details>)}</div>
        </div>
      </>}
      {(section === 'institution' || section === 'results') && <div className="rkc-account-stack">{rows.map((row, index) =>
        <article className="rkc-account-panel" key={index}><h3>{row.label}</h3><p className="rkc-account-body">{row.body}</p></article>)}</div>}
      {section === 'impact' && <div className="rkc-account-cards">{visible.map((row, index) => <article className="rkc-account-panel" key={index}>
        <small>{row.channel}</small><h3>{row.label}</h3>
        <dl className="rkc-account-periods">{([['2025', 'prior'], ['2026', 'current']] as const).map(([year, key]) =>
          <div key={key}><dt>{year}</dt><dd className="rkc-account-value">{valueText(row[key])}</dd>
            {(row[key + 'Start'] || row[key + 'End']) && <small>{[row[key + 'Start'], row[key + 'End']].filter(Boolean).join(' a ')}</small>}</div>)}</dl>
        <ImpactComparison row={row} />
        {row.variation && <p>Variação informada · {row.variation}</p>}
        {row.notes && <details><summary>Observações</summary><p className="rkc-account-body">{row.notes}</p></details>}
      </article>)}</div>}
    </>}
  </section>;
}

function FundingSummary({ rows }: { rows: PublicRow[] }) {
  const statuses = unique(rows, 'status');
  const years = unique(rows, 'year').sort((a, b) => Number(a) - Number(b));
  if (!statuses.length || !years.length) return null;
  return <div className="rkc-account-cards">{statuses.map(status => <article key={status} className="rkc-account-panel">
    <h3>{status}</h3>
    <dl className="rkc-account-periods">{years.map(year => {
      const values = rows.filter(row => row.year === year && row.status === status && typeof row.total === 'number');
      const total = values.length ? values.reduce((sum, row) => sum + Math.round(Number(row.total) * 100), 0) / 100 : null;
      return <div key={year}><dt>{year}</dt><dd>{money(total)}</dd></div>;
    })}</dl>
  </article>)}</div>;
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
  if (row.priorStart || row.priorEnd || row.currentStart || row.currentEnd) {
    const priorDuration = days(row.priorStart, row.priorEnd);
    if (!(priorDuration >= 0 && priorDuration === days(row.currentStart, row.currentEnd))) return null;
  }
  const max = Math.max(prior, current, 1);
  return <div className="rkc-account-impact-bars" aria-hidden="true">
    {[prior, current].map((value, index) => <div key={index} className="rkc-account-track">
      <div className="rkc-account-bar" style={{ width: percentageWidth(value / max) }} />
    </div>)}
  </div>;
}

function Overview({ row }: { row: PublicRow }) {
  const share = typeof row.share === 'number' && row.share >= 0 && row.share <= 1 ? row.share : null;
  return <>
    <div className="rkc-account-cards">{[['Orçamento previsto', money(row.total)], ['Solicitado ao FAJ', money(row.faj)],
      ['Outras fontes previstas', money(row.other)], ['Participação prevista do FAJ', percentage(row.share)]].map(([label, value]) =>
      <article className="rkc-account-panel" key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div>
    {share !== null && <figure className="rkc-account-panel">
      <figcaption>Composição do orçamento previsto</figcaption>
      <div className="rkc-account-bar" aria-hidden="true"><span style={{ width: percentageWidth(share) }} /></div>
      <div className="rkc-account-legend"><span>FAJ · {percentage(share)}</span><span>Outras fontes · {percentage(1 - share)}</span></div>
    </figure>}
    <div className="rkc-account-panel"><h3>Execução financeira</h3><dl className="rkc-account-status">
      {['Aprovado', 'Recebido', 'Executado', 'A receber', 'Saldo disponível'].map(label => <div key={label}><dt>{label}</dt><dd>Não informado</dd></div>)}
    </dl></div>
  </>;
}

function percentageWidth(value: number) { return Math.min(100, Math.max(0, value * 100)) + '%'; }

function Budget({ rows }: { rows: PublicRow[] }) {
  const max = Math.max(1, ...rows.map(row => Number(row.total) || 0));
  return <>
    <figure className="rkc-account-panel">
      <figcaption>Distribuição dos recursos previstos</figcaption>
      {rows.map((row, index) => typeof row.total === 'number' && <div key={index} className="rkc-account-budget-bar">
        <span>{row.label} · {money(row.total)}</span>
        <div className="rkc-account-track" aria-hidden="true"><div className="rkc-account-bar" style={{ width: percentageWidth(row.total / max) }}>
          <span style={{ width: percentageWidth(row.total > 0 && typeof row.faj === 'number' ? row.faj / row.total : 0) }} />
        </div></div>
      </div>)}
    </figure>
    <div className="rkc-account-table" tabIndex={0} role="region" aria-label="Tabela de dados"><table>
      <thead><tr><th>Rubrica</th><th>Custo previsto</th><th>FAJ solicitado</th><th>Outras fontes previstas</th><th>Participação FAJ</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}><th scope="row">{row.description ? <details><summary>{row.label}</summary><p className="rkc-account-body">{row.description}</p></details> : row.label}</th><td>{money(row.total)}</td>
        <td>{money(row.faj)}</td><td>{money(row.other)}</td>
        <td>{percentage(typeof row.total === 'number' && row.total > 0 && typeof row.faj === 'number' ? row.faj / row.total : null)}</td></tr>)}</tbody>
    </table></div>
  </>;
}

export default function Dashboard() {
  const { slug = '', view } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<{ slug: string; report: PublicReport | null; error: boolean }>();
  const [notice, setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const report = state?.slug === slug ? state.report : null;
  const narrative = view === 'narrativo';
  const tabs = narrative ? narrativeTabs : financialTabs;
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
      <div className="rkc-account-hero"><div className="rkc-account-wrap">
        <p>Rede Kalunga de Comunicações · Transparência</p>
        <h1>{report?.title || 'Prestação de contas'}</h1>
        {report && <dl>
          <div><dt>Período de referência</dt><dd>{report.period_start || report.period_end ? [formatDate(report.period_start), formatDate(report.period_end)].join(' a ') : 'Não informado'}</dd></div>
          <div><dt>Atualização pública</dt><dd>{formatDate(report.published_at)}</dd></div>
        </dl>}
      </div></div>
      <div className="rkc-account-wrap">
        {state?.slug !== slug ? <p role="status">Carregando prestação…</p> : !report || (view && view !== 'financeiro' && !narrative)
          ? <p role="status">{state.error ? 'Erro ao consultar a prestação. Atualize a página para tentar novamente.' : 'Prestação indisponível para consulta pública.'}</p>
          : <>
            <nav className="rkc-account-views" aria-label="Páginas da prestação">
              <Link to={base + '/financeiro'} aria-current={!narrative ? 'page' : undefined}><BarChart3 size={20} /> Financeiro</Link>
              <Link to={base + '/narrativo'} aria-current={narrative ? 'page' : undefined}><BookOpen size={20} /> Narrativo e impacto</Link>
            </nav>
            <nav className="rkc-account-tabs" aria-label="Seções da prestação">
              {tabs.map(tab => <button key={tab} type="button" aria-pressed={section === tab} onClick={() => setParams({ aba: tab })}>{sections[tab]}</button>)}
            </nav>
            <DashboardContent key={section + slug} report={report} section={section} />
          </>}
      </div>
    </main>
    <footer className="rkc-account-wrap rkc-account-footer"><Link to="/">Rede Kalunga de Comunicações <ArrowUpRight size={16} /></Link></footer>
  </div>;
}

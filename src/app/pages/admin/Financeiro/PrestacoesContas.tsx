import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ClipboardList, FilePlus2, FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFinanceSupabase } from './hooks/useFinanceSupabase';
import { formatDate } from './data/financeiro.repo';

type Template = {
  id: string;
  slug: string;
  name: string;
  institution_name: string | null;
  funding_program: string | null;
  cycle_name: string | null;
  version: number;
  status: 'draft' | 'active' | 'archived';
  description: string | null;
};

type Report = {
  id: string;
  title: string;
  reference_code: string | null;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  created_at: string;
  template_id: string;
  fund_id: string | null;
  project_id: string | null;
};

const STATUS: Record<Report['status'], string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  approved: 'Aprovada',
  published: 'Publicada',
  archived: 'Arquivada',
};

const statusClass: Record<Report['status'], string> = {
  draft: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_review: 'bg-sky-50 text-sky-800 ring-sky-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  published: 'bg-green-100 text-green-900 ring-green-200',
  archived: 'bg-gray-100 text-gray-600 ring-gray-200',
};

export function PrestacoesContas() {
  const { funds, projects } = useFinanceSupabase();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [fundId, setFundId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [filters, setFilters] = useState({ fund: '', project: '', funder: '', status: '', from: '', to: '' });

  const activeTemplates = useMemo(() => templates.filter((item) => item.status === 'active'), [templates]);

  const funderByTemplate = new Map(templates.map(template => [template.id, template.institution_name || template.funding_program || '']));
  const funders = Array.from(new Set(funderByTemplate.values())).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const visibleReports = reports.filter(report =>
    (!filters.fund || filters.fund === report.fund_id) &&
    (!filters.project || filters.project === report.project_id) &&
    (!filters.funder || filters.funder === funderByTemplate.get(report.template_id)) &&
    (!filters.status || filters.status === report.status) &&
    (!filters.from || (report.period_end ?? report.period_start ?? '') >= filters.from) &&
    (!filters.to || Boolean(report.period_start ?? report.period_end) && (report.period_start ?? report.period_end ?? '') <= filters.to)
  );
  const filterOptions = [
    ['fund', 'Fundo', funds.map(fund => [fund.id, fund.nome])],
    ['project', 'Projeto', projects.map(project => [project.id, project.nome])],
    ['funder', 'Financiador', funders.map(funder => [funder, funder])],
    ['status', 'Situação', Object.entries(STATUS)],
  ] as const;
  const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal';

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    const [templateResult, reportResult] = await Promise.all([
      supabase.from('finance_reporting_templates').select('id,slug,name,institution_name,funding_program,cycle_name,version,status,description').order('name'),
      supabase.from('finance_accountability_reports').select('id,title,reference_code,status,period_start,period_end,due_date,created_at,template_id,fund_id,project_id').order('created_at', { ascending: false }),
    ]);
    const issue = templateResult.error || reportResult.error;
    if (issue) {
      setLoadError(issue.message.includes('does not exist') || issue.message.includes('schema cache')
        ? 'A estrutura de prestações ainda não foi instalada no Supabase. A migration está preparada na branch de desenvolvimento e precisa ser validada antes da aplicação.'
        : issue.message);
    } else {
      setTemplates((templateResult.data || []) as Template[]);
      setReports((reportResult.data || []) as Report[]);
    }
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);

  useEffect(() => {
    if (!templateId && activeTemplates[0]) setTemplateId(activeTemplates[0].id);
  }, [activeTemplates, templateId]);

  const createFajTemplate = async () => {
    setBusy(true);
    const { error } = await supabase.from('finance_reporting_templates').insert({
      slug: 'faj-ii-ciclo',
      name: 'Prestação de Contas FAJ',
      institution_name: 'Fundo de Apoio ao Jornalismo',
      funding_program: 'FAJ',
      cycle_name: 'II Ciclo',
      version: 1,
      status: 'active',
      description: 'Modelo FAJ II Ciclo com preenchimento narrativo e financeiro.',
      structure: {
        sections: ['identification', 'financial', 'work_plan', 'narrative', 'impact_engagement', 'documents', 'review'],
        narrative_fields: ['question_1', 'question_2', 'question_3', 'question_4'],
        financial_spreadsheet_mapping: 'audited_export_pending',
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes('duplicate key') ? 'O modelo FAJ II Ciclo já está cadastrado.' : error.message);
      return;
    }
    toast.success('Modelo FAJ II Ciclo cadastrado.');
    await loadData();
  };

  const createReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateId || !title.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('finance_accountability_reports').insert({
      template_id: templateId,
      fund_id: fundId || null,
      project_id: projectId || null,
      title: title.trim(),
      reference_code: referenceCode.trim() || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      due_date: dueDate || null,
      status: 'draft',
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
      financial_data: {},
      narrative_data: {},
    }).select('id').single();
    if (!error && data?.id) {
      await supabase.from('finance_accountability_history').insert({
        report_id: data.id,
        action: 'created',
        actor_id: user?.id ?? null,
        change_summary: 'Prestação criada como rascunho.',
        snapshot: { title: title.trim(), template_id: templateId, fund_id: fundId || null, project_id: projectId || null },
      });
    }
    let folderReady = false;
    if (!error && data?.id) {
      try {
        const result = await supabase.functions.invoke('drive-files', { body: { action: 'accountability-ensure-folder', report_id: data.id } });
        folderReady = !result.error && result.data?.ok === true;
      } catch { /* draft is already saved; retry from detail */ }
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (folderReady) toast.success('Prestação criada com pasta no Drive.');
    else toast.warning('Rascunho salvo. Abra a prestação para tentar preparar a pasta novamente.');
    setShowCreate(false);
    setTitle('');
    setReferenceCode('');
    setPeriodStart('');
    setPeriodEnd('');
    setDueDate('');
    setFundId('');
    setProjectId('');
    await loadData();
  };

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7f3] p-4 text-[#17251f] sm:p-6 lg:p-8">
      <header className="rounded-[26px] bg-[#103d2e] p-6 text-white shadow-[0_18px_50px_rgba(16,61,46,0.12)] sm:p-8">
        <Link to="/admin/financeiro" className="mb-5 inline-flex items-center gap-2 text-sm text-white/75 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar ao Financeiro</Link>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <span className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ead7a6]">Gestão e transparência</span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prestações de contas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Organize prestações por edital, fundo, projeto e período. Os registros são vinculados ao Financeiro existente.</p>
          </div>
          <button type="button" onClick={() => setShowCreate((value) => !value)} disabled={!activeTemplates.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ead7a6] px-4 py-3 text-sm font-semibold text-[#173b2e] transition hover:bg-[#f3e5c2] disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Nova prestação</button>
        </div>
      </header>

      {loadError && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{loadError}</div>}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Total de prestações</p><p className="mt-2 text-3xl font-semibold">{reports.length}</p></div>
        <div className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Em andamento</p><p className="mt-2 text-3xl font-semibold">{reports.filter((item) => item.status === 'draft' || item.status === 'in_review').length}</p></div>
        <div className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Modelos ativos</p><p className="mt-2 text-3xl font-semibold">{activeTemplates.length}</p></div>
      </section>

      {showCreate && (
        <form onSubmit={createReport} className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4ebd8] text-[#315b47]"><FilePlus2 className="h-5 w-5" /></span><div><h2 className="font-semibold">Abrir prestação de contas</h2><p className="text-sm text-gray-500">O registro será salvo como rascunho.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Título da prestação<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Prestação de contas FAJ II Ciclo" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-[#315b47]" /></label>
            <label className="space-y-1 text-sm font-medium">Modelo oficial<select required value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal"><option value="">Selecione um modelo</option>{activeTemplates.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Fundo vinculado<select value={fundId} onChange={(event) => setFundId(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal"><option value="">Sem vínculo por enquanto</option>{funds.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Projeto vinculado<select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal"><option value="">Sem vínculo por enquanto</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Código de referência<input value={referenceCode} onChange={(event) => setReferenceCode(event.target.value)} placeholder="Opcional" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm font-medium">Início<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label><label className="space-y-1 text-sm font-medium">Fim<input type="date" min={periodStart || undefined} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label></div>
            <label className="space-y-1 text-sm font-medium">Prazo de entrega<input type="date" className={inputClass} value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium">Cancelar</button><button type="submit" disabled={busy || !templateId} className="rounded-xl bg-[#103d2e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Salvando...' : 'Criar rascunho'}</button></div>
        </form>
      )}

      <section className="rounded-2xl border border-[#e7e9e2] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0e9] p-5"><div className="flex items-center gap-3"><ClipboardList className="h-5 w-5 text-[#315b47]" /><div><h2 className="font-semibold">Prestações cadastradas</h2><p className="text-xs text-gray-500">Histórico e situação dos registros</p></div></div><button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Atualizar</button></div>
        {reports.length > 0 && <div className="grid gap-3 border-b p-5 sm:grid-cols-2 lg:grid-cols-3">
          {filterOptions.map(([key, label, options]) => <label key={key} className="space-y-1 text-sm font-medium">
            <span>{label}</span><select className={inputClass} value={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.value })}>
              <option value="">Todos</option>
              {options.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
            </select>
          </label>)}
          <label className="space-y-1 text-sm font-medium"><span>Período a partir de</span><input type="date" className={inputClass} value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })} /></label>
          <label className="space-y-1 text-sm font-medium"><span>Período até</span><input type="date" className={inputClass} min={filters.from || undefined} value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })} /></label>
        </div>}
        {loading ? <p className="p-8 text-center text-sm text-gray-500">Carregando registros...</p> : visibleReports.length ? <div className="divide-y divide-[#edf0e9]">{visibleReports.map((report) => {
          const template = templates.find((item) => item.id === report.template_id);
          const fund = funds.find((item) => item.id === report.fund_id);
          const project = projects.find((item) => item.id === report.project_id);
          return <article key={report.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="font-semibold">{report.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass[report.status]}`}>{STATUS[report.status]}</span></div><p className="text-sm text-gray-500">{template?.name || 'Modelo não localizado'} · {report.reference_code || 'Sem código'}</p><p className="mt-1 text-xs text-gray-500">{fund?.nome || 'Sem fundo'}{project ? ` · ${project.nome}` : ''} · {report.period_start ? formatDate(report.period_start + 'T12:00:00') : 'Período não definido'} a {report.period_end ? formatDate(report.period_end + 'T12:00:00') : '—'}</p><p className="mt-1 text-sm text-gray-700">Prazo de entrega {report.due_date ? formatDate(report.due_date + 'T12:00:00') : '—'}</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-xs text-gray-400">Criada em {formatDate(report.created_at)}</span><Link to={`/admin/financeiro/prestacoes/${report.id}`} className="rounded-lg border border-[#dfe5dc] px-3 py-2 text-xs font-semibold text-[#315b47] hover:bg-[#f6f8f3]">Abrir prestação</Link></div></article>;
        })}</div> : reports.length ? <p className="p-8 text-center text-sm text-gray-500">Nenhuma prestação corresponde aos filtros.</p> : <div className="p-10 text-center"><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#f4ebd8] text-[#315b47]"><FolderOpen className="h-6 w-6" /></span><h3 className="font-semibold">Nenhuma prestação cadastrada</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-500">Cadastre o modelo oficial FAJ II Ciclo e depois abra a primeira prestação como rascunho.</p></div>}
      </section>

      <section className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Modelos oficiais</h2><p className="mt-1 text-sm text-gray-500">Versões de editais vinculadas às prestações.</p></div><button type="button" onClick={() => void createFajTemplate()} disabled={busy || templates.some((item) => item.slug === 'faj-ii-ciclo' && item.version === 1)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#103d2e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Cadastrar FAJ II Ciclo</button></div>
        <div className="mt-4 space-y-3">{templates.length ? templates.map((item) => <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl border border-[#edf0e9] p-4 sm:flex-row sm:items-center"><div><p className="font-medium">{item.name} <span className="text-xs text-gray-400">v{item.version}</span></p><p className="text-sm text-gray-500">{item.institution_name || item.funding_program || 'Instituição não informada'} · {item.cycle_name || 'Ciclo não informado'}</p></div><span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.status === 'active' ? 'Ativo' : item.status === 'draft' ? 'Rascunho' : 'Arquivado'}</span></div>) : <p className="rounded-xl bg-[#f8f9f6] p-4 text-sm text-gray-500">Nenhum modelo cadastrado.</p>}</div>
        <p className="mt-4 text-xs leading-5 text-gray-500">O modelo FAJ inclui campos narrativos e financeiros. A geração preenchida dos documentos oficiais está pendente.</p>
      </section>
    </div>
  );
}

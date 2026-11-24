import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateFajFinancials } from './fajFinancialCalculations';

type ReportRow = {
  id: string;
  title: string;
  drive_folder_id: string | null;
  status: string;
  template_id: string;
  narrative_data: Record<string, any>;
  financial_data: Record<string, any>;
  reference_code: string | null;
  period_start: string | null;
  period_end: string | null;
};

const questions = [
  { key: 'question_1', label: 'O que significa desenvolvimento institucional para a sua organização e o que vocês desejam alcançar nesse sentido em 2027?', guidance: "Relacione essa intenção à missão da organização, à realidade do território e aos valores que orientam seu jornalismo, incluindo interesse público, diversidade, equidade e independência editorial." },
  { key: 'question_2', label: 'Quais mudanças institucionais vocês pretendem priorizar em 2027 e por que elas são importantes para a organização?', guidance: "Considere os aspectos mais relevantes para sua realidade, como organização da equipe, governança, planejamento, processos administrativos, gestão financeira e sustentabilidade. Não é necessário contemplar todos: explique suas escolhas." },
  { key: 'question_3', label: 'Como vocês pretendem colocar essas prioridades em prática ao longo de 2027?', guidance: "Descreva as principais ações, responsabilidades, recursos e apoios necessários, incluindo como pretendem aproveitar mentorias, encontros e trocas na rede do Travessias, quando pertinente. Indique também os obstáculos previstos." },
  { key: 'question_4', label: 'Ao final de 2027, que mudanças concretas permitiriam reconhecer que a organização se desenvolveu institucionalmente?', guidance: "Explique os sinais ou evidências que vocês pretendem acompanhar e como essas mudanças poderão contribuir para a continuidade da organização, a qualidade e regularidade da produção jornalística e sua relação com a comunidade local." },
];

const channels = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Site ou Portal', 'Podcast ou conteúdo audiovisual', 'Jornal impresso / conteúdos impressos', 'Newsletters', 'Outros canais'];

export function PrestacaoContasDetalhe() {
  const { id = '' } = useParams();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [narrative, setNarrative] = useState<Record<string, any>>({});
  const [impact, setImpact] = useState<Record<string, any>>({});
  const [institution, setInstitution] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparingDrive, setPreparingDrive] = useState(false);
  const [preparingDocuments, setPreparingDocuments] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error: queryError } = await supabase.from('finance_accountability_reports')
        .select('id,title,status,template_id,narrative_data,financial_data,reference_code,period_start,period_end,drive_folder_id')
        .eq('id', id).single();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (data) {
        const row = data as ReportRow;
        setReport(row);
        setNarrative(row.narrative_data || {});
        setInstitution({ ...((row.narrative_data?.institution || {}) as Record<string, string>), emails: Array.isArray(row.narrative_data?.institution?.emails) ? row.narrative_data.institution.emails.join('\n') : String(row.narrative_data?.institution?.emails || '') });
        setImpact((row.narrative_data?.impact_engagement || {}) as Record<string, any>);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [id]);

  const prepareDrive = async () => {
    if (!report || preparingDrive) return;
    setPreparingDrive(true);
    try {
      const result = await supabase.functions.invoke('drive-files', { body: { action: 'accountability-ensure-folder', report_id: report.id } });
      if (result.error || !result.data?.ok || !result.data?.folder_id) throw new Error('Não foi possível preparar a pasta. Tente novamente.');
      setReport(current => current?.id === report.id ? { ...current, drive_folder_id: result.data.folder_id } : current);
      toast.success('Pasta vinculada ao Drive.');
    } catch { toast.error('Não foi possível preparar a pasta. O rascunho permanece salvo.'); }
    finally { setPreparingDrive(false); }
  };

  const prepareDocuments = async () => {
    if (!report || preparingDocuments) return;
    setPreparingDocuments(true);
    try {
      const result = await supabase.functions.invoke('drive-files', {body:{action:'accountability-prepare-documents',report_id:report.id}});
      if (result.error || !result.data?.ok) throw new Error('Modelos indisponíveis');
      toast.success('Cópias dos modelos preparadas no Drive. Preenchimento automático ainda indisponível.');
    } catch { toast.error('Não foi possível preparar os modelos. Verifique o cadastro e as permissões do Drive.'); }
    finally { setPreparingDocuments(false); }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!report) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const nextNarrative = { ...narrative, institution: { ...institution, emails: (institution.emails || '').split(/[\n,;]/).map((email) => email.trim()).filter(Boolean) }, impact_engagement: impact };
    const { error: updateError } = await supabase.from('finance_accountability_reports').update({
      narrative_data: nextNarrative,
      updated_by: user?.id ?? null,
    }).eq('id', report.id);
    if (!updateError) {
      await supabase.from('finance_accountability_history').insert({
        report_id: report.id,
        action: 'updated',
        actor_id: user?.id ?? null,
        change_summary: 'Atualização dos dados narrativos e indicadores de impacto.',
        snapshot: { narrative_data: nextNarrative },
      });
    }
    setSaving(false);
    if (updateError) toast.error(updateError.message);
    else {
      setNarrative(nextNarrative);
      toast.success('Rascunho salvo.');
    }
  };

  const metricNames = (channel: string): string[] => {
    if (channel === 'Instagram') return ['Seguidores','Interações','Visualizações','Contas alcançadas','Visualizadores','Crescimento líquido'];
    if (['Facebook','TikTok','LinkedIn'].includes(channel)) return ['Seguidores','Interações','Alcance','Visualizações'];
    if (channel === 'Site ou Portal') return ['Visitantes'];
    if (channel === 'Podcast ou conteúdo audiovisual') return ['Reproduções','Ouvintes'];
    if (channel === 'Jornal impresso / conteúdos impressos') return ['Exemplares impressos','Exemplares distribuídos'];
    if (channel === 'Newsletters') return ['Assinantes'];
    return ['Indicador relevante'];
  };
  const setMetric = (channel: string, metric: string, field: string, value: string) => {
    setImpact(current => {
      const previous = current[channel] || {};
      const metrics = previous.metrics || {};
      return { ...current, [channel]: { ...previous, metrics: { ...metrics, [metric]: { ...(metrics[metric] || {}), [field]: value } } } };
    });
  };

  const setImpactValue = (channel: string, field: string, value: string) => {
    setImpact((current) => ({ ...current, [channel]: { ...(current[channel] || {}), [field]: value } }));
  };

  if (loading) return <div className="p-8 text-sm text-gray-500">Carregando prestação...</div>;
  if (error || !report) return <div className="space-y-3 p-8"><p className="text-sm text-rose-700">{error || 'Prestação não encontrada.'}</p><Link to="/admin/financeiro/prestacoes" className="text-sm text-[#315b47] underline">Voltar para prestações</Link></div>;

  // Read only: do not seed or overwrite existing financial records.
  const financial = report.financial_data || {};
  const hasFinancialRows = Array.isArray(financial.team) && Array.isArray(financial.budgetExcludingTeam) && Array.isArray(financial.funding);
  const calculated = hasFinancialRows ? calculateFajFinancials(financial.team, financial.budgetExcludingTeam, financial.funding) : null;
  const money = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7f3] p-4 text-[#17251f] sm:p-6 lg:p-8">
      <header className="rounded-[26px] bg-[#103d2e] p-6 text-white sm:p-8">
        <Link to="/admin/financeiro/prestacoes" className="mb-4 inline-flex items-center gap-2 text-sm text-white/75 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar às prestações</Link>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#ead7a6]">Rascunho · FAJ II Ciclo</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{report.title}</h1><p className="mt-2 text-sm text-white/70">Preencha aos poucos. As informações ficam privadas até a aprovação e publicação.</p></div><span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white">Rascunho</span></div>
      </header>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Documentos no Google Drive</h2>
        <p className="my-2 text-sm text-gray-500">{report.drive_folder_id ? 'Pasta institucional vinculada.' : 'Pasta pendente de preparação.'}</p>
        {report.drive_folder_id && <a className="mr-4 text-sm underline" href={`https://drive.google.com/drive/folders/${encodeURIComponent(report.drive_folder_id)}`} target="_blank" rel="noopener noreferrer">Abrir pasta</a>}
        <button type="button" disabled={preparingDrive} onClick={() => void prepareDrive()} className="rounded-lg border px-3 py-2 text-sm">{preparingDrive ? 'Preparando...' : report.drive_folder_id ? 'Verificar pasta' : 'Preparar pasta'}</button>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Modelos oficiais</h2>
        <p className="my-2 text-sm text-gray-500">Prepare cópias do Word e Excel oficiais, sem alterar os originais. O preenchimento automático será disponibilizado após validação.</p>
        <button type="button" disabled={preparingDocuments || report.status !== 'draft'} onClick={() => void prepareDocuments()} className="rounded-lg border px-3 py-2 text-sm">{preparingDocuments ? 'Preparando...' : 'Preparar documentos oficiais'}</button>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Resumo financeiro · FAJ II</h2>
        <p className="my-2 text-sm text-gray-500">Orçamento previsto, não execução de caixa. Valores derivados dos registros disponíveis; dados incompletos podem produzir totais parciais.</p>
        {calculated ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[['Orçamento total', money(calculated.total)], ['Recursos FAJ', money(calculated.faj)], ['Outras fontes', money(calculated.other)], ['Equipe', money(calculated.teamTotal)]].map(([label, value]) => <div key={label} className="rounded-xl border p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}
        </div> : <p className="text-sm text-gray-500">Dados financeiros ainda não vinculados ao formato de cálculo. Nenhum valor presumido.</p>}
      </section>
      <form onSubmit={save} className="space-y-6">
        <section className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">1. Identificação institucional</h2>
          <p className="mb-5 mt-1 text-sm text-gray-500">Dados básicos solicitados no documento narrativo oficial.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[['organization_name','Nome da organização'],['responsible_person','Pessoa responsável pelo preenchimento'],['responsible_role','Cargo'],['emails','E-mails de contato (um por linha)'],['requested_amount','Valor solicitado para o próximo ciclo'],['filled_at','Data do preenchimento']].map(([key,label]) => <label key={key} className="space-y-1 text-sm font-medium">{label}<input value={institution[key] || ''} onChange={(event) => setInstitution((current) => ({ ...current, [key]: event.target.value }))} type={key === 'filled_at' ? 'date' : 'text'} placeholder={key === 'requested_amount' ? 'Informe o valor em reais' : key === 'emails' ? 'email@exemplo.com' : ''} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>)}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">2. Respostas narrativas</h2>
          <p className="mb-5 mt-1 text-sm text-gray-500">Responda às quatro perguntas conforme as orientações do formulário oficial FAJ II Ciclo.</p>
          <div className="space-y-5">{questions.map((question) => <label key={question.key} className="block space-y-2 text-sm font-medium">{question.label}<span className="block text-sm font-normal text-gray-600">{question.guidance}</span><textarea rows={5} value={narrative[question.key] || ''} onChange={(event) => setNarrative((current) => ({ ...current, [question.key]: event.target.value }))} placeholder="Digite a resposta..." className="w-full rounded-xl border border-gray-300 px-3 py-3 font-normal leading-6" /></label>)}</div>
        </section>

        <section className="rounded-2xl border border-[#e7e9e2] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">3. Impacto e engajamento</h2>
          <p className="mb-5 mt-1 text-sm text-gray-500">Registre os indicadores individuais e seus períodos. Os campos gerais anteriores são preservados para não perder informações existentes.</p>
          <div className="space-y-4">{channels.map((channel) => <div key={channel} className="rounded-xl border border-[#edf0e9] p-4"><h3 className="mb-3 text-sm font-semibold">{channel}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['2025','year_2025'],['2026','year_2026'],['Variação','variation'],['Observações','notes']].map(([label,key]) => <label key={key} className="space-y-1 text-xs font-medium text-gray-600">{label}<input value={impact[channel]?.[key] || ''} onChange={(event) => setImpactValue(channel,key,event.target.value)} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm font-normal text-gray-900" /></label>)}</div><div className="mt-4 space-y-3">{metricNames(channel).map(metric => <fieldset key={metric} className="rounded-lg border p-3"><legend className="px-1 text-sm font-medium">{metric}</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[['2025','value_2025'],['Início 2025','start_2025'],['Fim 2025','end_2025'],['2026','value_2026'],['Início 2026','start_2026'],['Fim 2026','end_2026'],['Variação informada','variation'],['Observações','notes'], ...(channel === 'Outros canais' ? [['Nome do indicador','name']] : [])].map(([label,key]) => <label key={key} className="text-xs text-gray-600">{label}<input type={key.startsWith('start_') || key.startsWith('end_') ? 'date' : 'text'} placeholder={key.startsWith('value_') ? 'Não informado' : undefined} value={impact[channel]?.metrics?.[metric]?.[key] ?? ''} onChange={event => setMetric(channel,metric,key,event.target.value)} className="block w-full rounded-lg border px-2 py-2 text-sm" /></label>)}</div><p className="mt-2 text-xs text-gray-500">Compare apenas métricas equivalentes e períodos compatíveis.</p></fieldset>)}</div></div>)}</div>
        </section>

        <div className="sticky bottom-3 flex justify-end rounded-2xl border border-[#e7e9e2] bg-white/95 p-3 shadow-lg backdrop-blur"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#103d2e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar rascunho'}</button></div>
      </form>
    </div>
  );
}

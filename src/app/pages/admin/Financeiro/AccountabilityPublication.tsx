import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DashboardContent } from '@/app/pages/public/Accountability/Dashboard';
import { formatDate, sections, type PublicReport, type Section } from '@/app/pages/public/Accountability/model';
import { accountabilityPublicContent } from './accountabilityPublicContent';
import type { FajFinancialData } from './fajFinancialCalculations';

type Report = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  period_start: string | null;
  period_end: string | null;
  financial_data: FajFinancialData;
  narrative_data: Record<string, unknown>;
  template: { slug: string };
};
type Release = { slug: string; enabled: boolean; published_at: string };

export function AccountabilityPublication({ report, disabled, onChange }: {
  report: Report;
  disabled: boolean;
  onChange: () => void;
}) {
  const [release, setRelease] = useState<Release | null>(null);
  const [slug, setSlug] = useState(report.template.slug);
  const [selected, setSelected] = useState<Section[]>([]);
  const [preview, setPreview] = useState<Section>();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const content = useMemo(() => accountabilityPublicContent(report.financial_data, report.narrative_data), [report]);
  const available = (Object.keys(sections) as Section[]).filter(key => key === 'narrative'
    ? content[key]?.length === 4 : !!content[key]?.length);
  const selectedAvailable = selected.filter(key => available.includes(key));
  const publicPath = '/prestacao-de-contas/' + encodeURIComponent(release?.slug || slug);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setReviewed(false);
    void supabase.rpc('get_finance_accountability_publication', { target_report_id: report.id }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError('Não foi possível consultar a publicação. Recarregue a página.');
      const current = data as Release | null;
      setRelease(current);
      setSlug(current?.slug ?? report.template.slug);
      setLoading(false);
    });
    return () => { active = false; };
  }, [report.id, report.template.slug, report.updated_at]);

  const toggle = (section: Section) => {
    setReviewed(false);
    setSelected(current => current.includes(section) ? current.filter(item => item !== section) : [...current, section]);
  };

  const changePublication = async (publish: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('set_finance_accountability_publication', {
        target_report_id: report.id,
        expected_revision: report.updated_at,
        expected_publication: release?.published_at ?? null,
        requested_slug: slug,
        reviewed_content: publish ? Object.fromEntries(selectedAvailable.map(key => [key, content[key]])) : null,
      });
      if (error) throw error;
      setRelease(data as Release | null);
      setReviewed(false);
      toast.success(publish ? 'Versão pública disponibilizada.' : 'Versão retirada da consulta pública.');
      onChange();
    } catch (cause) {
      toast.error((cause as { message?: string })?.message || 'Falha ao atualizar a publicação.');
    } finally { setBusy(false); }
  };

  const previewReport: PublicReport = {
    title: report.title,
    period_start: report.period_start,
    period_end: report.period_end,
    published_at: report.updated_at,
    content,
  };
  const invalidSlug = !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80;

  return <details className="rounded-2xl border bg-white p-5">
    <summary className="cursor-pointer font-semibold">Publicação de transparência</summary>
    <div className="mt-4 space-y-4">
      {error ? <p role="alert">{error}</p> : loading ? <p role="status">Consultando publicação…</p> : <>
        <p>{release?.enabled && report.status !== 'archived' ? 'Versão disponível desde ' + formatDate(release.published_at) : 'Sem versão pública ativa.'}</p>
        {release?.enabled && report.status !== 'archived' && <div className="flex flex-wrap gap-3 text-sm">
          <a className="underline" href={publicPath} target="_blank" rel="noreferrer">Abrir dashboard público</a>
          <button type="button" className="underline" onClick={() => {
            void navigator.clipboard.writeText(location.origin + publicPath).then(() => toast.success('Link copiado.'), () => toast.error('Não foi possível copiar o link.'));
          }}>Copiar link</button>
          <button type="button" className="underline" disabled={busy} onClick={() => void changePublication(false)}>Despublicar</button>
        </div>}
        {report.status !== 'archived' && <fieldset disabled={disabled || busy} className="space-y-4">
          <label className="block text-sm font-medium">Identificador na URL
            <input className="ml-2 rounded border px-2 py-1" value={slug} onChange={event => { setSlug(event.target.value); setReviewed(false); }} />
          </label>
          <fieldset className="space-y-2">
            <legend className="font-medium">Seções da próxima versão</legend>
            {available.map(key => <div key={key} className="flex flex-wrap items-center gap-3 text-sm">
                <label><input type="checkbox" className="mr-2" checked={selected.includes(key)} onChange={() => toggle(key)} />{sections[key]}</label>
                <button type="button" className="underline" aria-expanded={preview === key} onClick={() => setPreview(current => current === key ? undefined : key)}>Prévia</button>
              </div>)}
          </fieldset>
          {preview && <div className="rkc-account rounded-xl px-4" style={{ minHeight: 0 }}>
            <DashboardContent key={preview} report={previewReport} section={preview} />
          </div>}
          <label className="block text-sm"><input type="checkbox" className="mr-2" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
            Conferi as seções selecionadas com as fontes oficiais e revisei os textos, valores e evidências para divulgação pública.
          </label>
          {disabled && <p className="text-sm">Salve as alterações antes de publicar.</p>}
          <button type="button" className="rounded-lg bg-[#194934] px-4 py-2 text-white disabled:opacity-50"
            disabled={!reviewed || !selectedAvailable.length || invalidSlug} onClick={() => void changePublication(true)}>
            {release?.enabled ? 'Atualizar versão pública' : 'Publicar dashboard'}
          </button>
        </fieldset>}
      </>}
    </div>
  </details>;
}

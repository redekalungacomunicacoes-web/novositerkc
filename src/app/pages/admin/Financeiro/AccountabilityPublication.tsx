import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { editorialBucket } from '@/app/pages/public/Accountability/EditorialMedia';
import { DashboardContent } from '@/app/pages/public/Accountability/Dashboard';
import { formatDate, parsePublicReport, sections, type PublicReport, type PublicRow, type Section } from '@/app/pages/public/Accountability/model';
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
  const [source, setSource] = useState<PublicReport['content']>();
  const [publishedContent, setPublishedContent] = useState<PublicReport['content']>();
  const [media, setMedia] = useState<PublicRow[]>([]);
  const sourceInput = useRef<HTMLInputElement>(null);
  const baseContent = useMemo(() => accountabilityPublicContent(report.financial_data, report.narrative_data), [report]);
  const content = { ...(source ?? publishedContent ?? baseContent), team_members: baseContent.team_members,
    ...(media.length ? { records: [...(publishedContent?.records ?? []), ...media] } : {}) };
  const available = (Object.keys(sections) as Section[]).filter(key => key === 'narrative'
    ? content[key]?.length === 4 : !!content[key]?.length);
  const selectedAvailable = selected.filter(key => available.includes(key));
  const publicPath = '/prestacao-de-contas/' + encodeURIComponent(release?.slug || slug);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setReviewed(false);
    setPublishedContent(undefined);
    setSelected([]);
    void supabase.rpc('get_finance_accountability_publication', { target_report_id: report.id }).then(async ({ data, error }) => {
      if (!active) return;
      if (error) setError('Não foi possível consultar a publicação. Recarregue a página.');
      const current = data as Release | null;
      setRelease(current);
      setSlug(current?.slug ?? report.template.slug);
      if (current?.enabled) {
        const result = await supabase.rpc('get_finance_accountability_public_report', { requested_slug: current.slug });
        if (!active) return;
        const published = parsePublicReport(result.data);
        if (result.error || !published) {
          setError('Não foi possível carregar as seções já publicadas.');
        } else {
          setPublishedContent(published.content);
          setSelected(Object.keys(published.content) as Section[]);
        }
      }
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
  const importSource = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      const entries = Object.entries(parsed);
      if (!entries.length || entries.some(([key, rows]) => key === 'records' || key === 'team_members' || !Object.hasOwn(sections, key)
        || !Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)
          || Object.values(row).some(value => value !== null && !['string', 'number'].includes(typeof value))))) throw new Error();
      setSource(parsed as PublicReport['content']);
      setReviewed(false);
      setSelected([]);
      toast.success('Conteúdo da fonte carregado para revisão.');
    } catch { toast.error('O arquivo não tem o formato de conteúdo público esperado.'); }
    finally { if (sourceInput.current) sourceInput.current.value = ''; }
  };

  const uploadMedia = async (index: number, file: File) => {
    setBusy(true);
    try {
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
      if (!extension || file.size > 8_000_000) throw new Error('Selecione uma imagem JPG, PNG ou WebP de até 8 MB.');
      const path = report.id + '/' + crypto.randomUUID() + '.' + extension;
      const { error } = await supabase.storage.from(editorialBucket).upload(path, file, { contentType: file.type, cacheControl: '0' });
      if (error) throw error;
      setMedia(current => current.map((row, position) => position === index ? { ...row, path } : row));
      setReviewed(false);
    } catch (cause) {
      toast.error((cause as { message?: string })?.message || 'Falha ao enviar imagem para revisão.');
    } finally { setBusy(false); }
  };

  const updateMedia = (index: number, key: string, value: string | number) => {
    setMedia(current => current.map((row, position) => position === index ? { ...row, [key]: value } : row));
    setReviewed(false);
  };
  const invalidMedia = selected.includes('records') && (!selected.includes('narrative') ||
    media.some(row => !row.path || !String(row.alt ?? '').trim() || !String(row.caption ?? '').trim()
      || !Number.isInteger(row.afterParagraph) || Number(row.afterParagraph) < 0 || Number(row.afterParagraph) > 99));
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
          <details className="space-y-3">
            <summary className="cursor-pointer font-medium">Conteúdo das fontes e imagens para revisão</summary>
            <label className="block">Conteúdo revisável em JSON
              <input ref={sourceInput} type="file" accept="application/json,.json" className="block"
                onChange={event => { const file = event.target.files?.[0]; if (file) void importSource(file); }} />
            </label>
            {(source || publishedContent) && <button type="button" className="underline" onClick={() => { setSource(undefined); setPublishedContent(undefined); setSelected([]); setReviewed(false); }}>
              Usar dados do cadastro
            </button>}
            {media.map((row, index) => <fieldset key={index} className="space-y-2 rounded border p-3">
              <legend>Imagem {index + 1}</legend>
              <label className="block">Arquivo aprovado para divulgação
                <input type="file" accept="image/jpeg,image/png,image/webp" className="block"
                  onChange={event => { const file = event.target.files?.[0]; if (file) void uploadMedia(index, file); }} />
              </label>
              {row.path && <p>Arquivo carregado para revisão.</p>}
              <label className="block">Texto alternativo<input className="ml-2 border" value={row.alt ?? ''} onChange={event => updateMedia(index, 'alt', event.target.value)} /></label>
              <label className="block">Legenda<input className="ml-2 border" value={row.caption ?? ''} onChange={event => updateMedia(index, 'caption', event.target.value)} /></label>
              <label className="block">Pergunta<select className="ml-2 border" value={row.question ?? 1} onChange={event => updateMedia(index, 'question', Number(event.target.value))}>
                {[1, 2, 3, 4].map(question => <option key={question}>{question}</option>)}
              </select></label>
              <label className="block">Após o parágrafo (0 para antes da resposta)
                <input type="number" className="ml-2 border" min="0" max="99" value={row.afterParagraph ?? 0}
                  onChange={event => updateMedia(index, 'afterParagraph', event.target.valueAsNumber)} />
              </label>
              <button type="button" className="underline" onClick={() => {
                setMedia(current => current.filter((_, position) => position !== index));
                setReviewed(false);
              }}>Remover da seleção</button>
            </fieldset>)}
            <button type="button" className="underline" disabled={media.length + (publishedContent?.records?.length ?? 0) >= 30} onClick={() => {
              setMedia(current => [...current, { question: 1, afterParagraph: 0 }]);
              setReviewed(false);
            }}>Adicionar imagem</button>
            {invalidMedia && <p role="status">Selecione o narrativo e complete os dados de cada imagem.</p>}
          </details>
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
            disabled={!reviewed || !selectedAvailable.length || invalidSlug || invalidMedia} onClick={() => void changePublication(true)}>
            {release?.enabled ? 'Atualizar versão pública' : 'Publicar dashboard'}
          </button>
        </fieldset>}
      </>}
    </div>
  </details>;
}

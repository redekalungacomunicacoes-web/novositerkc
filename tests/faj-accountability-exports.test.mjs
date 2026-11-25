import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { fillFajNarrative, fillFajWorkbook, impactRows } from '../supabase/functions/_shared/faj-office-export.ts';
import { renderFajConsolidatedPdf } from '../supabase/functions/_shared/faj-pdf-export.ts';

const narrative = {
  institution: { organization_name: 'Organização de teste', emails: ['teste@example.invalid'], requested_amount: 0 },
  question_1: 'Texto & informação\nSegunda linha',
  impact_engagement: { Instagram: { metrics: { Alcance: { value_2025: 0, value_2026: 7 } } } },
};

test('fills the marked Word template while preserving styles, line breaks and nine channels', async () => {
  const zip = new JSZip();
  const tokens = ['ORGANIZACAO', 'RESPONSAVEL', 'CARGO', 'EMAILS', 'VALOR_SOLICITADO', 'DATA_PREENCHIMENTO',
    'PERGUNTA_1', 'PERGUNTA_2', 'PERGUNTA_3', 'PERGUNTA_4'];
  const p = text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const marker = key => `{{${key}}}`;
  const impact = ['IMPACT_CHANNEL', 'IMPACT_INDICATOR', 'IMPACT_2025', 'IMPACT_2026', 'IMPACT_VARIATION', 'IMPACT_NOTES'];
  const row = `<w:tr>${impact.map(key => `<w:tc>${p(marker(key))}</w:tc>`).join('')}</w:tr>`;
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    ${p('Título oficial')}${tokens.map(key => key === 'PERGUNTA_1' ? '<w:p><w:r><w:t>{{PERG</w:t></w:r><w:r><w:t>UNTA_1}}</w:t></w:r></w:p>' : p(marker(key))).join('')}
    <w:tbl>${row}</w:tbl></w:body></w:document>`);
  zip.file('word/styles.xml', '<preserved/>');
  const result = await JSZip.loadAsync(await fillFajNarrative(await zip.generateAsync({ type: 'uint8array' }), narrative));
  const xml = await result.file('word/document.xml').async('string');
  assert.match(xml, /Título oficial/);
  assert.match(xml, /Organização de teste/);
  assert.match(xml, /Texto &amp; informação<\/w:t><w:br\/><w:t[^>]*>Segunda linha/);
  assert.equal((xml.match(/<w:tr>/g) ?? []).length, 9);
  assert.match(xml, /<w:t[^>]*>0<\/w:t>/);
  assert.doesNotMatch(xml, /{{/);
  assert.equal(await result.file('word/styles.xml').async('string'), '<preserved/>');
  assert.equal(impactRows(narrative.impact_engagement)[0].IMPACT_2025, '0');
  zip.file('word/document.xml', '<missing/>');
  await assert.rejects(fillFajNarrative(await zip.generateAsync({ type: 'uint8array' }), narrative), /marcadores/);
});

test('renders a real multi-page consolidated PDF using saved report data', async () => {
  const report = {
    title: 'Relatório privado · RKC', status: 'draft',
    narrative_data: { ...narrative, question_1: 'Evidência na comunidade com ação no território. '.repeat(800) },
    financial_data: { team: [{ name: 'Pessoa A', monthly: 100, faj: 0, months: 2 }],
      workPlanRows: [{ objective: 'Objetivo registrado' }] },
  };
  const output = await renderFajConsolidatedPdf(report);
  assert.equal(Buffer.from(output.subarray(0, 5)).toString(), '%PDF-');
  const parsed = await PDFDocument.load(output);
  assert.ok(parsed.getPageCount() > 1);
  assert.equal(parsed.getTitle(), 'Relatório consolidado · FAJ II Ciclo');
});

test('fills the original XLSX in isolation while preserving workbook structure and removing prior mapped data',
  { skip: !process.env.RKC_FAJ_ORIGINAL_XLSX }, async () => {
    const original = await readFile(process.env.RKC_FAJ_ORIGINAL_XLSX);
    const data = { narrative_data: narrative, financial_data: { workPlanRows: [{ objective: '=texto não executável' }], team: [{ name: 'Pessoa A', monthly: 0, faj: 0, months: 2 }] } };
    const before = await JSZip.loadAsync(original);
    const result = await JSZip.loadAsync(await fillFajWorkbook(original, data));
    const wb = await result.file('xl/workbook.xml').async('string');
    assert.match(wb, /name="LISTAS"[^>]*state="hidden"|state="hidden"[^>]*name="LISTAS"/);
    const originalWorkbook = await before.file('xl/workbook.xml').async('string');
    const sheets = (originalWorkbook.match(/<sheet /g) ?? []).length;
    const offset = originalWorkbook.includes('name="0_APRESENTACAO"') ? 1 : 0;
    assert.equal(sheets, 6 + offset);
    assert.equal((wb.match(/<sheet /g) ?? []).length, sheets);
    let formulas = 0;
    for (let index = 1; index <= sheets; index++) {
      const path = `xl/worksheets/sheet${index}.xml`;
      const sheet = await result.file(path).async('string');
      const initial = await before.file(path).async('string');
      formulas += (sheet.match(/<f(?: |>)/g) ?? []).length;
      assert.equal((sheet.match(/<dataValidation(?: |>)/g) ?? []).length, (initial.match(/<dataValidation(?: |>)/g) ?? []).length);
      assert.equal((sheet.match(/<mergeCell(?: |>)/g) ?? []).length, (initial.match(/<mergeCell(?: |>)/g) ?? []).length);
      if (index === 2 + offset) {
        assert.match(sheet, /Observações importantes:|<c[^>]*r="A16"/);
        assert.match(sheet, /<c[^>]*r="A3"[^>]*t="inlineStr"[^>]*><is><t[^>]*>=texto não executável<\/t>/);
      }
      if (index === 3 + offset) assert.match(sheet, /\$E\$3:\$E\$18,2025,\$G\$3:\$G\$18,"Confirmado – a receber"/);
      if (index === 4 + offset) assert.ok(/<f(?: [^>]+)?>SUM\(F2:F17\)<\/f>/.test(sheet));
    }
    assert.equal(formulas, 86);
    const strings = await result.file('xl/sharedStrings.xml').async('string');
    assert.ok(!/@gmail\.com/i.test(strings), 'source contacts must be removed');
  });

test('registers an immutable export and audit entry once per version', async t => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.finance_accountability_documents (
      id uuid primary key default gen_random_uuid(), report_id uuid, document_type text check (document_type = 'official_template'),
      file_name text, mime_type text, storage_path text, checksum_sha256 text, template_version integer,
      metadata jsonb, generated_at timestamptz, created_by uuid
    );
    create table public.finance_accountability_history (report_id uuid, action text, actor_id uuid, change_summary text, snapshot jsonb);
    grant select, insert, update on public.finance_accountability_documents to authenticated, service_role;
    grant insert on public.finance_accountability_history to service_role;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261124203000_finance_accountability_exports.sql', import.meta.url), 'utf8'));
  const report = '00000000-0000-4000-8000-000000000001';
  const register = driveId => db.query(
    'select public.record_finance_accountability_export($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as id',
    [report, 'consolidated_report', 'Relatório.pdf', 'application/pdf', driveId, 'checksum', 1, 'version', 'pdf', null],
  );
  await db.exec('set role authenticated');
  await assert.rejects(register('private-id'), { code: '42501' });
  await assert.rejects(db.exec(`insert into public.finance_accountability_documents(document_type,metadata) values ('consolidated_report','{"stage":"filled_export"}')`), { code: '42501' });
  await db.exec('set role service_role');
  const original = (await register('private-id')).rows[0].id;
  assert.equal((await register('private-id')).rows[0].id, original);
  await assert.rejects(register('unexpected-id'), /não corresponde/);
  await db.exec('reset role');
  assert.equal((await db.query('select document_type from public.finance_accountability_documents')).rows.length, 1);
  assert.equal((await db.query('select action from public.finance_accountability_history')).rows[0].action, 'document_generated');
});

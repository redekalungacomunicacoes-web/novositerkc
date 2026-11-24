import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { fajEditableCells, fajFormulaCorrections, fajTabs, readFajCells } from './faj-sheet-mapping.ts';

type CellReport = Parameters<typeof readFajCells>[0];
type Value = string | number | boolean | null;
type RecordValue = Record<string, unknown>;

const SHEET = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML = 'http://www.w3.org/XML/1998/namespace';
const MAX_BYTES = 5 * 1024 * 1024;

export const object = (value: unknown): RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RecordValue : {};

export const entries = (value: unknown): RecordValue[] => Array.isArray(value) ? value.map(object) : [];
export const stringValue = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

function xmlText(value: string) {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value)) throw new Error('Há caracteres incompatíveis com o formato Office.');
  return value;
}

function nodes(root: Document | Element, ns: string, tag: string): Element[] {
  return Array.from(root.getElementsByTagNameNS(ns, tag));
}

async function openOffice(bytes: Uint8Array) {
  if (bytes.length > MAX_BYTES) throw new Error('O modelo oficial excede 5 MB.');
  const zip = await JSZip.loadAsync(bytes);
  if (Object.values(zip.files).some(file => file.unsafeOriginalName && file.unsafeOriginalName !== file.name)
    || Object.keys(zip.files).some(name => /(?:vbaProject\.bin|activeX\/|externalLinks\/|embeddings\/)/i.test(name))) {
    throw new Error('Modelo Office com componentes externos ou executáveis.');
  }
  return zip;
}

async function readXml(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) throw new Error('Estrutura do modelo oficial incompatível.');
  const xml = await file.async('string');
  if (xml.length > MAX_BYTES || /<!DOCTYPE/i.test(xml)) throw new Error('Estrutura XML do modelo oficial inválida.');
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function setXml(zip: JSZip, path: string, document: Document) {
  zip.file(path, new XMLSerializer().serializeToString(document));
}

function setCellValue(document: Document, cell: Element, value: Value) {
  if (nodes(cell, SHEET, 'f').length) throw new Error('Um campo editável coincide com uma fórmula no modelo.');
  for (const tag of ['v', 'is']) for (const node of nodes(cell, SHEET, tag)) node.parentNode?.removeChild(node);
  cell.removeAttribute('t');
  if (value === null || value === '') return;
  if (typeof value === 'string') {
    if (value.length > 32767) throw new Error('Um campo excede o limite de caracteres por célula do Excel.');
    const inline = document.createElementNS(SHEET, 'is');
    const t = document.createElementNS(SHEET, 't');
    t.setAttributeNS(XML, 'xml:space', 'preserve');
    t.textContent = xmlText(value);
    inline.appendChild(t);
    cell.setAttribute('t', 'inlineStr');
    cell.insertBefore(inline, cell.firstChild);
    return;
  }
  const node = document.createElementNS(SHEET, 'v');
  node.textContent = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  if (typeof value === 'boolean') cell.setAttribute('t', 'b');
  cell.insertBefore(node, cell.firstChild);
}

function a1(row: number, column: number) {
  return String.fromCharCode(64 + column) + row;
}

function getOrCreateCell(doc: Document, index: Map<string, Element>, ref: string) {
  const existing = index.get(ref);
  if (existing) return existing;
  const rowNumber = Number(ref.slice(1));
  const data = nodes(doc, SHEET, 'sheetData')[0];
  let row = nodes(data, SHEET, 'row').find(node => Number(node.getAttribute('r')) === rowNumber);
  if (!row) {
    row = doc.createElementNS(SHEET, 'row');
    row.setAttribute('r', String(rowNumber));
    const nextRow = nodes(data, SHEET, 'row').find(node => Number(node.getAttribute('r')) > rowNumber);
    data.insertBefore(row, nextRow ?? null);
  }
  const cell = doc.createElementNS(SHEET, 'c');
  cell.setAttribute('r', ref);
  const col = (value: string) => value.replace(/\d+$/, '');
  const nextCell = nodes(row, SHEET, 'c').find(node => {
    const name = col(node.getAttribute('r') ?? '');
    return name.length > col(ref).length || (name.length === col(ref).length && name > col(ref));
  });
  row.insertBefore(cell, nextCell ?? null);
  index.set(ref, cell);
  return cell;
}

async function scrubSharedStrings(zip: JSZip, docs: Document[]) {
  const path = 'xl/sharedStrings.xml';
  if (!zip.file(path)) return;
  const xml = await readXml(zip, path);
  const all = nodes(xml, SHEET, 'si');
  const used = new Map<number, number>();
  let useCount = 0;
  for (const sheet of docs) {
    for (const cell of nodes(sheet, SHEET, 'c').filter(cell => cell.getAttribute('t') === 's')) {
      const ref = nodes(cell, SHEET, 'v')[0];
      const previous = Number(ref?.textContent);
      if (!ref || !all[previous]) throw new Error('Texto compartilhado inválido no modelo oficial.');
      if (!used.has(previous)) used.set(previous, used.size);
      ref.textContent = String(used.get(previous));
      useCount++;
    }
  }
  for (const node of all) node.parentNode?.removeChild(node);
  const table = xml.documentElement!;
  for (const previous of used.keys()) table.appendChild(all[previous]);
  table.setAttribute('count', String(useCount));
  table.setAttribute('uniqueCount', String(used.size));
  setXml(zip, path, xml);
}

export async function fillFajWorkbook(bytes: Uint8Array, report: CellReport) {
  const zip = await openOffice(bytes);
  const workbook = await readXml(zip, 'xl/workbook.xml');
  const relationships = await readXml(zip, 'xl/_rels/workbook.xml.rels');
  const declared = nodes(workbook, SHEET, 'sheet');
  if (declared.length !== fajTabs.length || declared.some((node, index) => node.getAttribute('name') !== fajTabs[index])
      || !['hidden', 'veryHidden'].includes(declared[6].getAttribute('state') ?? '')) {
    throw new Error('O XLSX não corresponde às sete abas oficiais do FAJ II Ciclo.');
  }
  const financial = object(report.financial_data);
  for (const group of ['workPlanRows', 'funding', 'team', 'budgetExcludingTeam'] as const) {
    const count = new Set(fajEditableCells.filter(field => field.path[1] === group).map(field => field.row)).size;
    if (entries(financial[group]).slice(count).some(row => Object.values(row).some(value => value != null && value !== ''))) {
      throw new Error('O relatório contém linhas que excedem a capacidade do modelo oficial.');
    }
  }
  if (!entries(financial.workPlanRows).some(row => Object.values(row).some(value => value != null && value !== '')) && stringValue(financial.workPlan).trim()) {
    throw new Error('Organize o plano de trabalho anterior em linhas antes de exportar o XLSX.');
  }
  const collected = [];
  const values = readFajCells(report);
  for (const tab of declared) {
    const name = tab.getAttribute('name')!;
    const id = tab.getAttributeNS(REL, 'id');
    const rel = Array.from(relationships.getElementsByTagNameNS('*', 'Relationship')).find(node => node.getAttribute('Id') === id);
    const destination = rel?.getAttribute('Target') ?? '';
    const path = destination.startsWith('/xl/') ? destination.slice(1) : `xl/${destination}`;
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) throw new Error('Vínculo de aba incompatível com o modelo.');
    const doc = await readXml(zip, path);
    const index = new Map(nodes(doc, SHEET, 'c').map(cell => [cell.getAttribute('r') ?? '', cell]));
    for (const field of fajEditableCells.filter(field => field.tab === name)) {
      const ref = a1(field.row, field.column);
      let value = values[`'${name}'!${ref}`] ?? null;
      if (field.kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const date = new Date(value + 'T00:00:00Z');
        if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) {
          value = (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
        }
      }
      const cell = value === null ? index.get(ref) : getOrCreateCell(doc, index, ref);
      if (cell) setCellValue(doc, cell, value);
    }
    if (name === fajTabs[5]) {
      const organization = values[`'${fajTabs[1]}'!B3`] ?? null;
      setCellValue(doc, getOrCreateCell(doc, index, 'B3'), organization);
    }
    for (const field of fajFormulaCorrections.filter(field => field.tab === name)) {
      const cell = index.get(a1(field.row, field.column));
      const formula = cell && nodes(cell, SHEET, 'f')[0];
      if (!formula) throw new Error('Uma fórmula oficial esperada está ausente.');
      formula.textContent = field.formula.replace(/^=/, '');
    }
    // Never distribute numbers cached for the input template.
    for (const cell of nodes(doc, SHEET, 'c').filter(cell => nodes(cell, SHEET, 'f').length)) {
      for (const cached of nodes(cell, SHEET, 'v')) cached.parentNode?.removeChild(cached);
    }
    collected.push({ path, doc });
  }
  if (collected.reduce((total, { doc }) => total + nodes(doc, SHEET, 'f').length, 0) !== 86) {
    throw new Error('As 86 fórmulas oficiais do FAJ não foram localizadas.');
  }
  await scrubSharedStrings(zip, collected.map(({ doc }) => doc));
  for (const { path, doc } of collected) setXml(zip, path, doc);
  let settings = nodes(workbook, SHEET, 'calcPr')[0];
  if (!settings) {
    settings = workbook.createElementNS(SHEET, 'calcPr');
    workbook.documentElement!.appendChild(settings);
  }
  settings.setAttribute('fullCalcOnLoad', '1');
  settings.setAttribute('forceFullCalc', '1');
  setXml(zip, 'xl/workbook.xml', workbook);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

const channelLabels = [
  ['Instagram', 'Instagram'], ['Facebook', 'Facebook'], ['TikTok', 'TikTok'], ['LinkedIn', 'LinkedIn'],
  ['Site ou Portal', 'Site ou Portal'], ['Podcast ou conteúdo audiovisual', 'Podcast ou conteúdo audiovisual'],
  ['Jornal impresso / conteúdos impressos', 'Jornal impresso / conteúdos impressos'],
  ['Newsletters', 'Newsletters'], ['Outros canais', 'Outros canais de transmissão'],
];

function periodResult(metric: RecordValue, year: '2025' | '2026') {
  const value = stringValue(metric[`value_${year}`]);
  const dates = [metric[`start_${year}`], metric[`end_${year}`]].map(stringValue).filter(Boolean).join(' a ');
  return [value, dates].filter(Boolean).join('\n');
}

export function impactRows(impact: unknown) {
  return channelLabels.flatMap(([key, label]) => {
    const channel = object(object(impact)[key]);
    const metrics = Object.entries(object(channel.metrics)).map(([name, metric]) => {
      const data = object(metric);
      return { IMPACT_CHANNEL: label, IMPACT_INDICATOR: stringValue(data.name) || name, IMPACT_2025: periodResult(data, '2025'),
        IMPACT_2026: periodResult(data, '2026'), IMPACT_VARIATION: stringValue(data.variation), IMPACT_NOTES: stringValue(data.notes) };
    }).filter(row => row.IMPACT_2025 || row.IMPACT_2026 || row.IMPACT_VARIATION || row.IMPACT_NOTES);
    const aggregate = { IMPACT_CHANNEL: label, IMPACT_INDICATOR: '', IMPACT_2025: stringValue(channel.year_2025),
      IMPACT_2026: stringValue(channel.year_2026), IMPACT_VARIATION: stringValue(channel.variation), IMPACT_NOTES: stringValue(channel.notes) };
    if (aggregate.IMPACT_2025 || aggregate.IMPACT_2026 || aggregate.IMPACT_VARIATION || aggregate.IMPACT_NOTES) metrics.unshift(aggregate);
    return metrics.length ? metrics : [aggregate];
  });
}

function replaceWordTokens(doc: Document, scope: Document | Element, values: Record<string, string>) {
  const replaced = new Set<string>();
  for (const p of nodes(scope, WORD, 'p')) {
    const runs = nodes(p, WORD, 't');
    const all = runs.map(run => run.textContent ?? '').join('');
    const matches = [...all.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].reverse();
    for (const match of matches) {
      const key = match[1];
      if (!Object.hasOwn(values, key)) continue;
      const start = match.index!;
      const end = start + match[0].length;
      let offset = 0;
      let inserted = false;
      for (const run of runs) {
        const original = run.textContent ?? '';
        const runEnd = offset + original.length;
        if (offset < end && runEnd > start) {
          const prefix = original.slice(0, Math.max(0, start - offset));
          const suffix = original.slice(Math.min(original.length, end - offset));
          const replacement = inserted ? '' : values[key];
          inserted = true;
          const lines = xmlText(prefix + replacement + suffix).split(/\r?\n/);
          run.setAttributeNS(XML, 'xml:space', 'preserve');
          run.textContent = lines.shift()!;
          let after = run;
          for (const text of lines) {
            const br = doc.createElementNS(WORD, 'w:br');
            run.parentNode?.insertBefore(br, after.nextSibling);
            const t = doc.createElementNS(WORD, 'w:t');
            t.setAttributeNS(XML, 'xml:space', 'preserve');
            t.textContent = text;
            run.parentNode?.insertBefore(t, br.nextSibling);
            after = t;
          }
        }
        offset = runEnd;
      }
      replaced.add(key);
    }
  }
  return replaced;
}

export function institutionFields(narrative: unknown) {
  const data = object(narrative);
  const institution = object(data.institution);
  const date = stringValue(institution.filled_at);
  const requested = institution.requested_amount;
  return {
    ORGANIZACAO: stringValue(institution.organization_name), RESPONSAVEL: stringValue(institution.responsible_person),
    CARGO: stringValue(institution.responsible_role),
    EMAILS: Array.isArray(institution.emails) ? institution.emails.map(stringValue).filter(Boolean).join('\n') : stringValue(institution.emails),
    VALOR_SOLICITADO: typeof requested === 'number' ? currency(requested) : stringValue(requested),
    DATA_PREENCHIMENTO: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : date,
    PERGUNTA_1: stringValue(data.question_1), PERGUNTA_2: stringValue(data.question_2),
    PERGUNTA_3: stringValue(data.question_3), PERGUNTA_4: stringValue(data.question_4),
  };
}

export function currency(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : '';
}

export async function fillFajNarrative(bytes: Uint8Array, narrative: unknown) {
  const zip = await openOffice(bytes);
  const path = 'word/document.xml';
  const document = await readXml(zip, path);
  const fields = institutionFields(narrative);
  if (replaceWordTokens(document, document, fields).size !== Object.keys(fields).length) {
    throw new Error('Os marcadores institucionais ou narrativos do modelo Word estão incompletos.');
  }
  const impactTemplate = nodes(document, WORD, 'tr').filter(row => nodes(row, WORD, 't').map(t => t.textContent).join('').includes('{{IMPACT_CHANNEL}}'));
  if (impactTemplate.length !== 1) throw new Error('O modelo Word precisa de uma linha de indicadores com os marcadores oficiais.');
  for (const values of impactRows(object(narrative).impact_engagement)) {
    const row = impactTemplate[0].cloneNode(true) as Element;
    if (replaceWordTokens(document, row, values).size !== Object.keys(values).length) throw new Error('Os marcadores da tabela de indicadores estão incompletos.');
    impactTemplate[0].parentNode?.insertBefore(row, impactTemplate[0]);
  }
  impactTemplate[0].parentNode?.removeChild(impactTemplate[0]);
  setXml(zip, path, document);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

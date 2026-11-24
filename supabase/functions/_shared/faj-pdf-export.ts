import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { budgetLabels, calculateFajFinancials, type FajFinancialData } from './faj-financial-calculations.ts';
import { currency, entries, impactRows, institutionFields, object, stringValue } from './faj-office-export.ts';

type Report = { title: string; status: string; period_start?: string | null; period_end?: string | null; narrative_data: unknown; financial_data: unknown };
type Pair = readonly [string, string];
const green = rgb(0.063, 0.239, 0.18);
const ink = rgb(0.12, 0.16, 0.14);
const paper = rgb(0.96, 0.97, 0.95);

const workColumns = [['objective', 'Objetivo'], ['activity', 'Atividade / entrega'], ['outcome', 'Resultado esperado'],
  ['evidence', 'Indicador / evidência'], ['period', 'Período'], ['budgetLine', 'Rubrica / custo'], ['notes', 'Observações']] as const;

function toFontText(font: PDFFont, input: string) {
  const supported = new Set(font.getCharacterSet());
  return Array.from(input.normalize('NFC'), char => {
    if (char === '\u00a0' || char === '\t') return ' ';
    const point = char.codePointAt(0)!;
    return supported.has(point) ? char : `[U+${point.toString(16).toUpperCase()}]`;
  }).join('');
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines = [];
    let line = '';
    for (const word of toFontText(font, paragraph).split(/ /)) {
      const candidate = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    return [...lines, line];
  });
}

export async function renderFajConsolidatedPdf(report: Report) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('Relatório consolidado · FAJ II Ciclo');
  const [regular, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  let page: PDFPage;
  let y = 0;
  const left = 44;
  const right = 551;
  function startPage() {
    page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 783, width: 595, height: 59, color: green });
    page.drawText('REDE KALUNGA DE COMUNICAÇÕES', { x: left, y: 812, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText('FAJ II Ciclo · Relatório consolidado', { x: left, y: 793, size: 10, font: regular, color: rgb(1, 1, 1) });
    page.drawText(`Página ${doc.getPageCount()}`, { x: left, y: 27, size: 9, font: regular, color: ink });
    y = 755;
  }
  function write(text: string, font = regular, size = 11, offset = 0) {
    for (const line of wrap(font, text, size, right - left - offset)) {
      if (y < 55) startPage();
      if (line) page.drawText(line, { x: left + offset, y, size, font, color: ink });
      y -= size + 4;
    }
  }
  function section(name: string) {
    if (y < 95) startPage();
    y -= 10;
    page.drawRectangle({ x: left - 5, y: y - 5, width: right - left + 5, height: 19, color: paper });
    write(name, bold, 12);
    y -= 6;
  }
  function row(values: readonly Pair[]) {
    const populated = values.filter(([, value]) => value !== '');
    for (const [label, value] of populated) write(`${label}: ${value}`, regular, 10, 7);
    if (populated.length) y -= 6;
  }

  startPage();
  write(report.title, bold, 17);
  const statuses: Record<string, string> = { draft: 'Rascunho', in_review: 'Em revisão', approved: 'Aprovada', published: 'Publicada', archived: 'Arquivada', delivered: 'Entregue' };
  row([['Situação', statuses[report.status] ?? ''], ['Início do período', report.period_start ?? ''], ['Fim do período', report.period_end ?? '']]);
  const narrative = object(report.narrative_data);
  const financial = object(report.financial_data) as FajFinancialData & ReturnType<typeof object>;
  const institution = institutionFields(narrative);
  section('Identificação institucional');
  row([['Organização', institution.ORGANIZACAO], ['Responsável', institution.RESPONSAVEL],
    ['Cargo', institution.CARGO], ['E-mails', institution.EMAILS], ['Valor solicitado', institution.VALOR_SOLICITADO], ['Data de preenchimento', institution.DATA_PREENCHIMENTO]]);
  section('Plano de trabalho');
  const plan = entries(financial.workPlanRows);
  for (const item of plan) row(workColumns.map(([key, label]) => [label, stringValue(item[key])]));
  if (!plan.length && stringValue(financial.workPlan)) write(stringValue(financial.workPlan));
  section('Relatório narrativo');
  const questions = [
    'O que significa desenvolvimento institucional para a sua organização e o que vocês desejam alcançar nesse sentido em 2027?',
    'Quais mudanças institucionais vocês pretendem priorizar em 2027 e por que elas são importantes para a organização?',
    'Como vocês pretendem colocar essas prioridades em prática ao longo de 2027?',
    'Ao final de 2027, que mudanças concretas permitiriam reconhecer que a organização se desenvolveu institucionalmente?',
  ];
  for (const [index, question] of questions.entries()) {
    write(question, bold, 10);
    const answer = stringValue(narrative[`question_${index + 1}`]);
    if (answer) write(answer);
    y -= 6;
  }
  section('Sustentabilidade financeira');
  for (const item of entries(financial.funding)) row([['Financiador', stringValue(item.source)], ['Tipo', stringValue(item.sourceType)],
    ['Finalidade', stringValue(item.purpose)], ['Projeto', stringValue(item.project)], ['Ano', stringValue(item.year)],
    ['Valor informado', currency(item.amount)], ['Situação', stringValue(item.status)], ['Entrada prevista', stringValue(item.expectedDate)], ['Observações', stringValue(item.notes)]]);
  row([['Variações', stringValue(financial.sustainabilityVariations)], ['Riscos e captação', stringValue(financial.sustainabilityRisks)]]);
  section('Equipe e remuneração prevista');
  for (const item of entries(financial.team)) row([['Integrante ou função', stringValue(item.name)], ['Vínculo', stringValue(item.relationship)],
    ['Remuneração mensal bruta', currency(item.monthly)], ['Encargos mensais', currency(item.charges)], ['Meses previstos', stringValue(item.months)],
    ['Valor financiado pelo FAJ', currency(item.faj)], ['Observações', stringValue(item.notes)]]);
  section('Orçamento previsto por rubricas');
  row([['Referência', stringValue(financial.budgetReference)], ['Período', stringValue(financial.budgetPeriod)],
    ['Observações sobre pessoal', stringValue(financial.personnelNotes)], ['Mudanças', stringValue(financial.budgetChanges)]]);
  const totals = calculateFajFinancials(
    Array.isArray(financial.team) ? financial.team : [],
    Array.isArray(financial.budgetExcludingTeam) ? financial.budgetExcludingTeam : [],
    []
  );
  row([['Pessoal/equipe', currency(totals.teamTotal)], ['Pessoal financiado pelo FAJ', currency(totals.teamFaj)],
    ['Orçamento total previsto', currency(totals.total)], ['FAJ previsto', currency(totals.faj)], ['Outras fontes previstas', currency(totals.other)],
    ['Participação prevista do FAJ', totals.share === null ? '' : totals.share.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 2 })]]);
  for (const [index, item] of entries(financial.budgetExcludingTeam).entries()) {
    if (!Object.values(item).some(value => value !== null && value !== '')) continue;
    row([['Rubrica', stringValue(item.label) || budgetLabels[index] || ''], ['Descrição', stringValue(item.description)],
      ['Custo previsto', currency(item.total)], ['Valor FAJ previsto', currency(item.faj)], ['Observações', stringValue(item.notes)]]);
  }
  section('Impacto e engajamento');
  for (const item of impactRows(narrative.impact_engagement)) row([['Canal', item.IMPACT_CHANNEL], ['Indicador', item.IMPACT_INDICATOR],
    ['2025', item.IMPACT_2025], ['2026', item.IMPACT_2026], ['Variação', item.IMPACT_VARIATION], ['Observações', item.IMPACT_NOTES]]);
  return await doc.save();
}

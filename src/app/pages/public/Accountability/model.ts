export const sections = {
  overview: 'Dados de identificação',
  budget: 'Orçamento por rubricas',
  team: 'Equipe',
  team_members: 'Detalhamento da equipe',
  funding: 'Sustentabilidade',
  plan: 'Plano de trabalho',
  institution: 'Apresentação institucional',
  narrative: 'Desenvolvimento institucional',
  records: 'Ações, fotografias e registros',
  impact: 'Impacto e engajamento',
  results: 'Resultados e perspectivas',
} as const;

export type Section = keyof typeof sections;
export type PublicRow = Record<string, string | number | null>;
export type PublicReport = {
  title: string;
  published_at: string;
  period_start: string | null;
  period_end: string | null;
  content: Partial<Record<Section, PublicRow[]>>;
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 });
export const money = (value: PublicRow[string]) => typeof value === 'number' ? currency.format(value) : 'Não informado';
export const percentage = (value: PublicRow[string]) => typeof value === 'number' ? percent.format(value) : 'Não informado';
export const formatDate = (date: string | null) => date
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: date.length === 10 ? 'UTC' : 'America/Sao_Paulo' }).format(new Date(date))
  : 'Não informado';

const plainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function parsePublicReport(value: unknown): PublicReport | null {
  if (!plainObject(value) || !plainObject(value.content) ||
      typeof value.title !== 'string' || typeof value.published_at !== 'string' ||
      !Number.isFinite(Date.parse(value.published_at))) return null;

  const content: PublicReport['content'] = {};
  for (const section of Object.keys(sections) as Section[]) {
    const rows = value.content[section];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || !rows.every(row => plainObject(row) &&
      Object.values(row).every(field => field === null ||
        typeof field === 'string' || (typeof field === 'number' && Number.isFinite(field))))) return null;
    content[section] = rows;
  }
  const date = (field: unknown) => typeof field === 'string' && Number.isFinite(Date.parse(field)) ? field : null;
  return { title: value.title, published_at: value.published_at,
    period_start: date(value.period_start), period_end: date(value.period_end), content };
}

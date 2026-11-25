export const sections = {
  overview: 'Visão geral',
  budget: 'Orçamento e rubricas',
  team: 'Equipe e estrutura',
  funding: 'Sustentabilidade financeira',
  plan: 'Plano de trabalho',
  institution: 'Visão institucional',
  narrative: 'Relatório narrativo',
  impact: 'Impacto e engajamento',
  results: 'Desenvolvimento institucional',
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

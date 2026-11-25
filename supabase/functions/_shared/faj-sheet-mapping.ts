import type { Cells, CellValue } from "./accountability-sheet-reconcile.ts";

export type FajReportData = { financial_data: unknown; narrative_data: unknown };
type PathPart = string | number;
type Kind = "text" | "amount" | "months" | "year" | "status" | "emails" | "date";
export type FajCell = {
  tab: string;
  row: number;
  column: number;
  path: PathPart[];
  kind: Kind;
};

export const fajTabs = [
  "1_DADOS DE IDENTIFICAÇÃO", "2_PLANO_DE_TRABALHO",
  "3_SUSTENTABILIDADE", "4_EQUIPE", "5_ORCAMENTO_RUBRICAS", "LISTAS",
] as const;
const [identity, plan, funding, team, budget] = fajTabs;
type Column = readonly [column: number, key: string, kind: Kind];
const rows = (tab: string, first: number, count: number, group: string, columns: readonly Column[]): FajCell[] =>
  Array.from({ length: count }, (_, index) => columns.map(([column, key, kind]) => ({
    tab, column, kind, row: first + index, path: ["financial_data", group, index, key],
  }))).flat();

export const fajEditableCells: readonly FajCell[] = [
  ...([
    [funding, 29, 2, "sustainabilityVariations"], [funding, 30, 2, "sustainabilityRisks"],
    [budget, 2, 2, "budgetReference"], [budget, 4, 2, "budgetPeriod"],
    [budget, 7, 7, "personnelNotes"], [budget, 26, 2, "budgetChanges"],
  ] as const).map(([tab, row, column, key]): FajCell => ({ tab, row, column, path: ["financial_data", key], kind: "text" })),
  ...(["organization_name", "responsible_person", "emails", "renewal_period", "registration_changes"] as const)
    .map((key, index): FajCell => ({
      tab: identity, row: index + 3, column: 2, path: ["narrative_data", "institution", key], kind: key === "emails" ? "emails" : "text",
    })),
  ...rows(plan, 3, 13, "workPlanRows", [
    [1, "objective", "text"], [2, "activity", "text"], [3, "outcome", "text"], [4, "evidence", "text"],
    [5, "period", "text"], [6, "budgetLine", "text"], [7, "notes", "text"],
  ]),
  ...rows(funding, 3, 16, "funding", [
    [1, "source", "text"], [2, "sourceType", "text"], [3, "purpose", "text"], [4, "project", "text"],
    [5, "year", "year"], [6, "amount", "amount"], [7, "status", "status"], [8, "expectedDate", "date"], [9, "notes", "text"],
  ]),
  ...rows(team, 2, 16, "team", [
    [1, "name", "text"], [2, "relationship", "text"], [3, "monthly", "amount"], [4, "charges", "amount"],
    [5, "months", "months"], [7, "faj", "amount"], [9, "notes", "text"],
  ]),
  ...rows(budget, 8, 10, "budgetExcludingTeam", [
    [2, "description", "text"], [3, "total", "amount"], [4, "faj", "amount"], [7, "notes", "text"],
  ]),
];

export const fajFormulaCorrections = [
  { tab: funding, row: 23, column: 2, formula: '=SUMIFS($F$3:$F$18,$E$3:$E$18,2025,$G$3:$G$18,"Confirmado – a receber")' },
  { tab: funding, row: 23, column: 3, formula: '=SUMIFS($F$3:$F$18,$E$3:$E$18,2026,$G$3:$G$18,"Confirmado – a receber")' },
  { tab: funding, row: 24, column: 2, formula: '=SUMIFS($F$3:$F$18,$E$3:$E$18,2025,$G$3:$G$18,"Em negociação")' },
  { tab: funding, row: 24, column: 3, formula: '=SUMIFS($F$3:$F$18,$E$3:$E$18,2026,$G$3:$G$18,"Em negociação")' },
  { tab: team, row: 18, column: 6, formula: "=SUM(F2:F17)" },
  { tab: team, row: 18, column: 7, formula: "=SUM(G2:G17)" },
  { tab: team, row: 22, column: 3, formula: '=COUNTIF(A2:A17,"?*")' },
];

export const a1 = ({ tab, row, column }: Pick<FajCell, "tab" | "row" | "column">) =>
  `'${tab}'!${String.fromCharCode(64 + column)}${row}`;
export const fajEditableKeys = fajEditableCells.map(a1);

const fundingStatuses = [
  "Confirmado – recurso recebido", "Confirmado – a receber", "Em negociação", "Potencial doador / prospecção",
];

export function normalizeFajCell(cell: FajCell, value: unknown): CellValue {
  if (value === null || value === undefined || value === "") return null;
  const invalid = () => new Error(`Valor incompatível com o modelo FAJ em ${a1(cell)}.`);
  if (cell.kind === "emails") {
    if (!Array.isArray(value) && typeof value !== "string") throw invalid();
    const entries = Array.isArray(value) ? value : value.split(/[\n,;]/);
    if (entries.some(entry => typeof entry !== "string")) throw invalid();
    return entries.map(entry => entry.trim()).filter(Boolean).join("\n") || null;
  }
  if (cell.kind === "date" && typeof value === "number") {
    if (!Number.isFinite(value) || value < 1 || value >= 100_000) throw invalid();
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000).toISOString().slice(0, 10);
  }
  if (cell.kind === "amount") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1e12 ||
      Math.abs(value - Math.round(value * 100) / 100) > 1e-8) throw invalid();
    return value;
  }
  if (cell.kind === "months" || cell.kind === "year") {
    if (typeof value !== "number" || !Number.isSafeInteger(value) ||
      (cell.kind === "months" ? value < 1 : ![2025, 2026, 2027].includes(value))) throw invalid();
    return value;
  }
  // Sheets converts free-form period strings like "12" to numbers.
  if ((cell.kind === "text" || cell.kind === "date") && typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string" || value.length > 50_000 ||
    (cell.kind === "status" && !fundingStatuses.includes(value))) throw invalid();
  return value;
}

function at(data: unknown, key: PathPart) {
  return data && typeof data === "object" ? (data as Record<PathPart, unknown>)[key] : undefined;
}

export function readFajCells(report: FajReportData): Cells {
  return Object.fromEntries(fajEditableCells.map(cell => [a1(cell), normalizeFajCell(cell, cell.path.reduce(at, report as unknown))]));
}

type Nested = Record<PathPart, unknown>;
export function applyFajCells<T extends FajReportData>(report: T, values: Cells): T {
  const updated = structuredClone(report);
  for (const cell of fajEditableCells) {
    const key = a1(cell);
    if (!Object.hasOwn(values, key)) continue;
    const value = normalizeFajCell(cell, values[key]);
    let node = updated as unknown as Nested;
    for (let index = 0; index < cell.path.length - 1; index++) {
      const part = cell.path[index];
      const numeric = typeof cell.path[index + 1] === "number";
      if (numeric ? !Array.isArray(node[part]) : !node[part] || typeof node[part] !== "object" || Array.isArray(node[part])) {
        node[part] = numeric ? [] : {};
      }
      if (Array.isArray(node)) {
        for (let missing = 0; missing < Number(part); missing++) node[missing] ??= {};
      }
      node = node[part] as Nested;
    }
    node[cell.path.at(-1)!] = cell.kind === "emails" ? typeof value === "string" ? value.split("\n") : [] : value;
  }
  return updated;
}

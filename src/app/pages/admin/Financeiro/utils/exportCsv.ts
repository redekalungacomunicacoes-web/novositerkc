const toSafe = (value: unknown) => `${value ?? ''}`.replace(/"/g, '""');

const formatValue = (column: string, value: unknown) => {
  if (column === 'Data' && value) return new Date(`${value}`).toLocaleDateString('pt-BR');
  if (['Valor Unit', 'Total'].includes(column)) return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value ?? ''}`;
};

export const DEFAULT_REPORT_COLUMNS = ['Data', 'Tipo', 'Status', 'Descrição', 'Categoria', 'Projeto', 'Fundo', 'Valor Unit', 'Qtd', 'Total', 'Forma Pgto', 'Favorecido', 'Doc Tipo', 'Doc Nº', 'Observações', 'Qtd Comprovantes'];

export type ExportMovementRow = Record<string, string | number | null | undefined>;

export function exportMovementsCsv(rows: ExportMovementRow[], columns = DEFAULT_REPORT_COLUMNS, filename = 'relatorio-financeiro.csv') {
  const header = columns.join(';');
  const body = rows.map((row) => columns.map((column) => `"${toSafe(formatValue(column, row[column]))}"`).join(';')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

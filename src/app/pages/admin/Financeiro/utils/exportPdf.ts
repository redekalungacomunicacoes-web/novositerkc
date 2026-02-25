export type ExportPdfOptions = {
  title?: string;
  subtitle?: string;
  periodLabel?: string;
  totals?: { entradas: number; saidas: number; saldo: number };
  columns: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
};

const css = `
  body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
  h1 { margin: 0 0 6px 0; font-size: 24px; }
  p { margin: 4px 0; color: #4b5563; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
  th { background: #f3f4f6; }
  .totals { display: flex; gap: 16px; margin-top: 12px; }
  .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; }
`;

export function exportMovementsPdf({ title = 'Relatório Financeiro', subtitle, periodLabel, totals, columns, rows }: ExportPdfOptions) {
  const table = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${row[column] ?? ''}</td>`).join('')}</tr>`)
    .join('');

  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`
    <html>
      <head><title>${title}</title><style>${css}</style></head>
      <body>
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
        ${periodLabel ? `<p>Período: ${periodLabel}</p>` : ''}
        ${totals ? `
          <div class="totals">
            <div class="card"><strong>Entradas:</strong> ${totals.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            <div class="card"><strong>Saídas:</strong> ${totals.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            <div class="card"><strong>Saldo:</strong> ${totals.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        ` : ''}
        <table>
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
          <tbody>${table}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

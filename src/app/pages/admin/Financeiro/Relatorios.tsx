import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Filter } from 'lucide-react';
import { formatCurrency, formatDate } from './data/financeiro.repo';
import { useFinanceSupabase, type ReportFilters } from './hooks/useFinanceSupabase';

type ReportRow = Awaited<ReturnType<ReturnType<typeof useFinanceSupabase>['getReport']>>[number];

type Scope = NonNullable<ReportFilters['scope']>;

const toCsv = (rows: ReportRow[]) => {
  const headers = ['Data', 'Tipo', 'Fundo', 'Projeto', 'Categoria', 'Descrição', 'Valor', 'Status', 'Favorecido', 'Forma Pgto', 'Centro de Custo', 'Doc', 'Qtde', 'Vlr Unit', 'Total', 'Anexos'];
  const body = rows.map((row) => [
    formatDate(row.date),
    row.type,
    row.fundName,
    row.projectName,
    row.categoryName,
    row.description,
    row.totalValue.toFixed(2),
    row.status,
    row.beneficiary,
    row.payMethod,
    row.costCenter,
    row.doc,
    String(row.quantity),
    row.unitValue.toFixed(2),
    row.totalValue.toFixed(2),
    String(row.attachmentsCount),
  ]);
  return [headers, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
};

export function Relatorios() {
  const { listFunds, listProjects, listCategories, getReport } = useFinanceSupabase();
  const [funds, setFunds] = useState<{ id: string; nome: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; nome: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({ scope: 'geral', type: 'todos', status: 'todos' });

  useEffect(() => {
    const boot = async () => {
      const [f, p, c] = await Promise.all([listFunds(), listProjects(), listCategories()]);
      setFunds(f.map((item) => ({ id: item.id, nome: item.nome })));
      setProjects(p.map((item) => ({ id: item.id, nome: item.nome })));
      setCategories(c.map((item) => ({ id: item.id, name: item.name })));
    };
    void boot();
  }, [listFunds, listProjects, listCategories]);

  const scope = (filters.scope || 'geral') as Scope;

  const gerar = async () => {
    setLoading(true);
    try {
      const data = await getReport(filters);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const inPaid = rows.filter((r) => r.status === 'pago' && r.type === 'entrada').reduce((acc, row) => acc + row.totalValue, 0);
    const outPaid = rows.filter((r) => r.status === 'pago' && r.type === 'saida').reduce((acc, row) => acc + row.totalValue, 0);
    return { inPaid, outPaid, saldo: inPaid - outPaid };
  }, [rows]);

  const exportCsv = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rowsHtml = rows.map((row) => `<tr><td>${formatDate(row.date)}</td><td>${row.type}</td><td>${row.fundName}</td><td>${row.projectName}</td><td>${row.categoryName}</td><td>${row.description}</td><td>${formatCurrency(row.totalValue)}</td><td>${row.status}</td><td>${row.attachmentsCount}</td></tr>`).join('');
    const html = `
      <html>
      <head>
        <title>Relatório Financeiro</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: Arial, sans-serif; color: #1f2937; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
          .brand { font-size: 22px; font-weight: 700; color: #0f3d2e; }
          .meta { color: #4b5563; font-size: 12px; margin-bottom: 12px; }
          .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
          .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #e5e7eb; padding: 5px; vertical-align: top; }
          th { background: #0f3d2e; color: #fff; }
          tr:nth-child(even) { background: #f8fafc; }
          .signature { margin-top: 30px; display: flex; justify-content: space-between; }
          .line { width: 220px; border-top: 1px solid #111827; padding-top: 6px; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">Relatório Financeiro</div>
          <div>${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="meta">
          Escopo: ${scope} | Período: ${filters.startDate || 'Início'} até ${filters.endDate || 'Hoje'} | tipo=${filters.type || 'todos'} | status=${filters.status || 'todos'}
        </div>
        <div class="totals">
          <div class="card"><strong>Entradas pagas</strong><br />${formatCurrency(totals.inPaid)}</div>
          <div class="card"><strong>Saídas pagas</strong><br />${formatCurrency(totals.outPaid)}</div>
          <div class="card"><strong>Saldo no período</strong><br />${formatCurrency(totals.saldo)}</div>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Fundo</th><th>Projeto</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Anexos</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="signature">
          <div class="line">Responsável Financeiro</div>
          <div class="line">Assinatura</div>
        </div>
      </body>
      </html>`;

    const frame = window.open('', '_blank');
    if (!frame) return;
    frame.document.write(html);
    frame.document.close();
    frame.focus();
    frame.print();
  };

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Relatórios Financeiros</h1>
      <div className="mb-6 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
        <select className="rounded border px-3 py-2 text-sm" value={scope} onChange={(e) => setFilters((prev) => ({ ...prev, scope: e.target.value as Scope, fundId: undefined, projectId: undefined }))}>
          <option value="geral">Escopo: geral</option>
          <option value="fundo">Escopo: por fundo</option>
          <option value="projeto">Escopo: por projeto</option>
        </select>
        <input type="date" className="rounded border px-3 py-2 text-sm" value={filters.startDate || ''} onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value || undefined }))} />
        <input type="date" className="rounded border px-3 py-2 text-sm" value={filters.endDate || ''} onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value || undefined }))} />
        <select className="rounded border px-3 py-2 text-sm" value={filters.type || 'todos'} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as ReportFilters['type'] }))}><option value="todos">Tipo: todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option></select>
        <select className="rounded border px-3 py-2 text-sm" value={filters.status || 'todos'} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as ReportFilters['status'] }))}><option value="todos">Status: todos</option><option value="pago">Pago</option><option value="pendente">Pendente</option><option value="cancelado">Cancelado</option></select>
        <select disabled={scope === 'projeto'} className="rounded border px-3 py-2 text-sm disabled:bg-gray-100" value={filters.fundId || ''} onChange={(e) => setFilters((prev) => ({ ...prev, fundId: e.target.value || undefined }))}><option value="">Fundo: todos</option>{funds.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
        <select disabled={scope === 'fundo'} className="rounded border px-3 py-2 text-sm disabled:bg-gray-100" value={filters.projectId || ''} onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value || undefined }))}><option value="">Projeto: todos</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
        <select className="rounded border px-3 py-2 text-sm md:col-span-2" value={filters.categoryId || ''} onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value || undefined }))}><option value="">Categoria: todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button onClick={() => void gerar()} className="inline-flex items-center gap-2 rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white"><Filter className="h-4 w-4" />Gerar</button>
        <button onClick={exportCsv} disabled={rows.length === 0} className="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" />Exportar CSV</button>
        <button onClick={exportPdf} disabled={rows.length === 0} className="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm disabled:opacity-50"><FileText className="h-4 w-4" />Exportar PDF</button>
      </div>

      {loading && <p className="mb-4 text-sm text-gray-500">Gerando relatório...</p>}

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Fundo</th><th className="px-4 py-2">Projeto</th><th className="px-4 py-2">Categoria</th><th className="px-4 py-2">Descrição</th><th className="px-4 py-2">Valor</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Anexos</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2">{formatDate(row.date)}</td><td className="px-4 py-2">{row.type}</td><td className="px-4 py-2">{row.fundName}</td><td className="px-4 py-2">{row.projectName}</td><td className="px-4 py-2">{row.categoryName}</td><td className="px-4 py-2">{row.description}</td><td className="px-4 py-2">{formatCurrency(row.totalValue)}</td><td className="px-4 py-2">{row.status}</td><td className="px-4 py-2">{row.attachmentsCount}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Sem dados para os filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

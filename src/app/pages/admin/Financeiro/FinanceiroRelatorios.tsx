import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceSupabase } from './hooks/useFinanceSupabase';
import { formatCurrency, formatDate } from './figma/data/financeiro-data';
import { DEFAULT_REPORT_COLUMNS, exportMovementsCsv } from './utils/exportCsv';
import { exportMovementsPdf } from './utils/exportPdf';

const mapMovementToReportRow = (movement: any, fundName: string, projectName: string, attachmentCount: number) => ({
  Data: formatDate(movement.date),
  Tipo: movement.type,
  Status: movement.status,
  'Descrição': movement.description || '',
  Categoria: movement.category || '',
  Projeto: projectName,
  Fundo: fundName,
  'Valor Unit': Number(movement.unit_value || 0),
  Qtd: Number(movement.quantity || 0),
  Total: Number(movement.total_value || 0),
  'Forma Pgto': movement.payment_method || '',
  Favorecido: movement.payee || '',
  'Doc Tipo': movement.document_type || '',
  'Doc Nº': movement.document_number || '',
  'Centro Custo': movement.cost_center || '',
  'Observações': movement.notes || '',
  Comprovantes: attachmentCount,
});

export function FinanceiroRelatorios() {
  const [fundId, setFundId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  const { listMovements, listFunds, listProjects, listAttachmentsForMovements } = useFinanceSupabase();

  const load = async () => {
    const [fundRows, projectRows, movementRows] = await Promise.all([
      listFunds(),
      listProjects(),
      listMovements({
        fundId: fundId || undefined,
        projectId: projectId || undefined,
        status: status || undefined,
        type: (type as 'entrada' | 'saida') || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    ]);

    setFunds(fundRows || []);
    setProjects(projectRows || []);
    setMovements(movementRows || []);

    const rows = await listAttachmentsForMovements((movementRows || []).map((movement) => movement.id));
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.movement_id] = (acc[row.movement_id] || 0) + 1;
      return acc;
    }, {});
    setAttachmentCounts(counts);
  };

  useEffect(() => {
    void load();
  }, [fundId, projectId, status, type, dateFrom, dateTo]);

  const fundMap = useMemo(() => new Map(funds.map((fund) => [fund.id, fund.name])), [funds]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);

  const reportRows = useMemo(
    () =>
      movements.map((movement) =>
        mapMovementToReportRow(
          movement,
          fundMap.get(movement.fund_id) || '-',
          projectMap.get(movement.project_id) || '-',
          attachmentCounts[movement.id] || 0,
        ),
      ),
    [movements, fundMap, projectMap, attachmentCounts],
  );

  const totals = useMemo(() => {
    const entradas = movements
      .filter((movement) => movement.type === 'entrada')
      .reduce((acc, movement) => acc + Number(movement.total_value || 0), 0);
    const saidas = movements
      .filter((movement) => movement.type === 'saida')
      .reduce((acc, movement) => acc + Number(movement.total_value || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [movements]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mb-6">
        <Link to="/admin/financeiro" className="text-sm text-[#0f3d2e] hover:underline font-medium">← Voltar para Financeiro</Link>
        <h1 className="text-3xl font-semibold text-gray-900 mt-3">Relatórios Financeiros</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 grid grid-cols-1 md:grid-cols-6 gap-3">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg" />
        <select value={fundId} onChange={(e) => setFundId(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="">Todos os fundos</option>{funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name}</option>)}</select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="">Todos os projetos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="">Todos status</option><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="">Todos tipos</option><option value="entrada">Entrada</option><option value="saida">Saída</option></select>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button
          className="px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20]"
          onClick={() => exportMovementsCsv(reportRows, DEFAULT_REPORT_COLUMNS, 'relatorio-financeiro.csv')}
        >
          Baixar CSV
        </button>
        <button
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          onClick={() =>
            exportMovementsPdf({
              title: 'Relatório Financeiro',
              subtitle: `Fundo: ${fundMap.get(fundId) || 'Todos'} | Projeto: ${projectMap.get(projectId) || 'Todos'}`,
              periodLabel: `${dateFrom || 'início'} até ${dateTo || 'hoje'}`,
              totals,
              columns: DEFAULT_REPORT_COLUMNS,
              rows: reportRows,
            })
          }
        >
          Baixar PDF
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{DEFAULT_REPORT_COLUMNS.map((column) => <th key={column} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reportRows.map((row, index) => (
              <tr key={`${row['Descrição']}-${index}`} className="hover:bg-gray-50">
                {DEFAULT_REPORT_COLUMNS.map((column) => (
                  <td key={`${column}-${index}`} className="px-4 py-3 text-sm whitespace-nowrap">
                    {typeof row[column] === 'number' && ['Valor Unit', 'Total'].includes(column)
                      ? formatCurrency(Number(row[column]))
                      : `${row[column] ?? ''}`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Plus, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, formatDate, getDashboardData, listLatestMovements, listProjects, type FinanceiroProjeto } from './data/financeiro.repo';

export function ProjetoDetalhes() {
  const { id } = useParams();
  const [projeto, setProjeto] = useState<FinanceiroProjeto | null>(null);
  const [movimentacoesProjeto, setMovimentacoesProjeto] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>({ orcadoVsReal: [] });

  useEffect(() => {
    async function load() {
      const [projetos, movimentos, dashboardData] = await Promise.all([listProjects(), listLatestMovements(200), getDashboardData()]);
      setProjeto(projetos.find((item) => item.id === id) ?? null);
      setMovimentacoesProjeto(movimentos.filter((item) => item.projetoId === id));
      setDashboard(dashboardData);
    }

    void load();
  }, [id]);

  const chartData = useMemo(
    () => (dashboard.orcadoVsReal || []).map((item: any) => ({ periodo: item.periodo, orcado: Number(item.orcado) || 0, real: Number(item.real) || 0 })),
    [dashboard.orcadoVsReal],
  );

  if (!projeto) return <div className="p-8">Projeto não encontrado.</div>;

  return (
    <div className="p-8 space-y-8">
      <div>
        <Link to="/admin/financeiro/projetos" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft className="w-4 h-4" />Voltar para Projetos</Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold text-gray-900">{projeto.nome}</h1><StatusBadge status={projeto.status} size="md" /></div>
            <p className="text-sm text-gray-600">Fundo: {projeto.fundo || '—'}</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg"><Plus className="w-4 h-4" />Nova Movimentação</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Saldo Disponível</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(projeto.saldoDisponivel) || 0)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Total Orçado</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(projeto.totalOrcado) || 0)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Gasto Real</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(projeto.gastoReal) || 0)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Execução</p><p className="text-2xl font-semibold text-gray-900">{Number(projeto.execucao) || 0}%</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Orçado vs Real</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" /><YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(Number(value) || 0)} />
              <Legend />
              <Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" />
              <Bar dataKey="real" fill="#0f3d2e" name="Real" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Movimentações do Projeto</h3>
          <div className="text-sm text-amber-700 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" />Pendências: {movimentacoesProjeto.filter((mov) => mov.status !== 'pago').length}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(movimentacoesProjeto || []).map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{formatDate(mov.data)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{mov.descricao}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{mov.categoria || 'Sem categoria'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-red-600">- {formatCurrency(Number(mov.valorTotal) || 0)}</td>
                  <td className="px-6 py-4 text-center"><StatusBadge status={mov.status} /></td>
                </tr>
              ))}
              {movimentacoesProjeto.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Sem dados no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

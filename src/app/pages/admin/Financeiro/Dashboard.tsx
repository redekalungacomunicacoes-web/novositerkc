import { useEffect, useMemo, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, CircleDollarSign, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router';
import { KPICard } from './components/KPICard';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, formatDate, getDashboardData, listLatestMovements, type DashboardData, type FinanceiroMovimentacao } from './data/financeiro.repo';

const CHART_COLORS = ['#0f3d2e', '#ffdd9a', '#6b7280', '#10b981', '#ef4444'];

export function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardData>({
    entradas: 0,
    saidas: 0,
    saldoAtual: 0,
    pendencias: 0,
    fluxoCaixa: [],
    distribuicaoCategoria: [],
    orcadoVsReal: [],
  });
  const [movimentacoes, setMovimentacoes] = useState<FinanceiroMovimentacao[]>([]);

  useEffect(() => {
    async function load() {
      const [dashboardData, latestMovements] = await Promise.all([
        getDashboardData(),
        listLatestMovements(8),
      ]);
      setDashboard(dashboardData);
      setMovimentacoes(latestMovements);
    }

    void load();
  }, []);

  const fluxoCaixaData = useMemo(
    () => (dashboard.fluxoCaixa || []).map((item) => ({ periodo: item.periodo, entradas: Number(item.entradas) || 0, saidas: Number(item.saidas) || 0 })),
    [dashboard.fluxoCaixa],
  );

  const orcadoVsRealData = useMemo(
    () => (dashboard.orcadoVsReal || []).map((item) => ({ periodo: item.periodo, orcado: Number(item.orcado) || 0, real: Number(item.real) || 0 })),
    [dashboard.orcadoVsReal],
  );

  const categoriaData = useMemo(
    () => (dashboard.distribuicaoCategoria || []).map((item, index) => ({ name: item.categoria, value: Number(item.valor) || 0, color: CHART_COLORS[index % CHART_COLORS.length] })),
    [dashboard.distribuicaoCategoria],
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard Financeiro</h1>
            <p className="text-sm text-gray-600">Visão geral das finanças e projetos</p>
            <div className="flex items-center gap-2 mt-2">
              <Link to="/admin/financeiro/fundos" className="text-sm text-[#0f3d2e] hover:underline">Ver Fundos</Link>
              <span className="text-gray-400">•</span>
              <Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline">Ver Projetos</Link>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" />
            Nova Movimentação
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard title="Saldo Total" value={formatCurrency(Number(dashboard.saldoAtual) || 0)} icon={<CircleDollarSign className="w-5 h-5" />} variant="primary" />
        <KPICard title="Entradas" value={formatCurrency(Number(dashboard.entradas) || 0)} icon={<TrendingUp className="w-5 h-5" />} />
        <KPICard title="Saídas" value={formatCurrency(Number(dashboard.saidas) || 0)} icon={<TrendingDown className="w-5 h-5" />} />
        <KPICard title="Pendências" value={String(Number(dashboard.pendencias) || 0)} icon={<AlertCircle className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Fluxo de Caixa</h3>
          {fluxoCaixaData.length === 0 ? (
            <p className="text-sm text-gray-500">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={fluxoCaixaData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="periodo" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value) || 0)} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2} name="Entradas" />
                <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Orçado vs Real</h3>
          {orcadoVsRealData.length === 0 ? (
            <p className="text-sm text-gray-500">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={orcadoVsRealData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="periodo" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value) || 0)} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" />
                <Bar dataKey="real" fill="#0f3d2e" name="Real" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Distribuição por Categoria</h3>
        {categoriaData.length === 0 ? (
          <p className="text-sm text-gray-500">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={categoriaData || []} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value">
                {categoriaData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(Number(value) || 0)} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Últimas movimentações</h3>
          <Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projeto/Fundo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(movimentacoes || []).map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(mov.data)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{mov.descricao}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{mov.projetoNome !== '—' ? mov.projetoNome : mov.fundo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">- {formatCurrency(Number(mov.valorTotal) || 0)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center"><StatusBadge status={mov.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors"><Edit className="w-4 h-4 text-gray-600" /></button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors"><Trash2 className="w-4 h-4 text-gray-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {movimentacoes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Sem dados no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

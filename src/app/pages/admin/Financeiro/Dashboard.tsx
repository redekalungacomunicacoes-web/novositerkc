import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, AlertCircle, Edit, Trash2, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router';
import { KPICard } from './components/KPICard';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency } from './data/financeiro-data';

export function Dashboard() {
  // Dados para gráfico de fluxo de caixa
  const fluxoCaixaData = [
    { mes: 'Jan', entradas: 0, saidas: 0 },
    { mes: 'Fev', entradas: 0, saidas: 500 },
    { mes: 'Mar', entradas: 0, saidas: 0 },
  ];

  // Dados para gráfico orçado vs real
  const orcadoVsRealData = [
    { mes: 'Jan', orcado: 0, real: 0 },
    { mes: 'Fev', orcado: 0, real: 500 },
    { mes: 'Mar', orcado: 0, real: 0 },
  ];

  // Dados para distribuição por categoria
  const categoriaData = [
    { name: 'DESPESA DE PESSOAL', value: 500, color: '#0f3d2e' },
    { name: 'COMUNICAÇÃO', value: 0, color: '#ffdd9a' },
    { name: 'EQUIPAMENTOS', value: 0, color: '#6b7280' },
  ];

  const movimentacoes = [
    {
      id: 'mov-001',
      data: '24/02/2024',
      descricao: 'mercado',
      valor: 500.00,
      status: 'pago' as const,
      projetoNome: 'Oficina',
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard Financeiro</h1>
            <p className="text-sm text-gray-600">Visão geral das finanças e projetos</p>
            <div className="flex items-center gap-2 mt-2">
              <Link to="/admin/financeiro" className="text-sm text-[#0f3d2e] hover:underline">Ver Fundos</Link>
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Saldo Total"
          value={formatCurrency(59500)}
          icon={<Wallet className="w-5 h-5" />}
          variant="primary"
        />
        <KPICard
          title="Entradas"
          value={formatCurrency(0)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <KPICard
          title="Saídas"
          value={formatCurrency(0)}
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <KPICard
          title="Movimentações"
          value="0"
          icon={<AlertCircle className="w-5 h-5" />}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fluxo de Caixa */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Fluxo de Caixa</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={fluxoCaixaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2} name="Entradas" />
              <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orçado vs Real */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Orçado vs Real</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={orcadoVsRealData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" />
              <Bar dataKey="real" fill="#0f3d2e" name="Real" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribuição por Categoria */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Distribuição por Categoria</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoriaData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
              label={(entry) => entry.value > 0 ? `${((entry.value / 500) * 100).toFixed(0)}%` : ''}
            >
              {categoriaData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Últimas Movimentações */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Últimas movimentações</h3>
          <Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projeto/Fundo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comprovantes
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimentacoes.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {mov.data}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {mov.descricao}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {mov.projetoNome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                    - {formatCurrency(mov.valor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <StatusBadge status={mov.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    0
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

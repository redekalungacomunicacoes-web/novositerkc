import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, BarChart3, Plus, Eye, Edit, FileCheck } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { ModalMovimentacao } from '../components/ModalMovimentacao';
import { formatCurrency } from '../data/financeiro-data';

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);

  // Dados para gráfico de fluxo de caixa (6 meses)
  const fluxoCaixaData = [
    { mes: 'Out', entradas: 45000, saidas: 32000 },
    { mes: 'Nov', entradas: 52000, saidas: 38000 },
    { mes: 'Dez', entradas: 48000, saidas: 42000 },
    { mes: 'Jan', entradas: 55000, saidas: 35000 },
    { mes: 'Fev', entradas: 60000, saidas: 40000 },
    { mes: 'Mar', entradas: 50000, saidas: 33370 },
  ];

  // Dados para gráfico orçado vs real
  const orcadoVsRealData = [
    { mes: 'Jan', orcado: 50000, real: 35000 },
    { mes: 'Fev', orcado: 50000, real: 40000 },
    { mes: 'Mar', orcado: 50000, real: 33370 },
  ];

  // Dados para distribuição por categoria
  const categoriasMes = [
    { name: 'DESPESA DE PESSOAL', value: 16020, color: '#0f3d2e' },
    { name: 'COMUNICAÇÃO', value: 7350, color: '#ffdd9a' },
    { name: 'EQUIPAMENTOS', value: 3200, color: '#6b7280' },
    { name: 'ALIMENTAÇÃO', value: 2800, color: '#93c5fd' },
    { name: 'OUTROS', value: 4000, color: '#d1d5db' },
  ];

  const categoriasAno = [
    { name: 'DESPESA DE PESSOAL', value: 28020, color: '#0f3d2e' },
    { name: 'COMUNICAÇÃO', value: 12350, color: '#ffdd9a' },
    { name: 'EQUIPAMENTOS', value: 5200, color: '#6b7280' },
    { name: 'ALIMENTAÇÃO', value: 4800, color: '#93c5fd' },
    { name: 'OUTROS', value: 7000, color: '#d1d5db' },
  ];

  const pendencias = [
    {
      id: 'mov-005',
      data: '2025-03-15',
      descricao: 'Coffee break reunião março',
      valor: 800.00,
      favorecido: 'Buffet Bom Gosto',
      projeto: 'Formação Cultural 2025',
    },
    {
      id: 'mov-007',
      data: '2025-03-18',
      descricao: 'Hospedagem site - trimestre',
      valor: 450.00,
      favorecido: 'HostGator Brasil',
      projeto: 'Rede Integra 2025',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard Financeiro</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nova Movimentação
          </button>
        </div>
        <p className="text-gray-600">Visão geral das finanças e projetos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Saldo Total Atual"
          value={formatCurrency(66630)}
          icon={Wallet}
          variant="success"
        />
        <KPICard
          title="Entradas do Mês"
          value={formatCurrency(50000)}
          icon={TrendingUp}
          trend={{ value: '+12%', positive: true }}
        />
        <KPICard
          title="Saídas do Mês"
          value={formatCurrency(33370)}
          icon={TrendingDown}
          trend={{ value: '-8%', positive: true }}
        />
        <KPICard
          title="Pendências"
          value="2"
          icon={AlertCircle}
          variant="warning"
        />
      </div>

      {/* Execução do Orçamento */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Execução do Orçamento 2025</h3>
          <span className="text-sm text-gray-500">R$ 33.370 / R$ 100.000</span>
        </div>
        <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0f3d2e] to-[#ffdd9a] rounded-full transition-all"
            style={{ width: '33.37%' }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-sm text-gray-600">33,37% executado</span>
          <span className="text-sm font-medium text-[#0f3d2e]">R$ 66.630 restante</span>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fluxo de Caixa */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Fluxo de Caixa (6 meses)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={fluxoCaixaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Line type="monotone" dataKey="entradas" stroke="#0f3d2e" strokeWidth={2} name="Entradas" />
              <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orçado vs Real */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Orçado vs Real (por mês)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={orcadoVsRealData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" />
              <Bar dataKey="real" fill="#0f3d2e" name="Real" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribuição por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Mês */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribuição por Categoria (Mês)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoriasMes}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={(entry) => `${((entry.value / categoriasMes.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%`}
              >
                {categoriasMes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Ano */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribuição por Categoria (Ano)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoriasAno}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={(entry) => `${((entry.value / categoriasAno.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%`}
              >
                {categoriasAno.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumo por Projeto */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Resumo por Projeto</h3>
            <Link
              to="/admin/financeiro/projetos"
              className="text-sm text-[#0f3d2e] hover:underline font-medium"
            >
              Ver todos os projetos →
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projeto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fundo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orçado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Real
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diferença
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Execução
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">Rede Integra 2025</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">Unibanco 2025</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(45420)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-600">{formatCurrency(68500)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-600">{formatCurrency(23080)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-red-600">{formatCurrency(-45420)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="text-sm font-medium text-gray-900">34%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <Link
                    to="/projeto/proj-001"
                    className="inline-flex items-center gap-1 text-sm text-[#0f3d2e] hover:underline"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </Link>
                </td>
              </tr>
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">Formação Cultural 2025</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">Unibanco 2025</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(12210)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-600">{formatCurrency(31500)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-600">{formatCurrency(19290)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-red-600">{formatCurrency(-12210)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="text-sm font-medium text-gray-900">61%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <Link
                    to="/projeto/proj-002"
                    className="inline-flex items-center gap-1 text-sm text-[#0f3d2e] hover:underline"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pendências Recentes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Pendências Recentes</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {pendencias.map((pend) => (
            <div key={pend.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status="pendente" />
                    <span className="text-sm text-gray-500">{pend.data}</span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">{pend.descricao}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Projeto: {pend.projeto}</span>
                    <span>•</span>
                    <span>Favorecido: {pend.favorecido}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(pend.valor)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      Marcar Pago
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <FileCheck className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Nova Movimentação */}
      <ModalMovimentacao isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

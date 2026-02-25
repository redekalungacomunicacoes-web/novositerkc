import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Filter, Search, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StatusBadge } from '../components/StatusBadge';
import { ModalMovimentacao } from '../components/ModalMovimentacao';
import { PLANEJAMENTO_ITEMS, MOVIMENTACOES, formatCurrency, formatDate } from '../data/financeiro-data';

export function FundoDetalhes() {
  const { id } = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Dados do fundo Unibanco 2025
  const fundo = {
    id: 'unibanco-2025',
    nome: 'Unibanco 2025',
    ano: 2025,
    totalOrcado: 100000.00,
    saldoAtual: 66630.00,
    totalGastoReal: 33370.00,
    saldoInicial: 100000.00,
    totalEntradas: 0,
    totalSaidas: 33370.00,
  };

  // Dados para gráfico Orçado vs Real por categoria
  const categoriaData = [
    { categoria: 'PESSOAL', orcado: 50000, real: 16020 },
    { categoria: 'COMUNICAÇÃO', orcado: 10000, real: 7350 },
    { categoria: 'EQUIPAMENTOS', orcado: 4000, real: 3200 },
    { categoria: 'LOGÍSTICA', orcado: 22000, real: 0 },
    { categoria: 'ALIMENTAÇÃO', orcado: 4000, real: 2800 },
    { categoria: 'OUTROS', orcado: 10000, real: 4000 },
  ];

  // Dados para gráfico Orçado vs Real por mês
  const mesData = [
    { mes: 'Jan', orcado: 20000, real: 0 },
    { mes: 'Fev', orcado: 20000, real: 11220 },
    { mes: 'Mar', orcado: 20000, real: 22150 },
    { mes: 'Abr', orcado: 20000, real: 0 },
    { mes: 'Mai', orcado: 20000, real: 0 },
  ];

  // Dados para gráfico de linha - saldo ao longo do tempo
  const saldoData = [
    { mes: 'Jan', saldo: 100000 },
    { mes: 'Fev', saldo: 88780 },
    { mes: 'Mar', saldo: 66630 },
    { mes: 'Abr', saldo: 66630 },
    { mes: 'Mai', saldo: 66630 },
  ];

  const movimentacoesFundo = MOVIMENTACOES.filter(mov => mov.fundoId === id);

  const totalOrcado = PLANEJAMENTO_ITEMS.reduce((acc, item) => acc + item.totalOrcado, 0);
  const totalGastoReal = PLANEJAMENTO_ITEMS.reduce((acc, item) => acc + item.gastoReal, 0);
  const percentualExecucao = ((totalGastoReal / totalOrcado) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/admin/financeiro/fundos"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Fundos
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">{fundo.nome}</h1>
            <p className="text-gray-600">Acompanhamento completo do fundo</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nova Movimentação
          </button>
        </div>
      </div>

      {/* KPIs do Fundo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl border-2 border-[#0f3d2e] p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Saldo Disponível</p>
          <p className="text-2xl font-semibold text-[#0f3d2e]">{formatCurrency(fundo.saldoAtual)}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Total Orçado</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(fundo.totalOrcado)}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Gasto Real</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(fundo.totalGastoReal)}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Restante</p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatCurrency(fundo.totalOrcado - fundo.totalGastoReal)}
          </p>
        </div>
        <div className="bg-white rounded-xl border-2 border-[#ffdd9a] p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Execução</p>
          <p className="text-2xl font-semibold text-gray-900">{percentualExecucao}%</p>
        </div>
      </div>

      {/* Planejamento 2025 (Orçado) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20]">
          <h3 className="text-lg font-semibold text-white">Planejamento 2025 (Orçado)</h3>
          <p className="text-sm text-white/80 mt-1">Detalhamento dos itens orçados vs gastos reais</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Início
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fim
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qtd
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Orçado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gasto Real
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diferença
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Exec
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {PLANEJAMENTO_ITEMS.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 max-w-xs">{item.item}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {item.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-600">{formatDate(item.inicioPrevisto)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-600">{formatDate(item.fimPrevisto)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-900">{item.quantidade}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <span className="text-sm text-gray-900">{formatCurrency(item.valorUnitario)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(item.totalOrcado)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <span className="text-sm text-blue-600">{formatCurrency(item.gastoReal)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-medium ${item.diferenca < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(item.diferenca)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0f3d2e] rounded-full transition-all"
                          style={{ width: `${item.percentualExecucao}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{item.percentualExecucao}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={6} className="px-4 py-4 text-right font-semibold text-gray-900">
                  TOTAL
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-base font-bold text-gray-900">{formatCurrency(totalOrcado)}</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-base font-bold text-blue-600">{formatCurrency(totalGastoReal)}</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-base font-bold text-red-600">{formatCurrency(totalGastoReal - totalOrcado)}</span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="text-base font-bold text-gray-900">{percentualExecucao}%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Gráficos de Análise */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Orçado vs Real por Categoria */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Orçado vs Real por Categoria</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoriaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="categoria" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
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

        {/* Orçado vs Real por Mês */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Orçado vs Real por Mês</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mesData}>
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

      {/* Saldo ao Longo do Tempo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Saldo ao Longo do Tempo</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={saldoData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
            />
            <Legend />
            <Line type="monotone" dataKey="saldo" stroke="#0f3d2e" strokeWidth={3} name="Saldo" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Movimentações do Fundo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Movimentações do Fundo</h3>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
          {/* Filtros */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar movimentações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projeto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimentacoesFundo.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{formatDate(mov.data)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      mov.tipo === 'entrada' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {mov.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{mov.descricao}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">{mov.projeto}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {mov.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-medium ${
                      mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {mov.tipo === 'entrada' ? '+' : '-'} {formatCurrency(mov.valorTotal)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <StatusBadge status={mov.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Caixa Final */}
      <div className="bg-white rounded-xl border-2 border-[#0f3d2e] shadow-sm p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Resumo do Caixa</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Saldo Inicial</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(fundo.saldoInicial)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">+ Entradas Pagas</p>
            <p className="text-xl font-semibold text-green-600">{formatCurrency(fundo.totalEntradas)}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">- Saídas Pagas</p>
            <p className="text-xl font-semibold text-red-600">{formatCurrency(fundo.totalSaidas)}</p>
          </div>
          <div className="p-4 bg-[#0f3d2e] rounded-lg">
            <p className="text-sm text-white/80 mb-2">= Saldo Final</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(fundo.saldoAtual)}</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ModalMovimentacao isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

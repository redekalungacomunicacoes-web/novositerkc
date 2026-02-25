import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Plus, Search, Edit, Trash2, FileText } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { KPICard } from './components/KPICard';
import { StatusBadge } from './components/StatusBadge';
import { FUNDOS, MOVIMENTACOES, formatCurrency, formatDate } from './data/financeiro-data';

export function FundoDetalhes() {
  const { id } = useParams();
  const [searchTerm, setSearchTerm] = useState('');

  const fundo = FUNDOS.find(f => f.id === id);
  if (!fundo) return <div>Fundo não encontrado</div>;

  // Dados para gráfico Orçado vs Real por Mês
  const mesData = [
    { mes: 'Jan', orcado: 0, real: 0 },
    { mes: 'Fev', orcado: 0, real: 500 },
    { mes: 'Mar', orcado: 0, real: 0 },
  ];

  // Dados para gráfico Saldo ao Longo do Tempo
  const saldoData = [
    { mes: 'Jan', saldo: 50000 },
    { mes: 'Fev', saldo: 49500 },
    { mes: 'Mar', saldo: 49500 },
  ];

  const movimentacoesFundo = MOVIMENTACOES.filter(mov => mov.fundoId === id);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/admin/financeiro"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Fundos
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">{fundo.nome}</h1>
            <p className="text-sm text-gray-600">Acompanhamento completo do fundo</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" />
            Nova Movimentação
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Saldo Inicial</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(fundo.saldoInicial)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Saldo Atual</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(fundo.saldoAtual)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Entradas Pagas</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(fundo.totalEntradas)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Saídas Pagas</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(fundo.totalSaidas)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Pendências</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(0)}</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Orçado vs Real por Mês */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Orçado vs Real por Mês</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mesData}>
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

        {/* Saldo ao Longo do Tempo */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Saldo ao Longo do Tempo</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={saldoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="saldo" stroke="#0f3d2e" strokeWidth={2} name="Saldo" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Movimentações do Fundo */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Movimentações do Fundo</h3>
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar movimentações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimentacoesFundo.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(mov.data)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{mov.descricao}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                    - {formatCurrency(mov.valorTotal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <StatusBadge status={mov.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <FileText className="w-4 h-4 text-gray-600" />
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

import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Plus, CheckCircle2, AlertCircle, FileText, Download, Edit, Trash2 } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StatusBadge } from './components/StatusBadge';
import { PROJETOS, MOVIMENTACOES, formatCurrency, formatDate } from './data/financeiro-data';

export function ProjetoDetalhes() {
  const { id } = useParams();

  const projeto = PROJETOS.find(p => p.id === id);
  if (!projeto) return <div>Projeto não encontrado</div>;

  const movimentacoesProjeto = MOVIMENTACOES.filter(mov => mov.projetoId === id);

  // Dados para gráficos
  const categoriaData = [
    { categoria: 'PESSOAL', orcado: 30000, real: 500 },
    { categoria: 'COMUNICAÇÃO', orcado: 8000, real: 0 },
    { categoria: 'EQUIPAMENTOS', orcado: 4000, real: 0 },
    { categoria: 'LOGÍSTICA', orcado: 8000, real: 0 },
    { categoria: 'OUTROS', orcado: 0, real: 0 },
  ];

  const fluxoMensal = [
    { mes: 'Jan', entradas: 20000, saidas: 0 },
    { mes: 'Fev', entradas: 5000, saidas: 500 },
    { mes: 'Mar', entradas: 0, saidas: 0 },
    { mes: 'Abr', entradas: 0, saidas: 0 },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/admin/financeiro/projetos"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Financeiro
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">{projeto.nome}</h1>
              <StatusBadge status={projeto.status} size="md" />
            </div>
            <p className="text-sm text-gray-600">Fundo: {projeto.fundo}</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" />
            Nova Movimentação
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Saldo Disponível</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(projeto.saldoDisponivel)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Orçado</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(projeto.totalOrcado)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Gasto Real</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(projeto.gastoReal)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Execução</p>
          <p className="text-2xl font-semibold text-gray-900">{projeto.execucao}%</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue="visao-geral" className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Tabs.List className="flex border-b border-gray-200 bg-white">
          <Tabs.Trigger
            value="visao-geral"
            className="flex-1 px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e]"
          >
            Visão Geral
          </Tabs.Trigger>
          <Tabs.Trigger
            value="caixa"
            className="flex-1 px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e]"
          >
            Caixa
          </Tabs.Trigger>
          <Tabs.Trigger
            value="prestacao"
            className="flex-1 px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e]"
          >
            Prestação de Contas
          </Tabs.Trigger>
          <Tabs.Trigger
            value="relatorios"
            className="flex-1 px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e]"
          >
            Relatórios
          </Tabs.Trigger>
        </Tabs.List>

        {/* Visão Geral */}
        <Tabs.Content value="visao-geral" className="p-6">
          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-6">Orçado vs Real por Categoria</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoriaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="categoria" stroke="#6b7280" angle={-45} textAnchor="end" height={80} style={{ fontSize: '11px' }} />
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

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-6">Fluxo Mensal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={fluxoMensal}>
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
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="text-sm font-semibold text-gray-900">Movimentações Pagas</h4>
              </div>
              <p className="text-3xl font-bold text-green-600">4</p>
              <p className="text-sm text-gray-600 mt-1">{formatCurrency(57180)}</p>
            </div>
            <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <h4 className="text-sm font-semibold text-gray-900">Pendências</h4>
              </div>
              <p className="text-3xl font-bold text-yellow-600">1</p>
              <p className="text-sm text-gray-600 mt-1">{formatCurrency(800)}</p>
            </div>
            <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-semibold text-gray-900">Comprovantes</h4>
              </div>
              <p className="text-3xl font-bold text-blue-600">8</p>
              <p className="text-sm text-gray-600 mt-1">Documentos anexados</p>
            </div>
          </div>
        </Tabs.Content>

        {/* Caixa */}
        <Tabs.Content value="caixa" className="p-6">
          <div className="space-y-6">
            {/* Resumo Caixa */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Saldo Inicial</p>
                <p className="text-xl font-semibold text-gray-900">{formatCurrency(50000)}</p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">+ Entradas</p>
                <p className="text-xl font-semibold text-green-600">{formatCurrency(0)}</p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">- Saídas</p>
                <p className="text-xl font-semibold text-red-600">{formatCurrency(500)}</p>
              </div>
              <div className="p-4 bg-[#0f3d2e] rounded-lg">
                <p className="text-sm text-white/80 mb-2">= Saldo</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(49500)}</p>
              </div>
            </div>

            {/* Tabela de Movimentações */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comprovantes</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movimentacoesProjeto.map((mov) => (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(mov.data)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{mov.descricao}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            {mov.categoria}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          - {formatCurrency(mov.valorTotal)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatusBadge status={mov.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                          {mov.comprovantes.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button className="px-3 py-1.5 text-xs bg-[#0f3d2e] text-white rounded hover:bg-[#0a2b20]">
                              Editar
                            </button>
                            <button className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
                              Excluir
                            </button>
                            <button className="px-3 py-1.5 text-xs bg-[#0f3d2e] text-white rounded hover:bg-[#0a2b20]">
                              Comprovantes
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
        </Tabs.Content>

        {/* Prestação de Contas */}
        <Tabs.Content value="prestacao" className="p-6">
          <div className="space-y-6">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Comprovantes</h4>
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">80%</p>
                <p className="text-sm text-gray-600 mb-3">4 de 5 anexados</p>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '80%' }} />
                </div>
              </div>
              <div className="p-6 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Pendências</h4>
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">1</p>
                <p className="text-sm text-gray-600">Item sem pagamento</p>
              </div>
              <div className="p-6 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Sem Documento</h4>
                  <FileText className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">1</p>
                <p className="text-sm text-gray-600">Necessita comprovante</p>
              </div>
            </div>

            {/* Itens da Prestação */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Itens da Prestação de Contas</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {movimentacoesProjeto.map((mov) => (
                  <div key={mov.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{mov.descricao}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{formatDate(mov.data)}</span>
                          <span>•</span>
                          <span className="font-medium">{formatCurrency(mov.valorTotal)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={mov.status} />
                        <button className="px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                          Anexar (0)
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Tabs.Content>

        {/* Relatórios */}
        <Tabs.Content value="relatorios" className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Relatório Mensal */}
            <div className="p-6 bg-white border border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
              <FileText className="w-10 h-10 text-[#0f3d2e] mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Relatório Mensal</h4>
              <p className="text-sm text-gray-600 mb-6">Movimentações agrupadas por mês</p>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>

            {/* Por Categoria */}
            <div className="p-6 bg-white border border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
              <FileText className="w-10 h-10 text-[#0f3d2e] mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Por Categoria</h4>
              <p className="text-sm text-gray-600 mb-6">Análise por categoria de despesa</p>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>

            {/* Relatório Completo */}
            <div className="p-6 bg-white border border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
              <FileText className="w-10 h-10 text-[#0f3d2e] mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Relatório Completo</h4>
              <p className="text-sm text-gray-600 mb-6">Todas as movimentações detalhadas</p>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>

            {/* Pendências */}
            <div className="p-6 bg-white border border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
              <AlertCircle className="w-10 h-10 text-yellow-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Pendências</h4>
              <p className="text-sm text-gray-600 mb-6">Pagamentos e documentos pendentes</p>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>

            {/* Prestação de Contas */}
            <div className="p-6 bg-white border-2 border-[#0f3d2e] rounded-xl">
              <CheckCircle2 className="w-10 h-10 text-[#0f3d2e] mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Prestação de Contas</h4>
              <p className="text-sm text-gray-600 mb-6">Documento oficial com comprovantes</p>
              <button className="w-full flex items-center justify-center gap-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                <Download className="w-4 h-4" />
                Gerar
              </button>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

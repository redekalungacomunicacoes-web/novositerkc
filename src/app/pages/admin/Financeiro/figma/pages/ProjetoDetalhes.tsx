import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StatusBadge } from '../components/StatusBadge';
import { ModalMovimentacao } from '../components/ModalMovimentacao';
import { formatCurrency, formatDate } from '../data/financeiro-data';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { SupabaseHealth } from '../../components/SupabaseHealth';

export function ProjetoDetalhes() {
  const { id } = useParams();
  const [modalMovOpen, setModalMovOpen] = useState(false);
  const [projeto, setProjeto] = useState<any>(null);
  const [movimentacoesProjeto, setMovimentacoesProjeto] = useState<any[]>([]);
  const [fundos, setFundos] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const {
    getProject,
    listMovementsByProject,
    listFunds,
    createMovement,
    updateMovement,
    deleteMovement,
    uploadAttachment,
    listAttachments,
    listAttachmentCounts,
    deleteAttachment,
  } = useFinanceSupabase();





  const refetchMovements = async () => {
    if (!id) return;
    const movs = await listMovementsByProject(id);
    const safeMovs = movs || [];
    setMovimentacoesProjeto(safeMovs);
    const counts = await listAttachmentCounts(safeMovs.map((mov) => mov.id));
    setAttachmentCounts(counts);
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const [projRes, fundsRes] = await Promise.all([getProject(id), listFunds()]);
      setProjeto(projRes);
      setFundos(fundsRes || []);
      await refetchMovements();
    };
    void load();
  }, [id]);

  const fundoNome = fundos.find((f) => f.id === projeto?.fund_id)?.name || '-';

  useEffect(() => {
    const loadAttachments = async () => {
      if (!editing?.id) return;
      const data = await listAttachments(editing.id);
      setAttachments(data || []);
    };
    void loadAttachments();
  }, [editing?.id]);
  // Dados para gráficos
  const categoriaData = [
    { categoria: 'PESSOAL', orcado: 30000, real: 12000 },
    { categoria: 'COMUNICAÇÃO', orcado: 8000, real: 5500 },
    { categoria: 'EQUIPAMENTOS', orcado: 4000, real: 3200 },
    { categoria: 'LOGÍSTICA', orcado: 22000, real: 0 },
    { categoria: 'OUTROS', orcado: 4500, real: 2380 },
  ];

  const fluxoMensal = [
    { mes: 'Jan', entradas: 25000, saidas: 0 },
    { mes: 'Fev', entradas: 25000, saidas: 6500 },
    { mes: 'Mar', entradas: 0, saidas: 16580 },
    { mes: 'Abr', entradas: 0, saidas: 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/admin/financeiro"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Financeiro
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-semibold text-gray-900">{projeto?.name || '-'}</h1>
              <StatusBadge status={projeto?.status || 'em_andamento'} size="md" />
            </div>
            <p className="text-gray-600">Fundo: {fundoNome}</p>
          </div>
          <button
            onClick={() => { setEditing(null); setModalMovOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nova Movimentação
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border-2 border-[#0f3d2e] p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Saldo Disponível</p>
          <p className="text-2xl font-semibold text-[#0f3d2e]">{formatCurrency(Number(projeto?.current_balance || 0))}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Orçado</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(projeto?.initial_amount || 0))}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Gasto Real</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(movimentacoesProjeto.reduce((a,m)=>a+Number(m.total_value||0),0))}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-[#ffdd9a] p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Execução</p>
          <p className="text-2xl font-semibold text-gray-900">{Number(projeto?.initial_amount||0) ? ((movimentacoesProjeto.reduce((a,m)=>a+Number(m.total_value||0),0)/Number(projeto?.initial_amount||1))*100).toFixed(1) : '0'}%</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Tabs.List className="flex border-b border-gray-200 bg-gray-50">
          <Tabs.Trigger
            value="visao-geral"
            className="flex-1 px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e] data-[state=active]:bg-white"
          >
            Visão Geral
          </Tabs.Trigger>
          <Tabs.Trigger
            value="caixa"
            className="flex-1 px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e] data-[state=active]:bg-white"
          >
            Caixa
          </Tabs.Trigger>
          <Tabs.Trigger
            value="prestacao"
            className="flex-1 px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e] data-[state=active]:bg-white"
          >
            Prestação de Contas
          </Tabs.Trigger>
          <Tabs.Trigger
            value="relatorios"
            className="flex-1 px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white transition-colors data-[state=active]:text-[#0f3d2e] data-[state=active]:border-b-2 data-[state=active]:border-[#0f3d2e] data-[state=active]:bg-white"
          >
            Relatórios
          </Tabs.Trigger>
        </Tabs.List>

        {/* Visão Geral */}
        <Tabs.Content value="visao-geral" className="p-6">
          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-xl p-6">
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

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Fluxo Mensal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fluxoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2} name="Entradas" />
                  <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Resumo Rápido */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-gray-900">Movimentações Pagas</h4>
              </div>
              <p className="text-3xl font-bold text-green-600">4</p>
              <p className="text-sm text-gray-600 mt-1">{formatCurrency(57080)}</p>
            </div>
            <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <h4 className="font-semibold text-gray-900">Pendentes</h4>
              </div>
              <p className="text-3xl font-bold text-yellow-600">1</p>
              <p className="text-sm text-gray-600 mt-1">{formatCurrency(800)}</p>
            </div>
            <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Comprovantes</h4>
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
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Saldo Inicial</p>
                <p className="text-xl font-semibold text-gray-900">{formatCurrency(50000)}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">+ Entradas</p>
                <p className="text-xl font-semibold text-green-600">{formatCurrency(50000)}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">- Saídas</p>
                <p className="text-xl font-semibold text-red-600">{formatCurrency(23080)}</p>
              </div>
              <div className="p-4 bg-[#0f3d2e] rounded-lg">
                <p className="text-sm text-white/80 mb-2">= Saldo</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(45420)}</p>
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
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comprovantes</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movimentacoesProjeto.map((mov) => (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(mov.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{mov.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            {mov.category || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`text-sm font-medium ${
                            mov.type === 'entrada' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {mov.type === 'entrada' ? '+' : '-'} {formatCurrency(Number(mov.total_value || 0))}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatusBadge status={mov.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm text-gray-600">{attachmentCounts[mov.id] || 0}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => { setEditing(mov); setModalMovOpen(true); }}
                              className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm('Deseja realmente excluir esta movimentação?')) return;
                                await deleteMovement(mov.id);
                                await refetchMovements();
                              }}
                              className="px-3 py-1 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 transition-colors"
                            >
                              Excluir
                            </button>
                            <button
                              onClick={() => { setEditing(mov); setActiveTab('prestacao'); setModalMovOpen(true); }}
                              className="px-3 py-1 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors"
                            >
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
            {/* Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Comprovantes</h4>
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">80%</p>
                <p className="text-sm text-gray-600">4 de 5 anexados</p>
                <div className="mt-4 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '80%' }} />
                </div>
              </div>
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Pendências</h4>
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">1</p>
                <p className="text-sm text-gray-600">Item sem pagamento</p>
              </div>
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Sem Documento</h4>
                  <FileText className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">1</p>
                <p className="text-sm text-gray-600">Necessita comprovante</p>
              </div>
            </div>

            {/* Lista de Itens para Prestação */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Itens da Prestação de Contas</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {movimentacoesProjeto.map((mov) => (
                  <div key={mov.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{mov.description}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{formatDate(mov.date)}</span>
                          <span>•</span>
                          <span>{mov.cost_center || '-'}</span>
                          <span>•</span>
                          <span className="font-medium">{formatCurrency(Number(mov.total_value || 0))}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={mov.status} />
                        <button
                          onClick={() => { setEditing(mov); setModalMovOpen(true); }}
                          className="px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20] transition-colors"
                        >
                          Anexar ({attachmentCounts[mov.id] || 0})
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Relatório por Mês */}
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
                <FileText className="w-10 h-10 text-[#0f3d2e] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Relatório Mensal</h4>
                <p className="text-sm text-gray-600 mb-6">Movimentações agrupadas por mês</p>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                    <Download className="w-4 h-4 inline mr-1" />
                    PDF
                  </button>
                  <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Relatório por Categoria */}
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
                <FileText className="w-10 h-10 text-[#0f3d2e] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Por Categoria</h4>
                <p className="text-sm text-gray-600 mb-6">Análise por categoria de despesa</p>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                    <Download className="w-4 h-4 inline mr-1" />
                    PDF
                  </button>
                  <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Relatório Completo */}
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
                <FileText className="w-10 h-10 text-[#0f3d2e] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Relatório Completo</h4>
                <p className="text-sm text-gray-600 mb-6">Todas as movimentações detalhadas</p>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                    <Download className="w-4 h-4 inline mr-1" />
                    PDF
                  </button>
                  <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Relatório de Pendências */}
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-[#0f3d2e] transition-colors">
                <AlertCircle className="w-10 h-10 text-yellow-600 mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Pendências</h4>
                <p className="text-sm text-gray-600 mb-6">Pagamentos e documentos pendentes</p>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                    <Download className="w-4 h-4 inline mr-1" />
                    PDF
                  </button>
                  <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Prestação de Contas */}
              <div className="p-6 bg-white border-2 border-[#0f3d2e] rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-[#0f3d2e] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Prestação de Contas</h4>
                <p className="text-sm text-gray-600 mb-6">Documento oficial com comprovantes</p>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-[#0f3d2e] text-white text-sm rounded-lg hover:bg-[#0a2b20]">
                    <Download className="w-4 h-4 inline mr-1" />
                    Gerar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* Modals */}
      <ModalMovimentacao
        isOpen={modalMovOpen}
        onClose={() => setModalMovOpen(false)}
        editData={editing || { project_id: id }}
        projects={[{ id: projeto?.id || '', name: projeto?.name || '' }]}
        funds={fundos.map((f) => ({ id: f.id, name: f.name }))}
        attachments={attachments}
        onSubmit={async (payload) => {
          try {
            if (editing?.id) await updateMovement(editing.id, payload);
            else await createMovement({ ...payload, project_id: id, fund_id: payload.fund_id || projeto?.fund_id });
            await refetchMovements();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
          }
        }}
        onDelete={async (movementId) => {
          try {
            await deleteMovement(movementId);
            await refetchMovements();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
          }
        }}
        onChanged={async () => {
          await refetchMovements();
        }}
        onUploadAttachment={async (file, movementId) => {
          if (!movementId) return;
          try {
            await uploadAttachment(file, { movementId, fundId: projeto?.fund_id, projectId: id });
            const list = await listAttachments(movementId);
            setAttachments(list || []);
            await refetchMovements();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
          }
        }}
        onDeleteAttachment={async (attachmentId) => {
          try {
            const target = attachments.find((a) => a.id === attachmentId);
            if (!target) return;
            await deleteAttachment(target);
            if (editing?.id) {
              const list = await listAttachments(editing.id);
              setAttachments(list || []);
            }
            await refetchMovements();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
          }
        }}
      />
    </div>
  );
}

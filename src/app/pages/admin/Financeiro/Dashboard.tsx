import { useEffect, useMemo, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, CircleDollarSign, AlertCircle, Edit, Trash2, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router';
import { KPICard } from './components/KPICard';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, formatDate, type FinanceiroMovimentacao } from './data/financeiro.repo';
import { useFinanceSupabase, type MovementPayload } from './hooks/useFinanceSupabase';
import { ModalMovimentacao } from './components/ModalMovimentacao';
import { ConfirmDialog } from './components/ConfirmDialog';

const CHART_COLORS = ['#0f3d2e', '#ffdd9a', '#6b7280', '#10b981', '#ef4444'];

export function Dashboard() {
  const finance = useFinanceSupabase();
  const { dashboard, movements, funds, projects, categories, error, loading, load, createMovement, updateMovement, deleteMovementCascade, uploadAttachment, deleteAttachment, listAttachments, listAttachmentsForMovementIds, getSignedUrl } = finance;
  const [openModal, setOpenModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [attachments, setAttachments] = useState([] as Awaited<ReturnType<typeof listAttachments>>);
  const [attachmentCountMap, setAttachmentCountMap] = useState(new Map<string, number>());

  const categoriaData = useMemo(
    () => (dashboard.distribuicaoCategoria || []).map((item, index) => ({ name: item.categoria, value: Number(item.valor) || 0, color: CHART_COLORS[index % CHART_COLORS.length] })),
    [dashboard.distribuicaoCategoria],
  );

  const openCreateMovement = async () => {
    setEditingMovement(null);
    setAttachments([]);
    setOpenModal(true);
  };

  const openEditMovement = async (movement: FinanceiroMovimentacao) => {
    setEditingMovement(movement);
    const list = await listAttachments(movement.id);
    setAttachments(list);
    setOpenModal(true);
  };


  const viewAttachment = async (attachment: { storage_path: string }) => getSignedUrl(attachment.storage_path);
  const handleSubmit = async (payload: MovementPayload) => editingMovement ? updateMovement(editingMovement.id, payload) : createMovement(payload);

  useEffect(() => {
    const loadCounts = async () => {
      const map = await listAttachmentsForMovementIds(movements.map((mov) => mov.id));
      setAttachmentCountMap(map);
    };
    void loadCounts();
  }, [listAttachmentsForMovementIds, movements]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-gray-900">Dashboard Financeiro</h1>
          <p className="text-sm text-gray-600">Últimos 6 meses com dados pagos</p>
          <div className="mt-2 flex items-center gap-2"><Link to="/admin/financeiro/fundos" className="text-sm text-[#0f3d2e] hover:underline">Ver Fundos</Link><span className="text-gray-400">•</span><Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline">Ver Projetos</Link></div>
        </div>
        <button onClick={() => void openCreateMovement()} className="flex items-center gap-2 rounded-lg bg-[#0f3d2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a2b20]"><Plus className="h-4 w-4" />Nova Movimentação</button>
      </div>

      {loading && <div className="mb-6 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Carregando dados do financeiro...</div>}
      {error && <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Saldo Atual" value={formatCurrency(dashboard.saldoAtual)} icon={<CircleDollarSign className="h-5 w-5" />} variant="primary" />
        <KPICard title="Entradas pagas" value={formatCurrency(dashboard.entradas)} icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard title="Saídas pagas" value={formatCurrency(dashboard.saidas)} icon={<TrendingDown className="h-5 w-5" />} />
        <KPICard title="Pendências" value={formatCurrency(dashboard.pendencias)} icon={<AlertCircle className="h-5 w-5" />} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6"><h3 className="mb-6 text-base font-semibold text-gray-900">Fluxo de Caixa (Pago)</h3>{dashboard.fluxoCaixa.length === 0 ? <p className="text-sm text-gray-500">Sem dados.</p> : <ResponsiveContainer width="100%" height={250}><LineChart data={dashboard.fluxoCaixa}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Line type="monotone" dataKey="entradas" stroke="#10b981" name="Entradas" /><Line type="monotone" dataKey="saidas" stroke="#ef4444" name="Saídas" /></LineChart></ResponsiveContainer>}</div>
        <div className="rounded-xl border border-gray-200 bg-white p-6"><h3 className="mb-6 text-base font-semibold text-gray-900">Orçado vs Real</h3>{dashboard.orcadoVsReal.length === 0 ? <p className="text-sm text-gray-500">Sem dados.</p> : <ResponsiveContainer width="100%" height={250}><BarChart data={dashboard.orcadoVsReal}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" /><Bar dataKey="real" fill="#0f3d2e" name="Real" /></BarChart></ResponsiveContainer>}</div>
      </div>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6"><h3 className="mb-6 text-base font-semibold text-gray-900">Distribuição por Categoria</h3>{categoriaData.length === 0 ? <p className="text-sm text-gray-500">Sem dados.</p> : <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={categoriaData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value">{categoriaData.map((entry, index) => (<Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer>}</div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4"><h3 className="text-base font-semibold text-gray-900">Últimas movimentações</h3></div>
        <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-gray-200 bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs uppercase">Data</th><th className="px-6 py-3 text-left text-xs uppercase">Descrição</th><th className="px-6 py-3 text-left text-xs uppercase">Projeto/Fundo</th><th className="px-6 py-3 text-left text-xs uppercase">Categoria</th><th className="px-6 py-3 text-left text-xs uppercase">Anexos</th><th className="px-6 py-3 text-left text-xs uppercase">Valor</th><th className="px-6 py-3 text-center text-xs uppercase">Status</th><th className="px-6 py-3 text-center text-xs uppercase">Ações</th></tr></thead><tbody className="divide-y divide-gray-200 bg-white">{movements.map((mov) => (<tr key={mov.id}><td className="px-6 py-4 text-sm">{formatDate(mov.data)}</td><td className="px-6 py-4 text-sm">{mov.descricao}</td><td className="px-6 py-4 text-sm">{mov.projetoNome !== '—' ? mov.projetoNome : mov.fundo}</td><td className="px-6 py-4 text-sm">{mov.categoria}</td><td className="px-6 py-4 text-sm">{attachmentCountMap.get(mov.id) ?? mov.attachmentsCount ?? mov.comprovantes.length}</td><td className="px-6 py-4 text-sm font-medium">{formatCurrency(mov.valorTotal)}</td><td className="px-6 py-4 text-center"><StatusBadge status={mov.status} /></td><td className="px-6 py-4"><div className="flex items-center justify-center gap-2"><button onClick={() => void openEditMovement(mov)} className="rounded p-1 hover:bg-gray-100"><Edit className="h-4 w-4" /></button><button onClick={() => { setSelectedMovement(mov); setOpenDelete(true); }} className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-4 w-4" /></button><button onClick={() => void openEditMovement(mov)} className="rounded p-1 hover:bg-gray-100"><Eye className="h-4 w-4" /></button></div></td></tr>))}{movements.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">Sem dados.</td></tr>}</tbody></table></div>
      </div>

      <ModalMovimentacao
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        editData={editingMovement}
        projects={projects.map((p) => ({ id: p.id, name: p.nome, fundId: p.fundoId }))}
        funds={funds.map((f) => ({ id: f.id, name: f.nome }))}
        categories={categories}
        attachments={attachments}
        onSubmit={handleSubmit}
        onDelete={editingMovement ? async () => { await deleteMovementCascade(editingMovement.id); setOpenModal(false); } : undefined}
        onUploadAttachment={uploadAttachment}
        onDeleteAttachment={deleteAttachment}
        onViewAttachment={viewAttachment}
        onChanged={load}
      />
      <ConfirmDialog open={openDelete} title="Excluir movimentação" description="Esta ação remove movimentação e comprovantes." onCancel={() => setOpenDelete(false)} onConfirm={() => { if (selectedMovement) void deleteMovementCascade(selectedMovement.id); setOpenDelete(false); }} />
    </div>
  );
}

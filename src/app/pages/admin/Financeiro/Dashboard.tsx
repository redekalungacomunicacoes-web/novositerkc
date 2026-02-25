import { useMemo, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, CircleDollarSign, AlertCircle, Edit, Trash2, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router';
import { KPICard } from './components/KPICard';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, formatDate, type FinanceiroMovimentacao } from './data/financeiro.repo';
import { useFinanceSupabase } from './hooks/useFinanceSupabase';
import { ModalMovimentacao, type MovementFormValues } from './components/ModalMovimentacao';
import { ConfirmDialog } from './components/ConfirmDialog';

const CHART_COLORS = ['#0f3d2e', '#ffdd9a', '#6b7280', '#10b981', '#ef4444'];

const emptyMovement: MovementFormValues = {
  date: new Date().toISOString().slice(0, 10),
  type: 'saida',
  project_id: '',
  fund_id: '',
  title: '',
  description: '',
  unit_value: 0,
  quantity: 1,
  status: 'pendente',
  category_id: undefined,
  pay_method: 'pix',
  beneficiary: '',
  notes: '',
};

export function Dashboard() {
  const { dashboard, movements, funds, projects, categories, saving, createMovement, updateMovement, deleteMovementCascade, listAttachments, uploadAttachment, deleteAttachment, getSignedUrl } = useFinanceSupabase();
  const [openModal, setOpenModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [movementForm, setMovementForm] = useState<MovementFormValues>({ ...emptyMovement });

  const categoriaData = useMemo(
    () => (dashboard.distribuicaoCategoria || []).map((item, index) => ({ name: item.categoria, value: Number(item.valor) || 0, color: CHART_COLORS[index % CHART_COLORS.length] })),
    [dashboard.distribuicaoCategoria],
  );

  const openCreateMovement = () => {
    setEditingMovement(null);
    setMovementForm({ ...emptyMovement, fund_id: funds[0]?.id ?? '', project_id: projects[0]?.id ?? '' });
    setOpenModal(true);
  };

  const openEditMovement = (movement: FinanceiroMovimentacao) => {
    setEditingMovement(movement);
    setMovementForm({
      date: String(movement.data).slice(0, 10),
      type: movement.tipo,
      project_id: movement.projetoId,
      fund_id: movement.fundoId,
      title: movement.titulo,
      description: movement.descricao,
      unit_value: movement.valorUnitario || movement.valorTotal,
      quantity: movement.quantidade || 1,
      status: movement.status,
      category_id: movement.categoriaId || undefined,
      pay_method: movement.payMethod,
      beneficiary: movement.beneficiary,
      notes: movement.notes,
    });
    setOpenModal(true);
  };

  const handleSaveMovement = async (files: File[]) => {
    const ok = editingMovement ? await updateMovement(editingMovement.id, movementForm) : await createMovement(movementForm, files);
    if (ok) {
      setOpenModal(false);
      setEditingMovement(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-gray-900">Dashboard Financeiro</h1>
          <p className="text-sm text-gray-600">Últimos 6 meses com dados pagos</p>
          <div className="mt-2 flex items-center gap-2"><Link to="/admin/financeiro/fundos" className="text-sm text-[#0f3d2e] hover:underline">Ver Fundos</Link><span className="text-gray-400">•</span><Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline">Ver Projetos</Link></div>
        </div>
        <button onClick={openCreateMovement} className="flex items-center gap-2 rounded-lg bg-[#0f3d2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a2b20]"><Plus className="h-4 w-4" />Nova Movimentação</button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Saldo Total" value={formatCurrency(dashboard.saldoAtual)} icon={<CircleDollarSign className="h-5 w-5" />} variant="primary" />
        <KPICard title="Entradas" value={formatCurrency(dashboard.entradas)} icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard title="Saídas" value={formatCurrency(dashboard.saidas)} icon={<TrendingDown className="h-5 w-5" />} />
        <KPICard title="Pendências" value={String(dashboard.pendencias)} icon={<AlertCircle className="h-5 w-5" />} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6"><h3 className="mb-6 text-base font-semibold text-gray-900">Fluxo de Caixa (Pago)</h3><ResponsiveContainer width="100%" height={250}><LineChart data={dashboard.fluxoCaixa}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Line type="monotone" dataKey="entradas" stroke="#10b981" name="Entradas" /><Line type="monotone" dataKey="saidas" stroke="#ef4444" name="Saídas" /></LineChart></ResponsiveContainer></div>
        <div className="rounded-xl border border-gray-200 bg-white p-6"><h3 className="mb-6 text-base font-semibold text-gray-900">Orçado vs Real</h3><ResponsiveContainer width="100%" height={250}><BarChart data={dashboard.orcadoVsReal}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" /><Bar dataKey="real" fill="#0f3d2e" name="Real" /></BarChart></ResponsiveContainer></div>
      </div>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6"><h3 className="mb-6 text-base font-semibold text-gray-900">Distribuição por Categoria</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={categoriaData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value">{categoriaData.map((entry, index) => (<Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4"><h3 className="text-base font-semibold text-gray-900">Últimas movimentações</h3></div>
        <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-gray-200 bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs uppercase">Data</th><th className="px-6 py-3 text-left text-xs uppercase">Descrição</th><th className="px-6 py-3 text-left text-xs uppercase">Projeto/Fundo</th><th className="px-6 py-3 text-left text-xs uppercase">Categoria</th><th className="px-6 py-3 text-left text-xs uppercase">Anexos</th><th className="px-6 py-3 text-left text-xs uppercase">Valor</th><th className="px-6 py-3 text-center text-xs uppercase">Status</th><th className="px-6 py-3 text-center text-xs uppercase">Ações</th></tr></thead><tbody className="divide-y divide-gray-200 bg-white">{movements.map((mov) => (<tr key={mov.id}><td className="px-6 py-4 text-sm">{formatDate(mov.data)}</td><td className="px-6 py-4 text-sm">{mov.descricao}</td><td className="px-6 py-4 text-sm">{mov.projetoNome !== '—' ? mov.projetoNome : mov.fundo}</td><td className="px-6 py-4 text-sm">{mov.categoria}</td><td className="px-6 py-4 text-sm">{mov.attachmentsCount || mov.comprovantes.length}</td><td className="px-6 py-4 text-sm font-medium">{formatCurrency(mov.valorTotal)}</td><td className="px-6 py-4 text-center"><StatusBadge status={mov.status} /></td><td className="px-6 py-4"><div className="flex items-center justify-center gap-2"><button onClick={() => openEditMovement(mov)} className="rounded p-1 hover:bg-gray-100"><Edit className="h-4 w-4" /></button><button onClick={() => { setSelectedMovement(mov); setOpenDelete(true); }} className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-4 w-4" /></button><button onClick={() => openEditMovement(mov)} className="rounded p-1 hover:bg-gray-100"><Eye className="h-4 w-4" /></button></div></td></tr>))}{movements.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">Sem dados.</td></tr>}</tbody></table></div>
      </div>

      <ModalMovimentacao
        open={openModal}
        title={editingMovement ? 'Editar movimentação' : 'Nova movimentação'}
        movementId={editingMovement?.id}
        saving={saving}
        form={movementForm}
        funds={funds}
        projects={projects}
        categories={categories}
        onChange={setMovementForm}
        onClose={() => setOpenModal(false)}
        onSubmit={handleSaveMovement}
        listAttachments={listAttachments}
        onUploadAttachment={uploadAttachment}
        onDeleteAttachment={deleteAttachment}
        getSignedUrl={getSignedUrl}
      />
      <ConfirmDialog open={openDelete} title="Excluir movimentação" description="Esta ação remove movimentação e comprovantes." onCancel={() => setOpenDelete(false)} onConfirm={() => { if (selectedMovement) void deleteMovementCascade(selectedMovement.id); setOpenDelete(false); }} />
    </div>
  );
}

import { useMemo, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Plus, AlertCircle, Edit, Trash2, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, formatDate, type FinanceiroMovimentacao } from './data/financeiro.repo';
import { useFinanceSupabase } from './hooks/useFinanceSupabase';

const emptyMovement = {
  date: new Date().toISOString().slice(0, 10),
  type: 'saida' as const,
  project_id: '',
  fund_id: '',
  title: '',
  description: '',
  unit_value: 0,
  quantity: 1,
  status: 'pendente',
  category: '',
  payment_method: '',
  payee: '',
  notes: '',
};

export function ProjetoDetalhes() {
  const { id = '' } = useParams();
  const { projects, movements, dashboard, error, createMovement, updateMovement, deleteMovement } = useFinanceSupabase();
  const [openModal, setOpenModal] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [movementForm, setMovementForm] = useState({ ...emptyMovement });

  const projeto = useMemo(() => projects.find((item) => item.id === id) ?? null, [projects, id]);
  const movimentacoesProjeto = useMemo(() => movements.filter((item) => item.projetoId === id), [movements, id]);

  const chartData = useMemo(
    () => (dashboard.orcadoVsReal || []).map((item) => ({ periodo: item.periodo, orcado: Number(item.orcado) || 0, real: Number(item.real) || 0 })),
    [dashboard.orcadoVsReal],
  );

  if (!projeto) return <div className="p-8">Projeto não encontrado.</div>;

  const openCreateMovement = () => {
    setEditingMovement(null);
    setMovementForm({ ...emptyMovement, project_id: id, fund_id: projeto.fundoId });
    setOpenModal(true);
  };

  const openEditMovement = (movement: FinanceiroMovimentacao) => {
    setEditingMovement(movement);
    setMovementForm({
      ...emptyMovement,
      date: String(movement.data).slice(0, 10),
      type: 'saida',
      project_id: movement.projetoId,
      fund_id: movement.fundoId,
      title: movement.descricao,
      description: movement.descricao,
      unit_value: movement.valorTotal,
      quantity: 1,
      status: movement.status,
      category: movement.categoria,
    });
    setOpenModal(true);
  };

  const handleSaveMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...movementForm, project_id: id, fund_id: projeto.fundoId };
    const ok = editingMovement ? await updateMovement(editingMovement.id, payload) : await createMovement(payload);
    if (ok) {
      setOpenModal(false);
      setEditingMovement(null);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <Link to="/admin/financeiro/projetos" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft className="w-4 h-4" />Voltar para Projetos</Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold text-gray-900">{projeto.nome}</h1><StatusBadge status={projeto.status} size="md" /></div>
            <p className="text-sm text-gray-600">Fundo: {projeto.fundo || '—'}</p>
          </div>
          <button onClick={openCreateMovement} className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg"><Plus className="w-4 h-4" />Nova Movimentação</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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
            <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(movimentacoesProjeto || []).map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{formatDate(mov.data)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{mov.descricao}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{mov.categoria || 'Sem categoria'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-red-600">- {formatCurrency(Number(mov.valorTotal) || 0)}</td>
                  <td className="px-6 py-4 text-center"><StatusBadge status={mov.status} /></td>
                  <td className="px-6 py-4 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => openEditMovement(mov)} className="p-1 hover:bg-gray-100 rounded transition-colors"><Edit className="w-4 h-4 text-gray-600" /></button><button onClick={() => void deleteMovement(mov.id)} className="p-1 hover:bg-gray-100 rounded transition-colors"><Trash2 className="w-4 h-4 text-gray-600" /></button></div></td>
                </tr>
              ))}
              {movimentacoesProjeto.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Sem dados no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{editingMovement ? 'Editar movimentação' : 'Nova movimentação'}</h2><button onClick={() => setOpenModal(false)} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
            <form className="grid grid-cols-2 gap-3" onSubmit={handleSaveMovement}>
              <input required type="date" value={movementForm.date} onChange={(e) => setMovementForm((prev) => ({ ...prev, date: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
              <select value={movementForm.type} onChange={(e) => setMovementForm((prev) => ({ ...prev, type: e.target.value as 'entrada' | 'saida' }))} className="rounded border px-3 py-2 text-sm"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>
              <input required value={movementForm.title} onChange={(e) => setMovementForm((prev) => ({ ...prev, title: e.target.value, description: e.target.value }))} placeholder="Título" className="rounded border px-3 py-2 text-sm" />
              <input required type="number" value={movementForm.unit_value} onChange={(e) => setMovementForm((prev) => ({ ...prev, unit_value: Number(e.target.value) }))} placeholder="Valor unitário" className="rounded border px-3 py-2 text-sm" />
              <input required type="number" value={movementForm.quantity} onChange={(e) => setMovementForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} placeholder="Quantidade" className="rounded border px-3 py-2 text-sm" />
              <select value={movementForm.status} onChange={(e) => setMovementForm((prev) => ({ ...prev, status: e.target.value }))} className="rounded border px-3 py-2 text-sm"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select>
              <input value={movementForm.category} onChange={(e) => setMovementForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Categoria" className="rounded border px-3 py-2 text-sm" />
              <input value={movementForm.payment_method} onChange={(e) => setMovementForm((prev) => ({ ...prev, payment_method: e.target.value }))} placeholder="Forma de pagamento" className="rounded border px-3 py-2 text-sm" />
              <input value={movementForm.payee} onChange={(e) => setMovementForm((prev) => ({ ...prev, payee: e.target.value }))} placeholder="Favorecido" className="rounded border px-3 py-2 text-sm" />
              <textarea value={movementForm.notes} onChange={(e) => setMovementForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Observações" className="col-span-2 rounded border px-3 py-2 text-sm" />
              <div className="col-span-2 flex justify-end gap-2 pt-2"><button type="button" onClick={() => setOpenModal(false)} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="submit" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

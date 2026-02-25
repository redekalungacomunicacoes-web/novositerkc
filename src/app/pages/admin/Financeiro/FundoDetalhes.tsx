import { useMemo, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Plus, Search, Edit, Trash2, FileText, X } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

export function FundoDetalhes() {
  const { id = '' } = useParams();
  const { funds, projects, movements, dashboard, error, createMovement, updateMovement, deleteMovement } = useFinanceSupabase();
  const [searchTerm, setSearchTerm] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [movementForm, setMovementForm] = useState({ ...emptyMovement });

  const fundo = useMemo(() => funds.find((fund) => fund.id === id) ?? null, [funds, id]);

  const movimentacoesFundo = useMemo(
    () => movements.filter((mov) => mov.fundoId === id),
    [movements, id],
  );

  const filteredMovements = useMemo(
    () => movimentacoesFundo.filter((mov) => mov.descricao.toLowerCase().includes(searchTerm.toLowerCase())),
    [movimentacoesFundo, searchTerm],
  );

  if (!fundo) return <div className="p-8">Fundo não encontrado.</div>;

  const mesData = (dashboard.orcadoVsReal || []).map((item) => ({ mes: item.periodo, orcado: Number(item.orcado) || 0, real: Number(item.real) || 0 }));
  const saldoData = (dashboard.fluxoCaixa || []).reduce((acc: any[], row: any) => {
    const last = acc[acc.length - 1]?.saldo ?? (Number(fundo.saldoInicial) || 0);
    acc.push({ mes: row.periodo, saldo: last + (Number(row.entradas) || 0) - (Number(row.saidas) || 0) });
    return acc;
  }, []);

  const openCreateMovement = () => {
    setEditingMovement(null);
    setMovementForm({ ...emptyMovement, fund_id: id, project_id: projects.find((project) => project.fundoId === id)?.id ?? '' });
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
    const payload = { ...movementForm, fund_id: id };
    const ok = editingMovement ? await updateMovement(editingMovement.id, payload) : await createMovement(payload);
    if (ok) {
      setOpenModal(false);
      setEditingMovement(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link to="/admin/financeiro/fundos" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft className="w-4 h-4" />Voltar para Fundos</Link>
        <div className="flex items-start justify-between"><div><h1 className="text-2xl font-semibold text-gray-900 mb-1">{fundo.nome}</h1><p className="text-sm text-gray-600">Acompanhamento completo do fundo</p></div><button onClick={openCreateMovement} className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium"><Plus className="w-4 h-4" />Nova Movimentação</button></div>
      </div>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Saldo Inicial</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(fundo.saldoInicial) || 0)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Saldo Atual</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(fundo.saldoAtual) || 0)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Entradas Pagas</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(fundo.totalEntradas) || 0)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Saídas Pagas</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(fundo.totalSaidas) || 0)}</p></div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6"><p className="text-sm text-gray-600 mb-2">Pendências</p><p className="text-2xl font-semibold text-gray-900">{filteredMovements.filter((mov) => mov.status !== 'pago').length}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-base font-semibold text-gray-900 mb-6">Orçado vs Real por Mês</h3>{mesData.length === 0 ? <p className="text-sm text-gray-500">Sem dados no período.</p> : <ResponsiveContainer width="100%" height={250}><BarChart data={mesData || []}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(Number(value) || 0)} /><Legend /><Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" /><Bar dataKey="real" fill="#0f3d2e" name="Real" /></BarChart></ResponsiveContainer>}</div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-base font-semibold text-gray-900 mb-6">Saldo ao Longo do Tempo</h3>{saldoData.length === 0 ? <p className="text-sm text-gray-500">Sem dados no período.</p> : <ResponsiveContainer width="100%" height={250}><LineChart data={saldoData || []}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(Number(value) || 0)} /><Legend /><Line type="monotone" dataKey="saldo" stroke="#0f3d2e" strokeWidth={2} name="Saldo" /></LineChart></ResponsiveContainer>}</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-base font-semibold text-gray-900 mb-4">Movimentações do Fundo</h3><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Buscar movimentações..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" /></div></div>
        <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{filteredMovements.map((mov) => (<tr key={mov.id} className="hover:bg-gray-50 transition-colors"><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(mov.data)}</td><td className="px-6 py-4 text-sm text-gray-900">{mov.descricao}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">- {formatCurrency(Number(mov.valorTotal) || 0)}</td><td className="px-6 py-4 whitespace-nowrap text-center"><StatusBadge status={mov.status} /></td><td className="px-6 py-4 whitespace-nowrap text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => openEditMovement(mov)} className="p-1 hover:bg-gray-100 rounded transition-colors"><Edit className="w-4 h-4 text-gray-600" /></button><button onClick={() => void deleteMovement(mov.id)} className="p-1 hover:bg-gray-100 rounded transition-colors"><Trash2 className="w-4 h-4 text-gray-600" /></button><button className="p-1 hover:bg-gray-100 rounded transition-colors"><FileText className="w-4 h-4 text-gray-600" /></button></div></td></tr>))}{filteredMovements.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Sem dados no período.</td></tr>}</tbody></table></div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{editingMovement ? 'Editar movimentação' : 'Nova movimentação'}</h2><button onClick={() => setOpenModal(false)} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
            <form className="grid grid-cols-2 gap-3" onSubmit={handleSaveMovement}>
              <input required type="date" value={movementForm.date} onChange={(e) => setMovementForm((prev) => ({ ...prev, date: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
              <select value={movementForm.type} onChange={(e) => setMovementForm((prev) => ({ ...prev, type: e.target.value as 'entrada' | 'saida' }))} className="rounded border px-3 py-2 text-sm"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>
              <select required value={movementForm.project_id} onChange={(e) => setMovementForm((prev) => ({ ...prev, project_id: e.target.value }))} className="rounded border px-3 py-2 text-sm"><option value="">Projeto</option>{projects.filter((project) => project.fundoId === id).map((project) => (<option key={project.id} value={project.id}>{project.nome}</option>))}</select>
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

import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Plus, Eye, Edit, Trash2, Copy, TrendingUp, X } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, type FinanceiroFundo } from './data/financeiro.repo';
import { useFinanceSupabase, type FundPayload } from './hooks/useFinanceSupabase';

const EMPTY_FUND: FundPayload = {
  name: '',
  year: new Date().getFullYear(),
  description: '',
  opening_balance: 0,
  status: 'ativo',
};

export function Fundos() {
  const { funds, error, createFund, updateFund, deleteFund } = useFinanceSupabase();
  const [openModal, setOpenModal] = useState(false);
  const [editingFund, setEditingFund] = useState<FinanceiroFundo | null>(null);
  const [form, setForm] = useState<FundPayload>(EMPTY_FUND);

  const totalFundos = useMemo(() => funds.reduce((acc, f) => acc + (Number(f.totalOrcado) || 0), 0), [funds]);
  const saldoDisponivel = useMemo(() => funds.reduce((acc, f) => acc + (Number(f.saldoAtual) || 0), 0), [funds]);
  const fundosAtivos = useMemo(() => funds.filter((f) => f.status === 'ativo').length, [funds]);

  const openCreate = () => {
    setEditingFund(null);
    setForm(EMPTY_FUND);
    setOpenModal(true);
  };

  const openEdit = (fund: FinanceiroFundo) => {
    setEditingFund(fund);
    setForm({
      name: fund.nome,
      year: fund.ano,
      description: '',
      opening_balance: Number(fund.saldoInicial) || 0,
      status: fund.status,
    });
    setOpenModal(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await (editingFund ? updateFund(editingFund.id, form) : createFund(form));
      setOpenModal(false);
      setEditingFund(null);
    } catch {
      // erro já exibido via hook
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Fundos</h1>
            <p className="text-sm text-gray-600">Visão geral Financeiro</p>
            <div className="flex items-center gap-2 mt-2"><span className="text-sm text-gray-600">Financeiro / Fundos</span></div>
            <p className="text-sm text-gray-600 mt-2">Gerencie todos os fundos e recursos disponíveis</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Novo Fundo
          </button>
        </div>
      </div>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-start justify-between mb-2"><p className="text-sm text-gray-600">Total em Fundos</p><Copy className="w-5 h-5 text-gray-400" /></div><p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalFundos)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-start justify-between mb-2"><p className="text-sm text-gray-600">Saldo Disponível</p><TrendingUp className="w-5 h-5 text-gray-400" /></div><p className="text-2xl font-semibold text-gray-900">{formatCurrency(saldoDisponivel)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-start justify-between mb-2"><p className="text-sm text-gray-600">Fundos Ativos</p><div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center"><span className="text-xs font-medium text-gray-600">i</span></div></div><p className="text-2xl font-semibold text-gray-900">{fundosAtivos}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(funds || []).map((fundo) => (
          <div key={fundo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-[#0f3d2e] p-6 text-white">
              <div className="flex items-start justify-between mb-3"><div><h3 className="text-lg font-semibold">{fundo.nome}</h3><p className="text-sm text-white/80">Ano {fundo.ano}</p></div><StatusBadge status={fundo.status} /></div>
              <div className="grid grid-cols-2 gap-4 mt-4"><div><p className="text-xs text-white/60 mb-1">Saldo Inicial</p><p className="text-xl font-bold">{formatCurrency(Number(fundo.saldoInicial) || 0)}</p></div><div><p className="text-xs text-white/60 mb-1">Total Gasto</p><p className="text-xl font-bold">{formatCurrency(Number(fundo.totalGasto) || 0)}</p></div></div>
            </div>

            <div className="p-6">
              <div className="mb-6"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-600">Execução</span><span className="text-sm font-medium text-gray-900">{Number(fundo.execucao) || 0}%</span></div><div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-[#0f3d2e] rounded-full transition-all" style={{ width: `${Number(fundo.execucao) || 0}%` }} /></div></div>
              <div className="grid grid-cols-2 gap-4 mb-6"><div><p className="text-xs text-gray-500 mb-1">Saldo Atual</p><p className="text-base font-semibold text-gray-900">{formatCurrency(Number(fundo.saldoAtual) || 0)}</p></div><div><p className="text-xs text-gray-500 mb-1">Restante</p><p className="text-base font-semibold text-gray-900">{formatCurrency((Number(fundo.totalOrcado) || 0) - (Number(fundo.totalGasto) || 0))}</p></div></div>
              <div className="flex gap-3"><Link to={`/admin/financeiro/fundos/${fundo.id}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium"><Eye className="w-4 h-4" />Ver Detalhes</Link></div>
              <div className="flex gap-3 mt-3"><button onClick={() => openEdit(fundo)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"><Edit className="w-4 h-4" />Editar</button><button onClick={() => { void deleteFund(fundo.id).catch(() => undefined); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"><Trash2 className="w-4 h-4" />Excluir</button></div>
            </div>
          </div>
        ))}
      </div>
      {funds.length === 0 && <p className="text-sm text-gray-500 mt-6">Sem dados no período.</p>}

      {openModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingFund ? 'Editar fundo' : 'Novo fundo'}</h2>
              <button onClick={() => setOpenModal(false)} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form className="space-y-3" onSubmit={handleSave}>
              <input required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nome" className="w-full rounded border px-3 py-2 text-sm" />
              <input required type="number" value={form.year} onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value) }))} placeholder="Ano" className="w-full rounded border px-3 py-2 text-sm" />
              <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descrição" className="w-full rounded border px-3 py-2 text-sm" />
              <input required type="number" value={form.opening_balance} onChange={(e) => setForm((prev) => ({ ...prev, opening_balance: Number(e.target.value) }))} placeholder="Saldo inicial" className="w-full rounded border px-3 py-2 text-sm" />
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as FundPayload['status'] }))} className="w-full rounded border px-3 py-2 text-sm">
                <option value="ativo">Ativo</option>
                <option value="concluido">Concluído</option>
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpenModal(false)} className="rounded border px-4 py-2 text-sm">Cancelar</button>
                <button type="submit" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

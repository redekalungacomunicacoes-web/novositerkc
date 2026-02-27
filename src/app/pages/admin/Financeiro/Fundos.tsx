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

const toNumber = (v: unknown) => Number(v) || 0;

export function Fundos() {
  const { funds, error, createFund, updateFund, deleteFund } = useFinanceSupabase();
  const [openModal, setOpenModal] = useState(false);
  const [editingFund, setEditingFund] = useState<FinanceiroFundo | null>(null);
  const [form, setForm] = useState<FundPayload>(EMPTY_FUND);

  // ✅ KPIs coerentes com caixa:
  // - Total em Fundos: soma do saldo inicial (o que foi "aberto" no caixa)
  // - Saldo Disponível: soma do saldo atual (já calculado por movimentos pagos)
  const totalFundos = useMemo(() => (funds || []).reduce((acc, f) => acc + toNumber(f.saldoInicial), 0), [funds]);
  const saldoDisponivel = useMemo(() => (funds || []).reduce((acc, f) => acc + toNumber(f.saldoAtual), 0), [funds]);
  const fundosAtivos = useMemo(() => (funds || []).filter((f) => f.status === 'ativo').length, [funds]);

  // ✅ lista ordenada (estável)
  const orderedFunds = useMemo(() => {
    const list = [...(funds || [])];
    const weight = (s: string) => (s === 'ativo' ? 0 : s === 'concluido' ? 1 : 2);
    list.sort((a, b) => {
      const wa = weight(a.status);
      const wb = weight(b.status);
      if (wa !== wb) return wa - wb;
      const ya = toNumber(a.ano);
      const yb = toNumber(b.ano);
      if (ya !== yb) return yb - ya;
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
    return list;
  }, [funds]);

  const openCreate = () => {
    setEditingFund(null);
    setForm(EMPTY_FUND);
    setOpenModal(true);
  };

  const openEdit = (fund: FinanceiroFundo) => {
    setEditingFund(fund);
    setForm({
      name: fund.nome,
      year: toNumber(fund.ano) || new Date().getFullYear(),
      description: '',
      opening_balance: toNumber(fund.saldoInicial),
      status: fund.status as FundPayload['status'],
    });
    setOpenModal(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const payload: FundPayload = {
        ...form,
        year: toNumber(form.year) || new Date().getFullYear(),
        opening_balance: toNumber(form.opening_balance),
      };

      await (editingFund ? updateFund(editingFund.id, payload) : createFund(payload));
      setOpenModal(false);
      setEditingFund(null);
      setForm(EMPTY_FUND);
    } catch {
      // erro já exibido via hook
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-semibold text-gray-900">Fundos</h1>
            <p className="text-sm text-gray-600">Visão geral Financeiro</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">Financeiro / Fundos</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">Gerencie todos os fundos e recursos disponíveis</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#0f3d2e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a2b20]"
          >
            <Plus className="h-4 w-4" /> Novo Fundo
          </button>
        </div>
      </div>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-sm text-gray-600">Total em Fundos</p>
            <Copy className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalFundos)}</p>
          <p className="mt-1 text-xs text-gray-500">Soma do saldo inicial de todos os fundos</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-sm text-gray-600">Saldo Disponível</p>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(saldoDisponivel)}</p>
          <p className="mt-1 text-xs text-gray-500">Soma dos saldos atuais (entradas - saídas)</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-sm text-gray-600">Fundos Ativos</p>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
              <span className="text-xs font-medium text-gray-600">i</span>
            </div>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{fundosAtivos}</p>
          <p className="mt-1 text-xs text-gray-500">Status = ativo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(orderedFunds || []).map((fundo) => (
          <div key={fundo.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
            <div className="bg-[#0f3d2e] p-6 text-white">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{fundo.nome}</h3>
                  <p className="text-sm text-white/80">Ano {toNumber(fundo.ano) || new Date().getFullYear()}</p>
                </div>
                <StatusBadge status={fundo.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs text-white/60">Saldo Inicial</p>
                  <p className="text-xl font-bold">{formatCurrency(toNumber(fundo.saldoInicial))}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-white/60">Total Gasto (pago)</p>
                  <p className="text-xl font-bold">{formatCurrency(toNumber(fundo.totalGasto))}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Execução</span>
                  <span className="text-sm font-medium text-gray-900">{toNumber(fundo.execucao) || 0}%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-[#0f3d2e] transition-all"
                    style={{ width: `${toNumber(fundo.execucao) || 0}%` }}
                  />
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs text-gray-500">Saldo Atual</p>
                  <p className="text-base font-semibold text-gray-900">{formatCurrency(toNumber(fundo.saldoAtual))}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Saldo Restante</p>
                  <p className="text-base font-semibold text-gray-900">{formatCurrency(toNumber(fundo.saldoAtual))}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  to={`/admin/financeiro/fundos/${fundo.id}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f3d2e] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2b20]"
                >
                  <Eye className="h-4 w-4" />
                  Ver Detalhes
                </Link>
              </div>

              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => openEdit(fundo)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    void deleteFund(fundo.id).catch(() => undefined);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {orderedFunds.length === 0 && <p className="mt-6 text-sm text-gray-500">Sem dados no período.</p>}

      {openModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingFund ? 'Editar fundo' : 'Novo fundo'}</h2>
              <button onClick={() => setOpenModal(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSave}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                required
                type="number"
                value={form.year}
                onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                placeholder="Ano"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                required
                type="number"
                value={form.opening_balance}
                onChange={(e) => setForm((prev) => ({ ...prev, opening_balance: Number(e.target.value) }))}
                placeholder="Saldo inicial"
                className="w-full rounded border px-3 py-2 text-sm"
              />

              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as FundPayload['status'] }))}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="ativo">Ativo</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpenModal(false)} className="rounded border px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button type="submit" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

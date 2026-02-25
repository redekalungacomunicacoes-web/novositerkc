import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, AlertCircle, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../data/financeiro-data';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { SupabaseHealth } from '../../components/SupabaseHealth';
import { FundFormDialog } from '../../components/FundFormDialog';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../components/ui/alert';

export function Fundos() {
  const { listFunds, createFund, updateFund, deleteFund } = useFinanceSupabase();
  const [fundos, setFundos] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadFunds = async () => {
    try {
      const data = await listFunds();
      setFundos(data || []);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      setFeedback((error as Error).message);
    }
  };

  useEffect(() => {
    void loadFunds();
  }, []);

  const totals = useMemo(() => {
    const total = fundos.reduce((acc, f) => acc + Number(f.opening_balance || 0), 0);
    const available = fundos.reduce((acc, f) => acc + Number(f.current_balance || f.opening_balance || 0), 0);
    return { total, available, active: fundos.length };
  }, [fundos]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />
      {feedback ? <Alert className="mb-6 border-red-200 bg-red-50 text-red-700"><AlertDescription>{feedback}</AlertDescription></Alert> : null}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-gray-900">Fundos</h1>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm">
            <Plus className="w-5 h-5" />
            Novo Fundo
          </button>
        </div>
        <p className="text-gray-600">Gerencie todos os fundos e recursos disponíveis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard title="Total em Fundos" value={formatCurrency(totals.total)} icon={Wallet} variant="success" />
        <KPICard title="Saldo Disponível" value={formatCurrency(totals.available)} icon={TrendingUp} />
        <KPICard title="Fundos Ativos" value={String(totals.active)} icon={AlertCircle} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {fundos.map((fundo) => {
          const totalOrcado = Number(fundo.opening_balance || 0);
          const saldoAtual = Number(fundo.current_balance || 0);
          const totalGastoReal = Math.max(totalOrcado - saldoAtual, 0);
          return (
            <div key={fundo.id} className="bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20] p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{fundo.name}</h3>
                    <p className="text-sm text-white/80">Ano {fundo.year}</p>
                  </div>
                  <StatusBadge status={fundo.status || 'em_andamento'} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-white/60 mb-1">Saldo Atual</p><p className="text-2xl font-bold">{formatCurrency(saldoAtual)}</p></div>
                  <div><p className="text-xs text-white/60 mb-1">Total Orçado</p><p className="text-2xl font-bold">{formatCurrency(totalOrcado)}</p></div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-600">Execução</span><span className="text-sm font-medium text-gray-900">{totalOrcado ? ((totalGastoReal / totalOrcado) * 100).toFixed(1) : '0.0'}%</span></div><div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0f3d2e] to-[#ffdd9a] rounded-full transition-all" style={{ width: `${totalOrcado ? (totalGastoReal / totalOrcado) * 100 : 0}%` }} /></div></div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Gasto Real</p><p className="text-base font-semibold text-gray-900">{formatCurrency(totalGastoReal)}</p></div>
                  <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Restante</p><p className="text-base font-semibold text-gray-900">{formatCurrency(saldoAtual)}</p></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Link to={`/admin/financeiro/fundos/${fundo.id}`} className="col-span-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors"><Eye className="w-5 h-5" />Ver Detalhes</Link>
                  <button onClick={() => { setEditing(fundo); setModalOpen(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"><Edit className="w-4 h-4" />Editar</button>
                  <button onClick={() => setDeleting(fundo)} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" />Excluir</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FundFormDialog
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialData={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          try {
            if (editing?.id) await updateFund(editing.id, payload);
            else await createFund({ ...payload, current_balance: payload.opening_balance });
            setFeedback(null);
            await loadFunds();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback((error as Error).message);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir fundo"
        description="Confirma exclusão do fundo?"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting?.id) return;
          try {
            await deleteFund(deleting.id);
            setDeleting(null);
            await loadFunds();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback((error as Error).message);
          }
        }}
      />
    </div>
  );
}

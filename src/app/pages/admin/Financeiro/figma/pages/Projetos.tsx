import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Filter, Search, Edit, Trash2 } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../data/financeiro-data';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { SupabaseHealth } from '../../components/SupabaseHealth';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Alert, AlertDescription } from '../components/ui/alert';

const FRIENDLY_RLS = "Seu usuário não é admin no Supabase. Verifique tabela profiles.role='admin'.";
const normalizeError = (error: unknown) => {
  const message = (error as Error)?.message || 'Erro inesperado.';
  return message.toLowerCase().includes('row-level security') ? FRIENDLY_RLS : message;
};

export function Projetos() {
  const { listProjects, listFunds, createProject, updateProject, deleteProject } = useFinanceSupabase();
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: '', year: new Date().getFullYear(), description: '', fund_id: '', initial_amount: 0, current_balance: 0, status: 'em_andamento' });

  const load = async () => {
    try {
      const [projData, fundData] = await Promise.all([listProjects(), listFunds()]);
      setProjects(projData || []);
      setFunds(fundData || []);
      setFeedback(null);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      setFeedback(normalizeError(error));
    }
  };

  useEffect(() => { void load(); }, []);

  const fundNameById = useMemo(() => new Map(funds.map((f) => [f.id, f.name])), [funds]);
  const filtered = useMemo(() => projects.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase())), [projects, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', year: new Date().getFullYear(), description: '', fund_id: '', initial_amount: 0, current_balance: 0, status: 'em_andamento' });
    setOpenForm(true);
  };

  const openEdit = (project: any) => {
    setEditing(project);
    setForm({
      name: project.name || '',
      year: project.year || new Date().getFullYear(),
      description: project.description || '',
      fund_id: project.fund_id || '',
      initial_amount: Number(project.initial_amount || 0),
      current_balance: Number(project.current_balance || 0),
      status: project.status || 'em_andamento',
    });
    setOpenForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />
      {feedback ? <Alert className="mb-6 border-red-200 bg-red-50 text-red-700"><AlertDescription>{feedback}</AlertDescription></Alert> : null}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-gray-900">Projetos</h1>
          <button onClick={openCreate} className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm">
            <Plus className="w-5 h-5" />
            Novo Projeto
          </button>
        </div>
        <p className="text-gray-600">Gerencie todos os projetos financeiros</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} type="text" placeholder="Buscar projetos..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((projeto) => {
          const totalOrcado = Number(projeto.initial_amount || 0);
          const saldo = Number(projeto.current_balance || 0);
          const totalReal = Math.max(totalOrcado - saldo, 0);
          const percentualExecucao = totalOrcado ? Math.round((totalReal / totalOrcado) * 100) : 0;
          return (
            <div key={projeto.id} className="bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20] p-6 text-white">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold">{projeto.name}</h3>
                  <StatusBadge status={projeto.status || 'em_andamento'} />
                </div>
                <p className="text-sm text-white/80">{fundNameById.get(projeto.fund_id) || '-'}</p>
              </div>
              <div className="p-6">
                <div className="mb-6"><p className="text-xs text-gray-500 mb-2">Saldo Disponível</p><p className="text-3xl font-bold text-[#0f3d2e]">{formatCurrency(saldo)}</p></div>
                <div className="mb-6"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-600">Execução</span><span className="text-sm font-medium text-gray-900">{percentualExecucao}%</span></div><div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0f3d2e] to-[#ffdd9a] rounded-full transition-all" style={{ width: `${percentualExecucao}%` }} /></div></div>
                <div className="grid grid-cols-3 gap-3 mb-6"><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Orçado</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(totalOrcado)}</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Real</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(totalReal)}</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Diferença</p><p className="text-sm font-semibold text-red-600">{formatCurrency(totalReal - totalOrcado)}</p></div></div>
                <div className="grid grid-cols-3 gap-2">
                  <Link to={`/admin/financeiro/projetos/${projeto.id}`} className="col-span-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors"><Eye className="w-5 h-5" />Ver Detalhes</Link>
                  <button onClick={() => openEdit(projeto)} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"><Edit className="w-4 h-4" />Editar</button>
                  <button onClick={() => setDeleting(projeto)} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" />Excluir</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={openForm} onOpenChange={(value) => setOpenForm(value)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <input className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="px-4 py-2 border border-gray-300 rounded-lg" type="number" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              <select className="px-4 py-2 border border-gray-300 rounded-lg" value={form.fund_id} onChange={(e) => setForm({ ...form, fund_id: e.target.value })}>
                <option value="">Selecione o fundo</option>
                {funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
              </select>
            </div>
            <textarea className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Descrição" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="px-4 py-2 border border-gray-300 rounded-lg" type="number" step="0.01" placeholder="Valor inicial" value={form.initial_amount} onChange={(e) => setForm({ ...form, initial_amount: Number(e.target.value) })} />
              <input className="px-4 py-2 border border-gray-300 rounded-lg" type="number" step="0.01" placeholder="Saldo atual" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" className="px-6 py-2 border border-gray-300 rounded-lg" onClick={() => setOpenForm(false)}>Cancelar</button>
            <button
              type="button"
              className="px-6 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20]"
              onClick={async () => {
                try {
                  if (editing?.id) {
                    await updateProject(editing.id, { ...form, fund_id: form.fund_id || null });
                  } else {
                    await createProject({ ...form, fund_id: form.fund_id || null, current_balance: Number(form.current_balance || form.initial_amount || 0) });
                  }
                  setOpenForm(false);
                  await load();
                } catch (error) {
                  if (import.meta.env.DEV) console.error(error);
                  setFeedback(normalizeError(error));
                }
              }}
            >Salvar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir projeto"
        description="Deseja realmente excluir este projeto?"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting?.id) return;
          try {
            await deleteProject(deleting.id);
            setDeleting(null);
            await load();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback(normalizeError(error));
          }
        }}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Plus, Pencil, Trash2, FileText, List } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { KPICard } from '../components/KPICard';
import { ModalMovimentacao } from '../components/ModalMovimentacao';
import { formatCurrency, formatDate } from '../data/financeiro-data';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { SupabaseHealth } from '../../components/SupabaseHealth';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [funds, setFunds] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [latestMovements, setLatestMovements] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const {
    listFunds,
    listProjects,
    listMovements,
    listLatestMovements,
    createMovement,
    updateMovement,
    deleteMovement,
    listAttachments,
    uploadAttachment,
    deleteAttachment,
    listAttachmentsForMovements,
  } = useFinanceSupabase();

  const hydrateAttachmentCounts = async (movementRows: any[]) => {
    const ids = movementRows.map((row) => row.id).filter(Boolean);
    const rows = await listAttachmentsForMovements(ids);
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.movement_id] = (acc[row.movement_id] || 0) + 1;
      return acc;
    }, {});
    setAttachmentCounts(counts);
  };

  const load = async () => {
    try {
      const [fundsData, projectData, allMovements, latestRows] = await Promise.all([
        listFunds(),
        listProjects(),
        listMovements(),
        listLatestMovements(10),
      ]);
      setFunds(fundsData || []);
      setProjects(projectData || []);
      setMovements(allMovements || []);
      setLatestMovements(latestRows || []);
      await hydrateAttachmentCounts(latestRows || []);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const loadMovementAttachments = async () => {
      if (!editing?.id) {
        setAttachments([]);
        return;
      }
      const list = await listAttachments(editing.id);
      setAttachments(list || []);
    };

    void loadMovementAttachments();
  }, [editing?.id]);

  const saldoTotal = useMemo(() => funds.reduce((acc, f) => acc + Number(f.current_balance || 0), 0), [funds]);
  const entradasMes = useMemo(() => movements.filter((m) => m.type === 'entrada').reduce((a, m) => a + Number(m.total_value || 0), 0), [movements]);
  const saidasMes = useMemo(() => movements.filter((m) => m.type === 'saida').reduce((a, m) => a + Number(m.total_value || 0), 0), [movements]);
  const pendencias = useMemo(() => movements.filter((m) => m.status === 'pendente'), [movements]);

  const fluxoCaixaData = useMemo(() => {
    const grouped = new Map<string, { mes: string; entradas: number; saidas: number }>();
    movements.forEach((m) => {
      const mes = new Date(m.date).toLocaleDateString('pt-BR', { month: 'short' });
      const row = grouped.get(mes) || { mes, entradas: 0, saidas: 0 };
      if (m.type === 'entrada') row.entradas += Number(m.total_value || 0);
      else row.saidas += Number(m.total_value || 0);
      grouped.set(mes, row);
    });
    return Array.from(grouped.values()).slice(-6);
  }, [movements]);

  const categoriasMes = useMemo(() => {
    const byCategory = new Map<string, number>();
    movements.forEach((m) => {
      const cat = m.category || 'OUTROS';
      byCategory.set(cat, (byCategory.get(cat) || 0) + Number(m.total_value || 0));
    });
    const colors = ['#0f3d2e', '#ffdd9a', '#6b7280', '#93c5fd', '#d1d5db'];
    return Array.from(byCategory.entries()).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [movements]);

  const fundMap = useMemo(() => new Map(funds.map((f) => [f.id, f.name])), [funds]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard Financeiro</h1>
          <div className="flex items-center gap-3">
            <Link to="/admin/financeiro/relatorios" className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"><FileText className="w-5 h-5" />Relatórios</Link>
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm"><Plus className="w-5 h-5" />Nova Movimentação</button>
          </div>
        </div>
        <div className="flex items-center gap-3"><p className="text-gray-600">Visão geral das finanças e projetos</p><Link to="/admin/financeiro/fundos" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver Fundos</Link><Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver Projetos</Link></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <KPICard title="Saldo Total Atual" value={formatCurrency(saldoTotal)} icon={Wallet} variant="success" />
        <Link to="/admin/financeiro/movimentacoes" className="block"><KPICard title="Movimentações" value={String(movements.length)} icon={List} /></Link>
        <Link to="/admin/financeiro/movimentacoes?type=entrada" className="block"><KPICard title="Entradas" value={formatCurrency(entradasMes)} icon={TrendingUp} /></Link>
        <Link to="/admin/financeiro/movimentacoes?type=saida" className="block"><KPICard title="Saídas" value={formatCurrency(saidasMes)} icon={TrendingDown} /></Link>
        <Link to="/admin/financeiro/movimentacoes?status=pendente" className="block"><KPICard title="Pendências" value={String(pendencias.length)} icon={AlertCircle} variant="warning" /></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Fluxo de Caixa (6 meses)</h3><ResponsiveContainer width="100%" height={300}><LineChart data={fluxoCaixaData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Line type="monotone" dataKey="entradas" stroke="#0f3d2e" strokeWidth={2} name="Entradas" /><Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" /></LineChart></ResponsiveContainer></div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Orçado vs Real (por mês)</h3><ResponsiveContainer width="100%" height={300}><BarChart data={fluxoCaixaData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Bar dataKey="entradas" fill="#ffdd9a" name="Orçado" /><Bar dataKey="saidas" fill="#0f3d2e" name="Real" /></BarChart></ResponsiveContainer></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8"><h3 className="text-lg font-semibold text-gray-900 mb-6">Distribuição por Categoria</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={categoriasMes} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">{categoriasMes.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Últimas movimentações</h3>
          <Link to="/admin/financeiro/movimentacoes" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projeto/Fundo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comprovantes</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {latestMovements.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(mov.date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 capitalize">{mov.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{mov.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{projectMap.get(mov.project_id) || '-'} / {fundMap.get(mov.fund_id) || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap">{formatCurrency(Number(mov.total_value || 0))}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={mov.status} /></td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">{attachmentCounts[mov.id] || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditing(mov); setModalOpen(true); }} className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg" title="Editar"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleting(mov)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ModalMovimentacao
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editData={editing || undefined}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        funds={funds.map((f) => ({ id: f.id, name: f.name }))}
        attachments={attachments}
        onSubmit={async (payload) => {
          if (editing?.id) {
            return updateMovement(editing.id, payload);
          }
          return createMovement(payload);
        }}
        onDelete={async (movementId) => {
          await deleteMovement(movementId);
          await load();
        }}
        onChanged={load}
        onUploadAttachment={async (file, movementId, payload) => {
          if (!movementId) return;
          await uploadAttachment(file, {
            movementId,
            fundId: payload?.fund_id || editing?.fund_id || null,
            projectId: payload?.project_id || editing?.project_id || null,
          });
          const list = await listAttachments(movementId);
          setAttachments(list || []);
          await load();
        }}
        onDeleteAttachment={async (attachmentId) => {
          const target = attachments.find((a) => a.id === attachmentId);
          if (!target) return;
          await deleteAttachment(target);
          if (editing?.id) {
            const list = await listAttachments(editing.id);
            setAttachments(list || []);
          }
          await load();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir movimentação"
        description="Deseja realmente excluir esta movimentação?"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting?.id) return;
          await deleteMovement(deleting.id);
          setDeleting(null);
          await load();
        }}
      />
    </div>
  );
}

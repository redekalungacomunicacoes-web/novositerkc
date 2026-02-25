import { useEffect, useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Plus, Pencil, Trash2, FileText, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { KPICard } from '../components/KPICard';
import { ModalMovimentacao } from '../components/ModalMovimentacao';
import { formatCurrency, formatDate } from '../data/financeiro-data';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { SupabaseHealth } from '../../components/SupabaseHealth';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { AttachmentViewerDialog } from '../../components/AttachmentViewerDialog';

const PIE_COLORS = ['#0f3d2e', '#ffdd9a', '#6b7280', '#93c5fd', '#d1d5db'];

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [funds, setFunds] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [latestMovements, setLatestMovements] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [dashboardData, setDashboardData] = useState<any>({ kpis: {}, cashflowLine: [], budgetVsReal: [], categoryPie: [] });
  const [previewAttachment, setPreviewAttachment] = useState<any>(null);
  const [feedback, setFeedback] = useState<string>('');

  const { listFunds, listProjects, listLatestMovements, getDashboardAggregates, createMovement, updateMovement, deleteMovementCascade, listAttachments, uploadAttachment, deleteAttachment, listAttachmentsForMovementIds } = useFinanceSupabase();

  const load = async () => {
    try {
      const [fundsData, projectData, latestRows] = await Promise.all([listFunds(), listProjects(), listLatestMovements(10)]);
      setFunds(fundsData || []);
      setProjects(projectData || []);
      setLatestMovements(latestRows || []);

      const rows = await listAttachmentsForMovementIds((latestRows || []).map((row) => row.id));
      const counts = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.movement_id]: (acc[row.movement_id] || 0) + 1 }), {});
      setAttachmentCounts(counts);

      try {
        const aggregate = await getDashboardAggregates({ months: 6 });
        setDashboardData(aggregate);
      } catch (error) {
        if (import.meta.env.DEV) console.error(error);
        setDashboardData({ kpis: { totalMovements: latestRows?.length || 0, totalPending: 0, totalIn: 0, totalOut: 0, currentBalance: (fundsData || []).reduce((acc: number, fund: any) => acc + Number(fund.current_balance || 0), 0) }, cashflowLine: [], budgetVsReal: [], categoryPie: [] });
      }

      setFeedback('');
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      setFeedback((error as Error)?.message || 'Erro ao carregar dashboard financeiro.');
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

  const fundMap = useMemo(() => new Map(funds.map((f) => [f.id, f.name])), [funds]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const totalFunds = funds.length;
  const totalProjects = projects.length;
  const totalCash = funds.reduce((acc, fund) => acc + Number(fund.current_balance || 0), 0);


  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />
      {feedback ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{feedback}</div> : null}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2"><h1 className="text-3xl font-semibold text-gray-900">Dashboard Financeiro</h1><div className="flex items-center gap-3"><Link to="/admin/financeiro/relatorios" className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"><FileText className="w-5 h-5" />Relatórios</Link><button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm"><Plus className="w-5 h-5" />Nova Movimentação</button></div></div>
        <div className="flex items-center gap-3"><p className="text-gray-600">Visão geral das finanças e projetos</p><Link to="/admin/financeiro/fundos" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver Fundos</Link><Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver Projetos</Link></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard title="Saldo Atual" value={formatCurrency(Number(totalCash || dashboardData.kpis.currentBalance || 0))} subtitle={`${totalFunds} fundos • ${totalProjects} projetos`} icon={Wallet} color="primary" />
        <KPICard title="Entradas (pagas)" value={formatCurrency(Number(dashboardData.kpis.totalIn || 0))} subtitle={`${dashboardData.kpis.totalMovements || 0} movimentações`} icon={TrendingUp} color="success" />
        <KPICard title="Saídas (pagas)" value={formatCurrency(Number(dashboardData.kpis.totalOut || 0))} subtitle="Saídas pagas (6 meses)" icon={TrendingDown} color="danger" />
        <KPICard title="Pendências" value={`${dashboardData.kpis.totalPending || 0}`} subtitle={`${dashboardData.kpis.totalMovements || 0} movimentações`} icon={AlertCircle} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Fluxo de Caixa</h3><ResponsiveContainer width="100%" height={300}><LineChart data={dashboardData.cashflowLine}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Line type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2} name="Entradas" /><Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" /></LineChart></ResponsiveContainer></div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Orçado vs Real</h3><ResponsiveContainer width="100%" height={300}><BarChart data={dashboardData.budgetVsReal}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" /><Bar dataKey="real" fill="#0f3d2e" name="Real" /></BarChart></ResponsiveContainer></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8"><h3 className="text-lg font-semibold text-gray-900 mb-6">Distribuição por Categoria</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={dashboardData.categoryPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">{(dashboardData.categoryPie || []).map((_: any, index: number) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Últimas movimentações</h3><Link to="/admin/financeiro/movimentacoes" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver todas</Link></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projeto/Fundo</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comprovantes</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th></tr></thead>
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
                  <td className="px-4 py-3"><div className="flex items-center justify-center gap-2"><button onClick={() => { setEditing(mov); setModalOpen(true); }} className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg" title="Editar"><Pencil className="w-4 h-4" /></button><button onClick={() => setDeleting(mov)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>{attachmentCounts[mov.id] ? <button onClick={async () => { const rows = await listAttachments(mov.id); if (rows.length) setPreviewAttachment(rows[0]); }} className="p-2 text-[#0f3d2e] hover:bg-[#e8f2ef] rounded-lg" title="Ver comprovante"><Eye className="w-4 h-4" /></button> : null}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ModalMovimentacao isOpen={modalOpen} onClose={() => setModalOpen(false)} editData={editing || undefined} projects={projects.map((p) => ({ id: p.id, name: p.name }))} funds={funds.map((f) => ({ id: f.id, name: f.name }))} attachments={attachments}
        onSubmit={async (payload) => editing?.id ? updateMovement(editing.id, payload) : createMovement(payload)}
        onDelete={async () => { if (editing?.id) await deleteMovementCascade(editing); await load(); }}
        onChanged={load}
        onUploadAttachment={async (file, movementId, payload) => { if (!movementId) return; await uploadAttachment(file, { movementId, fundId: payload?.fund_id || editing?.fund_id || null, projectId: payload?.project_id || editing?.project_id || null }); const list = await listAttachments(movementId); setAttachments(list || []); await load(); }}
        onDeleteAttachment={async (attachmentId) => { const target = attachments.find((a) => a.id === attachmentId); if (!target) return; await deleteAttachment(target); if (editing?.id) setAttachments(await listAttachments(editing.id)); await load(); }}
      />

      <ConfirmDialog open={Boolean(deleting)} title="Excluir movimentação" description="Deseja realmente excluir esta movimentação?" onCancel={() => setDeleting(null)} onConfirm={async () => { if (!deleting?.id) return; await deleteMovementCascade(deleting); setDeleting(null); await load(); }} />
      <AttachmentViewerDialog open={Boolean(previewAttachment)} attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
}

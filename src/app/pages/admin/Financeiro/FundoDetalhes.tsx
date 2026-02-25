import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Edit, FileText, Plus, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate, type FinanceiroMovimentacao } from './data/financeiro.repo';
import { useFinanceSupabase, type MovementPayload } from './hooks/useFinanceSupabase';
import { ModalMovimentacao } from './components/ModalMovimentacao';
import { ConfirmDialog } from './components/ConfirmDialog';

const monthKey = (isoLike: string) => String(isoLike).slice(0, 7);
const downloadCsv = (filename: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(';'), ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replaceAll('"', '""')}"`).join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export function FundoDetalhes() {
  const { id = '' } = useParams();
  const finance = useFinanceSupabase();
  const { funds, projects, categories, listMovements, listAttachments, load, createMovement, updateMovement, deleteMovementCascade, uploadAttachment, deleteAttachment } = finance;
  const [tab, setTab] = useState<'geral' | 'caixa' | 'prestacao' | 'relatorios'>('geral');
  const [openModal, setOpenModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [movimentacoesFundo, setMovimentacoesFundo] = useState<FinanceiroMovimentacao[]>([]);
  const [attachments, setAttachments] = useState([] as Awaited<ReturnType<typeof listAttachments>>);

  const fundo = useMemo(() => funds.find((fund) => fund.id === id) ?? null, [funds, id]);

  const refreshAll = async () => {
    await load();
    const rows = await listMovements({ fundId: id });
    setMovimentacoesFundo(rows);
    if (editingMovement) setAttachments(await listAttachments(editingMovement.id));
  };

  useEffect(() => {
    void refreshAll();
  }, [id]);

  const metrics = useMemo(() => {
    const orcado = fundo?.totalOrcado || 0;
    const gastoPago = movimentacoesFundo.filter((m) => m.tipo === 'saida' && m.status === 'pago').reduce((acc, m) => acc + m.valorTotal, 0);
    const withAttachments = movimentacoesFundo.filter((m) => (m.attachmentsCount || m.comprovantes.length) > 0).length;
    return { saldoDisponivel: fundo?.saldoAtual || 0, orcado, gastoReal: gastoPago, execucao: orcado > 0 ? (gastoPago / orcado) * 100 : 0, comprovantesPct: movimentacoesFundo.length > 0 ? (withAttachments / movimentacoesFundo.length) * 100 : 0, pendencias: movimentacoesFundo.filter((m) => m.status === 'pendente').length, semDocumento: movimentacoesFundo.length - withAttachments };
  }, [fundo, movimentacoesFundo]);

  const fluxoMensal = useMemo(() => {
    const map = new Map<string, { periodo: string; entradas: number; saidas: number }>();
    movimentacoesFundo.forEach((mov) => {
      const periodo = monthKey(mov.data);
      const current = map.get(periodo) ?? { periodo, entradas: 0, saidas: 0 };
      if (mov.tipo === 'entrada') current.entradas += mov.valorTotal;
      if (mov.tipo === 'saida') current.saidas += mov.valorTotal;
      map.set(periodo, current);
    });
    return [...map.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [movimentacoesFundo]);

  const categoriaRows = useMemo(() => {
    const map = new Map<string, number>();
    movimentacoesFundo.filter((m) => m.tipo === 'saida').forEach((m) => map.set(m.categoria || 'Sem categoria', (map.get(m.categoria || 'Sem categoria') ?? 0) + m.valorTotal));
    return Array.from(map.entries()).map(([categoria, real]) => ({ categoria, orcado: 0, real }));
  }, [movimentacoesFundo]);

  if (!fundo) return <div className="p-8">Fundo não encontrado.</div>;

  return (
    <div className="space-y-5 p-8">
      <div className="flex items-center justify-between"><div><Link to="/admin/financeiro/fundos" className="inline-flex items-center gap-2 text-sm text-[#0f3d2e] hover:underline"><ArrowLeft className="h-4 w-4" />Voltar para fundos</Link><h1 className="mt-2 text-2xl font-semibold">{fundo.nome}</h1></div><button onClick={() => { setEditingMovement(null); setAttachments([]); setOpenModal(true); }} className="inline-flex items-center gap-2 rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white"><Plus className="h-4 w-4" />Nova Movimentação</button></div>
      <div className="flex gap-2">{(['geral', 'caixa', 'prestacao', 'relatorios'] as const).map((item) => <button key={item} className={`rounded px-3 py-2 text-sm ${tab === item ? 'bg-[#0f3d2e] text-white' : 'border'}`} onClick={() => setTab(item)}>{item === 'geral' ? 'Visão Geral' : item === 'caixa' ? 'Caixa' : item === 'prestacao' ? 'Prestação de Contas' : 'Relatórios'}</button>)}</div>
      {tab === 'geral' && <><div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"><div className="rounded-xl border bg-white p-4"><p className="text-xs">Saldo disponível</p><p className="text-lg font-semibold">{formatCurrency(metrics.saldoDisponivel)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs">Orçado</p><p className="text-lg font-semibold">{formatCurrency(metrics.orcado)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs">Gasto real</p><p className="text-lg font-semibold">{formatCurrency(metrics.gastoReal)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs">Execução %</p><p className="text-lg font-semibold">{metrics.execucao.toFixed(1)}%</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs">Comprovantes %</p><p className="text-lg font-semibold">{metrics.comprovantesPct.toFixed(1)}%</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs">Pendências</p><p className="text-lg font-semibold">{metrics.pendencias}</p></div></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="rounded-xl border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Fluxo mensal</h3><ResponsiveContainer width="100%" height={240}><LineChart data={fluxoMensal}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend /><Line dataKey="entradas" stroke="#10b981" /><Line dataKey="saidas" stroke="#ef4444" /></LineChart></ResponsiveContainer></div><div className="rounded-xl border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Orçado vs real por categoria</h3><ResponsiveContainer width="100%" height={240}><BarChart data={categoriaRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" /><YAxis /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend /><Bar dataKey="orcado" fill="#ffdd9a" /><Bar dataKey="real" fill="#0f3d2e" /></BarChart></ResponsiveContainer></div><div className="rounded-xl border bg-white p-4"><h3 className="mb-3 text-sm font-semibold">Distribuição categorias</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={categoriaRows} dataKey="real" nameKey="categoria" outerRadius={80} fill="#0f3d2e" /></PieChart></ResponsiveContainer></div></div></>}
      {tab === 'caixa' && <div className="overflow-hidden rounded-xl border bg-white"><div className="overflow-x-auto"><table className="w-full"><thead className="border-b bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs uppercase">Data</th><th className="px-4 py-3 text-left text-xs uppercase">Título</th><th className="px-4 py-3 text-left text-xs uppercase">Projeto</th><th className="px-4 py-3 text-left text-xs uppercase">Valor</th><th className="px-4 py-3 text-left text-xs uppercase">Comprovantes</th><th className="px-4 py-3 text-center text-xs uppercase">Ações</th></tr></thead><tbody>{movimentacoesFundo.map((mov) => <tr key={mov.id} className="border-b"><td className="px-4 py-3 text-sm">{formatDate(mov.data)}</td><td className="px-4 py-3 text-sm">{mov.titulo}</td><td className="px-4 py-3 text-sm">{projects.find((p) => p.id === mov.projetoId)?.nome ?? '—'}</td><td className="px-4 py-3 text-sm">{formatCurrency(mov.valorTotal)}</td><td className="px-4 py-3 text-sm">{mov.attachmentsCount || mov.comprovantes.length}</td><td className="px-4 py-3"><div className="flex justify-center gap-2"><button onClick={async () => { setEditingMovement(mov); setAttachments(await listAttachments(mov.id)); setOpenModal(true); }}><Edit className="h-4 w-4" /></button><button onClick={() => { setSelectedMovement(mov); setOpenDelete(true); }}><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table>{movimentacoesFundo.length === 0 && <p className="p-4 text-sm text-gray-500">Sem movimentações.</p>}</div></div>}
      {tab === 'prestacao' && <div className="space-y-3 rounded-xl border bg-white p-6"><p className="text-sm text-gray-600">Pendentes: {metrics.pendencias}</p><p className="text-sm text-gray-600">Sem documento: {metrics.semDocumento}</p>{movimentacoesFundo.map((mov) => <div className="flex justify-between rounded border p-3 text-sm" key={mov.id}><span>{mov.titulo} • {formatCurrency(mov.valorTotal)}</span><span>{mov.status} • {mov.attachmentsCount || mov.comprovantes.length} comprovante(s)</span></div>)}</div>}
      {tab === 'relatorios' && <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-6"><button className="rounded border px-4 py-2 text-sm" onClick={() => downloadCsv('relatorio-completo-fundo.csv', movimentacoesFundo.map((mov) => ({ data: mov.data, titulo: mov.titulo, projeto_id: mov.projetoId, categoria: mov.categoria, valor_total: mov.valorTotal, status: mov.status })))}>Relatório completo (CSV)</button><button className="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm"><FileText className="h-4 w-4" />PDF (stub)</button></div>}

      <ModalMovimentacao isOpen={openModal} onClose={() => setOpenModal(false)} editData={editingMovement} projects={projects.map((p) => ({ id: p.id, name: p.nome }))} funds={funds.map((f) => ({ id: f.id, name: f.nome }))} categories={categories} attachments={attachments} onSubmit={(payload: MovementPayload) => editingMovement ? updateMovement(editingMovement.id, payload) : createMovement({ ...payload, fund_id: id, project_id: payload.project_id || '' })} onDelete={editingMovement ? async () => { await deleteMovementCascade(editingMovement.id); setOpenModal(false); } : undefined} onUploadAttachment={async (file, movementId, payload) => uploadAttachment(file, movementId, payload.fund_id || id, payload.project_id)} onDeleteAttachment={deleteAttachment} onChanged={refreshAll} />
      <ConfirmDialog open={openDelete} title="Excluir movimentação" description="Esta ação remove movimentação e comprovantes." onCancel={() => setOpenDelete(false)} onConfirm={() => { if (selectedMovement) void deleteMovementCascade(selectedMovement.id); setOpenDelete(false); }} />
    </div>
  );
}

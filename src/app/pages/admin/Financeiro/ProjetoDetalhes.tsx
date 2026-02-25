import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Edit, FileText, Plus, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate, type FinanceiroMovimentacao } from './data/financeiro.repo';
import { useFinanceSupabase } from './hooks/useFinanceSupabase';
import { ModalMovimentacao, type MovementFormValues } from './components/ModalMovimentacao';
import { ConfirmDialog } from './components/ConfirmDialog';

const emptyMovement: MovementFormValues = { date: new Date().toISOString().slice(0, 10), type: 'saida', project_id: '', fund_id: '', title: '', description: '', unit_value: 0, quantity: 1, status: 'pendente', category_id: undefined, pay_method: 'pix', beneficiary: '', notes: '' };

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

export function ProjetoDetalhes() {
  const { id = '' } = useParams();
  const { funds, projects, movements, categories, saving, createMovement, updateMovement, deleteMovementCascade, uploadAttachment, deleteAttachment, listAttachments, getSignedUrl } = useFinanceSupabase();
  const [tab, setTab] = useState<'geral' | 'caixa' | 'prestacao' | 'relatorios'>('geral');
  const [openModal, setOpenModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [movementForm, setMovementForm] = useState<MovementFormValues>({ ...emptyMovement });

  const projeto = useMemo(() => projects.find((project) => project.id === id) ?? null, [projects, id]);
  const movimentacoesProjeto = useMemo(() => movements.filter((mov) => mov.projetoId === id), [movements, id]);

  const metrics = useMemo(() => {
    const orcado = projeto?.totalOrcado || 0;
    const gastoPago = movimentacoesProjeto.filter((m) => m.tipo === 'saida' && m.status === 'pago').reduce((acc, m) => acc + m.valorTotal, 0);
    const pendencias = movimentacoesProjeto.filter((m) => m.status === 'pendente').length;
    const withAttachments = movimentacoesProjeto.filter((m) => (m.attachmentsCount || m.comprovantes.length) > 0).length;
    return { saldoDisponivel: projeto?.saldoDisponivel || 0, orcado, gastoReal: gastoPago, execucao: orcado > 0 ? (gastoPago / orcado) * 100 : 0, comprovantesPct: movimentacoesProjeto.length > 0 ? (withAttachments / movimentacoesProjeto.length) * 100 : 0, pendencias, semDocumento: movimentacoesProjeto.length - withAttachments };
  }, [projeto, movimentacoesProjeto]);

  const fluxoMensal = useMemo(() => {
    const map = new Map<string, { periodo: string; entradas: number; saidas: number }>();
    movimentacoesProjeto.forEach((mov) => {
      const periodo = monthKey(mov.data);
      const current = map.get(periodo) ?? { periodo, entradas: 0, saidas: 0 };
      if (mov.tipo === 'entrada') current.entradas += mov.valorTotal;
      if (mov.tipo === 'saida') current.saidas += mov.valorTotal;
      map.set(periodo, current);
    });
    return [...map.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [movimentacoesProjeto]);

  if (!projeto) return <div className="p-8">Projeto não encontrado.</div>;

  const openCreateMovement = () => { setEditingMovement(null); setMovementForm({ ...emptyMovement, project_id: id, fund_id: projeto.fundoId }); setOpenModal(true); };
  const openEditMovement = (movement: FinanceiroMovimentacao) => { setEditingMovement(movement); setMovementForm({ date: movement.data.slice(0, 10), type: movement.tipo, project_id: movement.projetoId, fund_id: movement.fundoId, title: movement.titulo, description: movement.descricao, unit_value: movement.valorUnitario, quantity: movement.quantidade, status: movement.status, category_id: movement.categoriaId || undefined, pay_method: movement.payMethod, beneficiary: movement.beneficiary, notes: movement.notes }); setOpenModal(true); };
  const handleSaveMovement = async (files: File[]) => { const ok = editingMovement ? await updateMovement(editingMovement.id, movementForm) : await createMovement(movementForm, files); if (ok) { setOpenModal(false); setEditingMovement(null); } };

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between"><div><Link to="/admin/financeiro/projetos" className="inline-flex items-center gap-2 text-sm text-[#0f3d2e] hover:underline"><ArrowLeft className="w-4 h-4" />Voltar para projetos</Link><h1 className="text-2xl font-semibold mt-2">{projeto.nome}</h1></div><button onClick={openCreateMovement} className="inline-flex items-center gap-2 rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white"><Plus className="w-4 h-4" />Nova Movimentação</button></div>
      <div className="flex gap-2">{(['geral', 'caixa', 'prestacao', 'relatorios'] as const).map((item) => <button key={item} className={`rounded px-3 py-2 text-sm ${tab === item ? 'bg-[#0f3d2e] text-white' : 'border'}`} onClick={() => setTab(item)}>{item === 'geral' ? 'Visão Geral' : item === 'caixa' ? 'Caixa' : item === 'prestacao' ? 'Prestação de Contas' : 'Relatórios'}</button>)}</div>

      {tab === 'geral' && <><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"><div className="bg-white rounded-xl border p-4"><p className="text-xs">Saldo disponível</p><p className="text-lg font-semibold">{formatCurrency(metrics.saldoDisponivel)}</p></div><div className="bg-white rounded-xl border p-4"><p className="text-xs">Orçado</p><p className="text-lg font-semibold">{formatCurrency(metrics.orcado)}</p></div><div className="bg-white rounded-xl border p-4"><p className="text-xs">Gasto real</p><p className="text-lg font-semibold">{formatCurrency(metrics.gastoReal)}</p></div><div className="bg-white rounded-xl border p-4"><p className="text-xs">Execução %</p><p className="text-lg font-semibold">{metrics.execucao.toFixed(1)}%</p></div><div className="bg-white rounded-xl border p-4"><p className="text-xs">Comprovantes %</p><p className="text-lg font-semibold">{metrics.comprovantesPct.toFixed(1)}%</p></div><div className="bg-white rounded-xl border p-4"><p className="text-xs">Pendências</p><p className="text-lg font-semibold">{metrics.pendencias}</p></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="bg-white rounded-xl border p-4"><h3 className="mb-3 text-sm font-semibold">Fluxo mensal</h3><ResponsiveContainer width="100%" height={240}><LineChart data={fluxoMensal}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Line dataKey="entradas" stroke="#10b981" /><Line dataKey="saidas" stroke="#ef4444" /></LineChart></ResponsiveContainer></div><div className="bg-white rounded-xl border p-4"><h3 className="mb-3 text-sm font-semibold">Real por categoria</h3><ResponsiveContainer width="100%" height={240}><BarChart data={movimentacoesProjeto}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" /><YAxis /><Tooltip formatter={(value: number) => formatCurrency(value as number)} /><Legend /><Bar dataKey="valorTotal" fill="#0f3d2e" /></BarChart></ResponsiveContainer></div></div></>}

      {tab === 'caixa' && <div className="bg-white rounded-xl border overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs uppercase">Data</th><th className="px-4 py-3 text-left text-xs uppercase">Título</th><th className="px-4 py-3 text-left text-xs uppercase">Fundo</th><th className="px-4 py-3 text-left text-xs uppercase">Valor</th><th className="px-4 py-3 text-left text-xs uppercase">Comprovantes</th><th className="px-4 py-3 text-center text-xs uppercase">Ações</th></tr></thead><tbody>{movimentacoesProjeto.map((mov) => <tr key={mov.id} className="border-b"><td className="px-4 py-3 text-sm">{formatDate(mov.data)}</td><td className="px-4 py-3 text-sm">{mov.titulo}</td><td className="px-4 py-3 text-sm">{funds.find((f) => f.id === mov.fundoId)?.nome ?? '—'}</td><td className="px-4 py-3 text-sm">{formatCurrency(mov.valorTotal)}</td><td className="px-4 py-3 text-sm">{mov.attachmentsCount || mov.comprovantes.length}</td><td className="px-4 py-3"><div className="flex justify-center gap-2"><button onClick={() => openEditMovement(mov)}><Edit className="w-4 h-4" /></button><button onClick={() => { setSelectedMovement(mov); setOpenDelete(true); }}><Trash2 className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>{movimentacoesProjeto.length === 0 && <p className="p-4 text-sm text-gray-500">Sem movimentações.</p>}</div></div>}

      {tab === 'prestacao' && <div className="bg-white rounded-xl border p-6 space-y-3"><p className="text-sm text-gray-600">Pendentes: {metrics.pendencias}</p><p className="text-sm text-gray-600">Sem documento: {metrics.semDocumento}</p>{movimentacoesProjeto.map((mov) => <div className="border rounded p-3 text-sm flex justify-between" key={mov.id}><span>{mov.titulo} • {formatCurrency(mov.valorTotal)}</span><span>{mov.status} • {mov.attachmentsCount || mov.comprovantes.length} comprovante(s)</span></div>)}</div>}
      {tab === 'relatorios' && <div className="bg-white rounded-xl border p-6 flex gap-3 flex-wrap"><button className="rounded border px-4 py-2 text-sm" onClick={() => downloadCsv('relatorio-completo-projeto.csv', movimentacoesProjeto.map((mov) => ({ data: mov.data, titulo: mov.titulo, projeto_id: mov.projetoId, categoria: mov.categoria, valor_total: mov.valorTotal, status: mov.status })))}>Relatório completo (CSV)</button><button className="rounded border px-4 py-2 text-sm inline-flex items-center gap-2"><FileText className="w-4 h-4" />PDF (stub)</button></div>}

      <ModalMovimentacao open={openModal} title={editingMovement ? 'Editar movimentação' : 'Nova movimentação'} movementId={editingMovement?.id} saving={saving} form={movementForm} funds={funds} projects={projects} categories={categories} onChange={setMovementForm} onClose={() => setOpenModal(false)} onSubmit={handleSaveMovement} listAttachments={listAttachments} onUploadAttachment={uploadAttachment} onDeleteAttachment={deleteAttachment} getSignedUrl={getSignedUrl} />
      <ConfirmDialog open={openDelete} title="Excluir movimentação" description="Esta ação remove movimentação e comprovantes." onCancel={() => setOpenDelete(false)} onConfirm={() => { if (selectedMovement) void deleteMovementCascade(selectedMovement.id); setOpenDelete(false); }} />
    </div>
  );
}

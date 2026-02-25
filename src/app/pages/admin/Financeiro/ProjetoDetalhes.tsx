import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Edit, FileText, Plus, Trash2 } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, formatDate, type FinanceiroMovimentacao } from './data/financeiro.repo';
import { useFinanceSupabase } from './hooks/useFinanceSupabase';
import { ModalMovimentacao, type MovementFormValues } from './components/ModalMovimentacao';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ComprovantesDialog } from './components/ComprovantesDialog';

const emptyMovement: MovementFormValues = {
  date: new Date().toISOString().slice(0, 10), type: 'saida', project_id: '', fund_id: '', title: '', description: '', unit_value: 0, quantity: 1, status: 'pendente', category: '', payment_method: '', payee: '', notes: '',
};

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
  const { projects, funds, movements, error, saving, createMovement, updateMovement, deleteMovementCascade, uploadAttachment, deleteAttachment } = useFinanceSupabase();
  const [tab, setTab] = useState<'geral' | 'caixa' | 'prestacao' | 'relatorios'>('geral');
  const [openModal, setOpenModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openAttachments, setOpenAttachments] = useState(false);
  const [editingMovement, setEditingMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<FinanceiroMovimentacao | null>(null);
  const [movementForm, setMovementForm] = useState<MovementFormValues>({ ...emptyMovement });

  const projeto = useMemo(() => projects.find((item) => item.id === id) ?? null, [projects, id]);
  const movimentacoesProjeto = useMemo(() => movements.filter((item) => item.projetoId === id), [movements, id]);

  if (!projeto) return <div className="p-8">Projeto não encontrado.</div>;

  const openCreateMovement = () => {
    setEditingMovement(null);
    setMovementForm({ ...emptyMovement, project_id: id, fund_id: projeto.fundoId });
    setOpenModal(true);
  };

  const openEditMovement = (movement: FinanceiroMovimentacao) => {
    setEditingMovement(movement);
    setMovementForm({
      date: String(movement.data).slice(0, 10), type: movement.tipo, project_id: movement.projetoId, fund_id: movement.fundoId, title: movement.titulo, description: movement.descricao, unit_value: movement.valorUnitario || movement.valorTotal, quantity: movement.quantidade || 1, status: movement.status, category: movement.categoria, payment_method: movement.paymentMethod, payee: movement.payee, notes: movement.notes,
    });
    setOpenModal(true);
  };

  const handleSaveMovement = async () => {
    const ok = editingMovement ? await updateMovement(editingMovement.id, movementForm) : await createMovement(movementForm);
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
          <div><div className="flex items-center gap-3"><h1 className="text-2xl font-semibold text-gray-900">{projeto.nome}</h1><StatusBadge status={projeto.status} size="md" /></div><p className="text-sm text-gray-600">Fundo: {projeto.fundo || '—'}</p></div>
          <button onClick={openCreateMovement} className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg"><Plus className="w-4 h-4" />Nova Movimentação</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setTab('geral')} className="px-3 py-1 text-sm">Visão Geral</button>
        <button onClick={() => setTab('caixa')} className="px-3 py-1 text-sm">Caixa</button>
        <button onClick={() => setTab('prestacao')} className="px-3 py-1 text-sm">Prestação de Contas</button>
        <button onClick={() => setTab('relatorios')} className="px-3 py-1 text-sm">Relatórios</button>
      </div>

      {tab === 'geral' && <div className="grid grid-cols-1 md:grid-cols-4 gap-6"><div className="bg-white rounded-xl border p-6"><p className="text-sm">Saldo Disponível</p><p className="text-2xl font-semibold">{formatCurrency(Number(projeto.saldoDisponivel) || 0)}</p></div><div className="bg-white rounded-xl border p-6"><p className="text-sm">Total Orçado</p><p className="text-2xl font-semibold">{formatCurrency(Number(projeto.totalOrcado) || 0)}</p></div><div className="bg-white rounded-xl border p-6"><p className="text-sm">Gasto Real</p><p className="text-2xl font-semibold">{formatCurrency(Number(projeto.gastoReal) || 0)}</p></div><div className="bg-white rounded-xl border p-6"><p className="text-sm">Execução</p><p className="text-2xl font-semibold">{Number(projeto.execucao) || 0}%</p></div></div>}

      {tab === 'caixa' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs uppercase">Data</th><th className="px-4 py-3 text-left text-xs uppercase">Título</th><th className="px-4 py-3 text-left text-xs uppercase">Fundo</th><th className="px-4 py-3 text-left text-xs uppercase">Valor</th><th className="px-4 py-3 text-left text-xs uppercase">Comprovantes</th><th className="px-4 py-3 text-center text-xs uppercase">Ações</th></tr></thead>
              <tbody>
                {movimentacoesProjeto.map((mov) => (
                  <tr key={mov.id} className="border-b"><td className="px-4 py-3 text-sm">{formatDate(mov.data)}</td><td className="px-4 py-3 text-sm">{mov.titulo}</td><td className="px-4 py-3 text-sm">{funds.find((f) => f.id === mov.fundoId)?.nome ?? '—'}</td><td className="px-4 py-3 text-sm">{formatCurrency(mov.valorTotal)}</td><td className="px-4 py-3 text-sm">{mov.comprovantes.length} <button className="text-[#0f3d2e] underline" onClick={() => { setSelectedMovement(mov); setOpenAttachments(true); }}>Comprovantes</button></td><td className="px-4 py-3"><div className="flex justify-center gap-2"><button onClick={() => openEditMovement(mov)}><Edit className="w-4 h-4" /></button><button onClick={() => { setSelectedMovement(mov); setOpenDelete(true); }}><Trash2 className="w-4 h-4" /></button></div></td></tr>
                ))}
              </tbody>
            </table>
            {movimentacoesProjeto.length === 0 && <p className="p-4 text-sm text-gray-500">Sem movimentações.</p>}
          </div>
        </div>
      )}

      {tab === 'prestacao' && <div className="bg-white rounded-xl border p-6"><p className="text-sm text-gray-600">Pendentes: {movimentacoesProjeto.filter((mov) => mov.status !== 'pago').length}</p></div>}
      {tab === 'relatorios' && (
        <div className="bg-white rounded-xl border p-6 flex gap-3">
          <button className="rounded border px-4 py-2 text-sm" onClick={() => downloadCsv('relatorio-completo-projeto.csv', movimentacoesProjeto.map((mov) => ({ data: mov.data, titulo: mov.titulo, categoria: mov.categoria, fundo_id: mov.fundoId, valor_total: mov.valorTotal, status: mov.status })))}>Relatório completo (CSV)</button>
          <button className="rounded border px-4 py-2 text-sm" onClick={() => downloadCsv('relatorio-por-categoria-projeto.csv', Object.entries(movimentacoesProjeto.reduce((acc, mov) => ({ ...acc, [mov.categoria || 'Sem categoria']: (acc[mov.categoria || 'Sem categoria'] || 0) + mov.valorTotal }), {} as Record<string, number>)).map(([categoria, total]) => ({ categoria, total })))}>Por categoria (CSV)</button>
          <button className="rounded border px-4 py-2 text-sm inline-flex items-center gap-2"><FileText className="w-4 h-4" />PDF (placeholder)</button>
        </div>
      )}

      <ModalMovimentacao open={openModal} title={editingMovement ? 'Editar movimentação' : 'Nova movimentação'} saving={saving} form={movementForm} funds={funds} projects={projects} onChange={setMovementForm} onClose={() => setOpenModal(false)} onSubmit={handleSaveMovement} />
      <ConfirmDialog open={openDelete} title="Excluir movimentação" description="Esta ação remove movimentação e comprovantes." onCancel={() => setOpenDelete(false)} onConfirm={() => { if (selectedMovement) void deleteMovementCascade(selectedMovement.id); setOpenDelete(false); }} />
      <ComprovantesDialog open={openAttachments} movement={selectedMovement} saving={saving} onUpload={uploadAttachment} onDelete={deleteAttachment} onClose={() => setOpenAttachments(false)} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Edit, Paperclip, Trash2 } from 'lucide-react';
import { useFinanceSupabase } from './hooks/useFinanceSupabase';
import { formatCurrency, formatDate } from './figma/data/financeiro-data';
import { StatusBadge } from './figma/components/StatusBadge';
import { ModalMovimentacao } from './figma/components/ModalMovimentacao';
import { ConfirmDialog } from './components/ConfirmDialog';
import { toast } from 'sonner';

export function FinanceiroMovimentacoes() {
  const [params, setParams] = useSearchParams();
  const [movements, setMovements] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<any>(null);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  const { pathname } = useLocation();

  const pathFilters = useMemo(() => {
    if (pathname.endsWith('/movimentacoes/entrada')) return { type: 'entrada' as const };
    if (pathname.endsWith('/movimentacoes/saida')) return { type: 'saida' as const };
    if (pathname.endsWith('/movimentacoes/pendencias')) return { status: 'pendente' as const };
    return {};
  }, [pathname]);

  const {
    listMovements,
    listFunds,
    listProjects,
    listAttachments,
    listAttachmentsForMovements,
    createMovement,
    updateMovement,
    deleteMovement,
    uploadAttachment,
    deleteAttachment,
  } = useFinanceSupabase();

  const filters = useMemo(
    () => ({
      status: params.get('status') || pathFilters.status,
      type: (params.get('type') as 'entrada' | 'saida' | null) || pathFilters.type,
      dateFrom: params.get('dateFrom') || undefined,
      dateTo: params.get('dateTo') || undefined,
      search: params.get('q') || undefined,
    }),
    [params, pathFilters.status, pathFilters.type],
  );

  const load = async () => {
    const [movs, fundRows, projectRows] = await Promise.all([listMovements(filters), listFunds(), listProjects()]);
    setMovements(movs || []);
    setFunds(fundRows || []);
    setProjects(projectRows || []);

    const rows = await listAttachmentsForMovements((movs || []).map((mov) => mov.id));
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.movement_id] = (acc[row.movement_id] || 0) + 1;
      return acc;
    }, {});
    setAttachmentCounts(counts);
  };

  useEffect(() => {
    void load();
  }, [filters.status, filters.type, filters.dateFrom, filters.dateTo, filters.search]);

  useEffect(() => {
    const loadAttachmentList = async () => {
      if (!editing?.id) {
        setAttachments([]);
        return;
      }
      const list = await listAttachments(editing.id);
      setAttachments(list || []);
    };

    void loadAttachmentList();
  }, [editing?.id]);

  const fundMap = new Map(funds.map((fund) => [fund.id, fund.name]));
  const projectMap = new Map(projects.map((project) => [project.id, project.name]));

  const setFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mb-6">
        <Link to="/admin/financeiro" className="text-sm text-[#0f3d2e] hover:underline font-medium">← Voltar para Financeiro</Link>
        <h1 className="text-3xl font-semibold text-gray-900 mt-3">Movimentações</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
        <select value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value || undefined)} className="px-3 py-2 border rounded-lg">
          <option value="">Status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select value={filters.type || ''} onChange={(e) => setFilter('type', e.target.value || undefined)} className="px-3 py-2 border rounded-lg">
          <option value="">Tipo</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
        <input type="date" value={filters.dateFrom || ''} onChange={(e) => setFilter('dateFrom', e.target.value || undefined)} className="px-3 py-2 border rounded-lg" />
        <input type="date" value={filters.dateTo || ''} onChange={(e) => setFilter('dateTo', e.target.value || undefined)} className="px-3 py-2 border rounded-lg" />
        <input type="text" placeholder="Buscar..." value={filters.search || ''} onChange={(e) => setFilter('q', e.target.value || undefined)} className="px-3 py-2 border rounded-lg" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
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
            {movements.map((mov) => (
              <tr key={mov.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{formatDate(mov.date)}</td>
                <td className="px-4 py-3 text-sm capitalize">{mov.type}</td>
                <td className="px-4 py-3 text-sm">{mov.description}</td>
                <td className="px-4 py-3 text-sm">{projectMap.get(mov.project_id) || '-'} / {fundMap.get(mov.fund_id) || '-'}</td>
                <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(Number(mov.total_value || 0))}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={mov.status} /></td>
                <td className="px-4 py-3 text-center text-sm">{attachmentCounts[mov.id] || 0}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setEditing(mov)} className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg" title="Editar"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => setDeleting(mov)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(mov)} className="p-2 text-[#0f3d2e] hover:bg-[#e8f2ef] rounded-lg" title="Comprovantes"><Paperclip className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalMovimentacao
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        editData={editing || undefined}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        funds={funds.map((f) => ({ id: f.id, name: f.name }))}
        attachments={attachments}
        onSubmit={async (payload) => {
          if (editing?.id) {
            const updated = await updateMovement(editing.id, payload);
            toast.success('Movimentação atualizada com sucesso.');
            return updated;
          }
          const created = await createMovement(payload);
          toast.success('Movimentação criada com sucesso.');
          return created;
        }}
        onChanged={load}
        onDelete={async (movementId) => {
          await deleteMovement(movementId);
          setEditing(null);
          await load();
        }}
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
          const target = attachments.find((attachment) => attachment.id === attachmentId);
          if (!target) return;
          await deleteAttachment(target);
          toast.success('Comprovante excluído com sucesso.');
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
          toast.success('Movimentação excluída com sucesso.');
        }}
      />
    </div>
  );
}

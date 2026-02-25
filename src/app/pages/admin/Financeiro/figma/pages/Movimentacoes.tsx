import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, Eye, Paperclip } from "lucide-react";
import { useFinanceSupabase } from "../../hooks/useFinanceSupabase";
import { SupabaseHealth } from "../../components/SupabaseHealth";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { StatusBadge } from "../components/StatusBadge";
import { ModalMovimentacao } from "../components/ModalMovimentacao";
import { AttachmentViewerDialog } from "../../components/AttachmentViewerDialog";
import { formatCurrency, formatDate } from "../data/financeiro-data";

export function Movimentacoes() {
  const {
    listFunds,
    listProjects,
    listMovements,
    listAttachments,
    listAttachmentsForMovementIds,
    createMovement,
    updateMovement,
    deleteMovementCascade,
    uploadAttachment,
    deleteAttachment,
  } = useFinanceSupabase();

  const [funds, setFunds] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState<"" | "entrada" | "saida">("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const [attachments, setAttachments] = useState<any[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<any>(null);

  const fundMap = useMemo(() => new Map(funds.map((f) => [f.id, f.name])), [funds]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const load = async () => {
    try {
      setLoading(true);
      setFeedback("");

      const [fundsData, projectsData] = await Promise.all([listFunds(), listProjects()]);
      setFunds(fundsData || []);
      setProjects(projectsData || []);

      const list = await listMovements({
        search: q || undefined,
        status: status || undefined,
        type: type || undefined,
      });

      setRows(list || []);

      const att = await listAttachmentsForMovementIds((list || []).map((r: any) => r.id));
      const counts = att.reduce<Record<string, number>>((acc, row: any) => {
        acc[row.movement_id] = (acc[row.movement_id] || 0) + 1;
        return acc;
      }, {});
      setAttachmentCounts(counts);
    } catch (e: any) {
      setFeedback(e?.message || "Erro ao carregar movimentações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!editing?.id) {
        setAttachments([]);
        return;
      }
      const list = await listAttachments(editing.id);
      setAttachments(list || []);
    };
    void run();
  }, [editing?.id]);

  const totalIn = useMemo(
    () =>
      rows
        .filter((r) => r.status === "pago" && r.type === "entrada")
        .reduce((acc, r) => acc + Number(r.total_value || 0), 0),
    [rows]
  );

  const totalOut = useMemo(
    () =>
      rows
        .filter((r) => r.status === "pago" && r.type === "saida")
        .reduce((acc, r) => acc + Number(r.total_value || 0), 0),
    [rows]
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Movimentações</h1>
          <p className="text-sm text-gray-600">Caixa • lançamentos • anexos</p>
        </div>

        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-[#0f3d2e] px-5 py-3 text-white hover:bg-[#0a2b20]"
        >
          <Plus className="h-5 w-5" />
          Nova Movimentação
        </button>
      </div>

      {feedback ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {feedback}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-gray-600">Buscar</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="descrição…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>

        <div className="md:col-span-4 flex items-center justify-between gap-3 pt-2">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">Entradas:</span> {formatCurrency(totalIn)}{" "}
            <span className="mx-2 text-gray-300">|</span>
            <span className="font-semibold">Saídas:</span> {formatCurrency(totalOut)}
          </div>

          <button
            onClick={() => void load()}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projeto/Fundo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Anexos</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{formatDate(mov.date)}</td>
                  <td className="px-4 py-3 text-sm capitalize">{mov.type}</td>
                  <td className="px-4 py-3 text-sm">{mov.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {projectMap.get(mov.project_id) || "-"} / {fundMap.get(mov.fund_id) || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium whitespace-nowrap">
                    {formatCurrency(Number(mov.total_value || 0))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={mov.status} />
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                      {attachmentCounts[mov.id] || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setEditing(mov);
                          setModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(mov)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      {attachmentCounts[mov.id] ? (
                        <button
                          onClick={async () => {
                            const att = await (await import("../../hooks/useFinanceSupabase")).useFinanceSupabase().listAttachments(mov.id);
                            if (att?.length) setPreviewAttachment(att[0]);
                          }}
                          className="p-2 rounded-lg hover:bg-[#e8f2ef] text-[#0f3d2e]"
                          title="Ver comprovante"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-600">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              ) : null}
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
        onSubmit={async (payload) => (editing?.id ? updateMovement(editing.id, payload) : createMovement(payload))}
        onDelete={async () => {
          if (editing?.id) await deleteMovementCascade(editing);
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
          if (editing?.id) setAttachments(await listAttachments(editing.id));
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
          await deleteMovementCascade(deleting);
          setDeleting(null);
          await load();
        }}
      />

      <AttachmentViewerDialog open={Boolean(previewAttachment)} attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
}

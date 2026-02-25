import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Upload,
  FileText,
  Download,
  Trash2,
  Loader2,
  Save,
} from "lucide-react";

type Option = { id: string; name: string };

type MovementPayload = {
  date: string;
  type: "entrada" | "saida";
  project_id?: string | null;
  fund_id?: string | null;
  description: string;
  category?: string | null;
  category_id?: string | null;

  unit_value?: number;
  quantity?: number;
  total_value?: number;

  status?: string;

  cost_center?: string | null;
  payment_method?: string | null;
  payee?: string | null;

  document_type?: string | null;
  document_number?: string | null;

  notes?: string | null;
};

type AttachmentRow = {
  id: string;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;

  // Se você tiver URL pública no banco, pode existir:
  public_url?: string | null;

  // Se você usa storage path (recomendado):
  storage_path?: string | null;

  created_at?: string | null;
};

interface ModalMovimentacaoProps {
  isOpen: boolean;
  onClose: () => void;

  editData?: any;

  projects: Option[];
  funds: Option[];

  attachments: AttachmentRow[];

  // Deve retornar a movimentação (com id) quando criar/editar
  onSubmit: (payload: MovementPayload) => Promise<any>;

  // Excluir a movimentação atual (quando em edição)
  onDelete: () => Promise<void>;

  // Recarrega dashboard/listas
  onChanged: () => void;

  // Upload de anexos (file + movementId + payload pra montar path)
  onUploadAttachment: (
    file: File,
    movementId: string,
    payload: MovementPayload
  ) => Promise<void>;

  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}

const money = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function ModalMovimentacao({
  isOpen,
  onClose,
  editData,
  projects,
  funds,
  attachments,
  onSubmit,
  onDelete,
  onChanged,
  onUploadAttachment,
  onDeleteAttachment,
}: ModalMovimentacaoProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [form, setForm] = useState<MovementPayload>(() => ({
    date: editData?.date ?? "",
    type: (editData?.type ?? "saida") as "entrada" | "saida",
    project_id: editData?.project_id ?? null,
    fund_id: editData?.fund_id ?? null,
    description: editData?.description ?? "",
    category: editData?.category ?? "",
    category_id: editData?.category_id ?? null,
    unit_value: editData?.unit_value ?? 0,
    quantity: editData?.quantity ?? 1,
    total_value: editData?.total_value ?? 0,
    status: editData?.status ?? "pendente",
    cost_center: editData?.cost_center ?? "",
    payment_method: editData?.payment_method ?? "",
    payee: editData?.payee ?? "",
    document_type: editData?.document_type ?? "CPF",
    document_number: editData?.document_number ?? "",
    notes: editData?.notes ?? "",
  }));

  // Mantém o form sincronizado quando trocar editData (abrir outro item etc.)
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg("");
    setSaving(false);
    setDeleting(false);
    setUploading(false);

    setForm({
      date: editData?.date ?? "",
      type: (editData?.type ?? "saida") as "entrada" | "saida",
      project_id: editData?.project_id ?? null,
      fund_id: editData?.fund_id ?? null,
      description: editData?.description ?? "",
      category: editData?.category ?? "",
      category_id: editData?.category_id ?? null,
      unit_value: toNumber(editData?.unit_value ?? 0),
      quantity: toNumber(editData?.quantity ?? 1) || 1,
      total_value: toNumber(editData?.total_value ?? 0),
      status: editData?.status ?? "pendente",
      cost_center: editData?.cost_center ?? "",
      payment_method: editData?.payment_method ?? "",
      payee: editData?.payee ?? "",
      document_type: editData?.document_type ?? "CPF",
      document_number: editData?.document_number ?? "",
      notes: editData?.notes ?? "",
    });
  }, [editData, isOpen]);

  const total = useMemo(() => {
    const unit = toNumber(form.unit_value);
    const qty = Math.max(1, toNumber(form.quantity));
    return unit * qty;
  }, [form.unit_value, form.quantity]);

  // Sempre mantém total_value coerente (sem “loop” infinito)
  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev, quantity: Math.max(1, toNumber(prev.quantity)) };
      const computed = toNumber(next.unit_value) * Math.max(1, toNumber(next.quantity));
      if (toNumber(next.total_value) === computed) return prev;
      return { ...next, total_value: computed };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.unit_value, form.quantity]);

  const canUpload = Boolean(editData?.id); // precisa do movementId

  const validate = () => {
    if (!form.date) return "Informe a data.";
    if (!form.type) return "Informe o tipo.";
    if (!form.project_id) return "Selecione um projeto.";
    if (!form.fund_id) return "Selecione um fundo.";
    if (!form.description?.trim()) return "Informe a descrição.";
    // categoria pode ser opcional, mas se quiser obrigar:
    // if (!form.category?.trim() && !form.category_id) return "Informe a categoria.";
    if (toNumber(form.unit_value) <= 0) return "Informe um valor unitário válido.";
    if (Math.max(1, toNumber(form.quantity)) <= 0) return "Informe uma quantidade válida.";
    if (!form.status) return "Informe o status.";
    if (!form.payee?.trim()) return "Informe o favorecido.";
    return "";
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg("");

    const msg = validate();
    if (msg) {
      setErrorMsg(msg);
      return;
    }

    setSaving(true);
    try {
      const payload: MovementPayload = {
        ...form,
        quantity: Math.max(1, toNumber(form.quantity)),
        unit_value: toNumber(form.unit_value),
        total_value: total,
      };

      const saved = await onSubmit(payload);

      // Se foi criação, a tela “pai” geralmente recarrega e abre em edição na sequência.
      // Aqui a gente só dispara onChanged e fecha.
      onChanged();
      onClose();
      return saved;
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar movimentação.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editData?.id) return;
    setErrorMsg("");
    setDeleting(true);
    try {
      await onDelete();
      onChanged();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao excluir movimentação.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePickFiles = () => {
    if (!canUpload) {
      setErrorMsg("Salve a movimentação primeiro para anexar comprovantes.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!editData?.id) {
      setErrorMsg("Salve a movimentação antes de anexar.");
      return;
    }

    setErrorMsg("");
    setUploading(true);
    try {
      const payload: MovementPayload = {
        ...form,
        quantity: Math.max(1, toNumber(form.quantity)),
        unit_value: toNumber(form.unit_value),
        total_value: total,
      };

      // sobe 1 a 1 (mais seguro e dá pra tratar erro por arquivo)
      for (const file of Array.from(files)) {
        await onUploadAttachment(file, editData.id, payload);
      }

      onChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao enviar anexos.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20]">
          <h2 className="text-xl font-semibold text-white">
            {editData?.id ? "Editar Movimentação" : "Nova Movimentação"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Fechar"
            type="button"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Error */}
        {errorMsg ? (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.date || ""}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, type: e.target.value as any }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>

            {/* Projeto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projeto <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.project_id || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, project_id: e.target.value || null }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="">Selecione um projeto</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fundo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fundo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.fund_id || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fund_id: e.target.value || null }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="">Selecione um fundo</option>
                {funds.map((fundo) => (
                  <option key={fundo.id} value={fundo.id}>
                    {fundo.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria (texto simples) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <input
                type="text"
                value={form.category || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
                placeholder="Ex: DESPESA DE PESSOAL"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                (Se você usar category_id em outro lugar, você pode trocar esse campo por um select.)
              </p>
            </div>

            {/* Descrição */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.description || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Descrição da movimentação"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Valor Unitário */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Unitário <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={String(form.unit_value ?? 0)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, unit_value: toNumber(e.target.value) }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantidade <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={String(form.quantity ?? 1)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, quantity: Math.max(1, toNumber(e.target.value)) }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Total */}
            <div className="md:col-span-2 p-4 bg-[#ffdd9a]/10 rounded-lg border border-[#ffdd9a]">
              <p className="text-lg font-semibold text-gray-900">
                Valor Total: R$ {money(total)}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.status || "pendente"}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Favorecido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Favorecido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.payee || ""}
                onChange={(e) => setForm((p) => ({ ...p, payee: e.target.value }))}
                placeholder="Nome do favorecido"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Método de pagamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forma de Pagamento
              </label>
              <input
                type="text"
                value={form.payment_method || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_method: e.target.value }))
                }
                placeholder="Pix, Cartão, Boleto..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Centro de custo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Centro de Custo
              </label>
              <input
                type="text"
                value={form.cost_center || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cost_center: e.target.value }))
                }
                placeholder="Ex: Comunicação, Logística..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Tipo Doc */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Documento
              </label>
              <select
                value={form.document_type || "CPF"}
                onChange={(e) =>
                  setForm((p) => ({ ...p, document_type: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="RG">RG</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>

            {/* Número Doc */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do Documento
              </label>
              <input
                type="text"
                value={form.document_number || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, document_number: e.target.value }))
                }
                placeholder="000.000.000-00 / 00.000.000/0000-00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={form.notes || ""}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Observações adicionais..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent resize-none"
              />
            </div>

            {/* Comprovantes */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Comprovantes
                </label>

                <button
                  type="button"
                  onClick={handlePickFiles}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  title={!canUpload ? "Salve a movimentação antes" : "Enviar anexos"}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Enviar
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />
              </div>

              {!canUpload ? (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Para anexar comprovantes, primeiro clique em <b>Salvar</b>.
                </div>
              ) : null}

              {/* Lista anexos */}
              {attachments?.length ? (
                <div className="mt-4 space-y-2">
                  {attachments.map((att) => {
                    const fileName = att.file_name || "Arquivo";
                    const href = att.public_url || ""; // se existir
                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">
                            {fileName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Download só se tiver public_url.
                              Se você usa signedUrl no Viewer, o download/preview pode ser por lá. */}
                          <a
                            href={href || undefined}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className={`p-2 rounded-lg transition-colors ${
                              href ? "hover:bg-gray-200" : "opacity-40 pointer-events-none"
                            }`}
                            title={href ? "Baixar" : "Baixar indisponível (sem public_url)"}
                          >
                            <Download className="w-4 h-4 text-gray-600" />
                          </a>

                          <button
                            type="button"
                            onClick={() => onDeleteAttachment(att.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir anexo"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500">
                  Nenhum comprovante anexado.
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {editData?.id ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={saving || deleting || uploading}
            >
              Cancelar
            </button>

            <button
              type="submit"
              onClick={(e) => void handleSave(e as any)}
              disabled={saving || deleting}
              className="inline-flex items-center gap-2 px-6 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editData?.id ? "Salvar Alterações" : "Criar Movimentação"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

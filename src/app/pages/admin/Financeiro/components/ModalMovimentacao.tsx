import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Files, Upload, X } from 'lucide-react';
import type { FinanceAttachment, FinanceiroMovimentacao } from '../data/financeiro.repo';
import type { FinanceCategory, MovementPayload } from '../hooks/useFinanceSupabase';
import { AttachmentViewerDialog } from './AttachmentViewerDialog';

type SimpleItem = { id: string; name: string; fundId?: string };

type MemberItem = { id: string; name: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editData?: FinanceiroMovimentacao | null;
  projects: SimpleItem[];
  funds: SimpleItem[];
  categories: FinanceCategory[];
  members?: MemberItem[];
  attachments: FinanceAttachment[];
  onSubmit: (payload: MovementPayload) => Promise<{ id?: string } | void>;
  onDelete?: () => Promise<void>;
  onUploadAttachment: (file: File, context: { movementId: string; fundId?: string; projectId?: string }) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onViewAttachment: (attachment: FinanceAttachment) => Promise<string>;
  onChanged: () => Promise<void>;
};

const payMethods: { value: MovementPayload['pay_method']; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

const makeInitial = (movement?: FinanceiroMovimentacao | null): MovementPayload => ({
  date: movement?.data?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  type: movement?.tipo || 'saida',
  project_id: movement?.projetoId || '',
  fund_id: movement?.fundoId || '',
  title: movement?.titulo || '',
  description: movement?.descricao || '',
  unit_value: movement?.valorUnitario || 0,
  quantity: movement?.quantidade || 1,
  total_value: movement?.valorTotal || 0,
  status: movement?.status || 'pendente',
  category_id: movement?.categoriaId || undefined,
  pay_method: movement?.payMethod || 'pix',
  beneficiary: movement?.beneficiary || '',
  notes: movement?.notes || '',
  doc_type: movement?.docType || '',
  doc_number: movement?.docNumber || '',
  cost_center: movement?.costCenter || '',
});

export function ModalMovimentacao({ isOpen, onClose, editData, projects, funds, categories, members = [], attachments, onSubmit, onDelete, onUploadAttachment, onDeleteAttachment, onViewAttachment, onChanged }: Props) {
  const [form, setForm] = useState<MovementPayload>(makeInitial(editData));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [openAttachments, setOpenAttachments] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(makeInitial(editData));
      setErrorMsg(null);
      setSelectedFiles([]);
    }
  }, [isOpen, editData]);

  const fundProjects = useMemo(
    () => (form.fund_id ? projects.filter((project) => !project.fundId || project.fundId === form.fund_id) : projects),
    [projects, form.fund_id],
  );

  const totalValue = (Number(form.unit_value) || 0) * (Number(form.quantity) || 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      if (!form.fund_id && !form.project_id) throw new Error('Selecione ao menos um fundo ou projeto.');
      const payload: MovementPayload = { ...form, total_value: totalValue };
      const result = await onSubmit(payload);
      const movementId = editData?.id || result?.id;

      if (movementId && selectedFiles.length > 0) {
        await Promise.all(selectedFiles.map((file) => onUploadAttachment(file, { movementId, fundId: payload.fund_id, projectId: payload.project_id })));
      }

      await onChanged();
      onClose();
    } catch (error) {
      setErrorMsg((error as Error).message || 'Erro ao salvar movimentação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await onDeleteAttachment(attachmentId);
      await onChanged();
    } catch (error) {
      setErrorMsg((error as Error).message || 'Erro ao excluir comprovante.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[95vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editData ? 'Editar movimentação' : 'Nova movimentação'}</h2>
            <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </div>

          {errorMsg && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</div>}

          <form className="grid grid-cols-2 gap-3" onSubmit={handleSubmit}>
            <input required type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
            <select required value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as MovementPayload['type'] }))} className="rounded border px-3 py-2 text-sm"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>

            <select value={form.fund_id || ''} onChange={(e) => setForm((prev) => ({ ...prev, fund_id: e.target.value, project_id: '' }))} className="rounded border px-3 py-2 text-sm"><option value="">Fundo</option>{funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name}</option>)}</select>
            <select value={form.project_id || ''} onChange={(e) => setForm((prev) => ({ ...prev, project_id: e.target.value }))} className="rounded border px-3 py-2 text-sm"><option value="">Projeto</option>{fundProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>

            <input required value={form.title || ''} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Título" className="rounded border px-3 py-2 text-sm" />
            <input required value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descrição" className="rounded border px-3 py-2 text-sm" />

            <input required min={0} step="0.01" type="number" value={form.unit_value} onChange={(e) => setForm((prev) => ({ ...prev, unit_value: Number(e.target.value) }))} placeholder="Valor unitário" className="rounded border px-3 py-2 text-sm" />
            <input required min={1} step="0.01" type="number" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} placeholder="Quantidade" className="rounded border px-3 py-2 text-sm" />

            <div className="rounded border bg-gray-50 px-3 py-2 text-sm">Total: <strong>{totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
            <select required value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as MovementPayload['status'] }))} className="rounded border px-3 py-2 text-sm"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select>

            <select required value={form.category_id || ''} onChange={(e) => setForm((prev) => ({ ...prev, category_id: e.target.value || undefined }))} className="rounded border px-3 py-2 text-sm"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <select required value={form.pay_method} onChange={(e) => setForm((prev) => ({ ...prev, pay_method: e.target.value as MovementPayload['pay_method'] }))} className="rounded border px-3 py-2 text-sm">{payMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>

            <input required list="beneficiarios-list" value={form.beneficiary || ''} onChange={(e) => setForm((prev) => ({ ...prev, beneficiary: e.target.value }))} placeholder="Favorecido" className="rounded border px-3 py-2 text-sm" />
            <input value={form.cost_center || ''} onChange={(e) => setForm((prev) => ({ ...prev, cost_center: e.target.value }))} placeholder="Centro de custo" className="rounded border px-3 py-2 text-sm" />
            <input value={form.doc_type || ''} onChange={(e) => setForm((prev) => ({ ...prev, doc_type: e.target.value }))} placeholder="Tipo de documento" className="rounded border px-3 py-2 text-sm" />
            <input value={form.doc_number || ''} onChange={(e) => setForm((prev) => ({ ...prev, doc_number: e.target.value }))} placeholder="Número do documento" className="rounded border px-3 py-2 text-sm" />
            <textarea required value={form.notes || ''} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Observações" className="col-span-2 rounded border px-3 py-2 text-sm" />


            {members.length > 0 && <datalist id="beneficiarios-list">{members.map((member) => <option key={member.id} value={member.name} />)}</datalist>}
            <div className="col-span-2 space-y-3 rounded border p-3">
              <p className="text-sm font-medium">Comprovantes</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
                <Upload className="h-4 w-4" /> Selecionar arquivo(s)
                <input className="hidden" multiple type="file" accept="application/pdf,image/png,image/jpeg,image/jpg" onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
              </label>
              {selectedFiles.length > 0 && <p className="text-xs text-gray-500">{selectedFiles.length} arquivo(s): {selectedFiles.map((file) => file.name).join(', ')}</p>}

              <div className="flex items-center justify-between rounded border bg-gray-50 px-3 py-2 text-sm">
                <span>{attachments.length} comprovante(s) já anexado(s)</span>
                <button disabled={attachments.length === 0} type="button" onClick={() => setOpenAttachments(true)} className="inline-flex items-center gap-2 rounded border px-2 py-1 disabled:opacity-50"><Files className="h-4 w-4" />Ver anexos</button>
              </div>
            </div>

            <div className="col-span-2 flex justify-between gap-2 pt-2">
              <div>{onDelete && editData && <button type="button" onClick={() => { void onDelete(); }} className="rounded border border-red-300 px-4 py-2 text-sm text-red-700">Excluir</button>}</div>
              <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} type="submit" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button></div>
            </div>
          </form>
        </div>
      </div>
      <AttachmentViewerDialog
        open={openAttachments}
        attachments={attachments}
        loading={saving}
        error={errorMsg}
        onClose={() => setOpenAttachments(false)}
        onView={onViewAttachment}
        onDelete={handleDeleteAttachment}
      />
    </>
  );
}

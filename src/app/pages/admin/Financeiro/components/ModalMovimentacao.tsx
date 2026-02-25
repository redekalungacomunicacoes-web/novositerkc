import { useEffect, useMemo, useState } from 'react';
import { Eye, Paperclip, Trash2, Upload, X } from 'lucide-react';
import type { FinanceAttachment, FinanceiroFundo, FinanceiroProjeto } from '../data/financeiro.repo';
import type { FinanceCategory, MovementPayload } from '../hooks/useFinanceSupabase';
import { AttachmentViewerDialog } from './AttachmentViewerDialog';

export type MovementFormValues = MovementPayload;

type Props = {
  open: boolean;
  title: string;
  movementId?: string;
  saving?: boolean;
  form: MovementFormValues;
  funds: FinanceiroFundo[];
  projects: FinanceiroProjeto[];
  categories: FinanceCategory[];
  onChange: (next: MovementFormValues) => void;
  onClose: () => void;
  onSubmit: (files: File[]) => void;
  listAttachments: (movementId: string) => Promise<FinanceAttachment[]>;
  onUploadAttachment: (movementId: string, file: File, context?: { fundId?: string; projectId?: string }) => Promise<void>;
  onDeleteAttachment: (attachment: FinanceAttachment) => Promise<unknown>;
  getSignedUrl: (storagePath: string) => Promise<string>;
};

const payMethods: { value: MovementPayload['pay_method']; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

export function ModalMovimentacao({ open, title, movementId, saving = false, form, funds, projects, categories, onChange, onClose, onSubmit, listAttachments, onUploadAttachment, onDeleteAttachment, getSignedUrl }: Props) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<FinanceAttachment | null>(null);

  const fundProjects = useMemo(
    () => projects.filter((project) => !form.fund_id || project.fundoId === form.fund_id),
    [projects, form.fund_id],
  );

  useEffect(() => {
    if (!open || !movementId) {
      setAttachments([]);
      return;
    }
    void listAttachments(movementId).then(setAttachments);
  }, [open, movementId, listAttachments]);

  if (!open) return null;

  const total = (Number(form.unit_value) || 0) * (Number(form.quantity) || 0);

  const refreshAttachments = async () => {
    if (!movementId) return;
    const list = await listAttachments(movementId);
    setAttachments(list);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[95vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </div>

          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(pendingFiles); }}>
            <input required type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })} className="rounded border px-3 py-2 text-sm" />
            <select required value={form.type} onChange={(e) => onChange({ ...form, type: e.target.value as MovementPayload['type'] })} className="rounded border px-3 py-2 text-sm"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>

            <select required value={form.fund_id} onChange={(e) => onChange({ ...form, fund_id: e.target.value, project_id: '' })} className="rounded border px-3 py-2 text-sm"><option value="">Fundo</option>{funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.nome}</option>)}</select>
            <select required value={form.project_id || ''} onChange={(e) => onChange({ ...form, project_id: e.target.value })} className="rounded border px-3 py-2 text-sm"><option value="">Projeto</option>{fundProjects.map((project) => <option key={project.id} value={project.id}>{project.nome}</option>)}</select>

            <input required value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} placeholder="Título" className="rounded border px-3 py-2 text-sm" />
            <input required value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} placeholder="Descrição" className="rounded border px-3 py-2 text-sm" />

            <input required min={0} type="number" value={form.unit_value} onChange={(e) => onChange({ ...form, unit_value: Number(e.target.value) })} placeholder="Valor unitário" className="rounded border px-3 py-2 text-sm" />
            <input required min={1} type="number" value={form.quantity} onChange={(e) => onChange({ ...form, quantity: Number(e.target.value) })} placeholder="Quantidade" className="rounded border px-3 py-2 text-sm" />

            <div className="rounded border bg-gray-50 px-3 py-2 text-sm">Total: <strong>{total.toFixed(2)}</strong></div>
            <select required value={form.status} onChange={(e) => onChange({ ...form, status: e.target.value as MovementPayload['status'] })} className="rounded border px-3 py-2 text-sm"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select>

            <select value={form.category_id || ''} onChange={(e) => onChange({ ...form, category_id: e.target.value || undefined })} className="rounded border px-3 py-2 text-sm"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <select required value={form.pay_method} onChange={(e) => onChange({ ...form, pay_method: e.target.value as MovementPayload['pay_method'] })} className="rounded border px-3 py-2 text-sm"><option value="">Forma de pagamento</option>{payMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>

            <input value={form.beneficiary} onChange={(e) => onChange({ ...form, beneficiary: e.target.value })} placeholder="Favorecido" className="rounded border px-3 py-2 text-sm" />
            <textarea value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} placeholder="Observações" className="rounded border px-3 py-2 text-sm" />

            <div className="col-span-2 space-y-3 rounded border p-3">
              <p className="text-sm font-medium">Comprovantes</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
                <Upload className="h-4 w-4" /> Selecionar arquivos
                <input
                  className="hidden"
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
                />
              </label>
              {pendingFiles.length > 0 && <p className="text-xs text-gray-500">{pendingFiles.length} arquivo(s) serão enviados no salvar.</p>}

              {movementId && (
                <div className="space-y-2">
                  {attachments.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="inline-flex items-center gap-2"><Paperclip className="h-4 w-4" />{item.file_name}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedAttachment(item)} className="rounded p-1 hover:bg-gray-100"><Eye className="h-4 w-4" /></button>
                        <button type="button" onClick={() => void getSignedUrl(item.storage_path).then((url) => window.open(url, '_blank'))} className="rounded border px-2 py-1 text-xs">Baixar</button>
                        <button type="button" onClick={() => void onDeleteAttachment(item).then(refreshAttachments)} className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {attachments.length === 0 && <p className="text-xs text-gray-500">Sem comprovantes anexados.</p>}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs">
                    <Upload className="h-3 w-3" /> Upload imediato
                    <input className="hidden" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !movementId) return;
                      void onUploadAttachment(movementId, file, { fundId: form.fund_id, projectId: form.project_id }).then(refreshAttachments);
                    }} />
                  </label>
                </div>
              )}
            </div>

            <div className="col-span-2 flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} type="submit" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button></div>
          </form>
        </div>
      </div>
      <AttachmentViewerDialog open={Boolean(selectedAttachment)} attachment={selectedAttachment} onClose={() => setSelectedAttachment(null)} getSignedUrl={getSignedUrl} />
    </>
  );
}

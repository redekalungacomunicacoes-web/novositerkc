import { useMemo, useState } from 'react';
import { Eye, Paperclip, Trash2, Upload } from 'lucide-react';
import type { FinanceiroMovimentacao, FinanceAttachment } from '../data/financeiro.repo';
import { AttachmentViewerDialog } from './AttachmentViewerDialog';

type Props = {
  open: boolean;
  movement: FinanceiroMovimentacao | null;
  saving?: boolean;
  onUpload: (movementId: string, file: File) => Promise<unknown>;
  onDelete: (attachment: FinanceAttachment) => Promise<unknown>;
  onClose: () => void;
};

export function ComprovantesDialog({ open, movement, saving = false, onUpload, onDelete, onClose }: Props) {
  const [selected, setSelected] = useState<FinanceAttachment | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const attachments = useMemo(() => movement?.comprovantes ?? [], [movement]);

  if (!open || !movement) return null;

  const handleUpload = async (file?: File) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setFileError('Apenas PDF, JPG ou PNG são permitidos.');
      return;
    }
    setFileError(null);
    await onUpload(movement.id, file);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Comprovantes - {movement.titulo}</h3>
            <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
          </div>

          <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer mb-4">
            <Upload className="w-4 h-4" /> Upload comprovante
            <input type="file" className="hidden" accept="application/pdf,image/png,image/jpeg" onChange={(e) => void handleUpload(e.target.files?.[0])} />
          </label>
          {fileError && <p className="mb-3 text-sm text-red-600">{fileError}</p>}

          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="rounded border p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><Paperclip className="w-4 h-4 text-gray-500" />{attachment.file_name}</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelected(attachment)} className="p-1 rounded hover:bg-gray-100"><Eye className="w-4 h-4" /></button>
                  <button type="button" disabled={saving} onClick={() => void onDelete(attachment)} className="p-1 rounded hover:bg-gray-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {attachments.length === 0 && <p className="text-sm text-gray-500">Sem comprovantes.</p>}
          </div>
        </div>
      </div>
      <AttachmentViewerDialog open={Boolean(selected)} attachment={selected} onClose={() => setSelected(null)} />
    </>
  );
}

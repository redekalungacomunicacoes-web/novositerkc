import { useMemo, useState } from 'react';
import { Eye, Paperclip, Trash2, Upload } from 'lucide-react';
import type { FinanceiroMovimentacao, FinanceAttachment } from '../data/financeiro.repo';
import { AttachmentViewerDialog } from './AttachmentViewerDialog';

type Props = {
  open: boolean;
  movement: FinanceiroMovimentacao | null;
  saving?: boolean;
  onUpload: (movementId: string, file: File, context?: { fundId?: string; projectId?: string }) => Promise<void>;
  onDelete: (attachment: FinanceAttachment) => Promise<unknown>;
  getSignedUrl: (storagePath: string) => Promise<string>;
  onClose: () => void;
};

export function ComprovantesDialog({ open, movement, saving = false, onUpload, onDelete, getSignedUrl, onClose }: Props) {
  const [selected, setSelected] = useState<FinanceAttachment | null>(null);
  const attachments = useMemo(() => movement?.comprovantes ?? [], [movement]);

  if (!open || !movement) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Comprovantes - {movement.titulo}</h3>
            <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
          </div>

          <label className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
            <Upload className="h-4 w-4" /> Upload comprovante
            <input type="file" className="hidden" accept="application/pdf,image/png,image/jpeg" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void onUpload(movement.id, file, { fundId: movement.fundoId, projectId: movement.projetoId });
            }} />
          </label>

          <div className="max-h-[50vh] space-y-2 overflow-auto">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between rounded border p-3">
                <div className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4 text-gray-500" />{attachment.file_name}</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelected(attachment)} className="rounded p-1 hover:bg-gray-100"><Eye className="h-4 w-4" /></button>
                  <button type="button" disabled={saving} onClick={() => void onDelete(attachment)} className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {attachments.length === 0 && <p className="text-sm text-gray-500">Sem comprovantes.</p>}
          </div>
        </div>
      </div>
      <AttachmentViewerDialog open={Boolean(selected)} attachment={selected} onClose={() => setSelected(null)} getSignedUrl={getSignedUrl} />
    </>
  );
}

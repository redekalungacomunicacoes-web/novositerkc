import { ExternalLink, Paperclip, Trash2 } from 'lucide-react';
import type { FinanceAttachment } from '../data/financeiro.repo';

type Props = {
  open: boolean;
  attachments: FinanceAttachment[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onView: (attachment: FinanceAttachment) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
};

export function AttachmentViewerDialog({ open, attachments, loading = false, error, onClose, onView, onDelete }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Comprovantes</h3>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
        </div>

        {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between rounded border p-3 text-sm">
              <span className="inline-flex items-center gap-2 truncate"><Paperclip className="h-4 w-4" />{attachment.file_name}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={loading} onClick={() => void onView(attachment)} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-60">
                  <ExternalLink className="h-4 w-4" />Ver
                </button>
                <button type="button" disabled={loading} onClick={() => void onDelete(attachment.id)} className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" />Excluir anexo
                </button>
              </div>
            </div>
          ))}
          {!loading && attachments.length === 0 && <p className="text-sm text-gray-500">Sem comprovantes.</p>}
          {loading && <p className="text-sm text-gray-500">Processando...</p>}
        </div>
      </div>
    </div>
  );
}

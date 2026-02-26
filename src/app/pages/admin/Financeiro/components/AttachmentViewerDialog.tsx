import { ExternalLink, Paperclip, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FinanceAttachment } from '../data/financeiro.repo';

type Props = {
  open: boolean;
  attachments: FinanceAttachment[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onView: (attachment: FinanceAttachment) => Promise<string>;
  onDelete: (attachmentId: string) => Promise<void>;
};

export function AttachmentViewerDialog({ open, attachments, loading = false, error, onClose, onView, onDelete }: Props) {
  const [selected, setSelected] = useState<FinanceAttachment | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const isImage = useMemo(() => Boolean(selected?.mime_type?.startsWith('image/')), [selected]);
  const isPdf = useMemo(() => Boolean(selected?.mime_type?.includes('pdf')), [selected]);

  if (!open) return null;

  const handleOpenPreview = async (attachment: FinanceAttachment) => {
    setPreviewLoading(true);
    try {
      setSelected(attachment);
      const url = await onView(attachment);
      setSignedUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Comprovantes</h3>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
        </div>

        {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <span className="inline-flex items-center gap-2 truncate"><Paperclip className="h-4 w-4" />{attachment.file_name}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={loading || previewLoading} onClick={() => void handleOpenPreview(attachment)} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-60">
                    <ExternalLink className="h-4 w-4" />Abrir
                  </button>
                  <button type="button" disabled={loading} onClick={() => void onDelete(attachment.id)} className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60">
                    <Trash2 className="h-4 w-4" />Excluir
                  </button>
                </div>
              </div>
            ))}
            {!loading && attachments.length === 0 && <p className="text-sm text-gray-500">Sem comprovantes.</p>}
          </div>

          <div className="rounded border bg-gray-50 p-3">
            {!selected && <p className="text-sm text-gray-500">Selecione um comprovante para visualizar.</p>}
            {previewLoading && <p className="text-sm text-gray-500">Carregando visualização...</p>}
            {!previewLoading && selected && signedUrl && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{selected.file_name}</p>
                {isImage && <img src={signedUrl} alt={selected.file_name} className="max-h-[420px] w-full rounded object-contain" />}
                {!isImage && isPdf && <iframe title={selected.file_name} src={signedUrl} className="h-[420px] w-full rounded border bg-white" />}
                {!isImage && !isPdf && (
                  <a href={signedUrl} target="_blank" rel="noreferrer" className="inline-flex rounded border px-3 py-2 text-sm hover:bg-white">
                    Abrir arquivo em nova aba
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

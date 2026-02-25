import { useEffect, useState } from 'react';
import type { FinanceAttachment } from '../data/financeiro.repo';

type Props = {
  open: boolean;
  attachment: Pick<FinanceAttachment, 'id' | 'file_name' | 'mime_type' | 'storage_path'> | null;
  onClose: () => void;
  getSignedUrl: (storagePath: string) => Promise<string>;
};

export function AttachmentViewerDialog({ open, attachment, onClose, getSignedUrl }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !attachment) return;
    void getSignedUrl(attachment.storage_path).then(setUrl).catch(() => setUrl(null));
  }, [open, attachment, getSignedUrl]);

  if (!open || !attachment) return null;

  const isImage = attachment.mime_type.includes('image/');
  const isPdf = attachment.mime_type.includes('pdf');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{attachment.file_name}</h3>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
        </div>
        {!url && <p className="text-sm text-gray-500">Carregando arquivo...</p>}
        {url && isImage && <img src={url} alt={attachment.file_name} className="max-h-[70vh] w-full object-contain" />}
        {url && isPdf && <iframe title={attachment.file_name} src={url} className="h-[70vh] w-full rounded border" />}
        {url && !isImage && !isPdf && <p className="text-sm text-gray-600">Preview indisponível para este formato.</p>}
      </div>
    </div>
  );
}

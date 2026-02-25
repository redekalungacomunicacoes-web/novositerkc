import { useEffect, useState } from 'react';
import type { FinanceAttachment } from '../data/financeiro.repo';
import { useFinanceSupabase } from '../hooks/useFinanceSupabase';

type Props = {
  open: boolean;
  attachment: FinanceAttachment | null;
  onClose: () => void;
};

export function AttachmentViewerDialog({ open, attachment, onClose }: Props) {
  const { getSignedUrl } = useFinanceSupabase();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !attachment?.storage_path) {
      setUrl(null);
      return;
    }
    void getSignedUrl(attachment.storage_path)
      .then(setUrl)
      .catch(() => setUrl(null));
  }, [open, attachment, getSignedUrl]);

  if (!open || !attachment) return null;

  const mime = attachment.mime_type || '';
  const isImage = mime.includes('image/');
  const isPdf = mime.includes('pdf');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="truncate text-lg font-semibold">{attachment.file_name}</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')} className="rounded border px-3 py-1 text-sm" disabled={!url}>Baixar</button>
            <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
          </div>
        </div>
        {!url && <p className="text-sm text-gray-500">Carregando arquivo...</p>}
        {url && isImage && <img src={url} alt={attachment.file_name} className="max-h-[70vh] w-full object-contain" />}
        {url && isPdf && <iframe title={attachment.file_name} src={url} className="h-[70vh] w-full rounded border" />}
        {url && !isImage && !isPdf && <p className="text-sm text-gray-600">Preview indisponível para este formato.</p>}
      </div>
    </div>
  );
}

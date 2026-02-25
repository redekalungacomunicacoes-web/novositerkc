import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { FinanceAttachment } from '../data/financeiro.repo';

type Props = {
  open: boolean;
  attachment: Pick<FinanceAttachment, 'id' | 'file_name' | 'mime_type' | 'storage_path'> | null;
  onClose: () => void;
};

export function AttachmentViewerDialog({ open, attachment, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !attachment) return;
    void supabase.storage
      .from('finance-attachments')
      .createSignedUrl(attachment.storage_path, 60 * 10)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [open, attachment]);

  if (!open || !attachment) return null;

  const isImage = attachment.mime_type.includes('image/');
  const isPdf = attachment.mime_type.includes('pdf');

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{attachment.file_name}</h3>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
        </div>
        {!url && <p className="text-sm text-gray-500">Carregando arquivo...</p>}
        {url && isImage && <img src={url} alt={attachment.file_name} className="max-h-[70vh] w-full object-contain" />}
        {url && isPdf && <iframe title={attachment.file_name} src={url} className="h-[70vh] w-full rounded border" />}
        {url && !isImage && !isPdf && <p className="text-sm text-gray-600">Preview indisponível para este formato.</p>}
        {url && (
          <div className="mt-4">
            <a href={url} target="_blank" rel="noreferrer" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white inline-block">Abrir/Download</a>
          </div>
        )}
      </div>
    </div>
  );
}

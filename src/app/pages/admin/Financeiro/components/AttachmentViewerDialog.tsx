import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useFinanceSupabase } from '../hooks/useFinanceSupabase';

type Attachment = {
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
};

interface Props {
  open: boolean;
  attachment?: Attachment | null;
  onClose: () => void;
}

export function AttachmentViewerDialog({ open, attachment, onClose }: Props) {
  const [signedUrl, setSignedUrl] = useState('');
  const { getSignedUrl } = useFinanceSupabase();

  useEffect(() => {
    const load = async () => {
      if (!open || !attachment?.storage_path) {
        setSignedUrl('');
        return;
      }
      const url = await getSignedUrl(attachment.storage_path);
      setSignedUrl(url);
    };
    void load();
  }, [open, attachment?.storage_path]);

  if (!open || !attachment) return null;

  const isPdf = attachment.mime_type?.includes('pdf');
  const isImage = attachment.mime_type?.startsWith('image/');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Visualizar comprovante - {attachment.file_name}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {isPdf ? <iframe title={attachment.file_name} src={signedUrl} className="w-full h-full rounded-lg border" /> : null}
          {isImage ? <img src={signedUrl} alt={attachment.file_name} className="max-h-full mx-auto rounded-lg" /> : null}
          {!isPdf && !isImage ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <p className="text-gray-700">Pré-visualização não suportada, clique para abrir.</p>
              <a href={signedUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20]">Abrir</a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

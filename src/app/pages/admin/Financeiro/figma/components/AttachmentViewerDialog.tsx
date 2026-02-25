import React, { useEffect, useMemo, useState } from "react";
import { X, Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BUCKET = "finance-attachments";

type Attachment = {
  id: string;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;

  // Preferido (bucket privado)
  storage_path?: string | null;

  // Se existir na sua tabela, usa como fallback (bucket público)
  public_url?: string | null;

  created_at?: string | null;
};

type Props = {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;

  // opcional: aumentar expiração do signed url
  expiresInSeconds?: number;
};

function humanSize(bytes?: number | null) {
  const b = Number(bytes || 0);
  if (!b) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function AttachmentViewerDialog({
  open,
  attachment,
  onClose,
  expiresInSeconds = 60 * 10,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  const fileName = attachment?.file_name || "Arquivo";
  const mime = (attachment?.mime_type || "").toLowerCase();

  const isPdf = useMemo(() => mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf"), [mime, fileName]);
  const isImage = useMemo(() => mime.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(fileName), [mime, fileName]);

  useEffect(() => {
    if (!open || !attachment) return;

    let alive = true;
    setError("");
    setSignedUrl("");

    const load = async () => {
      setLoading(true);
      try {
        // 1) Se tiver public_url, usa direto
        if (attachment.public_url) {
          if (!alive) return;
          setSignedUrl(attachment.public_url);
          return;
        }

        // 2) Se tiver storage_path, gera signed url (bucket privado)
        if (attachment.storage_path) {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(attachment.storage_path, expiresInSeconds);

          if (error) throw error;

          if (!alive) return;
          setSignedUrl(data?.signedUrl || "");
          return;
        }

        throw new Error("Anexo sem public_url e sem storage_path.");
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Não foi possível carregar o anexo.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [open, attachment, expiresInSeconds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-gray-900">{fileName}</div>
            <div className="mt-1 text-xs text-gray-500">
              {mime ? mime : "tipo desconhecido"} {attachment?.file_size ? `• ${humanSize(attachment.file_size)}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signedUrl ? (
              <>
                <a
                  href={signedUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  title="Baixar"
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </a>

                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir
                </a>
              </>
            ) : null}

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              type="button"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="bg-gray-50 p-4">
          <div className="relative flex h-[70vh] w-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando anexo...
              </div>
            ) : error ? (
              <div className="max-w-lg p-6 text-center">
                <div className="text-sm font-medium text-red-700">{error}</div>
                <div className="mt-2 text-xs text-gray-500">
                  Se o bucket estiver privado, confirme se a tabela está salvando o <b>storage_path</b>.
                </div>
              </div>
            ) : !signedUrl ? (
              <div className="text-sm text-gray-600">Nenhum link disponível.</div>
            ) : isPdf ? (
              <iframe title={fileName} src={signedUrl} className="h-full w-full" />
            ) : isImage ? (
              <img src={signedUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="max-w-md p-6 text-center">
                <div className="text-sm font-medium text-gray-900">Prévia não disponível</div>
                <div className="mt-2 text-xs text-gray-500">
                  Clique em <b>Baixar</b> ou <b>Abrir</b> para visualizar o arquivo.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            type="button"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

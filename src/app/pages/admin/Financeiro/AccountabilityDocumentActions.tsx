import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const formats = [
  ['xlsx', 'Planilha financeira XLSX'],
  ['docx', 'Formulário narrativo DOCX'],
  ['pdf', 'Relatório consolidado PDF'],
] as const;
type Format = typeof formats[number][0];
type GeneratedFile = { id: string; name: string; format: Format };

export function AccountabilityDocumentActions({ reportId, onGenerated, disabled = false }: {
  reportId: string;
  onGenerated: () => void;
  disabled?: boolean;
}) {
  const [generating, setGenerating] = useState<Format | null>(null);
  const [latest, setLatest] = useState<GeneratedFile | null>(null);

  const generate = async (format: Format) => {
    if (generating || disabled) return;
    setGenerating(format);
    try {
      const { data, error } = await supabase.functions.invoke('drive-files', {
        body: { action: 'accountability-generate-document', report_id: reportId, format },
      });
      if (error) {
        const detail = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null;
        throw new Error(typeof detail?.error === 'string' ? detail.error : 'Não foi possível gerar o documento.');
      }
      if (!data?.ok || !data.document?.id) throw new Error(data?.error || 'Não foi possível confirmar o documento gerado.');
      setLatest(data.document);
      onGenerated();
      toast.success('Documento preenchido disponível no Drive.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o documento.');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[#e7e9e2] bg-white p-5">
      <h2 className="font-semibold text-[#173b2e]">Documentos preenchidos</h2>
      <p className="text-sm text-gray-600">Use os dados salvos na prestação. Cada versão gerada fica vinculada ao histórico.</p>
      <div className="flex flex-wrap gap-2">
        {formats.map(([format, label]) => (
          <button key={format} type="button" className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={disabled || generating !== null} onClick={() => void generate(format)}>
            <FileDown className="h-4 w-4" aria-hidden="true" />
            {generating === format ? 'Gerando…' : label}
          </button>
        ))}
      </div>
      {latest && <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>{latest.name}</span>
        <a className="underline" href={`https://drive.google.com/file/d/${encodeURIComponent(latest.id)}/view`} target="_blank" rel="noopener noreferrer">Abrir no Drive</a>
        <a className="underline" href={`https://drive.google.com/uc?export=download&id=${encodeURIComponent(latest.id)}`} target="_blank" rel="noopener noreferrer">Baixar</a>
      </div>}
    </section>
  );
}

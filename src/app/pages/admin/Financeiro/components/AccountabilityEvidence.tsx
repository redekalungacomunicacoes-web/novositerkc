import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

export function AccountabilityEvidence({ reportId, onUploaded }: {
  reportId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [category, setCategory] = useState('comprovante');
  const [uploadId, setUploadId] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !uploadId || sending) return;
    const form = event.currentTarget;
    setSending(true);
    setFeedback(undefined);
    const payload = new FormData();
    payload.append('module', 'finance-accountability');
    payload.append('report_id', reportId);
    payload.append('file', file);
    payload.append('category', category);
    payload.append('upload_id', uploadId);
    try {
      const { data, error } = await supabase.functions.invoke('drive-files', { body: payload });
      if (error || !data?.ok) throw new Error('Não foi possível enviar o anexo ao Drive. Você pode tentar novamente.');
      form.reset();
      setFile(undefined);
      setCategory('comprovante');
      setFeedback({ text: 'Anexo vinculado no Drive.', error: false });
      onUploaded();
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível enviar o anexo.', error: true });
    } finally {
      setSending(false);
    }
  }

  return <form onSubmit={submit} className="mt-4 space-y-2 border-t pt-4">
    <h3 className="text-sm font-semibold">Anexar comprovante ou evidência</h3>
    <fieldset disabled={sending} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">Categoria<select className="block rounded-lg border px-2 py-1" value={category} onChange={event => {
        setCategory(event.target.value);
        setUploadId(crypto.randomUUID());
      }}><option value="comprovante">Comprovante</option><option value="evidencia">Evidência</option></select></label>
      <label className="text-sm">Arquivo<input className="block max-w-56 py-1" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required onChange={event => {
        setFile(event.target.files?.[0]);
        setUploadId(crypto.randomUUID());
      }} /></label>
      <button type="submit" disabled={!file} className="rounded-lg border px-3 py-1 text-sm font-medium disabled:opacity-50">{sending ? 'Enviando…' : 'Enviar'}</button>
    </fieldset>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-sm text-rose-700' : 'text-sm text-green-800'}>{feedback.text}</p>}
  </form>;
}

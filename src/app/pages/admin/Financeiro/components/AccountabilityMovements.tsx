import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '../data/financeiro.repo';

type Attachment = { id: string; file_name: string; storage_path: string };
type Movement = {
  id: string;
  date: string;
  description: string | null;
  type: 'entrada' | 'saida';
  status: string;
  total_value: number | null;
  attachments: Attachment[];
};

const pageSize = 25;
const statuses: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', cancelado: 'Cancelado' };
const formatDate = (value: string) => value.split('-').reverse().join('/');

export function AccountabilityMovements({ projectId, fundId, start, end }: {
  projectId: string | null; fundId: string | null; start: string | null; end: string | null;
}) {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const available = Boolean((projectId || fundId) && start && end);

  useEffect(() => {
    if (!available || !start || !end) return;
    let active = true;
    setLoading(true);
    setError('');
    let query = supabase.from('finance_movements')
      .select('id,date,description,type,status,total_value,attachments:finance_attachments(id,file_name,storage_path)')
      .gte('date', start).lte('date', end);
    if (projectId) query = query.eq('project_id', projectId);
    else if (fundId) query = query.eq('fund_id', fundId);

    void query.order('date', { ascending: false }).order('id')
      .range(page * pageSize, (page + 1) * pageSize).then(result => {
        if (!active) return;
        setRows((result.data ?? []).slice(0, pageSize) as Movement[]);
        setHasMore((result.data?.length ?? 0) > pageSize);
        if (result.error) setError('Não foi possível consultar as movimentações do período.');
        setLoading(false);
      });
    return () => { active = false; };
  }, [available, projectId, fundId, start, end, page]);

  const download = async (attachment: Attachment) => {
    const { data, error: downloadError } = await supabase.storage.from('finance-attachments')
      .createSignedUrl(attachment.storage_path, 300, { download: attachment.file_name });
    if (downloadError || !data) {
      setError('Não foi possível baixar o comprovante.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = data.signedUrl;
    anchor.click();
  };

  return <section id="movimentacoes" className="rounded-2xl border border-[#e7e9e2] bg-white p-5 sm:p-6">
    <h2 className="font-semibold">Movimentações e comprovantes</h2>
    <p className="mt-1 text-sm text-gray-600">{available && start && end
      ? `Consulta pelo ${projectId ? 'projeto' : 'fundo'} vinculado entre ${formatDate(start)} e ${formatDate(end)}.`
      : 'Informe o período completo e vincule um fundo ou projeto para consultar as movimentações.'}</p>
    {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
    {available && (loading ? <p className="mt-3 text-sm text-gray-500" role="status">Consultando movimentações…</p> : <>
      {rows.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm">
        <thead><tr>{['Data', 'Descrição', 'Tipo', 'Situação', 'Valor', 'Comprovantes'].map(label => <th key={label} className="p-2" scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-t">
          <td className="p-2">{formatDate(row.date)}</td>
          <td className="p-2">{row.description || '—'}</td>
          <td className="p-2">{row.type === 'entrada' ? 'Receita' : 'Despesa'}</td>
          <td className="p-2">{statuses[row.status] ?? row.status}</td>
          <td className="whitespace-nowrap p-2">{row.total_value == null ? '—' : formatCurrency(row.total_value)}</td>
          <td className="p-2">{row.attachments.length ? <ul className="space-y-1">{row.attachments.map(file => <li key={file.id}>
            <button type="button" onClick={() => void download(file)} className="text-left text-[#315b47] underline">{file.file_name}</button>
          </li>)}</ul> : '—'}</td>
        </tr>)}</tbody>
      </table></div> : !error && <p className="mt-3 text-sm text-gray-500">Nenhuma movimentação no período.</p>}
      {(page > 0 || hasMore) && <nav aria-label="Páginas das movimentações" className="mt-3 flex items-center gap-3 text-sm">
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page + 1}</span>
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={!hasMore} onClick={() => setPage(page + 1)}>Próxima</button>
      </nav>}
    </>)}
  </section>;
}

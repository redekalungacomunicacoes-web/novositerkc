import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type CellValue = string | number | boolean | null;
type Conflict = { key: string; base: CellValue; panel: CellValue; sheet: CellValue };
type SheetStatus = {
  spreadsheet_id: string | null;
  status: 'unlinked' | 'pending' | 'synced' | 'conflict' | 'error' | 'locked';
  conflicts: Conflict[];
  conflict_token: string | null;
  error: string | null;
  last_synced_at: string | null;
};

type Props = {
  reportId: string;
  editable: boolean;
  pendingChanges?: boolean;
  savedRevision: number;
  onPull: () => void | Promise<void>;
};

const statusLabels: Record<SheetStatus['status'], string> = {
  unlinked: 'Planilha a preparar',
  pending: 'Planilha vinculada · primeira sincronização pendente',
  synced: 'Sincronizada',
  conflict: 'Alterações conflitantes',
  error: 'Sincronização pendente de correção',
  locked: 'Sincronização pausada durante revisão, aprovação ou arquivamento',
};

function cellLabel(value: CellValue) {
  if (value == null || value === '') return 'Em branco';
  return typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(value);
}

async function syncError(error: unknown) {
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    try {
      const details = await error.context.clone().json();
      if (typeof details.error === 'string') return details.error;
    } catch {
      // Fall back to the generic message for responses without JSON details.
    }
  }
  return 'Não foi possível consultar o Google Sheets. Tente novamente.';
}

export function AccountabilitySheetSync({ reportId, editable, pendingChanges = false, savedRevision, onPull }: Props) {
  const [state, setState] = useState<SheetStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadNeeded, setReloadNeeded] = useState(false);
  const activeOperation = useRef(false);
  const current = useRef({ pendingChanges, editable, onPull });
  current.current = { pendingChanges, editable, onPull };
  const mountedReport = useRef(reportId);
  const triedCreate = useRef<string | null>(null);
  const lastSave = useRef(savedRevision);

  useEffect(() => {
    mountedReport.current = reportId;
    lastSave.current = savedRevision;
    setState(null);
    setError('');
    setReloadNeeded(false);
    let active = true;
    void supabase.functions.invoke('drive-files', {
      body: { action: 'accountability-sheet-status', report_id: reportId },
    }).then(async ({ data, error: issue }) => {
      if (!active) return;
      if (issue || !data?.ok || !data.sync) {
        const message = await syncError(issue);
        if (active) setError(message);
      } else setState(data.sync as SheetStatus);
    }).catch(() => { if (active) setError('Não foi possível consultar o vínculo com o Google Sheets.'); });
    return () => { active = false; };
    // Only a different report should reset the registered synchronization state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const synchronize = useCallback(async (resolution?: 'panel' | 'sheet', token?: string) => {
    if (activeOperation.current || !current.current.editable || current.current.pendingChanges) return;
    activeOperation.current = true;
    setBusy(true);
    setError('');
    try {
      const { data, error: issue } = await supabase.functions.invoke('drive-files', {
        body: { action: 'accountability-sync-sheet', report_id: reportId, resolution, conflict_token: token },
      });
      if (mountedReport.current !== reportId) return;
      if (issue || !data?.ok || !data.sync) {
        const message = await syncError(issue);
        if (mountedReport.current === reportId) setError(message);
        return;
      }
      setState(data.sync as SheetStatus);
      if (data.pulled) {
        if (current.current.pendingChanges) setReloadNeeded(true);
        else {
          await current.current.onPull();
          setReloadNeeded(false);
        }
      }
    } catch {
      if (mountedReport.current === reportId) setError('Não foi possível atualizar o vínculo com o Google Sheets.');
    } finally {
      activeOperation.current = false;
      setBusy(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (!editable || pendingChanges || state?.status !== 'unlinked' || triedCreate.current === reportId) return;
    triedCreate.current = reportId;
    void synchronize();
  }, [editable, pendingChanges, reportId, state?.status, synchronize]);

  useEffect(() => {
    if (!editable || pendingChanges || savedRevision === lastSave.current) return;
    lastSave.current = savedRevision;
    void synchronize();
  }, [editable, pendingChanges, savedRevision, synchronize]);

  useEffect(() => {
    if (!editable || pendingChanges || !state?.spreadsheet_id) return;
    const poll = () => {
      if (document.visibilityState === 'visible') void synchronize();
    };
    const timer = window.setInterval(poll, 60_000);
    window.addEventListener('focus', poll);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', poll);
    };
  }, [editable, pendingChanges, state?.spreadsheet_id, synchronize]);

  const conflicts = state?.conflicts ?? [];
  const buttonsDisabled = busy || pendingChanges || !editable;

  return <section className="rounded-2xl border bg-white p-5" aria-label="Google Sheets">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold">Google Sheets</h2>
        <p className="mt-1 text-sm text-gray-600" role="status">
          {busy ? 'Sincronizando…' : state ? statusLabels[state.status] : error ? 'Vínculo indisponível' : 'Consultando vínculo…'}
        </p>
        {state?.last_synced_at && <p className="mt-1 text-xs text-gray-500">
          Última sincronização em {new Date(state.last_synced_at).toLocaleString('pt-BR')}
        </p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {state?.spreadsheet_id && <a href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.spreadsheet_id)}/edit`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <ExternalLink className="size-4" /> Abrir planilha
        </a>}
        {editable && <button type="button" disabled={buttonsDisabled} className="inline-flex items-center gap-2 rounded-lg bg-[#103d2e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void synchronize()}>
          <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} /> {state?.spreadsheet_id ? 'Sincronizar agora' : 'Preparar planilha'}
        </button>}
      </div>
    </div>
    {pendingChanges && editable && <p className="mt-3 text-sm text-gray-600">A sincronização será retomada depois de salvar as alterações do painel.</p>}
    {reloadNeeded && <p className="mt-3 text-sm text-amber-900" role="status">Há alterações da planilha no rascunho salvo. Guarde as edições que ainda não foram salvas e recarregue a prestação para consultá-las.</p>}
    {(error || state?.error) && <p className="mt-3 text-sm text-rose-700" role="alert">{error || state?.error}</p>}
    {state?.status === 'conflict' && conflicts.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-medium text-amber-950">Revise {conflicts.length} {conflicts.length === 1 ? 'campo divergente' : 'campos divergentes'}</h3>
      <div className="mt-2 max-h-52 overflow-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead><tr><th className="p-1">Célula</th><th className="p-1">Painel</th><th className="p-1">Planilha</th></tr></thead>
          <tbody>{conflicts.map(conflict => <tr key={conflict.key} className="border-t border-amber-200">
            <th className="break-words p-1 font-medium">{conflict.key}</th>
            <td className="whitespace-pre-wrap break-words p-1">{cellLabel(conflict.panel)}</td>
            <td className="whitespace-pre-wrap break-words p-1">{cellLabel(conflict.sheet)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {editable && state.conflict_token && <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm disabled:opacity-50" type="button" disabled={buttonsDisabled} onClick={() => void synchronize('panel', state.conflict_token!)}>
          Usar valores do painel nos conflitos
        </button>
        <button className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm disabled:opacity-50" type="button" disabled={buttonsDisabled} onClick={() => void synchronize('sheet', state.conflict_token!)}>
          Usar valores da planilha nos conflitos
        </button>
      </div>}
    </div>}
  </section>;
}

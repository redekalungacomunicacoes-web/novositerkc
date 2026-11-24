import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUserRoles, hasAnyRole } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';

type Status = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
type WorkflowAction = 'submit' | 'return' | 'approve' | 'deliver' | 'archive';

export type FinanceAccountabilityWorkflowResult = {
  status: Status;
  updated_at: string;
  review_notes: string | null;
  delivered_at: string | null;
  delivery_reference: string | null;
};

const labels: Record<WorkflowAction, string> = {
  submit: 'Enviar para revisão',
  return: 'Devolver para ajustes',
  approve: 'Aprovar prestação',
  deliver: 'Registrar entrega',
  archive: 'Arquivar prestação',
};

const workflowDateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

export function FinanceAccountabilityWorkflow({
  reportId, status, updatedAt, reviewNotes, deliveredAt, deliveryReference,
  pendingChanges = false, missingForReview = [], onChanged,
}: {
  reportId: string;
  status: Status;
  updatedAt: string;
  reviewNotes: string | null;
  deliveredAt: string | null;
  deliveryReference: string | null;
  pendingChanges?: boolean;
  missingForReview?: string[];
  onChanged: (result: FinanceAccountabilityWorkflowResult) => void;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const [activeAction, setActiveAction] = useState<WorkflowAction | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getCurrentUserRoles().then(({ roles }) => {
      if (active) setIsAdmin(hasAnyRole(roles, ['admin']));
    }).catch(() => {
      if (active) setIsAdmin(false);
    }).finally(() => {
      if (active) setLoadingRole(false);
    });
    return () => { active = false; };
  }, []);

  const actions: WorkflowAction[] = [];
  if (status === 'draft') actions.push('submit');
  if (status === 'in_review' && isAdmin) actions.push('return', 'approve');
  if ((status === 'approved' || status === 'published') && !deliveredAt) actions.push('deliver');
  if ((status === 'approved' || status === 'published') && deliveredAt && isAdmin) actions.push('archive');

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAction || busy || pendingChanges) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('advance_finance_accountability_workflow', {
        report_id: reportId,
        expected_updated_at: updatedAt,
        workflow_action: activeAction,
        notes: notes.trim() || null,
      }).single();
      if (error || !data) throw new Error(error?.message || 'A ação não retornou a situação da prestação.');
      onChanged(data as FinanceAccountabilityWorkflowResult);
      setActiveAction(null);
      setNotes('');
      toast.success('Fluxo da prestação atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-2xl border border-[#e7e9e2] bg-white p-5 sm:p-6">
    <div className="flex items-center gap-2">
      <ClipboardCheck className="h-5 w-5 text-[#315b47]" aria-hidden="true" />
      <h2 className="font-semibold">Revisão, aprovação e entrega</h2>
    </div>
    {reviewNotes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ajustes solicitados — {reviewNotes}</p>}
    {status === 'in_review' && <p className="mt-3 text-sm text-gray-600">A prestação aguarda revisão administrativa. O preenchimento está bloqueado durante a análise.</p>}
    {status === 'approved' && !deliveredAt && <p className="mt-3 text-sm text-gray-600">Prestação aprovada. Registre a entrega depois do envio ao financiador.</p>}
    {deliveredAt && <div className="mt-3 text-sm text-gray-700">
      <p>Entrega registrada em <time dateTime={deliveredAt}>{workflowDateTime.format(new Date(deliveredAt))}</time></p>
      {deliveryReference && <p className="mt-1 whitespace-pre-wrap">Referência — {deliveryReference}</p>}
    </div>}
    {status === 'archived' && <p className="mt-3 text-sm text-gray-600">Prestação arquivada para consulta.</p>}
    {status === 'draft' && missingForReview.length > 0 &&
      <p className="mt-3 text-sm text-gray-700">Pendências para revisão — {missingForReview.join(', ')}.</p>}
    {pendingChanges && <p role="status" className="mt-3 text-sm text-amber-800">Salve as alterações antes de avançar.</p>}
    {loadingRole && <p className="mt-3 text-sm text-gray-600">Verificando permissões…</p>}
    {!loadingRole && actions.length > 0 && <div className="mt-4 flex flex-wrap gap-2">
      {actions.map(action => <button key={action} type="button"
        disabled={busy || pendingChanges || (action === 'submit' && missingForReview.length > 0)}
        aria-pressed={activeAction === action}
        onClick={() => { setActiveAction(action); setNotes(''); }}
        className="rounded-lg border border-[#315b47] px-3 py-2 text-sm font-medium text-[#234b39] aria-pressed:bg-[#edf5ef] disabled:opacity-50">
        {labels[action]}
      </button>)}
    </div>}
    {activeAction && <form onSubmit={apply} className="mt-3 space-y-3 rounded-xl border bg-[#f8f9f6] p-4">
      <p className="text-sm font-medium">{labels[activeAction]}</p>
      {activeAction === 'deliver' && <p className="text-sm text-gray-600">Confirme somente após a entrega. O horário do registro entra no histórico da prestação.</p>}
      {(activeAction === 'return' || activeAction === 'deliver') &&
        <label className="block space-y-1 text-sm">
          <span>{activeAction === 'return' ? 'Ajustes solicitados' : 'Protocolo ou referência da entrega (opcional)'}</span>
          <textarea className="w-full rounded-lg border bg-white p-2" maxLength={2000} rows={2} value={notes}
            required={activeAction === 'return'} onChange={event => setNotes(event.target.value)} />
        </label>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={() => setActiveAction(null)}>Cancelar</button>
        <button type="submit" disabled={busy || pendingChanges || (activeAction === 'submit' && missingForReview.length > 0) || (activeAction === 'return' && !notes.trim())}
          className="rounded-lg bg-[#103d2e] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Registrando…' : 'Confirmar'}</button>
      </div>
    </form>}
  </section>;
}

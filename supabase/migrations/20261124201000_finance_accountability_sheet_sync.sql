create table public.finance_accountability_sheet_sync (
  report_id uuid primary key references public.finance_accountability_reports(id) on delete cascade,
  spreadsheet_id text not null unique check (spreadsheet_id ~ '^[A-Za-z0-9_-]{10,}$'),
  status text not null default 'pending' check (status in ('pending','synced','conflict','error')),
  baseline jsonb not null default '{}'::jsonb check (jsonb_typeof(baseline) = 'object'),
  conflicts jsonb not null default '[]'::jsonb check (jsonb_typeof(conflicts) = 'array'),
  conflict_token text,
  error text,
  last_synced_at timestamptz
);
alter table public.finance_accountability_sheet_sync enable row level security;
revoke all on public.finance_accountability_sheet_sync from public, anon, authenticated;
grant select, insert, update on public.finance_accountability_sheet_sync to service_role;

-- Atomic pull and checkpoint. A stale edge invocation cannot overwrite a newer report.
create function public.complete_finance_accountability_sheet_sync(
  p_report_id uuid,
  p_spreadsheet_id text,
  p_actor uuid,
  p_expected_narrative jsonb,
  p_expected_financial jsonb,
  p_next_narrative jsonb,
  p_next_financial jsonb,
  p_baseline jsonb,
  p_changes jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_report public.finance_accountability_reports%rowtype;
begin
  select * into current_report
  from public.finance_accountability_reports
  where id = p_report_id
  for update;

  if not found or current_report.status <> 'draft'
    or current_report.narrative_data is distinct from p_expected_narrative
    or current_report.financial_data is distinct from p_expected_financial then
    return false;
  end if;

  update public.finance_accountability_sheet_sync
  set baseline = p_baseline, status = 'synced', last_synced_at = now(),
      conflicts = '[]'::jsonb, conflict_token = null, error = null
  where report_id = p_report_id and spreadsheet_id = p_spreadsheet_id;
  if not found then return false; end if;

  if current_report.narrative_data is distinct from p_next_narrative
    or current_report.financial_data is distinct from p_next_financial then
    update public.finance_accountability_reports
    set narrative_data = p_next_narrative, financial_data = p_next_financial, updated_by = p_actor
    where id = p_report_id;
  end if;

  if p_changes <> '{}'::jsonb then
    insert into public.finance_accountability_history (report_id, action, actor_id, change_summary, snapshot)
    values (p_report_id, 'updated', p_actor, 'Sincronização com Google Sheets',
      jsonb_build_object('origin', 'google_sheets', 'spreadsheet_id', p_spreadsheet_id, 'changes', p_changes));
  end if;
  return true;
end;
$$;

revoke all on function public.complete_finance_accountability_sheet_sync(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.complete_finance_accountability_sheet_sync(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

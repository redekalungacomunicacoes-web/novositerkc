-- Record report updates in the same transaction as the edit.
create function public.record_finance_accountability_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.narrative_data is not distinct from old.narrative_data
    and new.financial_data is not distinct from old.financial_data
    and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.finance_accountability_history
    (report_id, action, actor_id, change_summary, snapshot)
  values (
    new.id,
    case when new.status is not distinct from old.status then 'updated'
      when new.status = 'in_review' then 'submitted_for_review'
      when new.status in ('approved','published','archived') then new.status
      when old.status = 'published' then 'unpublished'
      else 'updated' end,
    auth.uid(),
    case when new.status is distinct from old.status then 'Alteração da situação'
      else 'Atualização do preenchimento' end,
    jsonb_build_object(
      'before', jsonb_build_object('status', old.status, 'financial_data', old.financial_data, 'narrative_data', old.narrative_data),
      'after', jsonb_build_object('status', new.status, 'financial_data', new.financial_data, 'narrative_data', new.narrative_data)
    )
  );
  return new;
end;
$$;

revoke all on function public.record_finance_accountability_edit() from public;

create trigger record_finance_accountability_edit
after update on public.finance_accountability_reports
for each row execute function public.record_finance_accountability_edit();

create function public.save_finance_accountability_draft(
  report_id uuid,
  expected_narrative jsonb,
  expected_financial jsonb,
  next_narrative jsonb,
  next_financial jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.finance_accountability_reports as report
  set narrative_data = next_narrative,
      financial_data = coalesce(next_financial, report.financial_data),
      updated_by = auth.uid()
  where report.id = report_id
    and report.status = 'draft'
    and report.narrative_data = expected_narrative
    and report.financial_data = expected_financial;
  return found;
end;
$$;

revoke all on function public.save_finance_accountability_draft(uuid,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_finance_accountability_draft(uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;

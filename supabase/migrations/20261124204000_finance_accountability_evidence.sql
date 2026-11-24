create unique index finance_accountability_evidence_upload_idx
  on public.finance_accountability_documents (report_id, (metadata ->> 'upload_id'))
  where document_type = 'supporting_attachment' and metadata ? 'upload_id';

create function public.record_finance_accountability_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_status text;
begin
  if new.document_type <> 'supporting_attachment' then return new; end if;
  select report.status into report_status
    from public.finance_accountability_reports report where report.id = new.report_id for update;
  if report_status is distinct from 'draft' then
    raise exception 'Reabra o rascunho para registrar comprovantes e evidências.' using errcode = '42501';
  end if;
  insert into public.finance_accountability_history(report_id, action, actor_id, change_summary, snapshot)
  values (new.report_id, 'updated', new.created_by, 'Comprovante ou evidência vinculada.',
    jsonb_build_object('document_id', new.id, 'category', new.metadata ->> 'category'));
  return new;
end;
$$;

revoke all on function public.record_finance_accountability_evidence() from public;
create trigger record_finance_accountability_evidence
after insert on public.finance_accountability_documents
for each row execute function public.record_finance_accountability_evidence();

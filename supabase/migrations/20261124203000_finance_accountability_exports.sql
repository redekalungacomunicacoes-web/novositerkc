alter table public.finance_accountability_documents
  drop constraint finance_accountability_documents_document_type_check,
  add constraint finance_accountability_documents_document_type_check
    check (document_type in ('financial_spreadsheet','narrative_document','supporting_attachment','official_template','consolidated_report'));

create unique index finance_accountability_exports_version_idx
  on public.finance_accountability_documents (report_id, (metadata ->> 'version_key'), (metadata ->> 'format'))
  where metadata ->> 'stage' = 'filled_export';

create function public.record_finance_accountability_export(
  export_report_id uuid,
  export_type text,
  export_name text,
  export_mime text,
  export_drive_id text,
  export_checksum text,
  export_template_version integer,
  export_version_key text,
  export_format text,
  export_actor uuid
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  document_id uuid;
begin
  insert into public.finance_accountability_documents
    (report_id, document_type, file_name, mime_type, storage_path, checksum_sha256, template_version, metadata, generated_at, created_by)
  values
    (export_report_id, export_type, export_name, export_mime, export_drive_id, export_checksum, export_template_version,
      jsonb_build_object('provider','google_drive','stage','filled_export','version_key',export_version_key,'format',export_format), now(), export_actor)
  on conflict (report_id, (metadata ->> 'version_key'), (metadata ->> 'format'))
    where metadata ->> 'stage' = 'filled_export'
    do nothing
  returning id into document_id;

  if document_id is not null then
    insert into public.finance_accountability_history (report_id, action, actor_id, change_summary, snapshot)
    values (export_report_id, 'document_generated', export_actor, 'Documento preenchido gerado.',
      jsonb_build_object('document_id',document_id,'format',export_format,'checksum_sha256',export_checksum));
  else
    select doc.id into document_id
    from public.finance_accountability_documents doc
    where doc.report_id = export_report_id
      and doc.metadata ->> 'stage' = 'filled_export'
      and doc.metadata ->> 'version_key' = export_version_key
      and doc.metadata ->> 'format' = export_format
      and doc.storage_path = export_drive_id
      and doc.checksum_sha256 = export_checksum;
    if document_id is null then
      raise exception 'A versão vinculada do documento não corresponde ao arquivo no Drive.';
    end if;
  end if;
  return document_id;
end;
$$;

revoke all on function public.record_finance_accountability_export(uuid,text,text,text,text,text,integer,text,text,uuid) from public, anon, authenticated;
grant execute on function public.record_finance_accountability_export(uuid,text,text,text,text,text,integer,text,text,uuid) to service_role;

create function public.guard_finance_accountability_generated_document()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (new.metadata ->> 'stage' = 'filled_export'
      or (tg_op = 'UPDATE' and old.metadata ->> 'stage' = 'filled_export'))
  then
    raise exception 'Somente o gerador pode vincular ou modificar documentos preenchidos.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_finance_accountability_generated_document() from public;
create trigger guard_finance_accountability_generated_document
before insert or update on public.finance_accountability_documents
for each row execute function public.guard_finance_accountability_generated_document();

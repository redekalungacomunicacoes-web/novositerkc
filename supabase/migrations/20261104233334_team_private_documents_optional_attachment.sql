begin;
alter table public.team_private_documents
  alter column storage_path drop not null,
  alter column mime_type drop not null,
  alter column size_bytes drop not null;
alter table public.team_private_documents
  drop constraint if exists team_private_documents_file_consistency;
alter table public.team_private_documents
  add constraint team_private_documents_file_consistency
  check (
    (storage_path is null and mime_type is null and size_bytes is null)
    or (storage_path is not null and mime_type is not null and size_bytes is not null)
  );
comment on column public.team_private_documents.storage_path is
  'Opcional: NULL indica cadastro de dados documentais sem anexo físico.';
commit;

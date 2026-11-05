begin;
alter table public.team_private_documents drop constraint if exists team_private_documents_status_check;
alter table public.team_private_documents add constraint team_private_documents_status_check
  check (status in ('active','archived','deleted'));
alter table public.team_private_document_access drop constraint if exists team_private_document_access_action_check;
alter table public.team_private_document_access add constraint team_private_document_access_action_check
  check (action in ('upload','preview','field_read','archive','delete'));
comment on column public.team_private_documents.status is 'deleted representa exclusão lógica auditada e limpeza dos dados pessoais e do anexo.';
commit;

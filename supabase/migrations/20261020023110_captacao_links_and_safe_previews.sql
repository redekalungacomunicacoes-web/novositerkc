begin;

-- Preserve all stored documents while permitting link-only attachment records.
alter table public.captacao_anexos
  add column external_url text;

alter table public.captacao_anexos
  alter column storage_path drop not null;

alter table public.captacao_anexos
  add constraint captacao_anexos_source_check
  check (
    (storage_path is not null and external_url is null)
    or
    (storage_path is null and external_url is not null and external_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?)
  );

commit;
)
  );

commit;

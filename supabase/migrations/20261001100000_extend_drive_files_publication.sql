alter table public.drive_files
  add column if not exists visibility text not null default 'private',
  add column if not exists status text not null default 'active',
  add column if not exists public_slug text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists caption text,
  add column if not exists alt_text text,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'drive_files_visibility_check'
  ) then
    alter table public.drive_files
      add constraint drive_files_visibility_check
      check (visibility in ('private', 'public'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'drive_files_status_check'
  ) then
    alter table public.drive_files
      add constraint drive_files_status_check
      check (status in ('active', 'archived', 'trashed'));
  end if;
end $$;

create unique index if not exists drive_files_public_slug_uidx
  on public.drive_files(public_slug)
  where public_slug is not null;

create index if not exists drive_files_public_delivery_idx
  on public.drive_files(visibility, status, module, entity_id, sort_order);

drop policy if exists "public can read published drive files" on public.drive_files;
create policy "public can read published drive files"
  on public.drive_files
  for select
  to anon
  using (visibility = 'public' and status = 'active' and deleted_at is null);

comment on column public.drive_files.visibility is
  'private: somente administracao; public: pode ser entregue pelo endpoint publico de midia.';
comment on column public.drive_files.status is
  'active, archived ou trashed. Exclusao administrativa usa lixeira antes da remocao definitiva.';

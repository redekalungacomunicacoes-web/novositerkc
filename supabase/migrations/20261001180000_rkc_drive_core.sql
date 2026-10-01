-- RKC Drive: metadados de arquivos, escopo interno e leitura pública controlada.
begin;

create extension if not exists pgcrypto;

create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text,
  drive_folder_id text,
  name text not null default 'Arquivo',
  mime_type text,
  size_bytes bigint,
  module text not null default 'site',
  entity_id uuid,
  category text,
  uploaded_by uuid,
  web_view_link text,
  visibility text not null default 'private',
  status text not null default 'active',
  public_slug text,
  sort_order integer not null default 0,
  caption text,
  alt_text text,
  deleted_at timestamptz,
  task_id uuid references public.tasks(id) on delete set null,
  access_scope text not null default 'assignees',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mantém a migration segura se drive_files já existir com parte das colunas.
alter table public.drive_files
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists drive_file_id text,
  add column if not exists drive_folder_id text,
  add column if not exists name text not null default 'Arquivo',
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists module text not null default 'site',
  add column if not exists entity_id uuid,
  add column if not exists category text,
  add column if not exists uploaded_by uuid,
  add column if not exists web_view_link text,
  add column if not exists visibility text not null default 'private',
  add column if not exists status text not null default 'active',
  add column if not exists public_slug text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists caption text,
  add column if not exists alt_text text,
  add column if not exists deleted_at timestamptz,
  add column if not exists task_id uuid,
  add column if not exists access_scope text not null default 'assignees',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.drive_files'::regclass and conname='drive_files_task_id_fkey') then
    alter table public.drive_files add constraint drive_files_task_id_fkey
      foreign key (task_id) references public.tasks(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.drive_files'::regclass and conname='drive_files_visibility_check') then
    alter table public.drive_files add constraint drive_files_visibility_check check (visibility in ('private','public'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.drive_files'::regclass and conname='drive_files_status_check') then
    alter table public.drive_files add constraint drive_files_status_check check (status in ('active','archived','trashed'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.drive_files'::regclass and conname='drive_files_access_scope_check') then
    alter table public.drive_files add constraint drive_files_access_scope_check check (access_scope in ('assignees','team'));
  end if;
end $$;

create unique index if not exists drive_files_id_uidx on public.drive_files(id);
create unique index if not exists drive_files_drive_file_uidx on public.drive_files(drive_file_id) where drive_file_id is not null;
create unique index if not exists drive_files_public_slug_uidx on public.drive_files(public_slug) where public_slug is not null;
create index if not exists drive_files_module_entity_idx on public.drive_files(module, entity_id);
create index if not exists drive_files_task_scope_idx on public.drive_files(task_id, access_scope, status) where task_id is not null;
create index if not exists drive_files_uploaded_by_idx on public.drive_files(uploaded_by);

alter table public.drive_files enable row level security;

drop policy if exists "authenticated can read drive files" on public.drive_files;
drop policy if exists "authenticated can read scoped drive files" on public.drive_files;
drop policy if exists "authenticated_read_drive_files_scoped" on public.drive_files;
drop policy if exists "drive_files_select_scoped" on public.drive_files;
create policy "drive_files_select_scoped"
on public.drive_files for select to authenticated
using (
  public.is_task_admin(auth.uid())
  or (
    task_id is not null
    and exists (
      select 1 from public.tasks t
      join public.equipe me on me.user_id = auth.uid()
      where t.id = drive_files.task_id
        and (
          (t.access_scope = 'team' and me.ativo is not false)
          or t.created_by = me.id
          or t.assigned_to = me.id
          or coalesce(t.direcionamento, '{}'::uuid[]) @> array[me.id]
        )
    )
  )
);

drop policy if exists "public can read published drive files" on public.drive_files;
create policy "public can read published drive files"
on public.drive_files for select to anon
using (visibility = 'public' and status = 'active' and deleted_at is null and task_id is null);

comment on table public.drive_files is 'Metadados dos arquivos armazenados no Google Drive oficial da RKC.';
comment on column public.drive_files.access_scope is 'Escopo interno do anexo; independente de visibility para publicação web.';

commit;

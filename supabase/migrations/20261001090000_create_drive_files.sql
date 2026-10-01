create extension if not exists pgcrypto;

create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  drive_folder_id text,
  name text not null,
  mime_type text,
  size_bytes bigint,
  module text not null,
  entity_id uuid,
  category text,
  uploaded_by uuid references auth.users(id) on delete set null,
  web_view_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drive_files_module_entity_idx
  on public.drive_files(module, entity_id);

create index if not exists drive_files_uploaded_by_idx
  on public.drive_files(uploaded_by);

alter table public.drive_files enable row level security;

drop policy if exists "authenticated can read drive files" on public.drive_files;
create policy "authenticated can read drive files"
  on public.drive_files
  for select
  to authenticated
  using (true);

comment on table public.drive_files is
  'Metadados dos arquivos armazenados no Google Drive oficial da RKC. O binario nao fica no Supabase.';

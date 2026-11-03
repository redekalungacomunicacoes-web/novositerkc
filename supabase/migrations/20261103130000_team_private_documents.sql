begin;
-- Documentos internos da equipe. Nunca reutilizar buckets públicos de avatar/portfólio.
create table if not exists public.team_private_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.equipe(id) on delete restrict,
  document_type text not null check (document_type in
    ('rg','cpf','cnh','comprovante','curriculo','certificado','contrato','declaracao','autenticado','outro')),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  expires_on date,
  signed_copy boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_private_documents_member_active_idx on public.team_private_documents(member_id,created_at desc) where status='active';

create table if not exists public.team_private_document_access (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.team_private_documents(id) on delete restrict,
  actor_user_id uuid not null,
  action text not null check (action in ('upload','preview','field_read','archive')),
  field_name text,
  purpose text not null check (char_length(btrim(purpose)) between 3 and 400),
  created_at timestamptz not null default now()
);
create index if not exists team_private_document_access_document_idx on public.team_private_document_access(document_id,created_at desc);
create index if not exists team_private_document_access_actor_idx on public.team_private_document_access(actor_user_id,created_at desc);
alter table public.team_private_documents enable row level security;
alter table public.team_private_document_access enable row level security;
-- Sem SELECT/INSERT diretos ao frontend. Toda consulta passa por função autenticada e auditada.
revoke all on public.team_private_documents from public, anon, authenticated;
revoke all on public.team_private_document_access from public, anon, authenticated;
grant select,insert,update,delete on public.team_private_documents to service_role;
grant select,insert on public.team_private_document_access to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('team-internal-docs','team-internal-docs',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;
-- Intencionalmente sem policies SELECT em storage.objects para o bucket.
comment on table public.team_private_documents is 'Documentos pessoais/institucionais internos, acessíveis apenas via team-documents autenticada.';
comment on table public.team_private_document_access is 'Trilha obrigatória de visualização, leitura de dados e alterações de documentos internos.';
commit;

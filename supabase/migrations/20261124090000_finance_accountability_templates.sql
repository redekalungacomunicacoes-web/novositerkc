-- Estrutura inicial para modelos versionados de prestação de contas por edital.
-- Esta migration é aditiva: preserva o módulo financeiro existente e não altera dados atuais.
-- Aplicar somente após revisão e teste em ambiente controlado.

create table if not exists public.finance_reporting_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  institution_name text,
  funding_program text,
  cycle_name text,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  description text,
  spreadsheet_template_path text,
  narrative_template_path text,
  branding jsonb not null default '{}'::jsonb
    check (jsonb_typeof(branding) = 'object'),
  structure jsonb not null default '{}'::jsonb
    check (jsonb_typeof(structure) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, version)
);

create index if not exists finance_reporting_templates_status_idx
  on public.finance_reporting_templates(status);

create table if not exists public.finance_accountability_reports (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.finance_reporting_templates(id) on delete restrict,
  fund_id uuid references public.finance_funds(id) on delete set null,
  project_id uuid references public.finance_projects(id) on delete set null,
  title text not null,
  reference_code text,
  period_start date,
  period_end date,
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','published','archived')),
  financial_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(financial_data) = 'object'),
  narrative_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(narrative_data) = 'object'),
  public_slug text unique,
  public_enabled boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start is null or period_end is null or period_end >= period_start),
  check (not public_enabled or (status = 'published' and public_slug is not null))
);

create index if not exists finance_accountability_reports_template_idx
  on public.finance_accountability_reports(template_id);
create index if not exists finance_accountability_reports_fund_idx
  on public.finance_accountability_reports(fund_id);
create index if not exists finance_accountability_reports_project_idx
  on public.finance_accountability_reports(project_id);
create index if not exists finance_accountability_reports_period_idx
  on public.finance_accountability_reports(period_start, period_end);
create index if not exists finance_accountability_reports_status_idx
  on public.finance_accountability_reports(status);

create table if not exists public.finance_accountability_documents (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.finance_accountability_reports(id) on delete cascade,
  document_type text not null
    check (document_type in ('financial_spreadsheet','narrative_document','supporting_attachment','official_template')),
  template_version integer,
  file_name text not null,
  mime_type text,
  storage_path text not null,
  checksum_sha256 text,
  is_official_template boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  generated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists finance_accountability_documents_report_idx
  on public.finance_accountability_documents(report_id);

-- Histórico append-only: guarda versões dos dados antes/depois de alterações relevantes.
create table if not exists public.finance_accountability_history (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.finance_accountability_reports(id) on delete cascade,
  action text not null
    check (action in ('created','updated','submitted_for_review','approved','published','unpublished','document_generated','archived')),
  actor_id uuid references auth.users(id) on delete set null,
  change_summary text,
  snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists finance_accountability_history_report_idx
  on public.finance_accountability_history(report_id, created_at desc);

-- Reaproveita o mecanismo de atualização de timestamp já existente no módulo Financeiro.
drop trigger if exists trg_fin_reporting_templates_updated on public.finance_reporting_templates;
create trigger trg_fin_reporting_templates_updated
before update on public.finance_reporting_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_fin_accountability_reports_updated on public.finance_accountability_reports;
create trigger trg_fin_accountability_reports_updated
before update on public.finance_accountability_reports
for each row execute function public.set_updated_at();

alter table public.finance_reporting_templates enable row level security;
alter table public.finance_accountability_reports enable row level security;
alter table public.finance_accountability_documents enable row level security;
alter table public.finance_accountability_history enable row level security;

-- Inclui o papel financeiro já utilizado pelo painel administrativo.
create or replace function public.can_manage_finance_accountability()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name in ('admin_alfa', 'admin', 'financeiro')
  );
$;

revoke all on function public.can_manage_finance_accountability() from public;
grant execute on function public.can_manage_finance_accountability() to authenticated;

-- Administradores e integrantes com papel financeiro podem gerenciar estes registros.
-- A leitura pública será implementada por uma camada de publicação segura, sem expor JSON privado.
do $$ begin
  create policy "finance_reporting_templates_admin_all"
    on public.finance_reporting_templates for all to authenticated
    using (public.can_manage_finance_accountability()) with check (public.can_manage_finance_accountability());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_accountability_reports_admin_all"
    on public.finance_accountability_reports for all to authenticated
    using (public.can_manage_finance_accountability()) with check (public.can_manage_finance_accountability());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_accountability_documents_admin_all"
    on public.finance_accountability_documents for all to authenticated
    using (public.can_manage_finance_accountability()) with check (public.can_manage_finance_accountability());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_accountability_history_admin_select"
    on public.finance_accountability_history for select to authenticated
    using (public.can_manage_finance_accountability());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_accountability_history_admin_insert"
    on public.finance_accountability_history for insert to authenticated
    with check (public.can_manage_finance_accountability());
exception when duplicate_object then null; end $$;

comment on table public.finance_reporting_templates is
  'Modelos oficiais versionados de prestação de contas por instituição, edital e ciclo.';
comment on column public.finance_reporting_templates.structure is
  'Mapa JSON da estrutura original: abas, campos, fórmulas, validações, seções narrativas e indicadores.';
comment on table public.finance_accountability_reports is
  'Instâncias de prestação de contas vinculadas a um modelo, fundo e/ou projeto.';
comment on column public.finance_accountability_reports.financial_data is
  'Dados estruturados preenchidos para a parte financeira, preservando a semântica do modelo oficial.';
comment on column public.finance_accountability_reports.narrative_data is
  'Respostas narrativas e indicadores do formulário oficial.';
comment on table public.finance_accountability_documents is
  'Arquivos oficiais de origem, documentos gerados e anexos associados a uma prestação.';
comment on table public.finance_accountability_history is
  'Histórico de alterações e snapshots para rastreabilidade das prestações de contas.';

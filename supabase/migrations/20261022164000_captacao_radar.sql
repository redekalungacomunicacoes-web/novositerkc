-- Radar RKC: descoberta separada das candidaturas; sem envio automático.
create table if not exists public.captacao_radar_fontes (
 id uuid primary key default gen_random_uuid(), nome text not null, url text not null unique,
 ativa boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.captacao_radar_oportunidades (
 id uuid primary key default gen_random_uuid(), fonte_id uuid references public.captacao_radar_fontes(id) on delete set null,
 titulo text not null, organizador text, url_oficial text not null unique, prazo date, valor_estimado numeric(15,2),
 area text, resumo text, status_triagem text not null default 'nao_verificado'
 check (status_triagem in ('nao_verificado','em_analise','potencialmente_elegivel','inelegivel','arquivado')),
 motivo_triagem text, verificado_em timestamptz, captacao_edital_id uuid unique references public.captacao_editais(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists captacao_radar_oportunidades_prazo_idx on public.captacao_radar_oportunidades(prazo);
create table if not exists public.captacao_radar_sincronizacoes (
 id bigint generated always as identity primary key, iniciada_em timestamptz not null default now(),
 finalizada_em timestamptz, status text not null default 'executando' check(status in ('executando','sucesso','erro')),
 encontradas integer not null default 0, novas integer not null default 0, erro text
);
alter table public.captacao_radar_fontes enable row level security;
alter table public.captacao_radar_oportunidades enable row level security;
alter table public.captacao_radar_sincronizacoes enable row level security;
revoke all on public.captacao_radar_fontes,public.captacao_radar_oportunidades,public.captacao_radar_sincronizacoes from anon;
grant select on public.captacao_radar_fontes,public.captacao_radar_oportunidades,public.captacao_radar_sincronizacoes to authenticated;
create policy radar_fontes_read on public.captacao_radar_fontes for select to authenticated using (public.can_access_captacao());
create policy radar_oportunidades_read on public.captacao_radar_oportunidades for select to authenticated using (public.can_access_captacao());
create policy radar_sincronizacoes_read on public.captacao_radar_sincronizacoes for select to authenticated using (public.can_access_captacao());
-- Somente backend service_role pode coletar e atualizar dados; usuários autenticados não alteram radar diretamente.

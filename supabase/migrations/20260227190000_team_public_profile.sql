-- Página pública do integrante + admin equipe estendido

alter table if exists public.equipe
  add column if not exists slug text,
  add column if not exists curriculo_md text,
  add column if not exists whatsapp text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists website_url text,
  add column if not exists is_public boolean not null default false;

update public.equipe
set slug = lower(regexp_replace(coalesce(nome, id::text), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

create unique index if not exists equipe_slug_key on public.equipe (slug);
create index if not exists idx_equipe_slug on public.equipe (slug);

create table if not exists public.team_member_portfolio (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.equipe(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  title text,
  description text,
  file_url text not null,
  thumb_url text,
  order_index int not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.team_member_posts (
  member_id uuid not null references public.equipe(id) on delete cascade,
  post_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (member_id, post_id)
);

create index if not exists idx_team_member_portfolio_member_id on public.team_member_portfolio(member_id);
create index if not exists idx_team_member_posts_member_id on public.team_member_posts(member_id);

-- Fallback: só cria FK para matérias se a tabela existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='materias'
  ) THEN
    BEGIN
      ALTER TABLE public.team_member_posts
      ADD CONSTRAINT team_member_posts_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.materias(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

create or replace function public.set_equipe_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_equipe_updated_at on public.equipe;
create trigger trg_equipe_updated_at
before update on public.equipe
for each row execute function public.set_equipe_updated_at();

create or replace function public.is_team_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regclass('public.user_roles') is not null and to_regclass('public.roles') is not null then
    select exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('admin_alfa','admin','editor')
    ) into ok;
    if ok then return true; end if;
  end if;

  -- compatibilidade com função antiga do financeiro
  if to_regprocedure('public.is_admin()') is not null then
    execute 'select public.is_admin()' into ok;
    return coalesce(ok, false);
  end if;

  return false;
end;
$$;

grant execute on function public.is_team_admin() to anon, authenticated;

alter table if exists public.equipe enable row level security;
alter table if exists public.team_member_portfolio enable row level security;
alter table if exists public.team_member_posts enable row level security;

-- leitura pública apenas perfil publicado
DO $$ BEGIN
  create policy "equipe_public_select" on public.equipe
  for select to anon, authenticated
  using (coalesce(is_public,false) = true and coalesce(ativo,true) = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "equipe_admin_all" on public.equipe
  for all to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "team_portfolio_public_select" on public.team_member_portfolio
  for select to anon, authenticated
  using (
    is_public = true
    and exists (
      select 1 from public.equipe e
      where e.id = team_member_portfolio.member_id
        and coalesce(e.is_public,false) = true
        and coalesce(e.ativo,true) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "team_portfolio_admin_all" on public.team_member_portfolio
  for all to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "team_posts_public_select" on public.team_member_posts
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.equipe e
      where e.id = team_member_posts.member_id
        and coalesce(e.is_public,false) = true
        and coalesce(e.ativo,true) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "team_posts_admin_all" on public.team_member_posts
  for all to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('team-avatars', 'team-avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('team-portfolio', 'team-portfolio', true)
on conflict (id) do nothing;

-- leitura pública objetos (o arquivo deve estar em bucket público)
DO $$ BEGIN
  create policy "team_storage_public_read" on storage.objects
  for select to public
  using (bucket_id in ('team-avatars', 'team-portfolio'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "team_storage_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('team-avatars', 'team-portfolio') and public.is_team_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "team_storage_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('team-avatars', 'team-portfolio') and public.is_team_admin())
  with check (bucket_id in ('team-avatars', 'team-portfolio') and public.is_team_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "team_storage_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('team-avatars', 'team-portfolio') and public.is_team_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

comment on table public.team_member_posts is 'Relação integrante x matérias. TODO: se public.materias não existir, manter integração via app.';

alter table if exists public.site_settings
  add column if not exists google_analytics_enabled boolean not null default false,
  add column if not exists google_analytics_measurement_id text;

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  view_date date not null default (timezone('America/Sao_Paulo', now()))::date,
  page_type text not null check (page_type in ('site', 'materia', 'projeto')),
  path text,
  content_id uuid,
  content_slug text,
  session_id text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists page_views_created_at_idx on public.page_views(created_at desc);
create index if not exists page_views_view_date_idx on public.page_views(view_date desc);
create index if not exists page_views_type_date_idx on public.page_views(page_type, view_date desc);
create index if not exists page_views_content_idx on public.page_views(content_id, page_type);

alter table public.page_views enable row level security;

drop policy if exists "Public can insert page views" on public.page_views;

create policy "Public can insert page views"
  on public.page_views
  for insert
  to anon, authenticated
  with check (true);

create or replace function public.track_page_view(
  p_page_type text,
  p_path text default null,
  p_content_id uuid default null,
  p_content_slug text default null,
  p_session_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_page_type not in ('site', 'materia', 'projeto') then
    raise exception 'page_type inválido: %', p_page_type;
  end if;

  insert into public.page_views (
    page_type,
    path,
    content_id,
    content_slug,
    session_id,
    meta
  )
  values (
    p_page_type,
    p_path,
    p_content_id,
    p_content_slug,
    nullif(trim(p_session_id), ''),
    coalesce(p_meta, '{}'::jsonb)
  );
end;
$$;

create or replace function public.public_content_view_count(
  p_page_type text,
  p_content_id uuid default null,
  p_content_slug text default null
)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.page_views pv
  where pv.page_type = p_page_type
    and (
      (p_content_id is not null and pv.content_id = p_content_id)
      or (p_content_id is null and p_content_slug is not null and pv.content_slug = p_content_slug)
    );
$$;

create or replace function public.admin_dashboard_analytics(p_days integer default 14)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  is_admin_user boolean := false;
  safe_days integer := greatest(1, least(coalesce(p_days, 14), 90));
begin
  if uid is null then
    raise exception 'Acesso negado: usuário não autenticado.' using errcode = '42501';
  end if;

  if to_regclass('public.user_roles') is not null and to_regclass('public.roles') is not null then
    select exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = uid
        and r.name in ('admin_alfa', 'admin')
    )
    into is_admin_user;
  end if;

  if not is_admin_user and to_regprocedure('public.is_admin()') is not null then
    begin
      execute 'select public.is_admin()' into is_admin_user;
    exception
      when others then
        raise warning 'Falha ao validar public.is_admin(): %', sqlerrm;
    end;
  end if;

  if not coalesce(is_admin_user, false) then
    raise exception 'Acesso negado: apenas administradores podem consultar analytics.' using errcode = '42501';
  end if;

  return json_build_object(
    'site_total', (
      select count(*)::bigint
      from public.page_views
      where page_type = 'site'
    ),
    'last_days_total', (
      select count(*)::bigint
      from public.page_views
      where view_date >= current_date - (safe_days - 1)
    ),
    'daily', (
      select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json)
      from (
        select d.day,
               coalesce(sum(case when pv.page_type = 'site' then 1 else 0 end), 0)::bigint as site,
               coalesce(sum(case when pv.page_type = 'materia' then 1 else 0 end), 0)::bigint as materias,
               coalesce(sum(case when pv.page_type = 'projeto' then 1 else 0 end), 0)::bigint as projetos,
               coalesce(count(pv.id), 0)::bigint as total
        from generate_series(current_date - (safe_days - 1), current_date, interval '1 day') d(day)
        left join public.page_views pv on pv.view_date = d.day
        group by d.day
      ) t
    ),
    'top_materias', (
      select coalesce(json_agg(row_to_json(t) order by t.views desc), '[]'::json)
      from (
        select m.id,
               m.titulo,
               m.slug,
               count(*)::bigint as views
        from public.page_views pv
        join public.materias m on m.id = pv.content_id
        where pv.page_type = 'materia'
          and pv.view_date >= current_date - (safe_days - 1)
        group by m.id, m.titulo, m.slug
        order by views desc
        limit 5
      ) t
    ),
    'top_projetos', (
      select coalesce(json_agg(row_to_json(t) order by t.views desc), '[]'::json)
      from (
        select p.id,
               p.titulo,
               p.slug,
               count(*)::bigint as views
        from public.page_views pv
        join public.projetos p on p.id = pv.content_id
        where pv.page_type = 'projeto'
          and pv.view_date >= current_date - (safe_days - 1)
        group by p.id, p.titulo, p.slug
        order by views desc
        limit 5
      ) t
    )
  );
end;
$$;

revoke all on function public.track_page_view(text, text, uuid, text, text, jsonb) from public;
grant execute on function public.track_page_view(text, text, uuid, text, text, jsonb) to anon, authenticated;

revoke all on function public.public_content_view_count(text, uuid, text) from public;
grant execute on function public.public_content_view_count(text, uuid, text) to anon, authenticated;

revoke all on function public.admin_dashboard_analytics(integer) from public;
grant execute on function public.admin_dashboard_analytics(integer) to authenticated;

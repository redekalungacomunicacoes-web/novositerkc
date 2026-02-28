create or replace function public.admin_dashboard_counts()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  is_admin_user boolean := false;

  materias_count bigint;
  projetos_count bigint;
  equipe_count bigint;
  newsletter_count bigint;
  usuarios_count bigint;
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
    raise exception 'Acesso negado: apenas administradores podem consultar os KPIs.' using errcode = '42501';
  end if;

  if to_regclass('public.materias') is not null then
    execute 'select count(*) from public.materias' into materias_count;
  elsif to_regclass('public.materias_site') is not null then
    execute 'select count(*) from public.materias_site' into materias_count;
  elsif to_regclass('public.posts') is not null then
    execute 'select count(*) from public.posts' into materias_count;
  else
    raise warning 'Tabela de matérias não encontrada (materias/materias_site/posts).';
    materias_count := null;
  end if;

  if to_regclass('public.projetos') is not null then
    execute 'select count(*) from public.projetos' into projetos_count;
  elsif to_regclass('public.projects') is not null then
    execute 'select count(*) from public.projects' into projetos_count;
  else
    raise warning 'Tabela de projetos não encontrada (projetos/projects).';
    projetos_count := null;
  end if;

  if to_regclass('public.equipe') is not null then
    execute 'select count(*) from public.equipe' into equipe_count;
  else
    raise warning 'Tabela de equipe não encontrada (equipe).';
    equipe_count := null;
  end if;

  if to_regclass('public.newsletter_subscribers') is not null then
    execute 'select count(*) from public.newsletter_subscribers' into newsletter_count;
  elsif to_regclass('public.newsletter_contacts') is not null then
    execute 'select count(*) from public.newsletter_contacts' into newsletter_count;
  elsif to_regclass('public.newsletter_emails') is not null then
    execute 'select count(*) from public.newsletter_emails' into newsletter_count;
  else
    raise warning 'Tabela de newsletter não encontrada (newsletter_subscribers/newsletter_contacts/newsletter_emails).';
    newsletter_count := null;
  end if;

  begin
    execute 'select count(*) from auth.users' into usuarios_count;
  exception
    when others then
      raise warning 'Não foi possível contar auth.users: %', sqlerrm;
      usuarios_count := null;
  end;

  return json_build_object(
    'materias', materias_count,
    'projetos', projetos_count,
    'equipe', equipe_count,
    'newsletter', newsletter_count,
    'usuarios', usuarios_count
  );
end;
$$;

revoke all on function public.admin_dashboard_counts() from public;
grant execute on function public.admin_dashboard_counts() to authenticated;

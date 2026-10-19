-- Restrict RPC grants for captação helpers and internal trigger functions.
-- RLS evaluates access helpers as the requesting authenticated user.
create or replace function public.can_access_captacao(p_user_id uuid default auth.uid())
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_user_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and r.name in ('admin_alfa','admin','editor','autor','financeiro')
  );
$$;

create or replace function public.is_captacao_manager(p_user_id uuid default auth.uid())
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_user_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.equipe e where e.user_id = p_user_id
      and lower(trim(e.nome)) = 'felipe' and coalesce(e.ativo, true)
  );
$$;

revoke all on function public.can_access_captacao(uuid) from public, anon;
grant execute on function public.can_access_captacao(uuid) to authenticated;
revoke all on function public.is_captacao_manager(uuid) from public, anon, authenticated;
revoke all on function public.captacao_assign_protocol() from public, anon, authenticated;
revoke all on function public.captacao_guard_editais() from public, anon, authenticated;
revoke all on function public.captacao_audit_change() from public, anon, authenticated;
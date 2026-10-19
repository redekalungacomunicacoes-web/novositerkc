-- The manager check only reads the caller's own role under existing RLS policies.
create or replace function public.is_captacao_manager(p_user_id uuid default auth.uid())
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p_user_id and r.name = 'admin_alfa'
    );
$$;
revoke all on function public.is_captacao_manager(uuid) from public, anon;
grant execute on function public.is_captacao_manager(uuid) to authenticated;
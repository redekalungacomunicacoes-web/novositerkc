-- Harden edital creation, eligibility approval, and manager advancement.
-- Existing rows are preserved; any eligibility change invalidates prior approvals.
create or replace function public.is_captacao_manager(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p_user_id and r.name = 'admin_alfa'
    );
$$;
revoke all on function public.is_captacao_manager(uuid) from public, anon;
grant execute on function public.is_captacao_manager(uuid) to authenticated;

create or replace function public.captacao_guard_editais()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_requirements integer;
  v_met integer;
begin
  if tg_op = 'INSERT' then
    if new.eligibility_status <> 'pending_verification'
      or new.eligibility_opinion is not null
      or new.manager_approved_at is not null
      or new.manager_approved_by is not null
      or new.status in ('em_elaboracao','inscrito') then
      raise exception 'Novos editais iniciam sem aprovação e sem avanço de etapa.' using errcode = '42501';
    end if;
  else
    if new.manager_approved_at is distinct from old.manager_approved_at
      and new.manager_approved_at is not null then
      if not public.is_captacao_manager(v_actor) then
        raise exception 'A autorização de avanço pertence somente ao gestor Felipe.' using errcode = '42501';
      end if;
      if new.eligibility_status <> 'approved'
        or nullif(trim(new.eligibility_opinion), '') is null then
        raise exception 'A elegibilidade deve estar aprovada e documentada antes do avanço.' using errcode = '42501';
      end if;
      select count(*), count(*) filter (where status = 'met')
        into v_requirements, v_met
        from public.captacao_requisitos where edital_id = new.id;
      if v_requirements = 0 or v_requirements <> v_met then
        raise exception 'Todos os requisitos precisam estar atendidos antes do avanço.' using errcode = '42501';
      end if;
      select e.id into new.manager_approved_by from public.equipe e
      where e.user_id = v_actor and coalesce(e.ativo,true) limit 1;
    end if;

    if new.eligibility_status is distinct from old.eligibility_status then
      new.eligibility_reviewed_at := now();
      select e.id into new.eligibility_reviewed_by from public.equipe e
      where e.user_id = v_actor and coalesce(e.ativo,true) limit 1;
    end if;

    if new.eligibility_status = 'approved' and (
      nullif(trim(new.eligibility_opinion), '') is null
    ) then
      raise exception 'Registre um parecer antes de aprovar a elegibilidade.' using errcode = '42501';
    end if;
    if new.eligibility_status = 'approved' then
      select count(*), count(*) filter (where status = 'met')
        into v_requirements, v_met
        from public.captacao_requisitos where edital_id = new.id;
      if v_requirements = 0 or v_requirements <> v_met then
        raise exception 'A elegibilidade exige todos os requisitos registrados como atendidos.' using errcode = '42501';
      end if;
    end if;
  end if;

  if new.status in ('em_elaboracao','inscrito') and (
    new.eligibility_status <> 'approved' or new.manager_approved_at is null
  ) then
    raise exception 'A elaboração está bloqueada até a elegibilidade ser aprovada e o gestor autorizar o avanço.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.captacao_invalidate_eligibility()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_edital_id uuid;
begin
  v_edital_id := case when tg_op = 'DELETE' then old.edital_id else new.edital_id end;
  update public.captacao_editais
    set eligibility_status = 'pending_verification',
        eligibility_opinion = null,
        eligibility_reviewed_at = null,
        eligibility_reviewed_by = null,
        manager_approved_at = null,
        manager_approved_by = null,
        status = case when status in ('em_elaboracao','inscrito') then 'pending_eligibility' else status end
  where id = v_edital_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists captacao_requisitos_invalidate_eligibility on public.captacao_requisitos;
create trigger captacao_requisitos_invalidate_eligibility
after insert or update or delete on public.captacao_requisitos
for each row execute function public.captacao_invalidate_eligibility();

revoke all on function public.captacao_guard_editais() from public, anon, authenticated;
revoke all on function public.captacao_invalidate_eligibility() from public, anon, authenticated;

-- Painel privado de editais e captação da Rede Kalunga.
-- Não executa alterações sobre tabelas existentes; módulo independente.

begin;

create sequence if not exists public.captacao_protocol_seq start with 4;

create or replace function public.can_access_captacao(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and r.name in ('admin_alfa','admin','editor','autor','financeiro')
  );
$$;

create or replace function public.is_captacao_manager(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.equipe e where e.user_id = p_user_id
      and lower(trim(e.nome)) = 'felipe' and coalesce(e.ativo, true)
  );
$$;

revoke all on function public.can_access_captacao(uuid) from public;
grant execute on function public.can_access_captacao(uuid) to authenticated;
revoke all on function public.is_captacao_manager(uuid) from public;
grant execute on function public.is_captacao_manager(uuid) to authenticated;
grant usage, select on sequence public.captacao_protocol_seq to authenticated;

create table if not exists public.captacao_editais (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  title text not null,
  funder text not null,
  category text not null default 'Não informado',
  deadline date,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation','pending_eligibility','em_elaboracao','inscrito','encerrado')),
  eligibility_status text not null default 'pending_verification' check (eligibility_status in ('pending_verification','approved','not_eligible')),
  eligibility_opinion text,
  eligibility_reviewed_by uuid references public.equipe(id) on delete set null,
  eligibility_reviewed_at timestamptz,
  manager_approved_at timestamptz,
  manager_approved_by uuid references public.equipe(id) on delete set null,
  created_by uuid references public.equipe(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.captacao_assign_protocol()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.protocol is null or btrim(new.protocol) = '' then
    new.protocol := 'RKC-CAP-' || extract(year from now())::text || '-' || lpad(nextval('public.captacao_protocol_seq')::text, 3, '0');
  end if;
  if new.created_by is null then
    select e.id into new.created_by from public.equipe e where e.user_id = auth.uid() and coalesce(e.ativo, true) limit 1;
  end if;
  return new;
end;
$$;
create trigger captacao_editais_assign_protocol before insert on public.captacao_editais for each row execute function public.captacao_assign_protocol();

create table if not exists public.captacao_requisitos (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.captacao_editais(id) on delete cascade,
  description text not null,
  status text not null default 'pending' check (status in ('pending','met','not_met')),
  evidence text,
  reviewed_by uuid references public.equipe(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.captacao_tarefas (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.captacao_editais(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.equipe(id) on delete set null,
  due_date date,
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluida')),
  created_by uuid references public.equipe(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.captacao_anexos (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.captacao_editais(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  category text not null default 'documento' check (category in ('documento','regulamento','proposta','orcamento','comprovante')),
  uploaded_by uuid references public.equipe(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.captacao_auditoria (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id uuid not null,
  edital_id uuid,
  action text not null,
  actor_id uuid,
  actor_name text not null default 'Sistema',
  detail text not null default '',
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.captacao_guard_editais()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    if new.manager_approved_at is distinct from old.manager_approved_at then
      if not public.is_captacao_manager(v_actor) or new.manager_approved_at is null then
        raise exception 'A autorização de avanço pertence somente ao gestor Felipe.' using errcode = '42501';
      end if;
      new.manager_approved_by := (select e.id from public.equipe e where e.user_id = v_actor and lower(trim(e.nome))='felipe' limit 1);
    end if;
    if new.eligibility_status is distinct from old.eligibility_status then
      new.eligibility_reviewed_at := now();
      new.eligibility_reviewed_by := (select e.id from public.equipe e where e.user_id = v_actor and coalesce(e.ativo,true) limit 1);
      if new.eligibility_status = 'approved' and nullif(trim(new.eligibility_opinion), '') is null then
        raise exception 'Registre um parecer antes de aprovar a elegibilidade.';
      end if;
    end if;
  end if;
  if new.status in ('em_elaboracao','inscrito') and (new.eligibility_status <> 'approved' or new.manager_approved_at is null) then
    raise exception 'A elaboração está bloqueada até a elegibilidade ser aprovada e o gestor Felipe autorizar o avanço.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger captacao_editais_guard before insert or update on public.captacao_editais for each row execute function public.captacao_guard_editais();

create or replace function public.captacao_audit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_id uuid; v_edital_id uuid; v_actor uuid := auth.uid(); v_name text;
begin
  v_row := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := (v_row->>'id')::uuid;
  v_edital_id := coalesce(nullif(v_row->>'edital_id','')::uuid, v_id);
  select e.nome into v_name from public.equipe e where e.user_id=v_actor and coalesce(e.ativo,true) limit 1;
  insert into public.captacao_auditoria(entity,entity_id,edital_id,action,actor_id,actor_name,detail,changes)
  values (tg_table_name,v_id,v_edital_id,lower(tg_op),v_actor,coalesce(v_name,'Sistema'),coalesce(v_row->>'protocol',v_row->>'title',v_row->>'description',v_row->>'file_name',''),
    jsonb_build_object('before',case when tg_op='INSERT' then null else to_jsonb(old) end,'after',case when tg_op='DELETE' then null else to_jsonb(new) end));
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create trigger captacao_audit_editais after insert or update or delete on public.captacao_editais for each row execute function public.captacao_audit_change();
create trigger captacao_audit_requisitos after insert or update or delete on public.captacao_requisitos for each row execute function public.captacao_audit_change();
create trigger captacao_audit_tarefas after insert or update or delete on public.captacao_tarefas for each row execute function public.captacao_audit_change();
create trigger captacao_audit_anexos after insert or update or delete on public.captacao_anexos for each row execute function public.captacao_audit_change();

alter table public.captacao_editais enable row level security;
alter table public.captacao_requisitos enable row level security;
alter table public.captacao_tarefas enable row level security;
alter table public.captacao_anexos enable row level security;
alter table public.captacao_auditoria enable row level security;

create policy captacao_editais_read on public.captacao_editais for select to authenticated using (public.can_access_captacao());
create policy captacao_editais_create on public.captacao_editais for insert to authenticated with check (public.can_access_captacao());
create policy captacao_editais_update on public.captacao_editais for update to authenticated using (public.can_access_captacao()) with check (public.can_access_captacao());
create policy captacao_requisitos_access on public.captacao_requisitos for all to authenticated using (public.can_access_captacao()) with check (public.can_access_captacao());
create policy captacao_tarefas_access on public.captacao_tarefas for all to authenticated using (public.can_access_captacao()) with check (public.can_access_captacao());
create policy captacao_anexos_access on public.captacao_anexos for all to authenticated using (public.can_access_captacao()) with check (public.can_access_captacao());
create policy captacao_auditoria_read on public.captacao_auditoria for select to authenticated using (public.can_access_captacao());
revoke all on public.captacao_auditoria from anon, authenticated;
grant select on public.captacao_auditoria to authenticated;
grant insert, update, delete on public.captacao_editais, public.captacao_requisitos, public.captacao_tarefas, public.captacao_anexos to authenticated;
grant select on public.captacao_editais, public.captacao_requisitos, public.captacao_tarefas, public.captacao_anexos to authenticated;

insert into public.captacao_editais(protocol,title,funder,category,deadline,status,eligibility_status)
values
('RKC-CAP-2026-001','Acelere o Relógio da Igualdade','Plan Brasil','Oportunidade de captação','2026-11-11','pending_confirmation','pending_verification'),
('RKC-CAP-2026-002','Arranjos Regionais FSA Goiás — Produção Audiovisual','FSA / Goiás','Produção Audiovisual',null,'pending_confirmation','pending_verification'),
('RKC-CAP-2026-003','Arranjos Regionais FSA Goiás — Comercialização','FSA / Goiás','Comercialização',null,'pending_confirmation','pending_verification')
on conflict(protocol) do nothing;

insert into storage.buckets(id,name,public) values ('captacao-editais','captacao-editais',false) on conflict(id) do update set public=false;
create policy captacao_storage_read on storage.objects for select to authenticated using (bucket_id='captacao-editais' and public.can_access_captacao() and exists(select 1 from public.captacao_editais e where e.id::text=(storage.foldername(name))[1]));
create policy captacao_storage_insert on storage.objects for insert to authenticated with check (bucket_id='captacao-editais' and public.can_access_captacao() and exists(select 1 from public.captacao_editais e where e.id::text=(storage.foldername(name))[1]));
create policy captacao_storage_delete on storage.objects for delete to authenticated using (bucket_id='captacao-editais' and public.can_access_captacao() and exists(select 1 from public.captacao_editais e where e.id::text=(storage.foldername(name))[1]));

commit;

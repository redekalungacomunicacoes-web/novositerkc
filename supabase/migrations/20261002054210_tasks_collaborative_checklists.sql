begin;
alter table public.tasks
 add column if not exists expected_delivery text,
 add column if not exists completion_criteria text,
 add column if not exists project_id uuid references public.projetos(id) on delete set null,
 add column if not exists reviewer_id uuid references public.equipe(id) on delete set null,
 add column if not exists blocked_reason text,
 add column if not exists blocked_by uuid references public.equipe(id) on delete set null,
 add column if not exists workflow_version integer not null default 0,
 add column if not exists reopen_reason text;
create index if not exists tasks_project_idx on public.tasks(project_id);
create table public.task_checklist_items (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 300), note text,
 position integer not null default 0, completed_at timestamptz,
 completed_by uuid references public.equipe(id) on delete set null,
 assignee_id uuid references public.equipe(id) on delete set null, due_date date,
 created_at timestamptz not null default now(), unique(task_id,id)
);
create index task_checklist_order_idx on public.task_checklist_items(task_id,position,id);
create table public.task_file_links (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
 item_id uuid, drive_file_id uuid references public.drive_files(id) on delete cascade,
 legacy_attachment_id uuid references public.task_attachments(id) on delete cascade,
 purpose text not null check(purpose in ('stage','final')),
 check(num_nonnulls(drive_file_id,legacy_attachment_id)=1),
 check((purpose='stage' and item_id is not null) or (purpose='final' and item_id is null)),
 foreign key(task_id,item_id) references public.task_checklist_items(task_id,id) on delete cascade
);
create unique index task_file_links_unique on public.task_file_links(task_id,coalesce(item_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(drive_file_id,legacy_attachment_id),purpose);
create table public.task_workflow_history (
 id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id) on delete cascade,
 actor_id uuid references public.equipe(id) on delete set null, event text not null, detail jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index task_workflow_history_idx on public.task_workflow_history(task_id,created_at desc);
create table public.task_workflow_requests (
 task_id uuid not null references public.tasks(id) on delete cascade,request_id uuid not null,
 actor_user_id uuid not null, primary key(task_id,request_id)
);
-- Narrow private implementation: only the authenticated wrapper may invoke it.
create schema if not exists task_workflow_private;
revoke all on schema task_workflow_private from public;
grant usage on schema task_workflow_private to authenticated;
create function task_workflow_private.can_access(p_task uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
 select 1 from public.tasks t where t.id=p_task and (public.is_team_admin() or exists(
 select 1 from public.equipe e where e.user_id=auth.uid() and e.ativo is not false and
 (e.id in(t.created_by,t.assigned_to,t.reviewer_id) or exists(select 1 from public.task_assignees a where a.task_id=t.id and a.user_id=e.id)))))
$$;
revoke all on function task_workflow_private.can_access(uuid) from public;
grant execute on function task_workflow_private.can_access(uuid) to authenticated;
drop policy if exists tasks_read_guard on public.tasks;
create policy tasks_read_guard on public.tasks as restrictive for select to authenticated using(task_workflow_private.can_access(id));
create policy tasks_workflow_read on public.tasks for select to authenticated using(task_workflow_private.can_access(id));
create policy tasks_reviewer_approve on public.tasks for update to authenticated
using(exists(select 1 from public.equipe e where e.id=reviewer_id and e.user_id=auth.uid() and e.ativo is not false))
with check(exists(select 1 from public.equipe e where e.id=reviewer_id and e.user_id=auth.uid() and e.ativo is not false));
revoke insert,update,delete on public.task_assignees from authenticated;
-- New tables are read-only to clients. All writes go through a serialized, checked transaction.
alter table public.task_checklist_items enable row level security;
alter table public.task_file_links enable row level security;
alter table public.task_workflow_history enable row level security;
alter table public.task_workflow_requests enable row level security;
revoke all on public.task_checklist_items,public.task_file_links,public.task_workflow_history,public.task_workflow_requests from anon,authenticated;
grant select on public.task_checklist_items,public.task_file_links,public.task_workflow_history to authenticated;
grant all on public.task_checklist_items,public.task_file_links,public.task_workflow_history,public.task_workflow_requests to service_role;
create policy checklist_read on public.task_checklist_items for select to authenticated using(task_workflow_private.can_access(task_id));
create policy file_links_read on public.task_file_links for select to authenticated using(task_workflow_private.can_access(task_id));
create policy history_read on public.task_workflow_history for select to authenticated using(task_workflow_private.can_access(task_id));
create policy assignees_read_guard on public.task_assignees as restrictive for select to authenticated using(task_workflow_private.can_access(task_id));
-- Aggregate per task; no attachments/history loaded for cards.
create view public.task_checklist_progress with(security_invoker=true) as
 select task_id,count(*)::integer total,count(completed_at)::integer completed,
 round(count(completed_at)*100.0/nullif(count(*),0))::integer percent
 from public.task_checklist_items group by task_id;
revoke all on public.task_checklist_progress from anon;
grant select on public.task_checklist_progress to authenticated;

-- Defense for all existing status/edit paths, including PostgREST and service-role writes.
create function task_workflow_private.guard_task() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; manager boolean; pending integer;
begin
 select id into actor from public.equipe where user_id=auth.uid() and ativo is not false limit 1;
 manager:=coalesce(public.is_team_admin(),false) or actor in(old.created_by,old.assigned_to);
 if old.status in('concluida','concluido') and (new.status is distinct from old.status) then
  if not coalesce(manager,false) or nullif(btrim(new.reopen_reason),'') is null then raise exception 'Reabra a tarefa informando o motivo antes de ampliar o trabalho.'; end if;
 end if;
 if new.status in('concluida','concluido') and old.status not in('concluida','concluido') then
  select count(*) into pending from public.task_checklist_items where task_id=old.id and completed_at is null;
  if pending>0 then raise exception 'Há % etapas pendentes. Conclua o checklist antes de finalizar.',pending; end if;
  if old.reviewer_id is not null then
   if actor is distinct from old.reviewer_id or old.status<>'revisao' then raise exception 'Somente a pessoa revisora pode aprovar uma entrega em revisão.'; end if;
  elsif actor is distinct from old.assigned_to then raise exception 'Somente o responsável principal pode concluir a entrega.'; end if;
 end if;
 if new.status is distinct from old.status and new.status not in('concluida','concluido') and not coalesce(manager,false) then raise exception 'Somente o responsável, criador ou administrador pode mudar o status.'; end if;
 if new.status='revisao' and old.status<>'revisao' then
  if not coalesce(manager,false) then raise exception 'Somente o responsável, criador ou administrador pode solicitar revisão.'; end if;
  if exists(select 1 from public.task_checklist_items where task_id=old.id and completed_at is null) then raise exception 'Conclua as etapas pendentes antes de solicitar revisão.'; end if;
 end if;
 if auth.uid() is not null and current_setting('rkc.workflow_write',true) is distinct from 'on' then
  if (new.expected_delivery,new.completion_criteria,new.project_id,new.reviewer_id,new.blocked_reason,new.blocked_by,new.workflow_version,new.reopen_reason)
    is distinct from (old.expected_delivery,old.completion_criteria,old.project_id,old.reviewer_id,old.blocked_reason,old.blocked_by,old.workflow_version,old.reopen_reason) then
   raise exception 'Use o fluxo de detalhes para alterar a organização da tarefa.';
  end if;
  if not coalesce(manager,false) and (new.titulo,new.descricao,new.assigned_to,new.direcionamento,new.data_inicio,new.data_fim,new.prioridade) is distinct from
     (old.titulo,old.descricao,old.assigned_to,old.direcionamento,old.data_inicio,old.data_fim,old.prioridade) then raise exception 'Somente o responsável, criador ou administrador pode editar a tarefa.'; end if;
 end if;
 if old.status in('concluida','concluido') and new.status=old.status and
 (new.expected_delivery,new.completion_criteria,new.reviewer_id,new.blocked_reason,new.titulo,new.descricao,new.assigned_to,new.data_inicio,new.data_fim) is distinct from (old.expected_delivery,old.completion_criteria,old.reviewer_id,old.blocked_reason,old.titulo,old.descricao,old.assigned_to,old.data_inicio,old.data_fim) then
 raise exception 'Reabra a tarefa antes de alterar a entrega.'; end if;
 if new.status is distinct from old.status then
  insert into public.task_workflow_history(task_id,actor_id,event,detail) values(old.id,actor,
  case when old.status in('concluida','concluido') then 'task_reopened' when new.status='concluida' then 'approved' when new.status='revisao' then 'review_requested' else 'status_changed' end,
  jsonb_build_object('from',old.status,'to',new.status,'reason',new.reopen_reason));
 end if;
 return new;
end $$;
revoke all on function task_workflow_private.guard_task() from public;
create trigger task_workflow_guard before update on public.tasks for each row execute function task_workflow_private.guard_task();

create function task_workflow_private.mutate(p_task uuid,p_action text,p_payload jsonb,p_version integer,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.tasks; actor uuid; manager boolean; item uuid; step jsonb; pos integer; f uuid; legacy uuid; total integer; done integer;
begin
 if auth.uid() is null or not task_workflow_private.can_access(p_task) then raise exception 'Sem acesso à tarefa.' using errcode='42501'; end if;
 select * into t from public.tasks where id=p_task for update;
 select id into actor from public.equipe where user_id=auth.uid() and ativo is not false limit 1;
 if actor is null then raise exception 'Cadastro ativo na equipe obrigatório.'; end if;
 manager:=coalesce(public.is_team_admin(),false) or actor in(t.created_by,t.assigned_to);
 if exists(select 1 from public.task_workflow_requests where task_id=p_task and request_id=p_request and actor_user_id=auth.uid()) then
  return jsonb_build_object('version',t.workflow_version,'replayed',true);
 end if;
 if p_version is distinct from t.workflow_version then raise exception 'A tarefa mudou em outra sessão. Atualize os detalhes e tente novamente.' using errcode='40001'; end if;
 if t.status in('concluida','concluido') and p_action<>'reopen' then raise exception 'Reabra a tarefa e registre o motivo antes de alterar o trabalho.'; end if;
 if p_action in('metadata','collaborators','add','edit','delete','order','template','reopen','review') and not coalesce(manager,false) then raise exception 'Somente o responsável, criador ou administrador pode organizar a tarefa.' using errcode='42501'; end if;
 perform set_config('rkc.workflow_write','on',true);
 item:=nullif(p_payload->>'item_id','')::uuid;
 if p_action in('edit','delete','toggle') and not exists(select 1 from public.task_checklist_items where id=item and task_id=p_task) then raise exception 'Etapa não encontrada nesta tarefa.'; end if;
 if p_action in('add','edit','template') then
  if p_action='template' and (jsonb_typeof(p_payload->'steps') is distinct from 'array' or jsonb_array_length(p_payload->'steps') not between 1 and 100) then raise exception 'Informe de 1 a 100 etapas para o modelo.'; end if;
  for step in select value from jsonb_array_elements(case when p_action='template' then p_payload->'steps' else jsonb_build_array(p_payload) end) loop
   if nullif(step->>'assignee_id','') is not null then
    if not exists(select 1 from public.equipe where id=(step->>'assignee_id')::uuid and ativo is not false) then raise exception 'Responsável da etapa inválido.'; end if;
    insert into public.task_assignees(task_id,user_id) values(p_task,(step->>'assignee_id')::uuid) on conflict(task_id,user_id) do nothing;
   end if;
  end loop;
 end if;
 if p_action='metadata' then
  if nullif(p_payload->>'reviewer_id','') is not null and not exists(select 1 from public.equipe where id=(p_payload->>'reviewer_id')::uuid and ativo is not false) then raise exception 'Revisor inválido.'; end if;
  update public.tasks set expected_delivery=nullif(btrim(p_payload->>'expected_delivery'),''),completion_criteria=nullif(btrim(p_payload->>'completion_criteria'),''),
   project_id=nullif(p_payload->>'project_id','')::uuid,reviewer_id=nullif(p_payload->>'reviewer_id','')::uuid,
   blocked_reason=nullif(btrim(p_payload->>'blocked_reason'),''),blocked_by=nullif(p_payload->>'blocked_by','')::uuid where id=p_task;
 elsif p_action='collaborators' then
  if exists(select 1 from jsonb_array_elements_text(p_payload->'members') m where not exists(select 1 from public.equipe e where e.id=m::uuid and e.ativo is not false)) then raise exception 'Colaborador inválido.'; end if;
  delete from public.task_assignees where task_id=p_task;
  insert into public.task_assignees(task_id,user_id) select p_task,m::uuid from jsonb_array_elements_text(p_payload->'members') m on conflict(task_id,user_id) do nothing;
 elsif p_action in('add','template') then
  if p_action='template' and exists(select 1 from public.task_checklist_items where task_id=p_task) and coalesce(p_payload->>'mode','') not in('append','replace') then raise exception 'Escolha acrescentar ou substituir as etapas existentes.'; end if;
  if p_action='template' and p_payload->>'mode'='replace' then delete from public.task_checklist_items where task_id=p_task; end if;
  select coalesce(max(position)+1,0) into pos from public.task_checklist_items where task_id=p_task;
  for step in select value from jsonb_array_elements(case when p_action='add' then jsonb_build_array(p_payload) else p_payload->'steps' end) loop
   insert into public.task_checklist_items(task_id,title,note,position,assignee_id,due_date)
   values(p_task,btrim(step->>'title'),nullif(step->>'note',''),pos,nullif(step->>'assignee_id','')::uuid,nullif(step->>'due_date','')::date);
   pos:=pos+1;
  end loop;
 elsif p_action='edit' then
  update public.task_checklist_items set title=btrim(p_payload->>'title'),note=nullif(p_payload->>'note',''),assignee_id=nullif(p_payload->>'assignee_id','')::uuid,due_date=nullif(p_payload->>'due_date','')::date where id=item and task_id=p_task;
 elsif p_action='delete' then delete from public.task_checklist_items where id=item and task_id=p_task;
 elsif p_action='toggle' then
  -- Participants may complete/reopen steps; attribution is always server-derived.
  if actor=t.reviewer_id and not coalesce(manager,false) and not exists(select 1 from public.task_assignees where task_id=p_task and user_id=actor) then raise exception 'O revisor deve ser colaborador para concluir etapas.'; end if;
  update public.task_checklist_items set completed_at=case when (p_payload->>'completed')::boolean then now() else null end,
  completed_by=case when (p_payload->>'completed')::boolean then actor else null end where id=item and task_id=p_task;
 elsif p_action='order' then
  if (select count(*) from jsonb_array_elements_text(p_payload->'ids'))<>(select count(*) from public.task_checklist_items where task_id=p_task)
   or (select count(distinct value) from jsonb_array_elements_text(p_payload->'ids'))<>(select count(*) from public.task_checklist_items where task_id=p_task)
   or exists(select 1 from jsonb_array_elements_text(p_payload->'ids') x where not exists(select 1 from public.task_checklist_items where task_id=p_task and id=x::uuid)) then raise exception 'A ordem deve conter todas as etapas uma única vez.'; end if;
  update public.task_checklist_items i set position=x.ordinality::integer-1 from jsonb_array_elements_text(p_payload->'ids') with ordinality x where i.task_id=p_task and i.id=x.value::uuid;
 elsif p_action in('link','unlink') then
  f:=nullif(p_payload->>'drive_file_id','')::uuid;legacy:=nullif(p_payload->>'legacy_attachment_id','')::uuid;
  if p_action='link' then
   -- File locks serialize links with moves/trash; never create physical files here.
   if f is not null then perform 1 from public.drive_files where id=f and task_id=p_task and status='active' for update; if not found then raise exception 'O arquivo não pertence mais à tarefa.'; end if; end if;
   if legacy is not null then perform 1 from public.task_attachments where id=legacy and task_id=p_task for update; if not found then raise exception 'Anexo não encontrado nesta tarefa.'; end if; end if;
   insert into public.task_file_links(task_id,item_id,drive_file_id,legacy_attachment_id,purpose) values(p_task,item,f,legacy,p_payload->>'purpose') on conflict do nothing;
  else delete from public.task_file_links where task_id=p_task and id=(p_payload->>'link_id')::uuid; end if;
 elsif p_action='reopen' then
  if t.status not in('concluida','concluido') or nullif(btrim(p_payload->>'reason'),'') is null then raise exception 'Informe o motivo da reabertura.'; end if;
  update public.tasks set reopen_reason=btrim(p_payload->>'reason'),status='em_andamento' where id=p_task;
 elsif p_action='review' then update public.tasks set status='revisao' where id=p_task;
 elsif p_action='complete' then update public.tasks set status='concluida' where id=p_task;
 else raise exception 'Ação desconhecida.';
 end if;
 update public.tasks set workflow_version=workflow_version+1,updated_at=now() where id=p_task returning * into t;
 insert into public.task_workflow_history(task_id,actor_id,event,detail) values(p_task,actor,p_action,p_payload);
 insert into public.task_workflow_requests values(p_task,p_request,auth.uid());
 select count(*),count(completed_at) into total,done from public.task_checklist_items where task_id=p_task;
 return jsonb_build_object('version',t.workflow_version,'total',total,'completed',done,'percent',case when total=0 then null else round(done*100.0/total) end);
end $$;
revoke all on function task_workflow_private.mutate(uuid,text,jsonb,integer,uuid) from public;
grant execute on function task_workflow_private.mutate(uuid,text,jsonb,integer,uuid) to authenticated;
create function public.mutate_task_workflow(p_task uuid,p_action text,p_payload jsonb,p_version integer,p_request uuid) returns jsonb
language sql security invoker set search_path='' as $$ select task_workflow_private.mutate(p_task,p_action,p_payload,p_version,p_request) $$;
revoke all on function public.mutate_task_workflow(uuid,text,jsonb,integer,uuid) from public;
grant execute on function public.mutate_task_workflow(uuid,text,jsonb,integer,uuid) to authenticated;
-- Moves/trash/deletions clean associations atomically with metadata changes.
create function task_workflow_private.clean_file_links() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'DELETE' then
  if tg_table_name='drive_files' then
   if new.task_id is not distinct from old.task_id and new.status='active' then return new; end if;
  elsif new.task_id is not distinct from old.task_id then return new;
  end if;
 end if;
 if true then
  insert into public.task_workflow_history(task_id,actor_id,event,detail)
  select distinct l.task_id,e.id,'file_unlinked',jsonb_build_object('file_id',old.id,'cause',tg_op) from public.task_file_links l
  left join public.equipe e on e.user_id=auth.uid() where (l.drive_file_id=old.id or l.legacy_attachment_id=old.id);
  delete from public.task_file_links where drive_file_id=old.id or legacy_attachment_id=old.id;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function task_workflow_private.clean_file_links() from public;
create trigger task_drive_links_cleanup before update of task_id,status or delete on public.drive_files for each row execute function task_workflow_private.clean_file_links();
create trigger task_legacy_links_cleanup before update of task_id or delete on public.task_attachments for each row execute function task_workflow_private.clean_file_links();
-- New tasks start short; detailed workflow data is configured through the checked RPC.
create function task_workflow_private.guard_create() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and (new.reviewer_id is not null or new.project_id is not null or new.expected_delivery is not null or new.completion_criteria is not null or new.blocked_reason is not null or new.blocked_by is not null or new.workflow_version<>0 or new.reopen_reason is not null) then raise exception 'Configure a organização depois de criar a tarefa.'; end if;
 if auth.uid() is not null and new.status in('concluida','concluido') and not exists(select 1 from public.equipe e where e.id=new.assigned_to and e.user_id=auth.uid() and e.ativo is not false) then raise exception 'Somente o responsável principal pode concluir a entrega.'; end if;
 return new;
end $$;
revoke all on function task_workflow_private.guard_create() from public;
create trigger task_workflow_create_guard before insert on public.tasks for each row execute function task_workflow_private.guard_create();
commit;

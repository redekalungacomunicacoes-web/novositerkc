-- RKC Tasks V2: contexto transversal, checklist, auditoria e anexos no Google Drive.
-- Evolui public.tasks sem recriar o modulo existente.

begin;

alter table public.tasks
  add column if not exists context_type text not null default 'internal',
  add column if not exists context_id uuid,
  add column if not exists progress smallint not null default 0,
  add column if not exists drive_folder_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_context_type_check') then
    alter table public.tasks add constraint tasks_context_type_check
      check (context_type in ('internal', 'project', 'materia'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_progress_check') then
    alter table public.tasks add constraint tasks_progress_check check (progress between 0 and 100);
  end if;
end $$;

create index if not exists idx_tasks_context on public.tasks(context_type, context_id);
create index if not exists idx_task_assignees_user_task on public.task_assignees(user_id, task_id);

create table if not exists public.task_checklist (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  titulo text not null,
  concluida boolean not null default false,
  ordem integer not null default 0,
  completed_by uuid references public.equipe(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_checklist_task_order on public.task_checklist(task_id, ordem, created_at);

drop trigger if exists trg_task_checklist_updated_at on public.task_checklist;
create trigger trg_task_checklist_updated_at before update on public.task_checklist
for each row execute function public.set_updated_at();

create or replace function public.refresh_task_progress(p_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare total_count integer; done_count integer; new_progress smallint;
begin
  select count(*), count(*) filter (where concluida)
  into total_count, done_count from public.task_checklist where task_id = p_task_id;

  if total_count = 0 then
    select case status
      when 'concluida' then 100
      when 'revisao' then 80
      when 'em_andamento' then greatest(progress, 10)
      else 0 end
    into new_progress from public.tasks where id = p_task_id;
  else
    new_progress := round((done_count::numeric / total_count::numeric) * 100)::smallint;
  end if;

  update public.tasks set progress = coalesce(new_progress, 0) where id = p_task_id;
end;
$$;

create or replace function public.sync_task_checklist_progress()
returns trigger language plpgsql as $$
begin
  perform public.refresh_task_progress(coalesce(new.task_id, old.task_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_task_checklist_progress on public.task_checklist;
create trigger trg_task_checklist_progress
after insert or update or delete on public.task_checklist
for each row execute function public.sync_task_checklist_progress();

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid references public.equipe(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_activity_task_created on public.task_activity(task_id, created_at desc);

-- Drive passa a ser a fonte fisica dos novos anexos.
alter table public.drive_files
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

create index if not exists idx_drive_files_task on public.drive_files(task_id)
where task_id is not null;

alter table public.task_checklist enable row level security;
alter table public.task_activity enable row level security;

drop policy if exists "task_checklist_select_related" on public.task_checklist;
create policy "task_checklist_select_related" on public.task_checklist for select to authenticated
using (
  public.is_team_admin()
  or exists (
    select 1 from public.tasks t
    left join public.equipe creator on creator.id = t.created_by
    left join public.equipe assigned on assigned.id = t.assigned_to
    where t.id = task_checklist.task_id
      and (creator.user_id = auth.uid() or assigned.user_id = auth.uid()
        or exists (
          select 1 from public.task_assignees ta
          join public.equipe member on member.id = ta.user_id
          where ta.task_id = t.id and member.user_id = auth.uid()
        ))
  )
);

drop policy if exists "task_checklist_manage_related" on public.task_checklist;
create policy "task_checklist_manage_related" on public.task_checklist for all to authenticated
using (
  public.is_team_admin()
  or exists (
    select 1 from public.tasks t
    left join public.equipe creator on creator.id = t.created_by
    left join public.equipe assigned on assigned.id = t.assigned_to
    where t.id = task_checklist.task_id
      and (creator.user_id = auth.uid() or assigned.user_id = auth.uid()
        or exists (
          select 1 from public.task_assignees ta
          join public.equipe member on member.id = ta.user_id
          where ta.task_id = t.id and member.user_id = auth.uid()
        ))
  )
)
with check (
  public.is_team_admin()
  or exists (
    select 1 from public.tasks t
    left join public.equipe creator on creator.id = t.created_by
    left join public.equipe assigned on assigned.id = t.assigned_to
    where t.id = task_checklist.task_id
      and (creator.user_id = auth.uid() or assigned.user_id = auth.uid()
        or exists (
          select 1 from public.task_assignees ta
          join public.equipe member on member.id = ta.user_id
          where ta.task_id = t.id and member.user_id = auth.uid()
        ))
  )
);

drop policy if exists "task_activity_select_related" on public.task_activity;
create policy "task_activity_select_related" on public.task_activity for select to authenticated
using (
  public.is_team_admin()
  or exists (
    select 1 from public.tasks t
    left join public.equipe creator on creator.id = t.created_by
    left join public.equipe assigned on assigned.id = t.assigned_to
    where t.id = task_activity.task_id
      and (creator.user_id = auth.uid() or assigned.user_id = auth.uid()
        or exists (
          select 1 from public.task_assignees ta
          join public.equipe member on member.id = ta.user_id
          where ta.task_id = t.id and member.user_id = auth.uid()
        ))
  )
);

drop policy if exists "task_activity_insert_related" on public.task_activity;
create policy "task_activity_insert_related" on public.task_activity for insert to authenticated
with check (
  public.is_team_admin()
  or exists (
    select 1 from public.equipe actor where actor.id = task_activity.actor_id and actor.user_id = auth.uid()
  )
);

-- Acesso de tasks passa a reconhecer todos os responsaveis N:N.
drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated" on public.tasks for select to authenticated
using (
  public.is_team_admin()
  or exists (select 1 from public.equipe e where e.user_id = auth.uid() and e.id in (assigned_to, created_by))
  or exists (
    select 1 from public.task_assignees ta
    join public.equipe e on e.id = ta.user_id
    where ta.task_id = tasks.id and e.user_id = auth.uid()
  )
);

drop policy if exists "tasks_update_creator_or_assigned" on public.tasks;
create policy "tasks_update_creator_or_assigned" on public.tasks for update to authenticated
using (
  public.is_team_admin()
  or exists (select 1 from public.equipe e where e.user_id = auth.uid() and e.id in (assigned_to, created_by))
  or exists (
    select 1 from public.task_assignees ta join public.equipe e on e.id = ta.user_id
    where ta.task_id = tasks.id and e.user_id = auth.uid()
  )
)
with check (
  public.is_team_admin()
  or exists (select 1 from public.equipe e where e.user_id = auth.uid() and e.id in (assigned_to, created_by))
  or exists (
    select 1 from public.task_assignees ta join public.equipe e on e.id = ta.user_id
    where ta.task_id = tasks.id and e.user_id = auth.uid()
  )
);

comment on column public.tasks.context_type is 'internal, project ou materia.';
comment on column public.tasks.context_id is 'UUID da entidade de contexto; validacao da entidade ocorre na aplicacao.';
comment on column public.tasks.drive_folder_id is 'Pasta fisica da tarefa no Google Drive RKC, criada pelo backend.';
comment on table public.task_checklist is 'Microtarefas que calculam automaticamente o progresso da tarefa.';
comment on table public.task_activity is 'Historico operacional/auditoria da tarefa.';
comment on column public.drive_files.task_id is 'Vinculo direto opcional do arquivo do Drive com uma tarefa RKC.';

commit;

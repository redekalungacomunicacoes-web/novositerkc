-- RKC Tasks V2: acesso de anexos e responsabilidades N:N.
begin;

alter table public.drive_files
  add column if not exists access_scope text not null default 'assignees';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'drive_files_access_scope_check') then
    alter table public.drive_files add constraint drive_files_access_scope_check
      check (access_scope in ('assignees', 'team'));
  end if;
end $$;

create index if not exists idx_drive_files_task_scope
  on public.drive_files(task_id, access_scope)
  where task_id is not null and status = 'active';

alter table public.task_assignees enable row level security;

drop policy if exists "task_assignees_read_authenticated" on public.task_assignees;
drop policy if exists "task_assignees_manage_admin" on public.task_assignees;
drop policy if exists "task_assignees_select_related" on public.task_assignees;
drop policy if exists "task_assignees_manage_related" on public.task_assignees;

create policy "task_assignees_select_related"
on public.task_assignees for select to authenticated
using (
  public.is_team_admin()
  or exists (
    select 1 from public.equipe me
    join public.tasks t on t.id = task_assignees.task_id
    where me.user_id = auth.uid()
      and (t.created_by = me.id or t.assigned_to = me.id or task_assignees.user_id = me.id)
  )
);

create policy "task_assignees_manage_related"
on public.task_assignees for all to authenticated
using (
  public.is_team_admin()
  or exists (
    select 1 from public.equipe me
    join public.tasks t on t.id = task_assignees.task_id
    where me.user_id = auth.uid() and t.created_by = me.id
  )
)
with check (
  public.is_team_admin()
  or exists (
    select 1 from public.equipe me
    join public.tasks t on t.id = task_assignees.task_id
    where me.user_id = auth.uid() and t.created_by = me.id
  )
);

comment on column public.drive_files.access_scope is
  'Para anexos de tarefa: assignees = somente envolvidos; team = toda equipe autenticada. Nao torna o arquivo publico na web.';

commit;

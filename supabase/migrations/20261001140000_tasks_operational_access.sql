-- RKC Tasks: acesso operacional consolidado para tarefas e anexos.
-- team = equipe RKC autenticada; assignees = criador/responsaveis/admin.
begin;

alter table public.tasks add column if not exists access_scope text not null default 'assignees';
alter table public.drive_files add column if not exists access_scope text not null default 'assignees';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='tasks_access_scope_check') then
    alter table public.tasks add constraint tasks_access_scope_check check (access_scope in ('assignees','team'));
  end if;
  if not exists (select 1 from pg_constraint where conname='drive_files_access_scope_check') then
    alter table public.drive_files add constraint drive_files_access_scope_check check (access_scope in ('assignees','team'));
  end if;
end $$;

create index if not exists idx_tasks_access_scope on public.tasks(access_scope);
create index if not exists idx_drive_files_task_access on public.drive_files(task_id,access_scope) where task_id is not null;

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated" on public.tasks for select to authenticated using (
  public.is_team_admin()
  or (access_scope='team' and exists(select 1 from public.equipe e where e.user_id=auth.uid() and e.ativo is not false))
  or exists(select 1 from public.equipe e where e.user_id=auth.uid() and e.id in (assigned_to,created_by))
  or exists(select 1 from public.task_assignees ta join public.equipe e on e.id=ta.user_id where ta.task_id=tasks.id and e.user_id=auth.uid())
);

alter table public.task_assignees enable row level security;
drop policy if exists "task_assignees_read_authenticated" on public.task_assignees;
drop policy if exists "task_assignees_manage_admin" on public.task_assignees;
drop policy if exists "task_assignees_select_related" on public.task_assignees;
drop policy if exists "task_assignees_manage_related" on public.task_assignees;

create policy "task_assignees_select_related" on public.task_assignees for select to authenticated using (
  public.is_team_admin()
  or exists(select 1 from public.equipe me join public.tasks t on t.id=task_assignees.task_id
            where me.user_id=auth.uid() and (t.created_by=me.id or t.assigned_to=me.id or task_assignees.user_id=me.id or t.access_scope='team'))
);
create policy "task_assignees_manage_related" on public.task_assignees for all to authenticated
using (public.is_team_admin() or exists(select 1 from public.equipe me join public.tasks t on t.id=task_assignees.task_id where me.user_id=auth.uid() and t.created_by=me.id))
with check (public.is_team_admin() or exists(select 1 from public.equipe me join public.tasks t on t.id=task_assignees.task_id where me.user_id=auth.uid() and t.created_by=me.id));

drop policy if exists "authenticated can read drive files" on public.drive_files;
drop policy if exists "authenticated can read scoped drive files" on public.drive_files;
drop policy if exists "authenticated_read_drive_files_scoped" on public.drive_files;
create policy "authenticated_read_drive_files_scoped" on public.drive_files for select to authenticated using (
  task_id is null
  or public.is_team_admin()
  or uploaded_by=auth.uid()
  or (access_scope='team' and exists(select 1 from public.equipe e where e.user_id=auth.uid() and e.ativo is not false))
  or exists(select 1 from public.tasks t join public.equipe me on me.user_id=auth.uid()
            where t.id=drive_files.task_id and (t.created_by=me.id or t.assigned_to=me.id
              or exists(select 1 from public.task_assignees ta where ta.task_id=t.id and ta.user_id=me.id)))
);

comment on column public.tasks.access_scope is 'assignees = envolvidos/admin; team = toda equipe RKC autenticada.';
comment on column public.drive_files.access_scope is 'Escopo interno do arquivo; independente da publicacao web.';
commit;

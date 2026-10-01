-- RKC Tasks V2: visibilidade operacional por tarefa e por anexo.
-- "team" significa equipe RKC autenticada; nao significa publicacao na internet.

begin;

alter table public.tasks
  add column if not exists access_scope text not null default 'assignees';

alter table public.drive_files
  add column if not exists access_scope text not null default 'assignees';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_access_scope_check') then
    alter table public.tasks add constraint tasks_access_scope_check
      check (access_scope in ('assignees', 'team'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'drive_files_access_scope_check') then
    alter table public.drive_files add constraint drive_files_access_scope_check
      check (access_scope in ('assignees', 'team'));
  end if;
end $$;

create index if not exists idx_tasks_access_scope on public.tasks(access_scope);
create index if not exists idx_drive_files_task_access on public.drive_files(task_id, access_scope)
where task_id is not null;

-- Tarefas: equipe pode ler tarefas marcadas como "team"; tarefas restritas continuam
-- limitadas a admin, criador, responsavel principal e responsaveis N:N.
drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated" on public.tasks for select to authenticated
using (
  public.is_team_admin()
  or (
    access_scope = 'team'
    and exists (select 1 from public.equipe e where e.user_id = auth.uid() and e.ativo is not false)
  )
  or exists (select 1 from public.equipe e where e.user_id = auth.uid() and e.id in (assigned_to, created_by))
  or exists (
    select 1 from public.task_assignees ta
    join public.equipe e on e.id = ta.user_id
    where ta.task_id = tasks.id and e.user_id = auth.uid()
  )
);

-- Remove a leitura autenticada irrestrita criada no MVP do Drive.
drop policy if exists "authenticated can read drive files" on public.drive_files;
drop policy if exists "authenticated can read scoped drive files" on public.drive_files;
create policy "authenticated can read scoped drive files" on public.drive_files for select to authenticated
using (
  -- Mantem compatibilidade dos modulos ainda nao migrados para regras granulares.
  task_id is null
  or public.is_team_admin()
  or uploaded_by = auth.uid()
  or (
    access_scope = 'team'
    and exists (select 1 from public.equipe e where e.user_id = auth.uid() and e.ativo is not false)
  )
  or exists (
    select 1
    from public.tasks t
    left join public.equipe creator on creator.id = t.created_by
    left join public.equipe assigned on assigned.id = t.assigned_to
    where t.id = drive_files.task_id
      and (
        creator.user_id = auth.uid()
        or assigned.user_id = auth.uid()
        or exists (
          select 1 from public.task_assignees ta
          join public.equipe member on member.id = ta.user_id
          where ta.task_id = t.id and member.user_id = auth.uid()
        )
      )
  )
);

comment on column public.tasks.access_scope is
  'assignees: somente envolvidos/admin; team: toda equipe RKC autenticada pode visualizar.';
comment on column public.drive_files.access_scope is
  'Escopo interno do anexo. Independente de visibility, que controla publicacao web.';

commit;

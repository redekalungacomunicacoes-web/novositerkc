-- RKC Drive: arquivos de tarefa respeitam escopo interno.
begin;

drop policy if exists "authenticated can read drive files" on public.drive_files;
drop policy if exists "authenticated_read_drive_files_scoped" on public.drive_files;

create policy "authenticated_read_drive_files_scoped"
on public.drive_files for select to authenticated
using (
  task_id is null
  or access_scope = 'team'
  or public.is_team_admin()
  or exists (
    select 1
    from public.tasks t
    join public.equipe me on me.user_id = auth.uid()
    where t.id = drive_files.task_id
      and (
        t.created_by = me.id
        or t.assigned_to = me.id
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = me.id
        )
      )
  )
);

comment on policy "authenticated_read_drive_files_scoped" on public.drive_files is
  'Arquivos sem tarefa preservam leitura autenticada atual. Em tarefas, team libera para equipe; assignees restringe a envolvidos e admins.';

commit;

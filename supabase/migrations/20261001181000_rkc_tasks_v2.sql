-- RKC Tarefas: contexto, progresso e políticas coerentes com múltiplos direcionados.
begin;

alter table public.tasks
  add column if not exists context_type text not null default 'internal',
  add column if not exists context_id uuid,
  add column if not exists progress smallint not null default 0,
  add column if not exists drive_folder_id text,
  add column if not exists access_scope text not null default 'assignees';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.tasks'::regclass and conname='tasks_context_type_check') then
    alter table public.tasks add constraint tasks_context_type_check check (context_type in ('internal','project','materia'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.tasks'::regclass and conname='tasks_progress_check') then
    alter table public.tasks add constraint tasks_progress_check check (progress between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.tasks'::regclass and conname='tasks_access_scope_check') then
    alter table public.tasks add constraint tasks_access_scope_check check (access_scope in ('assignees','team'));
  end if;
end $$;

create index if not exists idx_tasks_context on public.tasks(context_type, context_id);
create index if not exists idx_tasks_access_scope on public.tasks(access_scope);

-- Leitura de tarefa: admin, participantes ou equipe ativa quando a tarefa permite.
drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
on public.tasks for select to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe me
    where me.user_id = auth.uid()
      and me.ativo is not false
      and (
        tasks.access_scope = 'team'
        or me.id = tasks.created_by
        or me.id = tasks.assigned_to
        or coalesce(tasks.direcionamento, '{}'::uuid[]) @> array[me.id]
      )
  )
);

-- Participantes podem atualizar o fluxo; a visibilidade ampla não dá permissão de edição.
drop policy if exists "tasks_update_creator_or_assigned" on public.tasks;
create policy "tasks_update_creator_or_assigned"
on public.tasks for update to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe me
    where me.user_id = auth.uid()
      and (me.id = tasks.created_by or me.id = tasks.assigned_to
        or coalesce(tasks.direcionamento, '{}'::uuid[]) @> array[me.id])
  )
)
with check (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe me
    where me.user_id = auth.uid()
      and (me.id = tasks.created_by or me.id = tasks.assigned_to
        or coalesce(tasks.direcionamento, '{}'::uuid[]) @> array[me.id])
  )
);

-- Comentários disponíveis para todos os participantes direcionados.
drop policy if exists "task_comments_select_related" on public.task_comments;
create policy "task_comments_select_related"
on public.task_comments for select to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.tasks t join public.equipe me on me.user_id = auth.uid()
    where t.id = task_comments.task_id
      and (me.id = t.created_by or me.id = t.assigned_to
        or coalesce(t.direcionamento, '{}'::uuid[]) @> array[me.id])
  )
);

drop policy if exists "task_comments_insert_related" on public.task_comments;
create policy "task_comments_insert_related"
on public.task_comments for insert to authenticated
with check (
  exists (select 1 from public.equipe me where me.id = task_comments.author_id and me.user_id = auth.uid())
  and (
    public.is_task_admin(auth.uid())
    or exists (
      select 1 from public.tasks t join public.equipe me on me.user_id = auth.uid()
      where t.id = task_comments.task_id
        and (me.id = t.created_by or me.id = t.assigned_to
          or coalesce(t.direcionamento, '{}'::uuid[]) @> array[me.id])
    )
  )
);

-- Compatibilidade com anexos legados enquanto novos uploads passam ao Drive.
drop policy if exists "attachments_select_authenticated" on public.task_attachments;
create policy "attachments_select_authenticated"
on public.task_attachments for select to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.tasks t join public.equipe me on me.user_id = auth.uid()
    where t.id = task_attachments.task_id
      and (me.id = t.created_by or me.id = t.assigned_to
        or coalesce(t.direcionamento, '{}'::uuid[]) @> array[me.id])
  )
);

drop policy if exists "attachments_insert_authenticated" on public.task_attachments;
create policy "attachments_insert_authenticated"
on public.task_attachments for insert to authenticated
with check (
  exists (select 1 from public.equipe uploader where uploader.id = task_attachments.uploaded_by and uploader.user_id = auth.uid())
  and (
    public.is_task_admin(auth.uid())
    or exists (
      select 1 from public.tasks t join public.equipe me on me.user_id = auth.uid()
      where t.id = task_attachments.task_id
        and (me.id = t.created_by or me.id = t.assigned_to
          or coalesce(t.direcionamento, '{}'::uuid[]) @> array[me.id])
    )
  )
);

-- Progresso acompanha o status enquanto não existe checklist por microtarefa.
create or replace function public.sync_task_progress_from_status()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluida' then
    new.progress := 100;
  elsif new.status = 'revisao' then
    new.progress := 80;
  elsif new.status = 'em_andamento' then
    new.progress := greatest(coalesce(new.progress, 0), 10);
  else
    new.progress := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_sync_progress on public.tasks;
create trigger trg_tasks_sync_progress
before insert or update on public.tasks
for each row execute function public.sync_task_progress_from_status();

comment on column public.tasks.context_type is 'internal, project ou materia.';
comment on column public.tasks.context_id is 'UUID de projeto ou matéria; a aplicação valida o registro.';
comment on column public.tasks.access_scope is 'assignees: participantes; team: toda equipe RKC autenticada.';

commit;

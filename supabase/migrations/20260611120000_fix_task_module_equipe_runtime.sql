-- Corrige políticas, anexos e notificações do módulo de tarefas para IDs de public.equipe.

begin;

-- task_attachments.uploaded_by precisa acompanhar os IDs usados pelo módulo (public.equipe.id).
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'task_attachments'
      and constraint_name = 'task_attachments_uploaded_by_fkey'
  ) then
    alter table public.task_attachments drop constraint task_attachments_uploaded_by_fkey;
  end if;
end $$;

alter table public.task_attachments
  add constraint task_attachments_uploaded_by_fkey
  foreign key (uploaded_by)
  references public.equipe(id)
  on delete set null;

-- Trigger de notificações: assigned_to é equipe.id; notifications.user_id continua sendo o auth user.
create or replace function public.notify_task_assignment_v2()
returns trigger
language plpgsql
as $$
declare
  target_user uuid;
begin
  if new.assigned_to is null then
    return new;
  end if;

  select e.user_id into target_user
  from public.equipe e
  where e.id = new.assigned_to;

  if target_user is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, task_id, tipo, titulo, mensagem)
    values (
      target_user,
      new.id,
      'nova_tarefa',
      'Nova tarefa atribuída',
      'Você recebeu a tarefa "' || new.titulo || '" para ' || to_char(new.data_tarefa, 'DD/MM/YYYY')
    );
  elsif tg_op = 'UPDATE' and new.assigned_to is distinct from old.assigned_to then
    insert into public.notifications (user_id, task_id, tipo, titulo, mensagem)
    values (
      target_user,
      new.id,
      'tarefa_atualizada',
      'Tarefa atribuída/reatribuída',
      'A tarefa "' || new.titulo || '" foi atribuída para você.'
    );
  end if;

  return new;
end;
$$;

-- Tasks: comparar auth.uid() com equipe.user_id, nunca diretamente com created_by/assigned_to.
drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
on public.tasks
for select
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe e
    where e.user_id = auth.uid()
      and e.id in (assigned_to, created_by)
  )
);

drop policy if exists "tasks_insert_authenticated" on public.tasks;
create policy "tasks_insert_authenticated"
on public.tasks
for insert
to authenticated
with check (
  exists (
    select 1 from public.equipe e
    where e.user_id = auth.uid()
      and e.id = created_by
  )
);

drop policy if exists "tasks_update_creator_or_assigned" on public.tasks;
create policy "tasks_update_creator_or_assigned"
on public.tasks
for update
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe e
    where e.user_id = auth.uid()
      and e.id in (assigned_to, created_by)
  )
)
with check (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe e
    where e.user_id = auth.uid()
      and e.id in (assigned_to, created_by)
  )
);

drop policy if exists "tasks_delete_creator" on public.tasks;
create policy "tasks_delete_creator"
on public.tasks
for delete
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe e
    where e.user_id = auth.uid()
      and e.id = created_by
  )
);

-- Anexos: uploaded_by é equipe.id e acesso acompanha criador/responsável da tarefa.
drop policy if exists "attachments_select_authenticated" on public.task_attachments;
create policy "attachments_select_authenticated"
on public.task_attachments
for select
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1
    from public.tasks t
    join public.equipe e on e.id in (t.assigned_to, t.created_by)
    where t.id = task_attachments.task_id
      and e.user_id = auth.uid()
  )
);

drop policy if exists "attachments_insert_authenticated" on public.task_attachments;
create policy "attachments_insert_authenticated"
on public.task_attachments
for insert
to authenticated
with check (
  exists (
    select 1 from public.equipe uploader
    where uploader.id = task_attachments.uploaded_by
      and uploader.user_id = auth.uid()
  )
  and (
    public.is_task_admin(auth.uid())
    or exists (
      select 1
      from public.tasks t
      join public.equipe e on e.id in (t.assigned_to, t.created_by)
      where t.id = task_attachments.task_id
        and e.user_id = auth.uid()
    )
  )
);

drop policy if exists "attachments_delete_uploader" on public.task_attachments;
create policy "attachments_delete_uploader"
on public.task_attachments
for delete
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.equipe uploader
    where uploader.id = task_attachments.uploaded_by
      and uploader.user_id = auth.uid()
  )
);

commit;

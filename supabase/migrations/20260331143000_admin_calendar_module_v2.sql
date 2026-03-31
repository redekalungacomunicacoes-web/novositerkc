-- =========================================================
-- Módulo de calendário administrativo (produção)
-- Complementa estrutura de tasks/anexos/notificações
-- =========================================================

create extension if not exists pgcrypto;

-- 1) Campos extras para aderir ao formulário completo
alter table if exists public.tasks
  add column if not exists external_link text;

-- 2) Função central de autorização (admin alpha/admin)
create or replace function public.is_task_admin(_uid uuid default auth.uid())
returns boolean
language plpgsql
stable
as $$
declare
  has_role boolean := false;
begin
  if _uid is null then
    return false;
  end if;

  if to_regclass('public.user_roles') is not null and to_regclass('public.roles') is not null then
    select exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = _uid
        and r.name in ('admin_alfa', 'admin')
    ) into has_role;
  end if;

  if has_role then
    return true;
  end if;

  if to_regprocedure('public.is_admin()') is not null then
    begin
      execute 'select public.is_admin()' into has_role;
      return coalesce(has_role, false);
    exception when others then
      return false;
    end;
  end if;

  return false;
end;
$$;

-- 3) Triggers automáticos de notificação por atribuição/reatribuição
create or replace function public.notify_task_assignment_v2()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.assigned_to is not null then
    insert into public.notifications (user_id, task_id, tipo, titulo, mensagem)
    values (
      new.assigned_to,
      new.id,
      'nova_tarefa',
      'Nova tarefa atribuída',
      'Você recebeu a tarefa "' || new.titulo || '" para ' || to_char(new.data_tarefa, 'DD/MM/YYYY')
    );
  elsif tg_op = 'UPDATE' and new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    insert into public.notifications (user_id, task_id, tipo, titulo, mensagem)
    values (
      new.assigned_to,
      new.id,
      'tarefa_atualizada',
      'Tarefa atribuída/reatribuída',
      'A tarefa "' || new.titulo || '" foi atribuída para você.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_task_assignment_insert on public.tasks;
create trigger trg_notify_task_assignment_insert
after insert on public.tasks
for each row
execute function public.notify_task_assignment_v2();

drop trigger if exists trg_notify_task_assignment_update on public.tasks;
create trigger trg_notify_task_assignment_update
after update on public.tasks
for each row
execute function public.notify_task_assignment_v2();

-- 4) Índices para filtros de calendário e notificações
create index if not exists idx_tasks_calendar_filter on public.tasks (data_tarefa, assigned_to);
create index if not exists idx_notifications_user_unread on public.notifications (user_id, lida, created_at desc);
create index if not exists idx_task_attachments_task_created on public.task_attachments (task_id, created_at desc);

-- 5) RLS reforçado
alter table if exists public.tasks enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.task_attachments enable row level security;

-- tasks: admin gerencia tudo; integrante visualiza/atualiza somente as dele

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
on public.tasks
for select
to authenticated
using (
  public.is_task_admin(auth.uid())
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "tasks_insert_authenticated" on public.tasks;
create policy "tasks_insert_authenticated"
on public.tasks
for insert
to authenticated
with check (
  public.is_task_admin(auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "tasks_update_creator_or_assigned" on public.tasks;
create policy "tasks_update_creator_or_assigned"
on public.tasks
for update
to authenticated
using (
  public.is_task_admin(auth.uid())
  or assigned_to = auth.uid()
)
with check (
  public.is_task_admin(auth.uid())
  or assigned_to = auth.uid()
);

drop policy if exists "tasks_delete_creator" on public.tasks;
create policy "tasks_delete_creator"
on public.tasks
for delete
to authenticated
using (
  public.is_task_admin(auth.uid())
  or created_by = auth.uid()
);

-- notifications: admin vê todas; integrante vê só as próprias

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (
  public.is_task_admin(auth.uid())
  or user_id = auth.uid()
);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (
  public.is_task_admin(auth.uid())
  or user_id = auth.uid()
)
with check (
  public.is_task_admin(auth.uid())
  or user_id = auth.uid()
);

-- attachments: admin full; integrante acessa anexos das tarefas em que é responsável

drop policy if exists "attachments_select_authenticated" on public.task_attachments;
create policy "attachments_select_authenticated"
on public.task_attachments
for select
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1 from public.tasks t
    where t.id = task_attachments.task_id
      and (t.assigned_to = auth.uid() or t.created_by = auth.uid())
  )
);

drop policy if exists "attachments_insert_authenticated" on public.task_attachments;
create policy "attachments_insert_authenticated"
on public.task_attachments
for insert
to authenticated
with check (
  public.is_task_admin(auth.uid())
  and uploaded_by = auth.uid()
);

drop policy if exists "attachments_delete_uploader" on public.task_attachments;
create policy "attachments_delete_uploader"
on public.task_attachments
for delete
to authenticated
using (
  public.is_task_admin(auth.uid())
  or uploaded_by = auth.uid()
);

-- 6) Storage bucket/policies (idempotente)
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', false)
on conflict (id) do nothing;

drop policy if exists "task_files_read_authenticated" on storage.objects;
create policy "task_files_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'task-files');

drop policy if exists "task_files_insert_authenticated" on storage.objects;
create policy "task_files_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-files'
  and public.is_task_admin(auth.uid())
);

drop policy if exists "task_files_update_authenticated" on storage.objects;
create policy "task_files_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-files'
  and public.is_task_admin(auth.uid())
)
with check (
  bucket_id = 'task-files'
  and public.is_task_admin(auth.uid())
);

drop policy if exists "task_files_delete_authenticated" on storage.objects;
create policy "task_files_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-files'
  and public.is_task_admin(auth.uid())
);

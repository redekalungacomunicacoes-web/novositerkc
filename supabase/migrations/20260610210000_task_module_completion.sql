-- Completa o módulo administrativo de tarefas sem recriar estruturas existentes.
-- Mantém a tabela public.tasks já usada pelo projeto e expõe compatibilidade com o nome public.tarefas.

create extension if not exists pgcrypto;

do $$
begin
  if exists (select 1 from pg_type where typname = 'task_status') then
    alter type public.task_status add value if not exists 'revisao';
  end if;
end $$;

alter table if exists public.tasks
  add column if not exists data_inicio date,
  add column if not exists data_fim date,
  add column if not exists data_conclusao timestamptz;

update public.tasks
set
  data_inicio = coalesce(data_inicio, data_tarefa),
  data_fim = coalesce(data_fim, data_tarefa)
where data_inicio is null or data_fim is null;

alter table if exists public.tasks
  alter column data_inicio set default current_date,
  alter column data_fim set default current_date;

create index if not exists idx_tasks_data_inicio_fim on public.tasks (data_inicio, data_fim);
create index if not exists idx_tasks_data_conclusao on public.tasks (data_conclusao desc);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.equipe(id) on delete set null,
  comentario text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task_created on public.task_comments (task_id, created_at desc);
create index if not exists idx_task_comments_author on public.task_comments (author_id);

drop trigger if exists trg_task_comments_updated_at on public.task_comments;
create trigger trg_task_comments_updated_at
before update on public.task_comments
for each row
execute function public.set_updated_at();

alter table if exists public.task_comments enable row level security;

drop policy if exists "task_comments_select_related" on public.task_comments;
create policy "task_comments_select_related"
on public.task_comments
for select
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (
    select 1
    from public.tasks t
    left join public.equipe assigned on assigned.id = t.assigned_to
    left join public.equipe creator on creator.id = t.created_by
    where t.id = task_comments.task_id
      and (assigned.user_id = auth.uid() or creator.user_id = auth.uid())
  )
);

drop policy if exists "task_comments_insert_related" on public.task_comments;
create policy "task_comments_insert_related"
on public.task_comments
for insert
to authenticated
with check (
  public.is_task_admin(auth.uid())
  or exists (
    select 1
    from public.tasks t
    left join public.equipe assigned on assigned.id = t.assigned_to
    left join public.equipe creator on creator.id = t.created_by
    where t.id = task_comments.task_id
      and (assigned.user_id = auth.uid() or creator.user_id = auth.uid())
  )
);

drop policy if exists "task_comments_update_own" on public.task_comments;
create policy "task_comments_update_own"
on public.task_comments
for update
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (select 1 from public.equipe e where e.id = task_comments.author_id and e.user_id = auth.uid())
)
with check (
  public.is_task_admin(auth.uid())
  or exists (select 1 from public.equipe e where e.id = task_comments.author_id and e.user_id = auth.uid())
);

drop policy if exists "task_comments_delete_own" on public.task_comments;
create policy "task_comments_delete_own"
on public.task_comments
for delete
to authenticated
using (
  public.is_task_admin(auth.uid())
  or exists (select 1 from public.equipe e where e.id = task_comments.author_id and e.user_id = auth.uid())
);

create or replace function public.notify_task_comment()
returns trigger
language plpgsql
as $$
declare
  target_user uuid;
begin
  select e.user_id into target_user
  from public.tasks t
  join public.equipe e on e.id = t.assigned_to
  where t.id = new.task_id;

  if target_user is not null then
    insert into public.notifications (user_id, task_id, tipo, titulo, mensagem)
    values (target_user, new.task_id, 'comentario', 'Novo comentário', 'Uma tarefa atribuída a você recebeu um novo comentário.');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_task_comment on public.task_comments;
create trigger trg_notify_task_comment
after insert on public.task_comments
for each row
execute function public.notify_task_comment();

-- Compatibilidade de nomenclatura solicitada: tabela lógica public.tarefas baseada na tabela de produção public.tasks.
create or replace view public.tarefas as
select
  id,
  titulo,
  descricao,
  data_inicio,
  data_fim,
  prioridade,
  status,
  assigned_to as responsavel,
  created_by as criador,
  data_conclusao,
  created_at,
  updated_at
from public.tasks;

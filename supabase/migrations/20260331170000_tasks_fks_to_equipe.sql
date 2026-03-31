-- Corrige FKs do módulo de tarefas para referenciar equipe em vez de profiles

begin;

-- remover FK errada (se existir)
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'tasks'
      and constraint_name = 'tasks_assigned_to_fkey'
  ) then
    alter table public.tasks drop constraint tasks_assigned_to_fkey;
  end if;

  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'tasks'
      and constraint_name = 'tasks_created_by_fkey'
  ) then
    alter table public.tasks drop constraint tasks_created_by_fkey;
  end if;
end $$;

-- criar FK correta com equipe
alter table public.tasks
  add constraint tasks_assigned_to_fkey
  foreign key (assigned_to)
  references public.equipe(id)
  on delete set null;

alter table public.tasks
  add constraint tasks_created_by_fkey
  foreign key (created_by)
  references public.equipe(id)
  on delete set null;

commit;

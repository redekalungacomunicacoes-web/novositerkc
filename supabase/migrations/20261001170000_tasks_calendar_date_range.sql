-- Persist date ranges for calendar tasks while keeping the legacy data_tarefa column in sync.
alter table public.tasks
  add column if not exists data_inicio date,
  add column if not exists data_fim date;

update public.tasks
set data_inicio = coalesce(data_inicio, data_tarefa),
    data_fim = coalesce(data_fim, data_inicio, data_tarefa)
where data_inicio is null or data_fim is null;

create or replace function public.sync_task_calendar_dates()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.data_inicio := coalesce(new.data_inicio, new.data_tarefa);
    new.data_fim := coalesce(new.data_fim, new.data_inicio, new.data_tarefa);
  elsif new.data_tarefa is distinct from old.data_tarefa
      and new.data_inicio is not distinct from old.data_inicio then
    -- Older task screens write only data_tarefa.
    new.data_inicio := new.data_tarefa;
    new.data_fim := new.data_tarefa;
  elsif new.data_inicio is distinct from old.data_inicio then
    new.data_tarefa := new.data_inicio;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_task_calendar_dates on public.tasks;
create trigger trg_sync_task_calendar_dates
before insert or update on public.tasks
for each row
execute function public.sync_task_calendar_dates();

alter table public.tasks
  alter column data_inicio set not null,
  alter column data_fim set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_calendar_date_range_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_calendar_date_range_check
      check (data_fim >= data_inicio);
  end if;
end;
$$;

create index if not exists idx_tasks_calendar_date_range
  on public.tasks (data_inicio, data_fim, assigned_to);

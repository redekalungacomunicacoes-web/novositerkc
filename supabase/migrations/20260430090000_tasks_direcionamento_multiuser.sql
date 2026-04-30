-- Corrige compatibilidade da tabela tasks com frontend moderno de calendário
alter table if exists public.tasks
  add column if not exists direcionamento uuid[] not null default '{}';

-- Migração segura se existia campo texto/json legado
update public.tasks
set direcionamento = case
  when assigned_to is not null then array[assigned_to]
  else '{}'
end
where direcionamento = '{}'::uuid[];

create index if not exists idx_tasks_direcionamento_gin on public.tasks using gin (direcionamento);

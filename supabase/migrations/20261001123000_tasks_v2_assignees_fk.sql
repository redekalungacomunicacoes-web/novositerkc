-- RKC Tasks V2: consolida responsaveis N:N em public.equipe.
-- task_assignees esta vazio na aplicacao desta migration, portanto nao ha dados legados a converter.

begin;

do $$
declare
  r record;
begin
  -- Remove qualquer FK anterior de user_id antes de estabelecer o modelo canonico.
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.task_assignees'::regclass
      and c.contype = 'f'
      and a.attname = 'user_id'
  loop
    execute format('alter table public.task_assignees drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.task_assignees
  add constraint task_assignees_user_id_equipe_fkey
  foreign key (user_id)
  references public.equipe(id)
  on delete cascade;

create index if not exists idx_task_assignees_user_task
  on public.task_assignees(user_id, task_id);

comment on column public.task_assignees.user_id is
  'ID de public.equipe do integrante responsavel pela tarefa. Nao e auth.users.id.';

commit;

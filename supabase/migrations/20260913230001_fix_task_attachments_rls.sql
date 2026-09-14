begin;

-- Mantém o bucket de anexos privado mesmo se ele já existir.
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', false)
on conflict (id) do update
set name = excluded.name,
    public = false;

-- Remove apenas FKs de uploaded_by que não apontem para public.equipe(id).
do $$
declare
  constraint_to_drop record;
begin
  for constraint_to_drop in
    select c.conname
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_namespace source_schema on source_schema.oid = source_table.relnamespace
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_schema.nspname = 'public'
      and source_table.relname = 'task_attachments'
      and c.conkey = array[
        (select a.attnum
         from pg_attribute a
         where a.attrelid = source_table.oid
           and a.attname = 'uploaded_by'
           and not a.attisdropped)
      ]::smallint[]
      and not (
        target_schema.nspname = 'public'
        and target_table.relname = 'equipe'
        and c.confkey = array[
          (select a.attnum
           from pg_attribute a
           where a.attrelid = target_table.oid
             and a.attname = 'id'
             and not a.attisdropped)
        ]::smallint[]
      )
  loop
    execute format(
      'alter table public.task_attachments drop constraint %I',
      constraint_to_drop.conname
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_namespace source_schema on source_schema.oid = source_table.relnamespace
    join pg_class target_table on target_table.oid = c.confrelid
    join pg_namespace target_schema on target_schema.oid = target_table.relnamespace
    where c.contype = 'f'
      and source_schema.nspname = 'public'
      and source_table.relname = 'task_attachments'
      and target_schema.nspname = 'public'
      and target_table.relname = 'equipe'
      and c.conkey = array[
        (select a.attnum
         from pg_attribute a
         where a.attrelid = source_table.oid
           and a.attname = 'uploaded_by'
           and not a.attisdropped)
      ]::smallint[]
      and c.confkey = array[
        (select a.attnum
         from pg_attribute a
         where a.attrelid = target_table.oid
           and a.attname = 'id'
           and not a.attisdropped)
      ]::smallint[]
  ) then
    alter table public.task_attachments
      add constraint task_attachments_uploaded_by_fkey
      foreign key (uploaded_by)
      references public.equipe(id)
      on delete set null;
  end if;
end $$;

alter table public.task_attachments enable row level security;

drop policy if exists "attachments_select_authenticated" on public.task_attachments;
drop policy if exists "attachments_insert_authenticated" on public.task_attachments;
drop policy if exists "attachments_delete_uploader" on public.task_attachments;
drop policy if exists "task_attachments_select" on public.task_attachments;
drop policy if exists "task_attachments_insert" on public.task_attachments;
drop policy if exists "task_attachments_delete" on public.task_attachments;

create policy "task_attachments_select"
on public.task_attachments for select to authenticated
using (true);

create policy "task_attachments_insert"
on public.task_attachments for insert to authenticated
with check (
  exists (
    select 1
    from public.equipe e
    where e.id = task_attachments.uploaded_by
      and e.user_id = auth.uid()
      and coalesce(e.ativo, true) = true
  )
);

create policy "task_attachments_delete"
on public.task_attachments for delete to authenticated
using (
  exists (
    select 1
    from public.equipe e
    where e.id = task_attachments.uploaded_by
      and e.user_id = auth.uid()
  )
);

drop policy if exists "task_files_read_authenticated" on storage.objects;
drop policy if exists "task_files_insert_authenticated" on storage.objects;
drop policy if exists "task_files_update_authenticated" on storage.objects;
drop policy if exists "task_files_delete_authenticated" on storage.objects;

create policy "task_files_read_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'task-files');

create policy "task_files_insert_authenticated"
on storage.objects for insert to authenticated
with check (bucket_id = 'task-files' and auth.uid() is not null);

create policy "task_files_update_authenticated"
on storage.objects for update to authenticated
using (bucket_id = 'task-files' and auth.uid() is not null)
with check (bucket_id = 'task-files' and auth.uid() is not null);

create policy "task_files_delete_authenticated"
on storage.objects for delete to authenticated
using (bucket_id = 'task-files' and auth.uid() is not null);

commit;

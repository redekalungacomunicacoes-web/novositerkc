begin;

-- =========================================================
-- GARANTE O BUCKET
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'task-files',
  'task-files',
  false
)
on conflict (id) do update
set public = false;


-- =========================================================
-- TASK_ATTACHMENTS
--
-- O frontend usa public.equipe.id em uploaded_by.
-- Portanto a FK precisa apontar para equipe(id).
-- =========================================================

alter table public.task_attachments
drop constraint if exists task_attachments_uploaded_by_fkey;

alter table public.task_attachments
add constraint task_attachments_uploaded_by_fkey
foreign key (uploaded_by)
references public.equipe(id)
on delete set null;


-- =========================================================
-- RLS TASK_ATTACHMENTS
-- =========================================================

alter table public.task_attachments enable row level security;

drop policy if exists "attachments_select_authenticated"
on public.task_attachments;

drop policy if exists "attachments_insert_authenticated"
on public.task_attachments;

drop policy if exists "attachments_delete_uploader"
on public.task_attachments;

drop policy if exists "task_attachments_select"
on public.task_attachments;

drop policy if exists "task_attachments_insert"
on public.task_attachments;

drop policy if exists "task_attachments_delete"
on public.task_attachments;


-- Usuário autenticado pode consultar anexos das tarefas do módulo.
create policy "task_attachments_select"
on public.task_attachments
for select
to authenticated
using (true);


-- Só permite inserir se uploaded_by for o membro da equipe
-- vinculado ao usuário autenticado.
create policy "task_attachments_insert"
on public.task_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.equipe e
    where e.id = task_attachments.uploaded_by
      and e.user_id = auth.uid()
      and coalesce(e.ativo, true) = true
  )
);


-- Usuário pode excluir os próprios anexos.
create policy "task_attachments_delete"
on public.task_attachments
for delete
to authenticated
using (
  exists (
    select 1
    from public.equipe e
    where e.id = task_attachments.uploaded_by
      and e.user_id = auth.uid()
  )
);


-- =========================================================
-- STORAGE.OBJECTS
-- =========================================================

drop policy if exists "task_files_read_authenticated"
on storage.objects;

drop policy if exists "task_files_insert_authenticated"
on storage.objects;

drop policy if exists "task_files_update_authenticated"
on storage.objects;

drop policy if exists "task_files_delete_authenticated"
on storage.objects;


create policy "task_files_read_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-files'
);


create policy "task_files_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-files'
  and auth.uid() is not null
);


create policy "task_files_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-files'
  and auth.uid() is not null
)
with check (
  bucket_id = 'task-files'
  and auth.uid() is not null
);


create policy "task_files_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-files'
  and auth.uid() is not null
);

commit;

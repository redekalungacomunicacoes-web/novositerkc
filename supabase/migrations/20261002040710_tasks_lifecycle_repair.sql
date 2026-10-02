-- Repair missing runtime contracts without replaying incompatible legacy migrations.
begin;
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.equipe(id) on delete set null,
  comentario text not null check (length(btrim(comentario)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_task_comments_task_created on public.task_comments(task_id,created_at);
alter table public.task_comments enable row level security;
grant select, insert, update, delete on public.task_comments to authenticated;
drop policy if exists task_comments_read on public.task_comments;
create policy task_comments_read on public.task_comments for select to authenticated
using (exists(select 1 from public.tasks t where t.id=task_comments.task_id));
drop policy if exists task_comments_create on public.task_comments;
create policy task_comments_create on public.task_comments for insert to authenticated
with check (
  exists(select 1 from public.tasks t where t.id=task_comments.task_id)
  and exists(select 1 from public.equipe e where e.id=author_id and e.user_id=auth.uid() and e.ativo is not false)
);
-- DELETE had no policy in production: PostgREST returned success with zero rows.
drop policy if exists tasks_delete_creator on public.tasks;
create policy tasks_delete_creator on public.tasks for delete to authenticated
using (public.is_team_admin() or exists(select 1 from public.equipe e where e.id=created_by and e.user_id=auth.uid()));
-- Keep older permissive policies from accepting a forged creator.
drop policy if exists tasks_creator_insert_guard on public.tasks;
create policy tasks_creator_insert_guard on public.tasks as restrictive for insert to authenticated
with check (exists(select 1 from public.equipe e where e.id=created_by and e.user_id=auth.uid() and e.ativo is not false));
-- Enforce visibility even if an older permissive SELECT policy allows every row.
drop policy if exists tasks_read_guard on public.tasks;
create policy tasks_read_guard on public.tasks as restrictive for select to authenticated
using (
  public.is_team_admin()
  or exists(select 1 from public.equipe e where e.user_id=auth.uid() and e.id in (created_by,assigned_to))
  or exists(select 1 from public.task_assignees ta join public.equipe e on e.id=ta.user_id where ta.task_id=tasks.id and e.user_id=auth.uid())
);
drop policy if exists task_drive_read_guard on public.drive_files;
create policy task_drive_read_guard on public.drive_files as restrictive for select to anon, authenticated
using (module <> 'tasks' or (task_id is not null and exists(select 1 from public.tasks t where t.id=drive_files.task_id)));
drop policy if exists task_assignees_create_guard on public.task_assignees;
create policy task_assignees_create_guard on public.task_assignees as restrictive for insert to authenticated
with check (exists(select 1 from public.tasks t where t.id=task_assignees.task_id and (public.is_team_admin() or exists(select 1 from public.equipe e where e.id=t.created_by and e.user_id=auth.uid()))));
drop policy if exists task_assignees_delete_guard on public.task_assignees;
create policy task_assignees_delete_guard on public.task_assignees as restrictive for delete to authenticated
using (exists(select 1 from public.tasks t where t.id=task_assignees.task_id and (public.is_team_admin() or exists(select 1 from public.equipe e where e.id=t.created_by and e.user_id=auth.uid()))));
create or replace function public.guard_task_identity() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if current_user in ('service_role','postgres') then return new; end if;
  if new.created_by is distinct from old.created_by or new.drive_folder_id is distinct from old.drive_folder_id then
    raise exception 'O criador e a pasta da tarefa são gerenciados pelo sistema.' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_task_identity on public.tasks;
create trigger trg_guard_task_identity before update on public.tasks for each row execute function public.guard_task_identity();
alter table public.drive_files add column if not exists task_upload_id uuid;
create unique index if not exists idx_task_drive_upload_id on public.drive_files(task_id,task_upload_id)
where module='tasks' and task_upload_id is not null;
-- Lock records are backend-only; clients cannot influence folder creation leases.
create table if not exists public.task_drive_locks (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  token uuid not null,
  locked_at timestamptz not null default now()
);
alter table public.task_drive_locks enable row level security;
revoke all on public.task_drive_locks from anon, authenticated;
grant all on public.task_drive_locks to service_role;
create table if not exists public.task_drive_root_locks (
  root_folder_id text primary key,
  token uuid not null,
  locked_at timestamptz not null default now()
);
alter table public.task_drive_root_locks enable row level security;
revoke all on public.task_drive_root_locks from anon, authenticated;
grant all on public.task_drive_root_locks to service_role;
create table if not exists public.task_cleanup_jobs (
  task_id uuid primary key,
  requested_by uuid not null,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','done')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.task_cleanup_jobs enable row level security;
revoke all on public.task_cleanup_jobs from anon, authenticated;
grant all on public.task_cleanup_jobs to service_role;
create index if not exists idx_task_cleanup_pending on public.task_cleanup_jobs(created_at) where status='pending';
commit;

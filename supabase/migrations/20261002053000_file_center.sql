begin;
create table public.file_center_folders (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null,
 parent_id uuid references public.file_center_folders(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 120),
 drive_folder_id text not null unique,
 created_at timestamptz not null default now()
);
create index idx_file_center_parent on public.file_center_folders(owner_user_id,parent_id);
alter table public.file_center_folders enable row level security;
revoke all on public.file_center_folders from anon,authenticated;
grant select on public.file_center_folders to authenticated;
grant all on public.file_center_folders to service_role;
create policy file_center_folders_read on public.file_center_folders for select to authenticated using(owner_user_id=auth.uid() or public.is_team_admin());
alter table public.drive_files add column central_folder_id uuid references public.file_center_folders(id) on delete restrict;
alter table public.drive_files add column central_upload_id uuid;
create unique index idx_file_center_upload on public.drive_files(uploaded_by,central_upload_id) where central_upload_id is not null;
create index idx_file_center_files on public.drive_files(central_folder_id) where status='active';
create policy file_center_read_guard on public.drive_files as restrictive for select to anon,authenticated
 using(module<>'file-center' or (auth.uid() is not null and (uploaded_by=auth.uid() or public.is_team_admin())));
create policy file_center_insert_guard on public.drive_files as restrictive for insert to anon,authenticated with check(module<>'file-center');
create policy file_center_update_guard on public.drive_files as restrictive for update to anon,authenticated using(module<>'file-center') with check(module<>'file-center');
create policy file_center_delete_guard on public.drive_files as restrictive for delete to anon,authenticated using(module<>'file-center');
commit;

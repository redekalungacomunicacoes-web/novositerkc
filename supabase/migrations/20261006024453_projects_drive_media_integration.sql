begin;
create schema if not exists maintenance;
create table maintenance.project_backup_20261006 as select id,to_jsonb(p) original_row from public.projetos p;
create table maintenance.project_gallery_backup_20261006 as select id,to_jsonb(g) original_row from public.projeto_galeria g;
revoke all on maintenance.project_backup_20261006,maintenance.project_gallery_backup_20261006 from public,anon,authenticated;
alter table maintenance.project_backup_20261006 enable row level security;
alter table maintenance.project_gallery_backup_20261006 enable row level security;
alter table public.projetos add column if not exists capa_drive_file_id uuid references public.drive_files(id) on delete restrict,
add column if not exists cover_card_drive_file_id uuid references public.drive_files(id) on delete restrict,
add column if not exists drive_folder_id text;
alter table public.projeto_galeria add column if not exists drive_file_id uuid references public.drive_files(id) on delete restrict,
add column if not exists thumb_drive_file_id uuid references public.drive_files(id) on delete restrict;
create table public.project_drive_leases (
project_id uuid primary key references public.projetos(id) on delete cascade,
token uuid not null, expires_at timestamptz not null
);
alter table public.project_drive_leases enable row level security;
revoke all on public.project_drive_leases from public,anon,authenticated;
create function public.claim_project_drive_folder(p_project_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
insert into public.project_drive_leases values(p_project_id,p_token,now()+interval '2 minutes')
on conflict(project_id) do update set token=excluded.token,expires_at=excluded.expires_at
where project_drive_leases.expires_at<now();
get diagnostics n=row_count; return n=1;
end $$;
revoke all on function public.claim_project_drive_folder(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_project_drive_folder(uuid,uuid) to service_role;
create policy project_drive_public_guard on public.drive_files as restrictive for select to anon using (
module<>'projetos' or (visibility='public' and status='active' and deleted_at is null and exists(
select 1 from public.projetos p where p.id=drive_files.entity_id and p.publicado_transparencia=true and
(p.capa_drive_file_id=drive_files.id or p.cover_card_drive_file_id=drive_files.id or exists(
select 1 from public.projeto_galeria g where g.projeto_id=p.id and (g.drive_file_id=drive_files.id or g.thumb_drive_file_id=drive_files.id))))));
commit;
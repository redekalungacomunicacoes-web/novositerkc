begin;

-- Pilot metadata only: legacy Storage fields remain untouched for rollback.
alter table public.equipe
  add column if not exists drive_folder_id text,
  add column if not exists avatar_drive_file_id uuid references public.drive_files(id) on delete set null,
  add column if not exists avatar_thumb_drive_file_id uuid references public.drive_files(id) on delete set null;

create index if not exists equipe_drive_folder_idx
  on public.equipe(drive_folder_id)
  where drive_folder_id is not null;

create index if not exists equipe_avatar_drive_idx
  on public.equipe(avatar_drive_file_id)
  where avatar_drive_file_id is not null;

create index if not exists equipe_avatar_thumb_drive_idx
  on public.equipe(avatar_thumb_drive_file_id)
  where avatar_thumb_drive_file_id is not null;

-- A Drive avatar must belong to the same team member and be active.
create or replace function public.equipe_guard_drive_avatar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.avatar_drive_file_id is not null and not exists (
    select 1 from public.drive_files f
    where f.id = new.avatar_drive_file_id
      and f.module = 'team'
      and f.entity_id = new.id
      and f.status = 'active'
  ) then
    raise exception 'Avatar do Drive incompatível com este integrante.';
  end if;

  if new.avatar_thumb_drive_file_id is not null and not exists (
    select 1 from public.drive_files f
    where f.id = new.avatar_thumb_drive_file_id
      and f.module = 'team'
      and f.entity_id = new.id
      and f.status = 'active'
  ) then
    raise exception 'Thumbnail do Drive incompatível com este integrante.';
  end if;

  return new;
end;
$$;

drop trigger if exists equipe_guard_drive_avatar on public.equipe;
create trigger equipe_guard_drive_avatar
before insert or update of avatar_drive_file_id, avatar_thumb_drive_file_id
on public.equipe
for each row execute function public.equipe_guard_drive_avatar();

revoke all on function public.equipe_guard_drive_avatar() from public, anon, authenticated;

commit;

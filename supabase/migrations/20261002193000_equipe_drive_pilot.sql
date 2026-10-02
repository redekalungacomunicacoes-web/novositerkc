-- Equipe Drive pilot: additive metadata only.
-- Legacy Storage fields remain untouched for rollback/fallback.
begin;

alter table public.equipe
  add column if not exists drive_folder_id text,
  add column if not exists avatar_drive_file_id uuid references public.drive_files(id) on delete set null,
  add column if not exists avatar_thumb_drive_file_id uuid references public.drive_files(id) on delete set null;

create unique index if not exists equipe_drive_folder_id_uidx
  on public.equipe(drive_folder_id)
  where drive_folder_id is not null;

create index if not exists equipe_avatar_drive_file_idx
  on public.equipe(avatar_drive_file_id)
  where avatar_drive_file_id is not null;

create index if not exists equipe_avatar_thumb_drive_file_idx
  on public.equipe(avatar_thumb_drive_file_id)
  where avatar_thumb_drive_file_id is not null;

comment on column public.equipe.drive_folder_id is
  'Google Drive folder id for 04_EQUIPE/<integrante>. Names are display-only; this immutable id is authoritative.';
comment on column public.equipe.avatar_drive_file_id is
  'Optional Drive metadata row for the profile avatar. Legacy foto_url/avatar_path remains as fallback during migration.';
comment on column public.equipe.avatar_thumb_drive_file_id is
  'Optional Drive metadata row for the profile thumbnail. Legacy avatar_thumb_path remains as fallback during migration.';

notify pgrst, 'reload schema';
commit;

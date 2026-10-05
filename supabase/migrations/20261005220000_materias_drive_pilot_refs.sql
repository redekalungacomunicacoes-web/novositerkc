-- Drive media references are additive so existing Storage-backed articles stay live.
alter table public.materias
  add column if not exists capa_drive_file_id uuid references public.drive_files(id) on delete restrict,
  add column if not exists banner_drive_file_id uuid references public.drive_files(id) on delete restrict,
  add column if not exists audio_drive_file_id uuid references public.drive_files(id) on delete restrict;

alter table public.materia_galeria
  add column if not exists drive_file_id uuid references public.drive_files(id) on delete restrict;

create index if not exists materias_capa_drive_file_id_idx on public.materias(capa_drive_file_id) where capa_drive_file_id is not null;
create index if not exists materias_banner_drive_file_id_idx on public.materias(banner_drive_file_id) where banner_drive_file_id is not null;
create index if not exists materia_galeria_drive_file_id_idx on public.materia_galeria(drive_file_id) where drive_file_id is not null;

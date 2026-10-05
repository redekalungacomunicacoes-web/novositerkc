-- Small public cards can use a Drive-hosted WebP rendition while the original
-- remains available for the article and social preview.
alter table public.materias
  add column if not exists capa_thumb_drive_file_id uuid references public.drive_files(id) on delete restrict,
  add column if not exists capa_thumb_url text;

create index if not exists materias_capa_thumb_drive_file_id_idx
  on public.materias(capa_thumb_drive_file_id)
  where capa_thumb_drive_file_id is not null;

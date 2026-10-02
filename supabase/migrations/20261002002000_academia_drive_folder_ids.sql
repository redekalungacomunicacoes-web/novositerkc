-- Fundação incremental para pastas persistentes da Academia no Drive RKC.
-- Executar manualmente no Supabase SQL Editor após merge/revisão.
begin;

alter table public.academy_courses
  add column if not exists drive_folder_id text;

alter table public.academy_lessons
  add column if not exists drive_folder_id text;

create index if not exists academy_courses_drive_folder_idx
  on public.academy_courses(drive_folder_id)
  where drive_folder_id is not null;

create index if not exists academy_lessons_drive_folder_idx
  on public.academy_lessons(drive_folder_id)
  where drive_folder_id is not null;

comment on column public.academy_courses.drive_folder_id is
  'ID imutável da pasta própria do curso em 09_ACADEMIA/CURSOS. O nome visível pode mudar sem quebrar vínculos.';

comment on column public.academy_lessons.drive_folder_id is
  'ID imutável da pasta própria da aula dentro da pasta do curso.';

notify pgrst,'reload schema';
commit;

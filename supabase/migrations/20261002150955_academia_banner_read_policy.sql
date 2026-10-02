-- Banner follows the same private course access as cover, lesson and materials.
begin;
alter policy academy_drive_read_guard on public.drive_files using (
 module<>'academy'
 or (visibility='private' and status='archived' and academy_can_edit(academy_course_id))
 or (visibility='private' and status='active' and deleted_at is null
   and academy_can_read(academy_course_id)
   and (exists(select 1 from academy_courses c where c.id=academy_course_id and c.cover_drive_file_id=drive_files.id)
     or exists(select 1 from academy_courses c where c.id=academy_course_id and c.banner_drive_file_id=drive_files.id)
     or exists(select 1 from academy_lessons l where l.media_drive_file_id=drive_files.id)
     or exists(select 1 from academy_materials m where m.drive_file_id=drive_files.id)))
);
notify pgrst,'reload schema';
commit;

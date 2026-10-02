-- Academia RKC: reparo definitivo do contrato de banner no Drive.
-- Substitui patches textuais anteriores por funções explícitas e idempotentes.
begin;

-- Garante que o tipo banner seja aceito pela constraint de domínio da Academia.
do $$
declare r record; def text;
begin
  for r in
    select c.conname, pg_get_constraintdef(c.oid) definition
      from pg_constraint c
     where c.conrelid='public.drive_files'::regclass
       and c.contype='c'
       and pg_get_constraintdef(c.oid) ilike '%academy_kind%'
  loop
    def := r.definition;
    if def ilike '%cover%' and def ilike '%media%' and def ilike '%material%' and def not ilike '%banner%' then
      execute format('alter table public.drive_files drop constraint %I', r.conname);
      def := replace(def, '''cover'', ''media'', ''material''', '''cover'', ''banner'', ''media'', ''material''');
      def := replace(def, '''cover''::text, ''media''::text, ''material''::text', '''cover''::text, ''banner''::text, ''media''::text, ''material''::text');
      execute format('alter table public.drive_files add constraint %I %s', r.conname, def);
    end if;
  end loop;
end $$;

alter table public.academy_courses
  add column if not exists banner_drive_file_id uuid references public.drive_files(id) on delete set null;

create or replace function public.academy_commit_drive(
  p_actor uuid,p_course uuid,p_lesson uuid,p_kind text,p_upload uuid,p_file jsonb,p_material uuid default null
) returns public.drive_files
language plpgsql security definer set search_path=public as $$
declare f drive_files; allowed boolean; previous uuid;
begin
  select exists(select 1 from user_roles u join roles r on r.id=u.role_id where u.user_id=p_actor and r.name in ('admin_alfa','admin'))
  or (exists(select 1 from user_roles u join roles r on r.id=u.role_id where u.user_id=p_actor and r.name in ('editor','autor','financeiro','admin','admin_alfa')) and
  (exists(select 1 from academy_courses where id=p_course and created_by=p_actor) or
  exists(select 1 from academy_course_instructors ci join academy_instructors i on i.id=ci.instructor_id join equipe e on e.id=i.member_id
  where ci.course_id=p_course and ci.can_edit and e.user_id=p_actor))) into allowed;
  if not allowed then raise exception 'Envio não autorizado.'; end if;
  if p_lesson is not null and not exists(select 1 from academy_lessons where id=p_lesson and course_id=p_course) then raise exception 'Aula incompatível.'; end if;
  if p_kind not in ('cover','banner','media','material')
     or (p_kind in ('cover','banner') and p_lesson is not null)
     or (p_kind='media' and p_lesson is null)
  then raise exception 'Destino acadêmico inválido: %.',p_kind; end if;

  select * into f from drive_files where academy_upload_id=p_upload;
  if found then
    if f.academy_course_id<>p_course or f.uploaded_by<>p_actor or f.academy_kind<>p_kind
    then raise exception 'Envio incompatível.'; end if;
    return f;
  end if;

  if p_kind='cover' then select cover_drive_file_id into previous from academy_courses where id=p_course;
  elsif p_kind='banner' then select banner_drive_file_id into previous from academy_courses where id=p_course;
  elsif p_kind='media' then select media_drive_file_id into previous from academy_lessons where id=p_lesson;
  elsif p_material is not null then select drive_file_id into previous from academy_materials where id=p_material;
  end if;

  insert into drive_files(drive_file_id,drive_folder_id,name,mime_type,size_bytes,module,entity_id,uploaded_by,visibility,status,
    academy_course_id,academy_lesson_id,academy_kind,academy_upload_id)
  values(p_file->>'id',p_file->>'folder_id',p_file->>'name',p_file->>'mimeType',(p_file->>'size')::bigint,'academy',p_course,p_actor,
    'private','active',p_course,p_lesson,p_kind,p_upload)
  returning * into f;

  if p_kind='cover' then
    update academy_courses set cover_drive_file_id=f.id,cover_path=null,updated_at=now() where id=p_course;
  elsif p_kind='banner' then
    update academy_courses set banner_drive_file_id=f.id,updated_at=now() where id=p_course;
  elsif p_kind='media' then
    update academy_lessons set media_source='drive',media_drive_file_id=f.id,media_path=null,media_url=null where id=p_lesson;
  elsif p_material is not null then
    update academy_materials set drive_file_id=f.id,storage_path=null,url=null,title=f.name
     where id=p_material and course_id=p_course and lesson_id is not distinct from p_lesson;
    if not found then raise exception 'Material incompatível.'; end if;
  else
    insert into academy_materials(course_id,lesson_id,title,drive_file_id) values(p_course,p_lesson,f.name,f.id);
  end if;

  if previous is not null and previous<>f.id then
    perform public.academy_retire_previous_drive(previous);
  end if;
  return f;
end $$;

create or replace function public.academy_unlink_drive(p_file uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  update drive_files set status='trashed',deleted_at=now(),updated_at=now() where id=p_file and module='academy';
  update academy_courses set cover_drive_file_id=null where cover_drive_file_id=p_file;
  update academy_courses set banner_drive_file_id=null where banner_drive_file_id=p_file;
  update academy_lessons set media_drive_file_id=null,media_source='none' where media_drive_file_id=p_file;
  delete from academy_materials where drive_file_id=p_file;
end $$;

create or replace function public.academy_retire_previous_drive(p_file uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.drive_files
     set status = case
       when module='academy' and (
         academy_course_id is null
         or academy_kind not in ('cover','banner','media','material')
         or visibility<>'private'
         or public_slug is not null
         or task_id is not null
         or (academy_kind='media' and academy_lesson_id is null)
         or (academy_kind in ('cover','banner') and academy_lesson_id is not null)
       ) then 'trashed' else 'archived' end,
       updated_at=now()
   where id=p_file and status<>'trashed';
end $$;

revoke all on function public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid),public.academy_unlink_drive(uuid),public.academy_retire_previous_drive(uuid) from public,anon,authenticated;
grant execute on function public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid),public.academy_unlink_drive(uuid),public.academy_retire_previous_drive(uuid) to service_role;

notify pgrst,'reload schema';
commit;

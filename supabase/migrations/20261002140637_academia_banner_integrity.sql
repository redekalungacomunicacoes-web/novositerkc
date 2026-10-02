-- Banner uses its own reference. Replay safety lives in PostgreSQL as well as UI/Edge.
begin;
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
  if p_material is not null and p_kind<>'material' then raise exception 'Destino de substituição inválido.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_course::text, 0));
  select * into f from drive_files where academy_upload_id=p_upload;
  if found then
    if f.academy_course_id<>p_course or f.uploaded_by<>p_actor or f.academy_kind is distinct from p_kind or f.academy_lesson_id is distinct from p_lesson or f.status<>'active'
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

create or replace function public.academy_guard_banner_reference() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.banner_drive_file_id is not null and not exists (
    select 1 from public.drive_files f where f.id=new.banner_drive_file_id
    and f.module='academy' and f.academy_course_id=new.id
    and f.academy_lesson_id is null and f.academy_kind='banner'
    and f.visibility='private' and f.public_slug is null and f.status='active'
  ) then raise exception 'Banner do Drive incompatível com este curso.'; end if;
  return new;
end $$;
drop trigger if exists academy_guard_banner on public.academy_courses;
create trigger academy_guard_banner before insert or update on public.academy_courses
for each row execute function public.academy_guard_banner_reference();
revoke all on function public.academy_guard_banner_reference() from public,anon,authenticated;
revoke all on function public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;

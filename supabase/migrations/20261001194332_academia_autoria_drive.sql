-- Incremental change only. Existing academy and drive tables must be inspected first.
-- Do not replay the historical migrations or repair history to apply this file.
begin;
create or replace function public.academy_can_edit(p_course uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select academy_admin() or (academy_member() and (
 exists(select 1 from academy_courses c where c.id=p_course and c.created_by=auth.uid()) or
 exists(select 1 from academy_course_instructors ci join academy_instructors i on i.id=ci.instructor_id
 join equipe e on e.id=i.member_id where ci.course_id=p_course and ci.can_edit and e.user_id=auth.uid())));
$$;
create or replace function public.academy_can_read(p_course uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select academy_can_edit(p_course) or (academy_member() and exists(
 select 1 from academy_courses c where c.id=p_course and c.status='published' and c.access_mode='internal'
 and (c.available_from is null or c.available_from<=now()) and (c.available_until is null or c.available_until>now())));
$$;
drop policy course_insert on public.academy_courses;
create policy course_insert on public.academy_courses for insert to authenticated
with check(academy_member() and created_by=(select auth.uid()));
create index if not exists academy_courses_creator_idx on public.academy_courses(created_by);
create function public.academy_guard_owner() returns trigger language plpgsql set search_path=public as $$
begin
 if new.created_by is distinct from old.created_by and (auth.uid() is not null or new.created_by is not null) then raise exception 'A autoria do curso não pode ser transferida.'; end if;
 return new;
end $$;
create trigger academy_guard_owner before update on public.academy_courses for each row execute function public.academy_guard_owner();

alter table public.drive_files
 add column if not exists access_scope text not null default 'assignees',
 add column academy_course_id uuid references public.academy_courses on delete set null,
 add column academy_lesson_id uuid,
 add column academy_kind text,
 add column academy_upload_id uuid,
 add constraint drive_academy_lesson_fk foreign key(academy_lesson_id,academy_course_id) references public.academy_lessons(id,course_id) on delete set null (academy_lesson_id),
 add constraint drive_academy_private check(module<>'academy' or
 ((academy_course_id is not null or status='trashed') and academy_kind in ('cover','media','material') and
 visibility='private' and public_slug is null and task_id is null and
 (academy_kind<>'media' or academy_lesson_id is not null or status='trashed')));
create unique index drive_academy_upload_idx on public.drive_files(academy_upload_id) where academy_upload_id is not null;
create index drive_academy_course_idx on public.drive_files(academy_course_id,academy_lesson_id);
alter table public.academy_courses add column cover_drive_file_id uuid references public.drive_files on delete restrict;
alter table public.academy_lessons
 add column media_drive_file_id uuid references public.drive_files on delete restrict,
 add column media_source text not null default 'none' check(media_source in ('none','drive','youtube','vimeo'));
alter table public.academy_materials add column drive_file_id uuid references public.drive_files on delete restrict;
alter table public.academy_materials drop constraint academy_materials_check;
alter table public.academy_materials add constraint academy_material_source check(
 (storage_path is not null)::integer+(url is not null)::integer+(drive_file_id is not null)::integer=1);
-- Existing Storage and external links are retained, never silently migrated/deleted.
create function public.academy_guard_drive_reference() returns trigger
language plpgsql security definer set search_path=public as $$
declare fid uuid; cid uuid; lid uuid; kind text;
begin
 if tg_table_name='academy_courses' then fid=new.cover_drive_file_id; cid=new.id; kind='cover';
 elsif tg_table_name='academy_lessons' then fid=new.media_drive_file_id; cid=new.course_id; lid=new.id; kind='media';
 else fid=new.drive_file_id; cid=new.course_id; lid=new.lesson_id; kind='material'; end if;
 if fid is not null and not exists(select 1 from drive_files f where f.id=fid and f.module='academy'
 and f.academy_course_id=cid and f.academy_lesson_id is not distinct from lid
 and f.academy_kind=kind and f.visibility='private' and f.status='active') then
 raise exception 'Arquivo do Drive incompatível com este curso ou aula.'; end if;
 if tg_table_name='academy_lessons' then
   if new.media_source in ('youtube','vimeo') then
     if new.media_drive_file_id is not null or new.media_path is not null then raise exception 'Selecione somente uma origem de conteúdo.'; end if;
     if new.media_url is null or new.media_url !~
       (case when new.media_source='youtube' then '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/[^[:space:]]+$'
       else '^https://(www\.|player\.)?vimeo\.com/(video/)?[0-9]+([/?][^[:space:]]*)?$' end)
       then raise exception 'Link inválido para o provedor selecionado.'; end if;
     if new.media_source='youtube' and not (
       new.media_url ~ '^https://youtu\.be/[A-Za-z0-9_-]{11}([?#][^[:space:]]*)?$' or
       new.media_url ~ '^https://(www\.|m\.)?youtube\.com/(embed|shorts)/[A-Za-z0-9_-]{11}([?#][^[:space:]]*)?$' or
       (new.media_url ~ '^https://(www\.|m\.)?youtube\.com/watch\?' and new.media_url ~ '[?&]v=[A-Za-z0-9_-]{11}(&|#|$)'))
       then raise exception 'Identificador de vídeo YouTube inválido.'; end if;
   elsif new.media_source='drive' and new.media_url is not null then raise exception 'Conteúdo do Drive não aceita URL externa.';
   end if;
 end if;
 return new;
end $$;
create trigger academy_guard_drive before insert or update on public.academy_courses for each row execute function public.academy_guard_drive_reference();
create trigger academy_guard_drive before insert or update on public.academy_lessons for each row execute function public.academy_guard_drive_reference();
create trigger academy_guard_drive before insert or update on public.academy_materials for each row execute function public.academy_guard_drive_reference();
-- Restrictive policies prevent existing broad/public Drive policies from exposing academy files.
alter table public.drive_files enable row level security;
create policy academy_drive_read on public.drive_files for select to authenticated using(module='academy' and academy_can_read(academy_course_id));
create policy academy_drive_read_guard on public.drive_files as restrictive for select to anon,authenticated using(
 module<>'academy' or (visibility='private' and status='archived' and academy_can_edit(academy_course_id)) or (visibility='private' and status='active' and deleted_at is null and academy_can_read(academy_course_id)
 and (exists(select 1 from academy_courses c where c.cover_drive_file_id=drive_files.id)
 or exists(select 1 from academy_lessons l where l.media_drive_file_id=drive_files.id)
 or exists(select 1 from academy_materials m where m.drive_file_id=drive_files.id))));
create policy academy_drive_insert_guard on public.drive_files as restrictive for insert to anon,authenticated with check(module<>'academy');
create policy academy_drive_update_guard on public.drive_files as restrictive for update to anon,authenticated using(module<>'academy') with check(module<>'academy');
create policy academy_drive_delete_guard on public.drive_files as restrictive for delete to anon,authenticated using(module<>'academy');
grant select on public.drive_files to authenticated;

-- Course lease serializes path creation across users/tabs. Client cannot access lease rows.
create table public.academy_drive_leases(course_id uuid primary key references academy_courses on delete cascade,
 token uuid not null, expires_at timestamptz not null);
alter table public.academy_drive_leases enable row level security;
revoke all on public.academy_drive_leases from public,anon,authenticated;
create function public.academy_drive_lock(p_course uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare acquired boolean;
begin
 if not academy_can_edit(p_course) then raise exception 'Envio não autorizado.'; end if;
 insert into academy_drive_leases values(p_course,p_token,now()+interval '5 minutes')
 on conflict(course_id) do update set token=excluded.token,expires_at=excluded.expires_at
 where academy_drive_leases.expires_at<now()
 returning true into acquired;
 return coalesce(acquired,false);
end $$;
create function public.academy_drive_unlock(p_course uuid,p_token uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not academy_can_edit(p_course) then raise exception 'Envio não autorizado.'; end if;
 delete from academy_drive_leases where course_id=p_course and token=p_token;
end $$;

-- Global root lease prevents two courses creating 09_ACADEMIA at the same time.
create table public.academy_drive_root_lease(id boolean primary key default true check(id),token uuid not null,expires_at timestamptz not null);
alter table public.academy_drive_root_lease enable row level security;
revoke all on public.academy_drive_root_lease from public,anon,authenticated;
create function public.academy_drive_root_lock(p_token uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare acquired boolean;
begin
 if not academy_member() then raise exception 'Pasta não autorizada.'; end if;
 insert into academy_drive_root_lease values(true,p_token,now()+interval '5 minutes')
 on conflict(id) do update set token=excluded.token,expires_at=excluded.expires_at where academy_drive_root_lease.expires_at<now()
 returning true into acquired;
 return coalesce(acquired,false);
end $$;
create function public.academy_drive_root_unlock(p_token uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not academy_member() then raise exception 'Pasta não autorizada.'; end if;
 delete from academy_drive_root_lease where token=p_token;
end $$;
revoke all on function public.academy_drive_root_lock(uuid),public.academy_drive_root_unlock(uuid) from public,anon;
grant execute on function public.academy_drive_root_lock(uuid),public.academy_drive_root_unlock(uuid) to authenticated;

-- Only the existing authenticated Edge Function can commit Google metadata and its content link together.
create function public.academy_commit_drive(p_actor uuid,p_course uuid,p_lesson uuid,p_kind text,p_upload uuid,p_file jsonb,p_material uuid default null)
returns public.drive_files language plpgsql security definer set search_path=public as $$
declare f drive_files; allowed boolean; previous uuid;
begin
 select exists(select 1 from user_roles u join roles r on r.id=u.role_id where u.user_id=p_actor and r.name in ('admin_alfa','admin'))
 or (exists(select 1 from user_roles u join roles r on r.id=u.role_id where u.user_id=p_actor and r.name in ('editor','autor','financeiro','admin','admin_alfa')) and
 (exists(select 1 from academy_courses where id=p_course and created_by=p_actor) or
 exists(select 1 from academy_course_instructors ci join academy_instructors i on i.id=ci.instructor_id join equipe e on e.id=i.member_id
 where ci.course_id=p_course and ci.can_edit and e.user_id=p_actor))) into allowed;
 if not allowed then raise exception 'Envio não autorizado.'; end if;
 if p_lesson is not null and not exists(select 1 from academy_lessons where id=p_lesson and course_id=p_course) then raise exception 'Aula incompatível.'; end if;
 if p_kind not in ('cover','media','material') or (p_kind='cover' and p_lesson is not null) or (p_kind='media' and p_lesson is null) then raise exception 'Destino inválido.'; end if;
 select * into f from drive_files where academy_upload_id=p_upload;
 if found then
 if f.academy_course_id<>p_course or f.uploaded_by<>p_actor then raise exception 'Envio incompatível.'; end if;
 return f; end if;
 if p_kind='cover' then select cover_drive_file_id into previous from academy_courses where id=p_course;
 elsif p_kind='media' then select media_drive_file_id into previous from academy_lessons where id=p_lesson;
 elsif p_material is not null then select drive_file_id into previous from academy_materials where id=p_material; end if;
 insert into drive_files(drive_file_id,drive_folder_id,name,mime_type,size_bytes,module,entity_id,uploaded_by,visibility,status,
 academy_course_id,academy_lesson_id,academy_kind,academy_upload_id)
 values(p_file->>'id',p_file->>'folder_id',p_file->>'name',p_file->>'mimeType',(p_file->>'size')::bigint,'academy',p_course,p_actor,'private','active',p_course,p_lesson,p_kind,p_upload) returning * into f;
 if p_kind='cover' then update academy_courses set cover_drive_file_id=f.id,cover_path=null where id=p_course;
 elsif p_kind='media' then update academy_lessons set media_source='drive',media_drive_file_id=f.id,media_path=null,media_url=null where id=p_lesson;
 elsif p_material is not null then
 update academy_materials set drive_file_id=f.id,storage_path=null,url=null,title=f.name where id=p_material and course_id=p_course and lesson_id is not distinct from p_lesson;
 if not found then raise exception 'Material incompatível.'; end if;
 else insert into academy_materials(course_id,lesson_id,title,drive_file_id) values(p_course,p_lesson,f.name,f.id);
 end if;
 -- Old versions remain private, with an explicit archived state for cleanup/audit.
 if previous is not null and previous<>f.id then update drive_files set status='archived',updated_at=now() where id=previous; end if;
 return f;
end $$;
create function public.academy_unlink_drive(p_file uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update drive_files set status='trashed',deleted_at=now(),updated_at=now() where id=p_file and module='academy';
 update academy_courses set cover_drive_file_id=null where cover_drive_file_id=p_file;
 update academy_lessons set media_drive_file_id=null,media_source='none' where media_drive_file_id=p_file;
 delete from academy_materials where drive_file_id=p_file;
end $$;
create function public.academy_guard_drive_delete() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from drive_files where module='academy' and status<>'trashed' and
 ((tg_table_name='academy_courses' and academy_course_id=old.id) or
 (tg_table_name='academy_lessons' and academy_lesson_id=old.id) or
 (tg_table_name='academy_materials' and id=(to_jsonb(old)->>'drive_file_id')::uuid) or
 (tg_table_name='academy_modules' and academy_lesson_id in (select id from academy_lessons where module_id=old.id)))) then
 raise exception 'Remova os arquivos do Drive antes de excluir este conteúdo.'; end if;
 return old;
end $$;
create trigger academy_guard_drive_delete before delete on public.academy_courses for each row execute function public.academy_guard_drive_delete();
create trigger academy_guard_drive_delete before delete on public.academy_modules for each row execute function public.academy_guard_drive_delete();
create trigger academy_guard_drive_delete before delete on public.academy_lessons for each row execute function public.academy_guard_drive_delete();
create trigger academy_guard_drive_delete before delete on public.academy_materials for each row execute function public.academy_guard_drive_delete();
revoke all on function public.academy_guard_drive_delete() from public,anon,authenticated;
-- Service-only RPCs; never callable by a browser, including authenticated authors.
revoke all on function public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid),public.academy_unlink_drive(uuid) from public,anon,authenticated;
grant execute on function public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid),public.academy_unlink_drive(uuid) to service_role;
revoke all on function public.academy_guard_owner(),public.academy_guard_drive_reference() from public,anon,authenticated;
revoke all on function public.academy_drive_lock(uuid,uuid),public.academy_drive_unlock(uuid,uuid) from public,anon;
grant execute on function public.academy_drive_lock(uuid,uuid),public.academy_drive_unlock(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

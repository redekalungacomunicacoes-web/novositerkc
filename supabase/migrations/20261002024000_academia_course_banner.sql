-- Academia RKC: banner visual independente da capa.
begin;
alter table public.academy_courses
  add column if not exists banner_drive_file_id uuid references public.drive_files(id) on delete set null;
create index if not exists academy_courses_banner_drive_idx on public.academy_courses(banner_drive_file_id) where banner_drive_file_id is not null;
comment on column public.academy_courses.banner_drive_file_id is 'Banner 3:1 privado do curso no Drive RKC; capa 16:9 permanece em cover_drive_file_id.';

-- academy_kind passa a reconhecer banner nas constraints existentes.
do $$
declare r record; def text;
begin
  for r in select c.conname, pg_get_constraintdef(c.oid) definition from pg_constraint c
    where c.conrelid='public.drive_files'::regclass and c.contype='c' and pg_get_constraintdef(c.oid) ilike '%academy_kind%'
  loop
    def:=r.definition;
    if def ilike '%cover%' and def ilike '%media%' and def ilike '%material%' and def not ilike '%banner%' then
      execute format('alter table public.drive_files drop constraint %I',r.conname);
      def:=replace(def,'''cover'', ''media'', ''material''','''cover'', ''banner'', ''media'', ''material''');
      def:=replace(def,'''cover''::text, ''media''::text, ''material''::text','''cover''::text, ''banner''::text, ''media''::text, ''material''::text');
      execute format('alter table public.drive_files add constraint %I %s',r.conname,def);
    end if;
  end loop;
end $$;
-- Adapta as RPCs já instaladas sem duplicar sua lógica de autorização/metadados.
do $
declare src text;
begin
  select pg_get_functiondef('public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure) into src;
  if src is null then raise exception 'academy_commit_drive não encontrada'; end if;
  src:=replace(src,'''cover'', ''media'', ''material''','''cover'', ''banner'', ''media'', ''material''');
  src:=replace(src,'''cover'',''media'',''material''','''cover'',''banner'',''media'',''material''');
  src:=replace(src,'p_kind = ''cover''','p_kind in (''cover'',''banner'')');
  src:=replace(src,'p_kind=''cover''','p_kind in (''cover'',''banner'')');
  -- Atribuição da imagem ao curso: banner ganha coluna própria.
  src:=replace(src,
    'update academy_courses set cover_drive_file_id=record_id,updated_at=now() where id=p_course',
    'if p_kind = ''banner'' then update academy_courses set banner_drive_file_id=record_id,updated_at=now() where id=p_course; else update academy_courses set cover_drive_file_id=record_id,updated_at=now() where id=p_course; end if');
  execute src;
end $;

notify pgrst,'reload schema';
commit;

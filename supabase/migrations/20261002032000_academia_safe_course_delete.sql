-- Academia RKC: exclusão segura de curso e diagnóstico claro.
-- Arquivos ativos devem ser removidos pela Academia antes da exclusão.
-- Histórico acadêmico continua protegido.
begin;

create or replace function public.academy_delete_course(p_course uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_files integer;
  enrollment_count integer;
begin
  if not public.academy_can_edit(p_course) then
    raise exception 'Sem permissão para excluir este curso.';
  end if;

  select count(*) into active_files
    from public.drive_files
   where module = 'academy'
     and academy_course_id = p_course
     and status = 'active';

  if active_files > 0 then
    raise exception 'Remova os % arquivo(s) ativo(s) do curso pela Academia antes de excluir.', active_files;
  end if;

  select count(*) into enrollment_count
    from public.academy_enrollments
   where course_id = p_course;

  if enrollment_count > 0 then
    raise exception 'Este curso possui % matrícula(s) ou histórico acadêmico e não pode ser excluído. Arquive o curso para preservar o histórico.', enrollment_count;
  end if;

  -- Registros de arquivos já arquivados/descartados não devem manter o curso preso.
  update public.drive_files
     set academy_course_id = null,
         academy_lesson_id = null,
         updated_at = now()
   where module = 'academy'
     and academy_course_id = p_course
     and status <> 'active';

  delete from public.academy_courses where id = p_course;
  if not found then raise exception 'Curso não encontrado.'; end if;
end;
$$;

revoke all on function public.academy_delete_course(uuid) from public, anon;
grant execute on function public.academy_delete_course(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

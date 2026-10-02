-- Academia RKC: exclusão administrativa completa de curso.
-- Remove vínculos acadêmicos do curso em uma única transação e libera metadados
-- dos arquivos no Drive sem exigir limpeza manual arquivo por arquivo.
begin;

create or replace function public.academy_delete_course(p_course uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.academy_admin() then
    raise exception 'Somente administradores podem excluir definitivamente um curso.';
  end if;

  if not exists(select 1 from public.academy_courses where id = p_course) then
    raise exception 'Curso não encontrado.';
  end if;

  -- Certificados restringem a matrícula; removê-los primeiro.
  delete from public.academy_certificates c
   using public.academy_enrollments e
   where c.enrollment_id = e.id
     and e.course_id = p_course;

  -- Matrículas removem em cascata progresso, tentativas e respostas.
  delete from public.academy_enrollments
   where course_id = p_course;

  -- Arquivos permanecem fisicamente no Drive, mas deixam de prender o curso.
  -- A limpeza física pode ser feita pelo fluxo de arquivos/Drive separadamente.
  update public.drive_files
     set academy_course_id = null,
         academy_lesson_id = null,
         updated_at = now()
   where module = 'academy'
     and academy_course_id = p_course;

  -- Demais entidades pedagógicas usam cascata/set null conforme o schema.
  delete from public.academy_courses where id = p_course;
  if not found then raise exception 'Curso não encontrado.'; end if;
end;
$$;

revoke all on function public.academy_delete_course(uuid) from public, anon;
grant execute on function public.academy_delete_course(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

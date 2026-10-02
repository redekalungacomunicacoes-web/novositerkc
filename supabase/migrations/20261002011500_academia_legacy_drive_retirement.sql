-- Compatibilidade para versões antigas de arquivos da Academia.
-- Mantém drive_academy_private; não afrouxa a proteção.
-- Registros legados incompletos só podem ser aposentados como trashed,
-- estado explicitamente aceito pela constraint para limpeza/auditoria.
create or replace function public.academy_retire_previous_drive(p_file uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.drive_files
     set status = case
       when module = 'academy'
        and (academy_course_id is null
          or academy_kind not in ('cover','media','material')
          or visibility <> 'private'
          or public_slug is not null
          or task_id is not null
          or (academy_kind = 'media' and academy_lesson_id is null))
       then 'trashed'
       else 'archived'
     end,
     updated_at = now()
   where id = p_file
     and status <> 'trashed';
end;
$$;

revoke all on function public.academy_retire_previous_drive(uuid) from public, anon, authenticated;
grant execute on function public.academy_retire_previous_drive(uuid) to service_role;

-- Patch only the retirement statement in academy_commit_drive.
do $$
declare src text;
begin
  select pg_get_functiondef('public.academy_commit_drive(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure)
    into src;
  if position('update drive_files set status=''archived'',updated_at=now() where id=previous' in src) = 0 then
    raise exception 'academy_commit_drive divergiu da versão esperada; migration interrompida com segurança.';
  end if;
  src := replace(
    src,
    'update drive_files set status=''archived'',updated_at=now() where id=previous',
    'perform public.academy_retire_previous_drive(previous)'
  );
  execute src;
end $$;

notify pgrst,'reload schema';

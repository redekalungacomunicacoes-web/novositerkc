begin;
-- Some installations contain an unused pre-V3 checklist outside repository migration history.
-- Import any rows once, preserving IDs and completion, then make it read-only for clients.
do $$ begin
 if to_regclass('public.task_checklist') is not null then
  execute $import$
   insert into public.task_checklist_items(id,task_id,title,position,completed_at,completed_by,created_at)
   select c.id,c.task_id,coalesce(nullif(btrim(c.titulo),''),'Etapa legada'),coalesce(c.ordem,0),
    case when c.concluida then coalesce(c.completed_at,c.updated_at,c.created_at,now()) else null end,
    case when c.concluida then e.id else null end,coalesce(c.created_at,now())
   from public.task_checklist c join public.tasks t on t.id=c.task_id left join public.equipe e on e.id=c.completed_by
   on conflict(id) do nothing
  $import$;
  execute 'revoke insert,update,delete on public.task_checklist from anon,authenticated';
 end if;
 if to_regprocedure('public.refresh_task_progress(uuid)') is not null then
  execute 'revoke all on function public.refresh_task_progress(uuid) from public,anon,authenticated';
 end if;
end $$;
commit;

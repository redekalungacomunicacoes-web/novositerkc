begin;
revoke all on schema task_workflow_private from public,anon;
revoke all on function public.mutate_task_workflow(uuid,text,jsonb,integer,uuid) from public,anon;
revoke all on function task_workflow_private.can_access(uuid) from public,anon;
revoke all on function task_workflow_private.mutate(uuid,text,jsonb,integer,uuid) from public,anon;
revoke all on function task_workflow_private.guard_task(),task_workflow_private.guard_create(),task_workflow_private.clean_file_links() from public,anon,authenticated;
create index if not exists task_file_links_drive_idx on public.task_file_links(drive_file_id) where drive_file_id is not null;
create index if not exists task_file_links_legacy_idx on public.task_file_links(legacy_attachment_id) where legacy_attachment_id is not null;
commit;

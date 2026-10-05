begin;
-- The previous anon policy planned calls to academy_can_edit, whose EXECUTE
-- grant is intentionally authenticated-only. That blocked all public Drive joins.
-- Preserve authenticated academy rules verbatim and explicitly deny anon academy.
alter policy academy_drive_read_guard on public.drive_files to authenticated;
create policy academy_drive_anon_read_guard on public.drive_files as restrictive
for select to anon using (module <> 'academy');
commit;

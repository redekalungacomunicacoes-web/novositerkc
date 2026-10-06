alter table public.academy_progress
  add column if not exists watched_percent numeric(5,2) not null default 0
  check (watched_percent >= 0 and watched_percent <= 100);

create or replace function public.academy_record_lesson_progress(
  p_enrollment uuid,
  p_lesson uuid,
  p_percent numeric
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare e academy_enrollments;
declare v_percent numeric;
begin
 select * into e from academy_enrollments where id=p_enrollment for update;
 if not academy_owns_enrollment(p_enrollment)
    or not exists(select 1 from academy_lessons where id=p_lesson and course_id=e.course_id and status='published')
 then raise exception 'Aula não autorizada'; end if;
 v_percent := greatest(0, least(100, coalesce(p_percent,0)));
 insert into academy_progress(enrollment_id,course_id,lesson_id,watched_percent,completed_at)
 values(e.id,e.course_id,p_lesson,v_percent,case when v_percent>=95 then now() end)
 on conflict(enrollment_id,lesson_id) do update set
   updated_at=now(),
   watched_percent=greatest(academy_progress.watched_percent,excluded.watched_percent),
   completed_at=case when greatest(academy_progress.watched_percent,excluded.watched_percent)>=95
     then coalesce(academy_progress.completed_at,now()) else academy_progress.completed_at end;
 update academy_enrollments set last_lesson_id=p_lesson where id=e.id;
 perform academy_refresh(e.id);
end $$;
revoke all on function public.academy_record_lesson_progress(uuid,uuid,numeric) from public;
grant execute on function public.academy_record_lesson_progress(uuid,uuid,numeric) to authenticated;
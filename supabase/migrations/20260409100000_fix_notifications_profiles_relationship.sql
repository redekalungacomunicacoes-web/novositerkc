-- Corrige relacionamento esperado pelo frontend:
-- notifications.user_id -> profiles.id

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'notifications'
      and constraint_name = 'notifications_user_id_fkey'
  ) then
    alter table public.notifications
      drop constraint notifications_user_id_fkey;
  end if;
end $$;

alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete cascade;

create index if not exists idx_notifications_user_id_created_at
  on public.notifications(user_id, created_at desc);

commit;

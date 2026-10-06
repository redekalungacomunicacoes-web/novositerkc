alter table public.site_popups add column if not exists target_path text not null default '/';
update public.site_popups set target_path='/' where target_path is null or btrim(target_path)='';
drop index if exists public.site_popups_one_active_idx;
drop index if exists public.site_popups_single_active_idx;
create unique index if not exists site_popups_one_active_per_path_idx on public.site_popups(target_path) where active=true;

create or replace function public.site_popup_keep_single_active()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.active then
    update public.site_popups
       set active=false, updated_at=now()
     where id<>new.id and active=true and target_path=new.target_path;
  end if;
  return new;
end $$;

drop trigger if exists site_popup_single_active_trigger on public.site_popups;
create trigger site_popup_single_active_trigger
before insert or update of active,target_path on public.site_popups
for each row execute function public.site_popup_keep_single_active();
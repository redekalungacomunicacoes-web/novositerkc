create table if not exists public.site_popups (
 id uuid primary key default gen_random_uuid(), title text not null, eyebrow text, description text, image_url text, youtube_url text,
 cta_label text not null default 'Assistir agora', cta_url text, active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.site_popups enable row level security;
drop policy if exists "site_popups_public_read_active" on public.site_popups;
create policy "site_popups_public_read_active" on public.site_popups for select using (active = true or public.is_admin());
drop policy if exists "site_popups_admin_all" on public.site_popups;
create policy "site_popups_admin_all" on public.site_popups for all using (public.is_admin()) with check (public.is_admin());
create unique index if not exists site_popups_single_active_idx on public.site_popups ((active)) where active = true;
create or replace function public.site_popup_single_active() returns trigger language plpgsql as $$ begin
 new.updated_at=now(); if new.active then update public.site_popups set active=false,updated_at=now() where id<>new.id and active=true; end if; return new; end; $$;
drop trigger if exists site_popup_single_active_trigger on public.site_popups;
create trigger site_popup_single_active_trigger before insert or update on public.site_popups for each row execute function public.site_popup_single_active();
grant select on public.site_popups to anon, authenticated; grant insert,update,delete on public.site_popups to authenticated;
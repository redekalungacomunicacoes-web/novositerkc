begin;
alter table public.team_member_portfolio add column if not exists drive_file_id uuid references public.drive_files(id) on delete restrict;
create index if not exists team_portfolio_drive_idx on public.team_member_portfolio(drive_file_id);
create table if not exists public.team_slug_aliases (
 slug text primary key, member_id uuid not null references public.equipe(id) on delete cascade
);
alter table public.team_slug_aliases enable row level security;
grant select on public.team_slug_aliases to anon, authenticated;
create policy team_alias_public_read on public.team_slug_aliases for select to anon, authenticated
using (exists(select 1 from public.equipe e where e.id=member_id and e.ativo and e.is_public));
create policy team_alias_editor_write on public.team_slug_aliases for all to authenticated
using (public.is_team_admin() or exists(select 1 from public.equipe e where e.id=member_id and e.user_id=auth.uid()))
with check (public.is_team_admin() or exists(select 1 from public.equipe e where e.id=member_id and e.user_id=auth.uid()));
create function public.team_preserve_slug() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.team_slug_aliases a where a.slug=new.slug and a.member_id<>new.id) then
  raise exception 'Slug reservado por outro integrante.';
 end if;
 if tg_op='UPDATE' and old.slug is distinct from new.slug and old.slug is not null then
  insert into public.team_slug_aliases(slug,member_id) values(old.slug,new.id) on conflict(slug) do nothing;
 end if;
 return new;
end $$;
create trigger team_preserve_slug before insert or update of slug on public.equipe for each row execute function public.team_preserve_slug();
revoke all on function public.team_preserve_slug() from public,anon,authenticated;
create policy team_drive_public_guard on public.drive_files as restrictive for select to anon
using (module <> 'team' or (visibility='public' and status='active' and deleted_at is null and exists(select 1 from public.equipe e where e.id=entity_id and e.ativo and e.is_public)));
create function public.team_portfolio_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.drive_file_id is not null and not exists(select 1 from public.drive_files f where f.id=new.drive_file_id and f.entity_id=new.member_id and f.module='team' and f.category='portfolio' and f.status='active') then
  raise exception 'Arquivo Drive incompatível com este portfólio.';
 end if;
 return new;
end $$;
create trigger team_portfolio_guard before insert or update of drive_file_id,member_id on public.team_member_portfolio for each row execute function public.team_portfolio_guard();
revoke all on function public.team_portfolio_guard() from public,anon,authenticated;
commit;

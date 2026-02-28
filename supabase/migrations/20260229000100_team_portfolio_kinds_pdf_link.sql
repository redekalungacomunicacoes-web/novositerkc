alter table if exists public.team_member_portfolio
  drop constraint if exists team_member_portfolio_kind_check;

alter table if exists public.team_member_portfolio
  add constraint team_member_portfolio_kind_check
  check (kind in ('image', 'video', 'pdf', 'link'));

alter table public.newsletter_deliveries
  add column if not exists tracking_token uuid not null default gen_random_uuid();

create unique index if not exists newsletter_deliveries_tracking_token_uidx
  on public.newsletter_deliveries(tracking_token);

create or replace function public.record_newsletter_open(p_tracking_token uuid)
returns table(delivery_id uuid, first_open boolean, total_opens integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.newsletter_deliveries%rowtype;
  v_first boolean;
  v_total integer;
begin
  select *
    into v_delivery
  from public.newsletter_deliveries
  where tracking_token = p_tracking_token
  for update;

  if not found then
    return;
  end if;

  v_first := v_delivery.opened_at is null;

  update public.newsletter_deliveries
  set
    open_count = coalesce(open_count, 0) + 1,
    opened_at = coalesce(opened_at, now()),
    updated_at = now()
  where id = v_delivery.id
  returning open_count into v_total;

  if v_delivery.subscriber_id is not null then
    update public.newsletter_subscribers
    set last_opened_at = now(), updated_at = now()
    where id = v_delivery.subscriber_id;
  end if;

  if v_first then
    update public.newsletter_campaigns
    set open_count = coalesce(open_count, 0) + 1, updated_at = now()
    where id = v_delivery.campaign_id;
  end if;

  return query select v_delivery.id, v_first, v_total;
end;
$$;

revoke all on function public.record_newsletter_open(uuid) from public, anon, authenticated;
grant execute on function public.record_newsletter_open(uuid) to service_role;

create table if not exists public.site_popup_metrics (
  popup_id uuid primary key references public.site_popups(id) on delete cascade,
  impression_count bigint not null default 0,
  click_count bigint not null default 0,
  close_count bigint not null default 0,
  last_impression_at timestamptz,
  last_click_at timestamptz,
  last_close_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_popup_metrics enable row level security;

drop policy if exists site_popup_metrics_admin_select on public.site_popup_metrics;
create policy site_popup_metrics_admin_select
on public.site_popup_metrics
for select
to authenticated
using (public.is_admin_or_editor());

revoke all on table public.site_popup_metrics from anon;
grant select on table public.site_popup_metrics to authenticated;
grant all on table public.site_popup_metrics to service_role;

insert into public.site_popup_metrics (popup_id)
select id from public.site_popups
on conflict (popup_id) do nothing;

create or replace function public.record_site_popup_event(p_popup_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event not in ('impression', 'click', 'close') then
    raise exception 'invalid popup event';
  end if;

  if not exists (select 1 from public.site_popups where id = p_popup_id) then
    return;
  end if;

  insert into public.site_popup_metrics (
    popup_id,
    impression_count,
    click_count,
    close_count,
    last_impression_at,
    last_click_at,
    last_close_at,
    updated_at
  )
  values (
    p_popup_id,
    case when p_event = 'impression' then 1 else 0 end,
    case when p_event = 'click' then 1 else 0 end,
    case when p_event = 'close' then 1 else 0 end,
    case when p_event = 'impression' then now() else null end,
    case when p_event = 'click' then now() else null end,
    case when p_event = 'close' then now() else null end,
    now()
  )
  on conflict (popup_id) do update
  set
    impression_count = public.site_popup_metrics.impression_count + case when p_event = 'impression' then 1 else 0 end,
    click_count = public.site_popup_metrics.click_count + case when p_event = 'click' then 1 else 0 end,
    close_count = public.site_popup_metrics.close_count + case when p_event = 'close' then 1 else 0 end,
    last_impression_at = case when p_event = 'impression' then now() else public.site_popup_metrics.last_impression_at end,
    last_click_at = case when p_event = 'click' then now() else public.site_popup_metrics.last_click_at end,
    last_close_at = case when p_event = 'close' then now() else public.site_popup_metrics.last_close_at end,
    updated_at = now();
end;
$$;

revoke all on function public.record_site_popup_event(uuid, text) from public, anon, authenticated;
grant execute on function public.record_site_popup_event(uuid, text) to service_role;

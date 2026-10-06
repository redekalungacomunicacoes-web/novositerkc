
-- Newsletter V2: preserve existing subscribers/campaigns while replacing the fragile delivery layer.

-- 1) Normalize campaign metadata without removing legacy columns.
alter table public.newsletter_campaigns
  add column if not exists category text not null default 'newsletter',
  add column if not exists last_error text;

update public.newsletter_campaigns
set sent_count = coalesce(sent_count, 0),
    fail_count = coalesce(fail_count, 0);

alter table public.newsletter_campaigns
  alter column sent_count set default 0,
  alter column fail_count set default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.newsletter_campaigns'::regclass
      and conname = 'newsletter_campaigns_category_check'
  ) then
    alter table public.newsletter_campaigns
      add constraint newsletter_campaigns_category_check
      check (category in ('newsletter','novidade','aviso','campanha'));
  end if;
end $$;

-- 2) Add a durable unsubscribe token for every subscriber.
alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token uuid;

update public.newsletter_subscribers
set unsubscribe_token = gen_random_uuid()
where unsubscribe_token is null;

alter table public.newsletter_subscribers
  alter column unsubscribe_token set default gen_random_uuid(),
  alter column unsubscribe_token set not null;

create unique index if not exists newsletter_subscribers_unsubscribe_token_uidx
  on public.newsletter_subscribers(unsubscribe_token);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers(status);

-- 3) Delivery ledger: makes sending idempotent, auditable and retryable.
create table if not exists public.newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  email text not null,
  status text not null default 'queued'
    check (status in ('queued','sent','failed')),
  attempt_count integer not null default 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists newsletter_sends_campaign_status_idx
  on public.newsletter_sends(campaign_id, status);

drop trigger if exists trg_newsletter_sends_updated_at on public.newsletter_sends;
create trigger trg_newsletter_sends_updated_at
before update on public.newsletter_sends
for each row execute function public.set_updated_at();

-- 4) RLS cleanup. The public site subscribes through an Edge Function;
-- direct table access is admin/editor only.
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_email_settings enable row level security;
alter table public.newsletter_sends enable row level security;

do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'newsletter_campaigns',
        'newsletter_subscribers',
        'newsletter_email_settings',
        'newsletter_sends'
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy newsletter_campaigns_admin_all
on public.newsletter_campaigns
for all
to authenticated
using (public.is_admin_or_editor())
with check (public.is_admin_or_editor());

create policy newsletter_subscribers_admin_all
on public.newsletter_subscribers
for all
to authenticated
using (public.is_admin_or_editor())
with check (public.is_admin_or_editor());

create policy newsletter_sends_admin_all
on public.newsletter_sends
for all
to authenticated
using (public.is_admin_or_editor())
with check (public.is_admin_or_editor());

-- SMTP settings are intentionally service-side only.
revoke all on table public.newsletter_email_settings from anon, authenticated;
revoke all on table public.newsletter_campaigns from anon;
revoke all on table public.newsletter_subscribers from anon;
revoke all on table public.newsletter_sends from anon;

grant select, insert, update, delete on table public.newsletter_campaigns to authenticated;
grant select, insert, update, delete on table public.newsletter_subscribers to authenticated;
grant select, insert, update, delete on table public.newsletter_sends to authenticated;

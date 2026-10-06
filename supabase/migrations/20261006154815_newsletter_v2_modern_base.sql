
-- Newsletter V2: modern, auditable and minimal-disruption base.

-- 1) Subscribers: lifecycle + segmentation primitives + safe unsubscribe token.
alter table public.newsletter_subscribers
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists unsubscribe_token uuid default gen_random_uuid(),
  add column if not exists last_sent_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists last_clicked_at timestamptz;

update public.newsletter_subscribers
set unsubscribe_token = gen_random_uuid()
where unsubscribe_token is null;

alter table public.newsletter_subscribers
  alter column unsubscribe_token set not null;

create unique index if not exists newsletter_subscribers_unsubscribe_token_uidx
  on public.newsletter_subscribers (unsubscribe_token);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

create index if not exists newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

-- 2) Reusable templates.
create table if not exists public.newsletter_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  subject text,
  preview_text text,
  content_html text not null,
  is_system boolean not null default false,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Campaigns: normalize and add audience/metrics/provider fields.
alter table public.newsletter_campaigns
  add column if not exists preview_text text,
  add column if not exists audience_mode text not null default 'all',
  add column if not exists audience_filter jsonb not null default '{}'::jsonb,
  add column if not exists template_id uuid references public.newsletter_templates(id) on delete set null,
  add column if not exists provider text not null default 'smtp',
  add column if not exists total_recipients integer not null default 0,
  add column if not exists delivered_count integer not null default 0,
  add column if not exists open_count integer not null default 0,
  add column if not exists click_count integer not null default 0,
  add column if not exists unsubscribe_count integer not null default 0,
  add column if not exists bounce_count integer not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists last_error text;

update public.newsletter_campaigns
set
  title = coalesce(nullif(title,''), nullif(internal_title,''), nullif(subject,''), 'Campanha'),
  mode = coalesce(nullif(mode,''), nullif(type,''), nullif(kind,''), 'custom'),
  content_html = coalesce(content_html, html),
  sent_count = coalesce(sent_count, 0),
  fail_count = coalesce(fail_count, 0),
  total_recipients = coalesce(total_recipients, 0),
  delivered_count = coalesce(delivered_count, 0),
  open_count = coalesce(open_count, 0),
  click_count = coalesce(click_count, 0),
  unsubscribe_count = coalesce(unsubscribe_count, 0),
  bounce_count = coalesce(bounce_count, 0);

alter table public.newsletter_campaigns
  alter column sent_count set default 0,
  alter column fail_count set default 0;

create index if not exists newsletter_campaigns_status_created_idx
  on public.newsletter_campaigns (status, created_at desc);

create index if not exists newsletter_campaigns_scheduled_idx
  on public.newsletter_campaigns (scheduled_for)
  where scheduled_for is not null;

-- 4) One row per campaign recipient: queue + delivery history.
create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  email text not null,
  status text not null default 'queued'
    check (status in ('queued','sending','sent','delivered','failed','bounced','complained','unsubscribed')),
  provider text not null default 'smtp',
  provider_message_id text,
  error_message text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  unsubscribed_at timestamptz,
  open_count integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists newsletter_deliveries_campaign_status_idx
  on public.newsletter_deliveries (campaign_id, status);

create index if not exists newsletter_deliveries_email_idx
  on public.newsletter_deliveries (email);

create index if not exists newsletter_deliveries_created_at_idx
  on public.newsletter_deliveries (created_at desc);

-- 5) Updated-at triggers.
drop trigger if exists trg_newsletter_templates_updated_at on public.newsletter_templates;
create trigger trg_newsletter_templates_updated_at
before update on public.newsletter_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_newsletter_deliveries_updated_at on public.newsletter_deliveries;
create trigger trg_newsletter_deliveries_updated_at
before update on public.newsletter_deliveries
for each row execute function public.set_updated_at();

-- 6) Seed a reusable RKC base template.
insert into public.newsletter_templates (name, slug, subject, preview_text, content_html, is_system)
values (
  'RKC — Base editorial',
  'rkc-base-editorial',
  null,
  'Novidades da Rede Kalunga Comunicações',
  '<div style="margin:0;background:#f5f5f1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#202020"><div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e8e2"><div style="padding:22px 26px;background:#0F7A3E;color:#ffffff"><div style="font-size:20px;font-weight:700">Rede Kalunga Comunicações</div><div style="font-size:13px;opacity:.9;margin-top:4px">Jornalismo comunitário do Território Kalunga</div></div><div style="padding:28px">{{content}}</div><div style="padding:18px 26px;background:#fafaf7;border-top:1px solid #ecece6;font-size:12px;line-height:1.6;color:#666">Você recebeu esta mensagem porque se inscreveu na Newsletter da RKC.<br><a href="{{unsubscribe_url}}" style="color:#0F7A3E">Cancelar inscrição</a></div></div></div>',
  true
)
on conflict (slug) do nothing;

-- 7) RLS and least-privilege grants.
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_templates enable row level security;
alter table public.newsletter_deliveries enable row level security;
alter table public.newsletter_email_settings enable row level security;

-- Remove old permissive/duplicated policies.
drop policy if exists "newsletter_admin_delete" on public.newsletter_subscribers;
drop policy if exists "newsletter_admin_select" on public.newsletter_subscribers;
drop policy if exists "newsletter_admin_update" on public.newsletter_subscribers;
drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;
drop policy if exists "newsletter_read_admin" on public.newsletter_subscribers;
drop policy if exists "newsletter_subscribe_anon" on public.newsletter_subscribers;
drop policy if exists "newsletter_subscribers_insert_public" on public.newsletter_subscribers;
drop policy if exists "newsletter_subscribers_select_authenticated" on public.newsletter_subscribers;
drop policy if exists "newsletter_update_admin_only" on public.newsletter_subscribers;

drop policy if exists "campaigns_admin_insert" on public.newsletter_campaigns;
drop policy if exists "campaigns_admin_select" on public.newsletter_campaigns;
drop policy if exists "campaigns_admin_update" on public.newsletter_campaigns;
drop policy if exists "campaigns_crud_admin" on public.newsletter_campaigns;
drop policy if exists "newsletter_campaigns_all_authenticated" on public.newsletter_campaigns;

drop policy if exists "Only admins can manage email settings" on public.newsletter_email_settings;
drop policy if exists "Newsletter settings managed by service role" on public.newsletter_email_settings;

-- Subscribers: only RKC admin/editor users can access from the client.
create policy "newsletter_subscribers_admin_select"
on public.newsletter_subscribers for select
to authenticated
using (public.is_admin_or_editor());

create policy "newsletter_subscribers_admin_insert"
on public.newsletter_subscribers for insert
to authenticated
with check (public.is_admin_or_editor());

create policy "newsletter_subscribers_admin_update"
on public.newsletter_subscribers for update
to authenticated
using (public.is_admin_or_editor())
with check (public.is_admin_or_editor());

create policy "newsletter_subscribers_admin_delete"
on public.newsletter_subscribers for delete
to authenticated
using (public.is_admin_or_editor());

-- Campaigns.
create policy "newsletter_campaigns_admin_select"
on public.newsletter_campaigns for select
to authenticated
using (public.is_admin_or_editor());

create policy "newsletter_campaigns_admin_insert"
on public.newsletter_campaigns for insert
to authenticated
with check (public.is_admin_or_editor());

create policy "newsletter_campaigns_admin_update"
on public.newsletter_campaigns for update
to authenticated
using (public.is_admin_or_editor())
with check (public.is_admin_or_editor());

create policy "newsletter_campaigns_admin_delete"
on public.newsletter_campaigns for delete
to authenticated
using (public.is_admin_or_editor());

-- Templates.
create policy "newsletter_templates_admin_select"
on public.newsletter_templates for select
to authenticated
using (public.is_admin_or_editor());

create policy "newsletter_templates_admin_insert"
on public.newsletter_templates for insert
to authenticated
with check (public.is_admin_or_editor());

create policy "newsletter_templates_admin_update"
on public.newsletter_templates for update
to authenticated
using (public.is_admin_or_editor())
with check (public.is_admin_or_editor());

create policy "newsletter_templates_admin_delete"
on public.newsletter_templates for delete
to authenticated
using (public.is_admin_or_editor() and not is_system);

-- Delivery history.
create policy "newsletter_deliveries_admin_select"
on public.newsletter_deliveries for select
to authenticated
using (public.is_admin_or_editor());

-- SMTP settings are server-only.
revoke all on table public.newsletter_email_settings from anon, authenticated;
grant all on table public.newsletter_email_settings to service_role;

-- Explicit Data API grants for the authenticated admin UI.
revoke all on table public.newsletter_subscribers from anon;
revoke all on table public.newsletter_campaigns from anon;
revoke all on table public.newsletter_templates from anon;
revoke all on table public.newsletter_deliveries from anon;

grant select, insert, update, delete on table public.newsletter_subscribers to authenticated;
grant select, insert, update, delete on table public.newsletter_campaigns to authenticated;
grant select, insert, update, delete on table public.newsletter_templates to authenticated;
grant select on table public.newsletter_deliveries to authenticated;

grant all on table public.newsletter_subscribers to service_role;
grant all on table public.newsletter_campaigns to service_role;
grant all on table public.newsletter_templates to service_role;
grant all on table public.newsletter_deliveries to service_role;

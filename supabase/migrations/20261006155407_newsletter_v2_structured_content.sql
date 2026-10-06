
alter table public.newsletter_campaigns
  add column if not exists content_json jsonb not null default '{}'::jsonb;

update public.newsletter_campaigns
set content_json = jsonb_build_object(
  'legacy', true,
  'mode', coalesce(mode, type, 'custom')
)
where content_json = '{}'::jsonb;

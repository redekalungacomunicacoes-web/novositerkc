-- newsletter_campaign_recipients is an older empty queue model.
-- newsletter_deliveries is now the single source of truth for recipient delivery state.
drop table if exists public.newsletter_campaign_recipients;

create index if not exists newsletter_campaigns_template_id_idx
  on public.newsletter_campaigns(template_id);

create index if not exists newsletter_deliveries_subscriber_id_idx
  on public.newsletter_deliveries(subscriber_id);

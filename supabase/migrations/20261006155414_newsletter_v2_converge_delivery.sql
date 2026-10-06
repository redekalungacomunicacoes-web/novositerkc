
-- Converge the two same-minute newsletter rebuilds on one delivery ledger.
alter table public.newsletter_deliveries
  add column if not exists attempt_count integer not null default 0;

-- newsletter_sends was created by the stability migration but never received data.
-- Use newsletter_deliveries as the single source of truth.
drop table if exists public.newsletter_sends;

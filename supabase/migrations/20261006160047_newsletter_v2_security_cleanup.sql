-- Newsletter-specific follow-up from Supabase advisors.

-- The aggregate stats view must respect the caller's permissions/RLS.
alter view public.newsletter_stats set (security_invoker = true);
revoke all on table public.newsletter_stats from anon, authenticated;
grant select on table public.newsletter_stats to authenticated;

-- Harden newsletter helper functions against mutable search_path.
alter function public.sync_newsletter_campaign_html() set search_path = public, pg_temp;
alter function public.is_admin_or_editor() set search_path = public, pg_temp;
alter function public.has_role(text[]) set search_path = public, pg_temp;

-- Remove redundant indexes reported by the performance advisor.
drop index if exists public.newsletter_subscribers_created_at_idx;
drop index if exists public.newsletter_subscribers_status_idx;
drop index if exists public.newsletter_subscribers_email_uq;

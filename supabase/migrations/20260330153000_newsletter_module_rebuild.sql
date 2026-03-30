-- Harden SMTP settings access and normalize newsletter campaign fields used by the admin module.

-- Restrict direct client access to SMTP credentials.
drop policy if exists "Authenticated can read newsletter email settings" on public.newsletter_email_settings;
drop policy if exists "Authenticated can upsert newsletter email settings" on public.newsletter_email_settings;
drop policy if exists "Authenticated can update newsletter email settings" on public.newsletter_email_settings;

create policy "Newsletter settings managed by service role"
on public.newsletter_email_settings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Ensure campaign columns exist for robust workflow.
do $$
begin
  if to_regclass('public.newsletter_campaigns') is not null then
    alter table public.newsletter_campaigns add column if not exists title text;
    alter table public.newsletter_campaigns add column if not exists subject text;
    alter table public.newsletter_campaigns add column if not exists mode text default 'custom';
    alter table public.newsletter_campaigns add column if not exists type text default 'custom';
    alter table public.newsletter_campaigns add column if not exists materia_id uuid;
    alter table public.newsletter_campaigns add column if not exists content_html text;
    alter table public.newsletter_campaigns add column if not exists status text default 'draft';
    alter table public.newsletter_campaigns add column if not exists sent_count integer default 0;
    alter table public.newsletter_campaigns add column if not exists fail_count integer default 0;
  end if;
end $$;

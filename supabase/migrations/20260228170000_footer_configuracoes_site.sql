alter table if exists public.configuracoes_site
  add column if not exists footer_logo_path text,
  add column if not exists footer_description text,
  add column if not exists footer_email text,
  add column if not exists footer_instagram_url text,
  add column if not exists footer_whatsapp text,
  add column if not exists footer_facebook_url text,
  add column if not exists footer_linkedin_url text,
  add column if not exists footer_youtube_url text,
  add column if not exists footer_location text,
  add column if not exists footer_address_short text,
  add column if not exists footer_maps_url text,
  add column if not exists updated_at timestamptz default now();

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

alter table public.site_settings
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text,
  add column if not exists seo_og_title text,
  add column if not exists seo_og_description text,
  add column if not exists seo_og_image text,
  add column if not exists seo_indexation text not null default 'index';

alter table public.site_settings
  drop constraint if exists site_settings_seo_indexation_check;

alter table public.site_settings
  add constraint site_settings_seo_indexation_check
  check (seo_indexation in ('index', 'noindex'));

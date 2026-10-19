alter table public.site_settings
  add column if not exists app_name text not null default 'Rede Kalunga Comunicações',
  add column if not exists app_short_name text not null default 'RKC',
  add column if not exists app_description text not null default 'Notícias, cultura e informação do Território Kalunga e da Chapada dos Veadeiros.',
  add column if not exists app_logo_url text,
  add column if not exists app_share_title text not null default 'Rede Kalunga Comunicações',
  add column if not exists app_share_text text not null default 'Acompanhe as notícias, a cultura e as histórias do Território Kalunga.',
  add column if not exists app_share_enabled boolean not null default true;

insert into public.site_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.projetos add column if not exists spotify_latest_episode_url text;
comment on column public.projetos.spotify_latest_episode_url is 'Optional Spotify episode URL featured in the project player; show URL remains the fallback.';

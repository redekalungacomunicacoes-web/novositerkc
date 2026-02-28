ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS ano_lancamento int,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS spotify_url text;

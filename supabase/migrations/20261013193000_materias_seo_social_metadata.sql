-- Campos opcionais para SEO e compartilhamento social.
ALTER TABLE public.materias
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text;

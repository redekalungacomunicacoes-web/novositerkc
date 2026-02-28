ALTER TABLE public.equipe
ADD COLUMN IF NOT EXISTS avatar_path text,
ADD COLUMN IF NOT EXISTS avatar_thumb_path text;


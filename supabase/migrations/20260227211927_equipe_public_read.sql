BEGIN;

ALTER TABLE public.equipe
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

UPDATE public.equipe
SET is_public = true
WHERE is_public IS DISTINCT FROM true;

ALTER TABLE public.equipe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read equipe" ON public.equipe;

CREATE POLICY "Public read equipe"
ON public.equipe
FOR SELECT
TO anon, authenticated
USING (is_public = true);

COMMIT;

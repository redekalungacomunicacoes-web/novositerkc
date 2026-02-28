BEGIN;

ALTER TABLE IF EXISTS public.materias
  ADD COLUMN IF NOT EXISTS autor_equipe_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'materias'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'materias_autor_equipe_id_fkey'
      AND conrelid = 'public.materias'::regclass
  ) THEN
    ALTER TABLE public.materias
      ADD CONSTRAINT materias_autor_equipe_id_fkey
      FOREIGN KEY (autor_equipe_id)
      REFERENCES public.equipe(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.materias m
SET autor_equipe_id = m.autor_id
WHERE m.autor_equipe_id IS NULL
  AND m.autor_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.equipe e
    WHERE e.id = m.autor_id
  );

ALTER TABLE IF EXISTS public.equipe ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'equipe'
      AND policyname = 'Public read equipe'
  ) THEN
    CREATE POLICY "Public read equipe"
      ON public.equipe
      FOR SELECT
      TO anon, authenticated
      USING (coalesce(is_public, false) = true);
  END IF;
END $$;

COMMIT;

BEGIN;

ALTER TABLE public.equipe
ADD COLUMN IF NOT EXISTS order_index int NOT NULL DEFAULT 0;

-- Se muitos registros antigos estiverem com 0, atribuir ordem incremental por created_at
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn
  FROM public.equipe
)
UPDATE public.equipe e
SET order_index = ranked.rn
FROM ranked
WHERE e.id = ranked.id
  AND e.order_index = 0;

CREATE INDEX IF NOT EXISTS equipe_order_index_idx
ON public.equipe(order_index);

COMMIT;

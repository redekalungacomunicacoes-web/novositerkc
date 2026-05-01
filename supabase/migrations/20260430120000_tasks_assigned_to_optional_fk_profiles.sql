-- Permitir responsável opcional para não bloquear inserts/updates sem responsável definido
ALTER TABLE public.tasks
ALTER COLUMN assigned_to DROP NOT NULL;

-- Garantir FK consistente para a entidade de usuário usada pelo app
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_assigned_to_fkey
FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
ON DELETE SET NULL;

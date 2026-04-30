-- Permite assigned_to opcional para maior flexibilidade sem quebrar FK
ALTER TABLE public.tasks
ALTER COLUMN assigned_to DROP NOT NULL;

-- Estrutura escalável para múltiplos responsáveis por tarefa
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task assignees readable by authenticated"
ON public.task_assignees
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Task assignees managed by admins"
ON public.task_assignees
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::text, 'admin_alfa'::text]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::text, 'admin_alfa'::text]));

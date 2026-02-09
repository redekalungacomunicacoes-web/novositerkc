-- Adiciona coluna meta para armazenar campos extras do formulário de Projetos (sem mexer no layout)
-- Execute no Supabase Dashboard -> SQL Editor (PROD)

ALTER TABLE public.projetos
ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;

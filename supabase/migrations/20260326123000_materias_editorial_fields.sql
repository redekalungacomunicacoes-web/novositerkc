-- Campos editoriais para o novo fluxo de matérias em blocos
-- Compatível com execução direta no SQL Editor do Supabase

alter table if exists public.materias
  add column if not exists content_blocks jsonb null,
  add column if not exists hashtags text[] null,
  add column if not exists audio_url text null;

comment on column public.materias.content_blocks is 'Estrutura de blocos do corpo da matéria (paragraph, heading, quote, highlight, image).';
comment on column public.materias.hashtags is 'Lista de hashtags normalizadas da matéria.';
comment on column public.materias.audio_url is 'URL pública do áudio da matéria.';

create table if not exists public.materia_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  slug text unique,
  created_at timestamptz not null default now()
);

insert into public.materia_categorias (nome, slug)
values
  ('Cultura', 'cultura'),
  ('Política', 'politica'),
  ('Educação', 'educacao'),
  ('Meio Ambiente', 'meio-ambiente'),
  ('Projetos', 'projetos'),
  ('Agenda', 'agenda')
on conflict (nome) do nothing;

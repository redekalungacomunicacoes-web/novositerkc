create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id) on delete cascade,
  image_path text not null,
  thumb_path text,
  caption text,
  order_index integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists project_images_project_id_idx
  on public.project_images(project_id);

create index if not exists project_images_project_id_order_idx
  on public.project_images(project_id, order_index);

alter table public.project_images enable row level security;

create policy if not exists "project_images_public_select"
  on public.project_images
  for select
  to anon, authenticated
  using (is_public = true);

create policy if not exists "project_images_admin_insert"
  on public.project_images
  for insert
  to authenticated
  with check (public.is_admin());

create policy if not exists "project_images_admin_update"
  on public.project_images
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy if not exists "project_images_admin_delete"
  on public.project_images
  for delete
  to authenticated
  using (public.is_admin());

alter table public.projetos enable row level security;
drop policy if exists projetos_select on public.projetos;
drop policy if exists projetos_insert on public.projetos;
drop policy if exists projetos_update on public.projetos;
drop policy if exists projetos_delete on public.projetos;

create policy projetos_select
on public.projetos
for select
to authenticated
using (true);

create policy projetos_insert
on public.projetos
for insert
to authenticated
with check (true);

create policy projetos_update
on public.projetos
for update
to authenticated
using (true)
with check (true);

create policy projetos_delete
on public.projetos
for delete
to authenticated
using (true);

alter table public.projeto_galeria enable row level security;
drop policy if exists projeto_galeria_select on public.projeto_galeria;
drop policy if exists projeto_galeria_insert on public.projeto_galeria;
drop policy if exists projeto_galeria_update on public.projeto_galeria;
drop policy if exists projeto_galeria_delete on public.projeto_galeria;

create policy projeto_galeria_select
on public.projeto_galeria
for select
to authenticated
using (true);

create policy projeto_galeria_insert
on public.projeto_galeria
for insert
to authenticated
with check (true);

create policy projeto_galeria_update
on public.projeto_galeria
for update
to authenticated
using (true)
with check (true);

create policy projeto_galeria_delete
on public.projeto_galeria
for delete
to authenticated
using (true);

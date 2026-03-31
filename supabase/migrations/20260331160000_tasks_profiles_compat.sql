-- Compatibilidade da tabela profiles para módulo de tarefas
-- Garante colunas esperadas pelo frontend e pelo schema de tasks

begin;

alter table if exists public.profiles
  add column if not exists id uuid,
  add column if not exists nome text,
  add column if not exists email text,
  add column if not exists ativo boolean not null default true;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_id'
  ) then
    execute $sql$
      update public.profiles
      set id = user_id
      where id is null
        and user_id is not null
    $sql$;
  end if;
end $$;

alter table if exists public.profiles
  alter column id set not null;

-- garante PK em id
alter table if exists public.profiles
  drop constraint if exists profiles_pkey;

alter table if exists public.profiles
  add constraint profiles_pkey primary key (id);

create unique index if not exists idx_profiles_email_unique on public.profiles (email);

commit;

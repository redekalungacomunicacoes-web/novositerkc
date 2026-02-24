-- Financeiro por projetos

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$ begin
  create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

create table if not exists public.finance_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  funder text,
  start_date date,
  end_date date,
  responsible text,
  initial_amount numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6B7280',
  created_at timestamptz not null default now()
);

create table if not exists public.finance_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6B7280',
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.finance_movement_type as enum ('entrada','saida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.finance_movement_status as enum ('pago','pendente','cancelado');
exception when duplicate_object then null; end $$;

create table if not exists public.finance_movements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.finance_projects(id) on delete cascade,
  date date not null,
  type public.finance_movement_type not null,
  description text not null,
  category_id uuid references public.finance_categories(id) on delete set null,
  unit_value numeric(14,2) not null default 0,
  quantity numeric(14,2) not null default 1,
  total_value numeric(14,2) not null default 0,
  status public.finance_movement_status not null default 'pendente',
  cost_center text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_movement_tags (
  movement_id uuid not null references public.finance_movements(id) on delete cascade,
  tag_id uuid not null references public.finance_tags(id) on delete cascade,
  primary key (movement_id, tag_id)
);

create table if not exists public.finance_attachments (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.finance_movements(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size bigint,
  storage_path text not null,
  public_url text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_fin_projects_updated on public.finance_projects;
create trigger trg_fin_projects_updated before update on public.finance_projects for each row execute function public.set_updated_at();

drop trigger if exists trg_fin_movements_updated on public.finance_movements;
create trigger trg_fin_movements_updated before update on public.finance_movements for each row execute function public.set_updated_at();

create or replace function public.finance_compute_total()
returns trigger language plpgsql as $$
begin
  new.total_value = coalesce(new.unit_value,0) * coalesce(new.quantity,0);
  return new;
end $$;

drop trigger if exists trg_fin_movements_total on public.finance_movements;
create trigger trg_fin_movements_total before insert or update of unit_value, quantity on public.finance_movements for each row execute function public.finance_compute_total();

create or replace function public.finance_recalc_project_balance(p_project_id uuid)
returns void language plpgsql as $$
declare
  v_initial numeric(14,2);
  v_in numeric(14,2);
  v_out numeric(14,2);
begin
  select initial_amount into v_initial from public.finance_projects where id = p_project_id;

  select
    coalesce(sum(case when type='entrada' then total_value else 0 end),0),
    coalesce(sum(case when type='saida' then total_value else 0 end),0)
  into v_in, v_out
  from public.finance_movements
  where project_id = p_project_id and status = 'pago';

  update public.finance_projects
  set current_balance = coalesce(v_initial,0) + v_in - v_out,
      updated_at = now()
  where id = p_project_id;
end $$;

create or replace function public.finance_on_movement_change()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    perform public.finance_recalc_project_balance(old.project_id);
    return old;
  else
    perform public.finance_recalc_project_balance(new.project_id);
    if (tg_op='UPDATE' and old.project_id is distinct from new.project_id) then
      perform public.finance_recalc_project_balance(old.project_id);
    end if;
    return new;
  end if;
end $$;

drop trigger if exists trg_fin_movements_balance on public.finance_movements;
create trigger trg_fin_movements_balance after insert or update or delete on public.finance_movements for each row execute function public.finance_on_movement_change();

alter table public.finance_projects enable row level security;
alter table public.finance_movements enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_tags enable row level security;
alter table public.finance_movement_tags enable row level security;
alter table public.finance_attachments enable row level security;

do $$ begin
  create policy "finance_admin_all_projects" on public.finance_projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_admin_all_movements" on public.finance_movements for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_admin_all_categories" on public.finance_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_admin_all_tags" on public.finance_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_admin_all_movement_tags" on public.finance_movement_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "finance_admin_all_attachments" on public.finance_attachments for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

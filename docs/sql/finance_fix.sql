-- Normalização automática de campos em finance_movements
create or replace function public.finance_movements_normalize_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status is not null then
    new.status := lower(new.status);
  end if;

  if new.type is not null then
    new.type := lower(new.type);
  end if;

  if new.pay_method is not null then
    new.pay_method := lower(replace(new.pay_method, 'ã', 'a'));
    if new.pay_method = 'transferência' then
      new.pay_method := 'transferencia';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_finance_movements_normalize_fields on public.finance_movements;
create trigger trg_finance_movements_normalize_fields
before insert or update on public.finance_movements
for each row
execute function public.finance_movements_normalize_fields();

-- View enriquecida com categoria e contagem de anexos
create or replace view public.v_finance_movements_enriched as
select
  m.*,
  c.name as category_name,
  p.name as project_name,
  f.name as fund_name,
  coalesce(a.attachments_count, 0)::int as attachments_count
from public.finance_movements m
left join public.finance_categories c on c.id = m.category_id
left join public.finance_projects p on p.id = m.project_id
left join public.finance_funds f on f.id = m.fund_id
left join (
  select movement_id, count(*) as attachments_count
  from public.finance_attachments
  group by movement_id
) a on a.movement_id = m.id;

-- Storage bucket policies (bucket privado finance-attachments)
-- Ajuste schema conforme seu projeto (storage.objects)
create policy if not exists "finance_attachments_authenticated_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'finance-attachments');

create policy if not exists "finance_attachments_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'finance-attachments');

create policy if not exists "finance_attachments_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'finance-attachments');

-- RLS opcional para tabelas financeiras
alter table if exists public.finance_movements enable row level security;
alter table if exists public.finance_attachments enable row level security;

create policy if not exists "finance_movements_authenticated_all"
on public.finance_movements
for all
to authenticated
using (true)
with check (true);

create policy if not exists "finance_attachments_authenticated_all"
on public.finance_attachments
for all
to authenticated
using (true)
with check (true);

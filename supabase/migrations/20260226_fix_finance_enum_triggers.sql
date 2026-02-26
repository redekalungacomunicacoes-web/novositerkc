-- Corrige funções de trigger que aplicam trim/lower diretamente em ENUM
-- (ex.: finance_movement_status), evitando erro:
-- function pg_catalog.btrim(finance_movement_status) does not exist

-- 1) Consulta de diagnóstico (para uso também no SQL Editor):
--    Lista triggers de finance_movements e definição das funções associadas.
-- select
--   t.tgname as trigger_name,
--   p.proname as function_name,
--   n.nspname as function_schema,
--   pg_get_function_identity_arguments(p.oid) as function_args,
--   pg_get_functiondef(p.oid) as function_def
-- from pg_trigger t
-- join pg_proc p on p.oid = t.tgfoid
-- join pg_namespace n on n.oid = p.pronamespace
-- where t.tgrelid = 'public.finance_movements'::regclass
--   and not t.tgisinternal;

-- 2) Patch automático das funções ligadas a triggers de finance_movements.
--    Substitui chamadas como btrim(status), trim(status), lower(status)
--    por versões com cast para texto.
do $$
declare
  fn record;
  fn_def text;
  patched_def text;
begin
  for fn in
    select distinct p.oid
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.finance_movements'::regclass
      and not t.tgisinternal
  loop
    fn_def := pg_get_functiondef(fn.oid);
    patched_def := fn_def;

    patched_def := regexp_replace(
      patched_def,
      '(?i)\\bbtrim\\s*\\(\\s*((new|old)\\.)?(status|type|entity_status)\\s*\\)',
      'btrim(\\1::text)',
      'g'
    );

    patched_def := regexp_replace(
      patched_def,
      '(?i)\\btrim\\s*\\(\\s*((new|old)\\.)?(status|type|entity_status)\\s*\\)',
      'trim(\\1::text)',
      'g'
    );

    patched_def := regexp_replace(
      patched_def,
      '(?i)\\blower\\s*\\(\\s*((new|old)\\.)?(status|type|entity_status)\\s*\\)',
      'lower(\\1::text)',
      'g'
    );

    if patched_def is distinct from fn_def then
      execute patched_def;
    end if;
  end loop;
end $$;

-- 3) Trigger explícita para total_value (mantém INSERT/UPDATE funcionando para ENUM).
--    Não aplica trim/lower em ENUM, preserva NEW.status já validado pelo tipo.
create or replace function public.finance_movements_prepare_row()
returns trigger
language plpgsql
as $$
begin
  new.quantity := coalesce(new.quantity, 1);
  new.unit_value := coalesce(new.unit_value, 0);
  new.total_value := coalesce(new.total_value, new.unit_value * new.quantity);
  return new;
end;
$$;

drop trigger if exists trg_fin_movements_prepare_row on public.finance_movements;
create trigger trg_fin_movements_prepare_row
before insert or update on public.finance_movements
for each row execute function public.finance_movements_prepare_row();

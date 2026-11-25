-- Exclusão visual segura de rascunhos vazios: histórico e Drive permanecem preservados.
-- Somente o criador ou um administrador financeiro pode descartar um rascunho
-- sem dados, comprovantes ou sincronização vinculada.
create or replace function public.discard_finance_accountability_draft(
  p_report_id uuid,
  p_expected_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  record_to_discard public.finance_accountability_reports%rowtype;
  is_administrator boolean;
begin
  if actor_id is null or not public.can_manage_finance_accountability() then
    raise exception 'Acesso financeiro necessário.' using errcode = '42501';
  end if;

  select * into record_to_discard
  from public.finance_accountability_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Prestação não encontrada.' using errcode = '22023';
  end if;

  if record_to_discard.updated_at is distinct from p_expected_updated_at then
    raise exception 'A prestação mudou. Recarregue antes de removê-la.' using errcode = '40001';
  end if;

  select exists (
    select 1 from public.user_roles ur
    join public.roles role on role.id = ur.role_id
    where ur.user_id = actor_id and role.name in ('admin', 'admin_alfa')
  ) into is_administrator;

  if record_to_discard.created_by is distinct from actor_id and not is_administrator then
    raise exception 'Somente o criador ou um administrador pode remover o rascunho.' using errcode = '42501';
  end if;

  if record_to_discard.status <> 'draft'
     or record_to_discard.delivered_at is not null
     or record_to_discard.public_enabled
     or record_to_discard.financial_data <> '{}'::jsonb
     or record_to_discard.narrative_data <> '{}'::jsonb
     or exists (select 1 from public.finance_accountability_documents d where d.report_id = p_report_id)
     or exists (select 1 from public.finance_accountability_sheet_sync s where s.report_id = p_report_id) then
    raise exception 'Só é possível remover rascunhos vazios, sem documentos ou planilhas vinculados.' using errcode = '22023';
  end if;

  -- Arquivamento lógico; o gatilho de histórico registra o evento.
  -- Não apaga documentos financeiros nem pastas privadas no Drive.
  update public.finance_accountability_reports
     set status = 'archived', updated_by = actor_id
   where id = p_report_id;

  return true;
end;
$$;

revoke all on function public.discard_finance_accountability_draft(uuid,timestamptz)
  from public, anon, authenticated;
grant execute on function public.discard_finance_accountability_draft(uuid,timestamptz)
  to authenticated;

comment on function public.discard_finance_accountability_draft(uuid,timestamptz) is
  'Arquiva apenas rascunhos vazios autorizados, sem apagar histórico ou arquivos do Drive.';

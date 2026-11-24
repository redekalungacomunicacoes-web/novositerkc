alter table public.finance_accountability_reports
  add column review_notes text,
  add column delivered_at timestamptz,
  add column delivered_by uuid references auth.users(id) on delete set null,
  add column delivery_reference text;

alter table public.finance_accountability_history
  drop constraint finance_accountability_history_action_check,
  add constraint finance_accountability_history_action_check
    check (action in ('created','updated','submitted_for_review','returned_for_revision','approved','delivered','published','unpublished','document_generated','archived'));

drop policy "finance_accountability_history_admin_insert" on public.finance_accountability_history;

create function public.guard_finance_accountability_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon', 'service_role') and (
      new.status <> 'draft' or new.review_notes is not null or new.delivered_at is not null
      or new.delivered_by is not null or new.delivery_reference is not null
      or new.public_enabled or new.public_slug is not null or new.published_at is not null
    ) then
      raise exception 'Uma prestação deve ser criada como rascunho privado.' using errcode = '42501';
    end if;

    if current_user = 'authenticated' then
      new.created_by := auth.uid();
      new.updated_by := auth.uid();
    end if;
    return new;
  end if;

  -- Even service-role edits may only change the report payload while it is a draft.
  if old.status <> 'draft' and (
    new.narrative_data is distinct from old.narrative_data
    or new.financial_data is distinct from old.financial_data
    or new.template_id is distinct from old.template_id
    or new.title is distinct from old.title
    or new.reference_code is distinct from old.reference_code
    or new.period_start is distinct from old.period_start
    or new.period_end is distinct from old.period_end
    or new.due_date is distinct from old.due_date
  ) then
    raise exception 'O preenchimento só pode ser alterado em rascunho.' using errcode = '42501';
  end if;

  if current_user in ('authenticated','anon','service_role') and (
    new.status is distinct from old.status
    or new.review_notes is distinct from old.review_notes
    or new.delivered_at is distinct from old.delivered_at
    or new.delivered_by is distinct from old.delivered_by
    or new.delivery_reference is distinct from old.delivery_reference
    or new.public_enabled is distinct from old.public_enabled
    or new.public_slug is distinct from old.public_slug
    or new.published_at is distinct from old.published_at
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by
    or (old.status <> 'draft' and (
      new.fund_id is distinct from old.fund_id or new.project_id is distinct from old.project_id
    ))
  ) then
    raise exception 'A alteração exige uma ação autorizada no fluxo de revisão.' using errcode = '42501';
  end if;

  if current_user = 'authenticated' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.guard_finance_accountability_workflow() from public;
create trigger guard_finance_accountability_workflow
before insert or update on public.finance_accountability_reports
for each row execute function public.guard_finance_accountability_workflow();

create or replace function public.record_finance_accountability_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_action text;
  event_summary text;
  previous_version jsonb;
begin
  if tg_op = 'INSERT' then
    event_action := 'created';
    event_summary := 'Prestação criada.';
  elsif new.delivered_at is distinct from old.delivered_at then
    event_action := 'delivered';
    event_summary := 'Entrega registrada.';
  elsif new.status is distinct from old.status then
    event_action := case new.status
      when 'in_review' then 'submitted_for_review'
      when 'draft' then 'returned_for_revision'
      else new.status end;
    event_summary := case new.status
      when 'in_review' then 'Prestação enviada para revisão.'
      when 'draft' then 'Prestação devolvida para ajustes.'
      when 'approved' then 'Prestação aprovada.'
      when 'archived' then 'Prestação arquivada.'
      else 'Situação atualizada.' end;
  elsif new.narrative_data is distinct from old.narrative_data
      or new.financial_data is distinct from old.financial_data then
    event_action := 'updated';
    event_summary := 'Atualização do preenchimento.';
  else
    return new;
  end if;

  if tg_op = 'UPDATE' then
    previous_version := jsonb_build_object(
      'status', old.status, 'financial_data', old.financial_data, 'narrative_data', old.narrative_data,
      'review_notes', old.review_notes, 'delivered_at', old.delivered_at, 'delivery_reference', old.delivery_reference
    );
  end if;

  insert into public.finance_accountability_history(report_id, action, actor_id, change_summary, snapshot)
  values (
    new.id, event_action, auth.uid(), event_summary,
    jsonb_build_object(
      'before', previous_version,
      'after', jsonb_build_object(
        'status', new.status, 'financial_data', new.financial_data, 'narrative_data', new.narrative_data,
        'review_notes', new.review_notes, 'delivered_at', new.delivered_at, 'delivery_reference', new.delivery_reference
      )
    )
  );
  return new;
end;
$$;

drop trigger record_finance_accountability_edit on public.finance_accountability_reports;
create trigger record_finance_accountability_edit
after insert or update on public.finance_accountability_reports
for each row execute function public.record_finance_accountability_edit();

drop policy "finance_accountability_documents_finance_insert" on public.finance_accountability_documents;
drop policy "finance_accountability_documents_finance_update" on public.finance_accountability_documents;

create function public.advance_finance_accountability_workflow(
  report_id uuid,
  expected_updated_at timestamptz,
  workflow_action text,
  notes text default null
)
returns table (status text, updated_at timestamptz, review_notes text, delivered_at timestamptz, delivery_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  is_admin boolean;
  current_report public.finance_accountability_reports%rowtype;
  next_status text;
  clean_notes text := nullif(btrim(notes), '');
  template_slug text;
begin
  if actor_id is null or not public.can_manage_finance_accountability() then
    raise exception 'Acesso financeiro necessário.' using errcode = '42501';
  end if;

  if workflow_action is null or workflow_action not in ('submit','return','approve','deliver','archive') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;

  if length(clean_notes) > 2000 then
    raise exception 'A observação deve ter até 2.000 caracteres.' using errcode = '22023';
  end if;

  if workflow_action in ('return','approve','archive') then
    select exists (
      select 1 from public.user_roles ur join public.roles role on role.id = ur.role_id
      where ur.user_id = actor_id and role.name in ('admin','admin_alfa')
    ) into is_admin;
    if not is_admin then
      raise exception 'Esta ação exige perfil de administração.' using errcode = '42501';
    end if;
  end if;

  select report.* into current_report
  from public.finance_accountability_reports report
  where report.id = report_id for update;

  if not found or current_report.updated_at is distinct from expected_updated_at then
    raise exception 'A prestação mudou. Recarregue antes de continuar.' using errcode = '40001';
  end if;

  if workflow_action = 'submit' and current_report.status = 'draft' then
    select template.slug into template_slug from public.finance_reporting_templates template where template.id = current_report.template_id;
    if template_slug = 'faj-ii-ciclo' and (
      jsonb_typeof(current_report.narrative_data #> '{institution,organization_name}') is distinct from 'string'
      or coalesce(current_report.narrative_data #>> '{institution,organization_name}', '') !~ '[^[:space:]]'
      or exists (
        select 1 from (values ('question_1'),('question_2'),('question_3'),('question_4')) q(key)
        where jsonb_typeof(current_report.narrative_data -> q.key) is distinct from 'string'
          or coalesce(current_report.narrative_data ->> q.key, '') !~ '[^[:space:]]'
      )
    ) then
      raise exception 'Salve a identificação e as quatro respostas narrativas antes de enviar para revisão.' using errcode = '22023';
    end if;
    next_status := 'in_review';
  elsif workflow_action = 'return' and current_report.status = 'in_review' then
    if clean_notes is null then
      raise exception 'Informe os ajustes pendentes.' using errcode = '22023';
    end if;
    next_status := 'draft';
  elsif workflow_action = 'approve' and current_report.status = 'in_review' then
    next_status := 'approved';
  elsif workflow_action = 'deliver' and current_report.status in ('approved','published') and current_report.delivered_at is null then
    next_status := current_report.status;
  elsif workflow_action = 'archive' and current_report.status in ('approved','published') and current_report.delivered_at is not null then
    next_status := 'archived';
  else
    raise exception 'Esta ação não está disponível na situação atual.' using errcode = '22023';
  end if;

  return query
  update public.finance_accountability_reports as report
  set status = next_status,
      review_notes = case when workflow_action = 'return' then clean_notes
        when workflow_action in ('submit','approve') then null else report.review_notes end,
      delivered_at = case when workflow_action = 'deliver' then clock_timestamp() else report.delivered_at end,
      delivered_by = case when workflow_action = 'deliver' then actor_id else report.delivered_by end,
      delivery_reference = case when workflow_action = 'deliver' then clean_notes else report.delivery_reference end,
      public_enabled = case when workflow_action = 'archive' then false else report.public_enabled end,
      updated_by = actor_id
  where report.id = report_id
  returning report.status, report.updated_at, report.review_notes, report.delivered_at, report.delivery_reference;
end;
$$;

revoke all on function public.advance_finance_accountability_workflow(uuid,timestamptz,text,text) from public;
grant execute on function public.advance_finance_accountability_workflow(uuid,timestamptz,text,text) to authenticated;

-- Keep saving and reading the next optimistic revision in one transaction.
create function public.save_finance_accountability_draft_revision(
  report_id uuid,
  expected_narrative jsonb,
  expected_financial jsonb,
  next_narrative jsonb,
  next_financial jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.save_finance_accountability_draft(report_id, expected_narrative, expected_financial, next_narrative, next_financial) then
    return null;
  end if;

  return (select report.updated_at from public.finance_accountability_reports report where report.id = report_id);
end;
$$;

revoke all on function public.save_finance_accountability_draft_revision(uuid,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_finance_accountability_draft_revision(uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;

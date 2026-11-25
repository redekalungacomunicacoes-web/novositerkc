-- The administrative public_enabled flag requires workflow status 'published'.
-- Keep transparency releases independent of financial approval and delivery.
create table public.finance_accountability_public_releases (
  report_id uuid primary key references public.finance_accountability_reports(id) on delete cascade,
  slug text not null unique check (length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  period_start date,
  period_end date,
  content jsonb not null,
  published_at timestamptz not null,
  enabled boolean not null default true
);

alter table public.finance_accountability_public_releases enable row level security;
revoke all on public.finance_accountability_public_releases from public, anon, authenticated;

create function public.get_finance_accountability_public_report(requested_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', release.title, 'period_start', release.period_start, 'period_end', release.period_end,
    'published_at', release.published_at, 'content', release.content
  )
  from public.finance_accountability_public_releases release
  join public.finance_accountability_reports report on report.id = release.report_id
  where release.slug = requested_slug and release.enabled and report.status <> 'archived';
$$;

revoke all on function public.get_finance_accountability_public_report(text) from public;
grant execute on function public.get_finance_accountability_public_report(text) to anon, authenticated;

create function public.get_finance_accountability_publication(target_report_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('slug', slug, 'enabled', enabled, 'published_at', published_at)
  from public.finance_accountability_public_releases
  where report_id = target_report_id and public.can_manage_finance_accountability();
$$;

revoke all on function public.get_finance_accountability_publication(uuid) from public;
grant execute on function public.get_finance_accountability_publication(uuid) to authenticated;

create function public.set_finance_accountability_publication(
  target_report_id uuid, expected_revision timestamptz, expected_publication timestamptz,
  requested_slug text, reviewed_content jsonb
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  report public.finance_accountability_reports%rowtype;
  release public.finance_accountability_public_releases%rowtype;
  public_content jsonb := '{}'::jsonb;
  section record;
  allowed_keys text[];
  row_data jsonb;
  projected_rows jsonb;
  projected_row jsonb;
begin
  if not public.can_manage_finance_accountability() then
    raise exception 'Acesso restrito ao módulo financeiro.' using errcode = '42501';
  end if;

  select * into strict report from public.finance_accountability_reports
    where id = target_report_id for update;
  select * into release from public.finance_accountability_public_releases where report_id = target_report_id;

  if release.published_at is distinct from expected_publication then
    raise exception 'A publicação mudou. Recarregue a prestação.';
  end if;

  if reviewed_content is null then
    if not coalesce(release.enabled, false) then return null; end if;
    update public.finance_accountability_public_releases
      set enabled = false, published_at = clock_timestamp()
      where report_id = target_report_id returning * into release;
  else
    if report.updated_at is distinct from expected_revision or report.status = 'archived' then
      raise exception 'A prestação mudou ou foi arquivada. Recarregue antes de publicar.';
    end if;
    if jsonb_typeof(reviewed_content) <> 'object' or reviewed_content = '{}'::jsonb
       or octet_length(reviewed_content::text) > 2000000 then
      raise exception 'Selecione conteúdo válido para publicação.';
    end if;
    for section in select * from jsonb_each(reviewed_content) loop
      allowed_keys := case section.key
        when 'overview' then array['total','faj','other','share']
        when 'budget' then array['label','total','faj','other']
        when 'team' then array['label','total','faj','other']
        when 'funding' then array['label','type','year','status','total']
        when 'plan' then array['label','activity','outcome','evidence','period','budgetLine']
        when 'institution' then array['label','body']
        when 'narrative' then array['label','body']
        when 'results' then array['label','body']
        when 'impact' then array['channel','label','prior','current','priorStart','priorEnd','currentStart','currentEnd','variation','notes']
        else null end;
      if allowed_keys is null or jsonb_typeof(section.value) <> 'array' then
        raise exception 'Seção pública inválida.';
      end if;
      if jsonb_array_length(section.value) = 0
         or (section.key in ('overview','team') and jsonb_array_length(section.value) > 1)
         or (section.key = 'narrative' and jsonb_array_length(section.value) <> 4) then
        raise exception 'Revise a estrutura e a integralidade da seção %.', section.key;
      end if;
      projected_rows := '[]'::jsonb;
      for row_data in select value from jsonb_array_elements(section.value) loop
        if jsonb_typeof(row_data) <> 'object' then raise exception 'Linha pública inválida.'; end if;
        select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into projected_row
          from jsonb_each(row_data)
          where key = any(allowed_keys)
            and case
              when key in ('total','faj','other','share','year') then jsonb_typeof(value) in ('number','null')
              when key in ('prior','current') then jsonb_typeof(value) in ('string','number','null')
              else jsonb_typeof(value) in ('string','null') end;
        if section.key = 'team' then
          projected_row := (projected_row - 'label') || '{"label":"Equipe e estrutura"}'::jsonb;
        end if;
        projected_rows := projected_rows || jsonb_build_array(projected_row);
      end loop;
      public_content := public_content || jsonb_build_object(section.key, projected_rows);
    end loop;
    if (public_content::text || report.title) ~* '([[:alnum:]_.%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|(drive|docs)\.google\.com|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})' then
      raise exception 'O conteúdo inclui e-mail, CPF ou link de documentos. Revise a seção antes de publicar.';
    end if;

    insert into public.finance_accountability_public_releases
      (report_id, slug, title, period_start, period_end, content, published_at)
      values (report.id, requested_slug, report.title, report.period_start, report.period_end, public_content, clock_timestamp())
      on conflict (report_id) do update set
        slug = excluded.slug, title = excluded.title, period_start = excluded.period_start,
        period_end = excluded.period_end, content = excluded.content, published_at = excluded.published_at, enabled = true
      returning * into release;
  end if;

  insert into public.finance_accountability_history (report_id, action, actor_id, change_summary, snapshot)
    values (report.id, case when release.enabled then 'published' else 'unpublished' end, auth.uid(),
      case when release.enabled then 'Versão de transparência publicada.' else 'Versão de transparência retirada.' end,
      jsonb_build_object('slug', release.slug, 'published_at', release.published_at, 'sections', (
        select jsonb_agg(key order by key) from jsonb_object_keys(release.content) as keys(key)
      )));
  return jsonb_build_object('slug', release.slug, 'enabled', release.enabled, 'published_at', release.published_at);
end;
$$;

revoke all on function public.set_finance_accountability_publication(uuid,timestamptz,timestamptz,text,jsonb) from public;
grant execute on function public.set_finance_accountability_publication(uuid,timestamptz,timestamptz,text,jsonb) to authenticated;

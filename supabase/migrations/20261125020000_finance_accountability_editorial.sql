-- Editorial files stay private until their path is present in an active reviewed release.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accountability-editorial', 'accountability-editorial', false, 8000000,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create function public.is_accountability_editorial_image_public(object_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.finance_accountability_public_releases release
    join public.finance_accountability_reports report on report.id = release.report_id
    where release.enabled and report.status <> 'archived'
      and release.content->'records' @> jsonb_build_array(jsonb_build_object('path', object_path))
  );
$$;

revoke all on function public.is_accountability_editorial_image_public(text) from public, anon, authenticated;
grant execute on function public.is_accountability_editorial_image_public(text) to anon, authenticated;

create policy "Read reviewed accountability images" on storage.objects for select to anon, authenticated
using (bucket_id = 'accountability-editorial' and public.is_accountability_editorial_image_public(name));

create policy "Review accountability images" on storage.objects for select to authenticated
using (bucket_id = 'accountability-editorial' and public.can_manage_finance_accountability());

create policy "Stage accountability images" on storage.objects for insert to authenticated
with check (bucket_id = 'accountability-editorial' and public.can_manage_finance_accountability()
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

create policy "Require review for anonymous accountability image reads" on storage.objects as restrictive for select to anon
using (bucket_id <> 'accountability-editorial' or public.is_accountability_editorial_image_public(name));

create policy "Limit authenticated accountability image reads" on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'accountability-editorial'
  or public.is_accountability_editorial_image_public(name)
  or public.can_manage_finance_accountability());

create policy "Prevent anonymous accountability image staging" on storage.objects as restrictive for insert to anon
with check (bucket_id <> 'accountability-editorial');

create policy "Require finance permissions for accountability image staging" on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'accountability-editorial' or (
  public.can_manage_finance_accountability()
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
));

create policy "Prevent replacing accountability images" on storage.objects as restrictive for update to anon, authenticated
using (bucket_id <> 'accountability-editorial')
with check (bucket_id <> 'accountability-editorial');

create policy "Prevent deleting accountability images from the client" on storage.objects as restrictive for delete to anon, authenticated
using (bucket_id <> 'accountability-editorial');

create or replace function public.set_finance_accountability_publication(
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
        when 'overview' then array['total','faj','other','share','reference','period','notes','fundingChanges','fundingRisks','organization','budgetCheck','fajCheck','teamCheck','funders2025','funders2026','funders2027','fundingInstructions','teamInstructions','budgetInstructions','planInstructions']
        when 'budget' then array['label','description','total','faj','other','notes','cellComment','share']
        when 'team' then array['label','total','faj','other','count','roleComment','relationshipComment']
        when 'funding' then array['label','type','year','status','total','purpose','project','expectedDate','notes','purposeComment','projectComment']
        when 'plan' then array['label','activity','outcome','evidence','period','budgetLine','notes']
        when 'institution' then array['label','body']
        when 'narrative' then array['label','body','guidance']
        when 'records' then array['path','caption','alt','question','afterParagraph']
        when 'results' then array['label','body']
        when 'impact' then array['channel','label','prior','current','priorStart','priorEnd','currentStart','currentEnd','variation','notes']
        else null end;
      if allowed_keys is null or jsonb_typeof(section.value) <> 'array' then
        raise exception 'Seção pública inválida.';
      end if;
      if jsonb_array_length(section.value) = 0
         or (section.key in ('overview','team') and jsonb_array_length(section.value) > 1)
         or (section.key = 'narrative' and jsonb_array_length(section.value) <> 4)
         or (section.key = 'records' and jsonb_array_length(section.value) > 30) then
        raise exception 'Revise a estrutura e a integralidade da seção %.', section.key;
      end if;
      projected_rows := '[]'::jsonb;
      for row_data in select value from jsonb_array_elements(section.value) loop
        if jsonb_typeof(row_data) <> 'object' then raise exception 'Linha pública inválida.'; end if;
        select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into projected_row
          from jsonb_each(row_data)
          where key = any(allowed_keys)
            and case
              when key in ('total','faj','other','share','year','count','question','afterParagraph','budgetCheck','fajCheck','teamCheck','funders2025','funders2026','funders2027') then jsonb_typeof(value) in ('number','null')
              when key in ('prior','current','reference','expectedDate') then jsonb_typeof(value) in ('string','number','null')
              else jsonb_typeof(value) in ('string','null') end;
        if section.key = 'records' and (
          coalesce(projected_row->>'path', '') !~ ('^' || report.id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
          or nullif(btrim(projected_row->>'alt'), '') is null
          or nullif(btrim(projected_row->>'caption'), '') is null
          or coalesce(projected_row->>'question', '') !~ '^[1-4]$'
          or coalesce(projected_row->>'afterParagraph', '') !~ '^[0-9]{1,2}$'
          or not exists (select 1 from storage.objects where bucket_id = 'accountability-editorial' and name = projected_row->>'path')
        ) then
          raise exception 'Revise o arquivo, a legenda e a posição da imagem antes de publicar.';
        end if;
        if section.key = 'team' then
          projected_row := (projected_row - 'label') || '{"label":"Equipe e estrutura"}'::jsonb;
        end if;
        projected_rows := projected_rows || jsonb_build_array(projected_row);
      end loop;
      public_content := public_content || jsonb_build_object(section.key, projected_rows);
    end loop;
    if public_content ? 'records' and not public_content ? 'narrative' then
      raise exception 'Selecione o relatório narrativo para publicar seus registros.';
    end if;
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

revoke all on function public.set_finance_accountability_publication(uuid,timestamptz,timestamptz,text,jsonb) from public, anon, authenticated;
grant execute on function public.set_finance_accountability_publication(uuid,timestamptz,timestamptz,text,jsonb) to authenticated;

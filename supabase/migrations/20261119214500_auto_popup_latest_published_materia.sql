-- Automatically feature the newest article when it is first published.
-- The trigger runs inside the article transaction, so the previous homepage popup
-- is disabled and the new one is activated atomically.

create or replace function public.sync_latest_published_materia_popup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status is distinct from 'published' then
    return new;
  end if;

  -- Editing an article that was already published must not reactivate its popup.
  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  -- Serialize simultaneous publications to guarantee one active homepage popup.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('rkc:latest-published-materia-home-popup')
  );

  update public.site_popups
     set active = false,
         updated_at = pg_catalog.now()
   where target_path = '/'
     and active = true;

  insert into public.site_popups (
    title,
    eyebrow,
    description,
    image_url,
    youtube_url,
    cta_label,
    cta_url,
    active,
    target_path
  )
  values (
    coalesce(nullif(pg_catalog.btrim(new.titulo), ''), 'Nova matéria da RKC'),
    'Última matéria publicada',
    nullif(pg_catalog.btrim(new.resumo), ''),
    coalesce(
      nullif(new.capa_thumb_url, ''),
      nullif(new.capa_url, ''),
      nullif(new.banner_url, '')
    ),
    null,
    'Ler matéria',
    '/materias/' || coalesce(nullif(new.slug, ''), new.id::text),
    true,
    '/'
  );

  return new;
end;
$function$;

revoke all on function public.sync_latest_published_materia_popup() from public, anon, authenticated;

drop trigger if exists materias_latest_published_popup on public.materias;

create trigger materias_latest_published_popup
after insert or update of status on public.materias
for each row
execute function public.sync_latest_published_materia_popup();

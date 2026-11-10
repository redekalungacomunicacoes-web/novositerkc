create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.materias
  add column if not exists scheduled_at timestamptz;

create index if not exists materias_scheduled_publication_idx
  on public.materias (scheduled_at)
  where status = 'draft' and scheduled_at is not null;

select cron.schedule(
  'rkc-publish-scheduled-materias',
  '* * * * *',
  $job$
    update public.materias
       set status = 'published',
           published_at = scheduled_at,
           scheduled_at = null,
           updated_at = now()
     where status = 'draft'
       and scheduled_at is not null
       and scheduled_at <= now();
  $job$
);

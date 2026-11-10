-- Historical published_at values were stored at UTC midnight from a date-only
-- input. Move those values to noon in Brasília so date display is stable
-- when rendered in America/Sao_Paulo, without changing the calendar date.
update public.materias
   set published_at = (
     ((published_at at time zone 'UTC')::date + time '12:00')
     at time zone 'America/Sao_Paulo'
   )
 where published_at is not null
   and published_at = date_trunc('day', published_at at time zone 'UTC') at time zone 'UTC';

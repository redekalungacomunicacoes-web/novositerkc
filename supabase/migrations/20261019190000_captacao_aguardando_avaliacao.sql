-- Adds an explicit post-submission state without implying eligibility or award approval.
alter table public.captacao_editais
  drop constraint if exists captacao_editais_status_check;

alter table public.captacao_editais
  add constraint captacao_editais_status_check
  check (status in ('pending_confirmation','pending_eligibility','em_elaboracao','inscrito','aguardando_avaliacao','encerrado'));

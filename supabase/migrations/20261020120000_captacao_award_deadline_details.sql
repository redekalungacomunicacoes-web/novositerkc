-- Store optional closing time and award amount details for captação records.
-- All columns are nullable so existing opportunities and integrations remain compatible.
alter table public.captacao_editais
  add column if not exists deadline_time time without time zone,
  add column if not exists award_amount numeric(12,2),
  add column if not exists award_amount_note text;

comment on column public.captacao_editais.deadline_time is
  'Optional closing time for the registration deadline, as stated by the official opportunity.';
comment on column public.captacao_editais.award_amount is
  'Optional amount of the award or grant stated in the official opportunity.';
comment on column public.captacao_editais.award_amount_note is
  'Context for the amount, such as beneficiary category, gross/net basis, and source.';

-- Fill only missing values on the already-submitted KaluCast application.
update public.captacao_editais
set deadline = coalesce(deadline, date '2026-10-16'),
    deadline_time = coalesce(deadline_time, time '18:00'),
    award_amount = coalesce(award_amount, 15000.00),
    award_amount_note = coalesce(award_amount_note, 'Premiação bruta para grupos/coletivos; sujeita a impostos e tributos, conforme item 3(c) do edital.'),
    updated_at = now()
where protocol = 'RKC-CAP-2026-005'
  and status = 'aguardando_avaliacao';

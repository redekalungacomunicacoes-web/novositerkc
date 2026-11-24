alter table public.finance_accountability_reports
add column due_date date;

comment on column public.finance_accountability_reports.due_date is
  'Data de entrega informada para a prestação, independente do período financeiro.';

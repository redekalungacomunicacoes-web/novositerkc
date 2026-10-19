-- Add indexes to foreign-key columns used by edital, task, and attachment lookups.
create index if not exists captacao_anexos_edital_id_idx on public.captacao_anexos(edital_id);
create index if not exists captacao_anexos_uploaded_by_idx on public.captacao_anexos(uploaded_by);
create index if not exists captacao_editais_created_by_idx on public.captacao_editais(created_by);
create index if not exists captacao_editais_eligibility_reviewed_by_idx on public.captacao_editais(eligibility_reviewed_by);
create index if not exists captacao_editais_manager_approved_by_idx on public.captacao_editais(manager_approved_by);
create index if not exists captacao_requisitos_edital_id_idx on public.captacao_requisitos(edital_id);
create index if not exists captacao_requisitos_reviewed_by_idx on public.captacao_requisitos(reviewed_by);
create index if not exists captacao_tarefas_assignee_id_idx on public.captacao_tarefas(assignee_id);
create index if not exists captacao_tarefas_created_by_idx on public.captacao_tarefas(created_by);
create index if not exists captacao_tarefas_edital_id_idx on public.captacao_tarefas(edital_id);
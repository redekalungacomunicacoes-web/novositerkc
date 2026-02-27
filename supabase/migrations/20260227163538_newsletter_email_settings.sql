-- Cria tabela de configuração de email da newsletter
create table if not exists public.newsletter_email_settings (
  id uuid primary key default gen_random_uuid(),

  from_email text not null,
  from_name text not null,

  smtp_host text not null,
  smtp_port int not null default 587,
  smtp_user text not null,
  smtp_pass text not null,

  smtp_secure boolean default false,

  reply_to text,

  delay_ms int default 150,
  max_per_send int default 5000,

  provider text default 'smtp',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.newsletter_email_settings enable row level security;

-- ⚠️ Ajuste esta policy conforme suas regras de roles/claims.
-- Se você já usa uma tabela de roles e checagens no app, prefira
-- bloquear 100% via Edge Function (service role) e nunca expor smtp_pass no client.
create policy "Authenticated can read newsletter email settings"
on public.newsletter_email_settings
for select
to authenticated
using (true);

create policy "Authenticated can upsert newsletter email settings"
on public.newsletter_email_settings
for insert
to authenticated
with check (true);

create policy "Authenticated can update newsletter email settings"
on public.newsletter_email_settings
for update
to authenticated
using (true)
with check (true);

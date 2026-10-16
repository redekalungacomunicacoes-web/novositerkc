-- RKC YouTube authorization storage. Service-role access only.
create table if not exists public.rkc_youtube_oauth_states (
  state_hash text primary key,
  requested_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.rkc_youtube_connections (
  id text primary key default 'official',
  channel_id text not null,
  channel_title text not null,
  refresh_token_ciphertext text not null,
  granted_scopes text[] not null default '{}',
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rkc_youtube_oauth_states enable row level security;
alter table public.rkc_youtube_connections enable row level security;
revoke all on table public.rkc_youtube_oauth_states from anon, authenticated;
revoke all on table public.rkc_youtube_connections from anon, authenticated;
-- Edge Function uses a service-role client after verifying the authenticated user and RKC administrator role.

create table if not exists public.game_documents (
  id text primary key check (id in ('users', 'leaderboard')),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.game_documents enable row level security;

revoke all on table public.game_documents from anon, authenticated;
grant all on table public.game_documents to service_role;
create table if not exists public.liverpool_app_state (
  state_key text primary key check (state_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  state_value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists liverpool_app_state_updated_at_idx
  on public.liverpool_app_state (updated_at desc);

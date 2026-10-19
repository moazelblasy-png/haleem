begin;

create table if not exists public.liverpool_owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  phone text not null default '' check (char_length(phone) <= 30),
  business_name text not null default 'Liverpool Gaming' check (char_length(btrim(business_name)) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.liverpool_owner_profiles enable row level security;
revoke all on public.liverpool_owner_profiles from anon, authenticated;
grant all on public.liverpool_owner_profiles to service_role;

alter table public.liverpool_sync_receipts
  add column if not exists executed_at timestamptz;
alter table public.liverpool_sync_receipts
  add column if not exists result jsonb;

comment on table public.liverpool_owner_profiles is
  'Server-managed owner profile, independent of browser-local state. Access is through authenticated server routes.';
comment on column public.liverpool_sync_receipts.executed_at is
  'Set only when the requested offline action has been applied to operational state.';
comment on column public.liverpool_sync_receipts.result is
  'JSON result returned when an offline action was executed.';

commit;
